using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using HomestayAuth.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;

var workingDirectory = Directory.GetCurrentDirectory();
var envPath = Path.Combine(workingDirectory, ".env");
if (!File.Exists(envPath))
    envPath = Path.Combine(workingDirectory, "backend", ".env");
EnvLoader.Load(envPath);

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

var dataProtectionKeysPath = Path.Combine(builder.Environment.ContentRootPath, ".data-protection-keys");
Directory.CreateDirectory(dataProtectionKeysPath);
builder.Services.AddDataProtection()
    .SetApplicationName("Tripio.Homestay")
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));

var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET");
if (string.IsNullOrWhiteSpace(jwtSecret))
    throw new InvalidOperationException("Thiếu biến môi trường JWT_SECRET");

// Cloud platforms map nested .NET configuration keys with double underscores.
// Prefer this single secret in production; the individual DB_* variables remain
// available so existing local development configuration keeps working.
var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Thiếu biến môi trường DATABASE_URL (chuỗi kết nối PostgreSQL/Neon).");
}

// Neon provides a postgres:// URI by default; Npgsql normally expects key/value pairs.
if (Uri.TryCreate(connectionString, UriKind.Absolute, out var databaseUri) &&
    (databaseUri.Scheme == "postgres" || databaseUri.Scheme == "postgresql"))
{
    var credentials = databaseUri.UserInfo.Split(':', 2);
    connectionString = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = databaseUri.Host,
        Port = databaseUri.IsDefaultPort ? 5432 : databaseUri.Port,
        Database = databaseUri.AbsolutePath.TrimStart('/'),
        Username = Uri.UnescapeDataString(credentials[0]),
        Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : "",
        SslMode = Npgsql.SslMode.Require,
        Pooling = true
    }.ConnectionString;
}

/*
 * The connection string is intentionally never logged: it contains credentials.
 * Configure it in the hosting platform's secret/environment-variable settings.
 */

builder.WebHost.UseUrls($"http://localhost:{Environment.GetEnvironmentVariable("PORT") ?? "5000"}");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IHomestayQueryService, HomestayQueryService>();
builder.Services.AddSingleton<HomestayAuth.Api.Features.Bookings.VnPayService>();
builder.Services.AddSingleton<IEmailOtpSender, EmailOtpSender>();
builder.Services.AddRateLimiter(options =>
{
    static RateLimitPartition<string> FixedWindow(HttpContext context, int limit, TimeSpan window) =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit,
                Window = window,
                QueueLimit = 0,
                AutoReplenishment = true
            });

    options.AddPolicy("auth-login", context => FixedWindow(context, 10, TimeSpan.FromMinutes(1)));
    options.AddPolicy("auth-register", context => FixedWindow(context, 5, TimeSpan.FromMinutes(10)));
    options.AddPolicy("auth-otp", context => FixedWindow(context, 10, TimeSpan.FromMinutes(1)));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Bạn thao tác quá nhanh. Vui lòng thử lại sau." }, cancellationToken);
    };
});
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "Tripio";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "Tripio.Web";
var authentication = builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddCookie("External", options =>
    {
        options.Cookie.Name = "homestay.external";
        options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies["token"];
                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var userIdValue = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var authVersionValue = context.Principal?.FindFirst("auth_version")?.Value;
                if (!long.TryParse(userIdValue, out var userId) || !int.TryParse(authVersionValue, out var authVersion))
                {
                    context.Fail("Phiên đăng nhập không hợp lệ.");
                    return;
                }

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var validSession = await db.Users.AsNoTracking().AnyAsync(user =>
                    user.Id == userId && user.Status == "Active" && user.AuthVersion == authVersion);
                if (!validSession) context.Fail("Phiên đăng nhập đã hết hiệu lực.");
            }
        };
    });

var googleClientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");
var googleClientSecret = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET");
if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
    authentication.AddGoogle("Google", options =>
    {
        options.ClientId = googleClientId;
        options.ClientSecret = googleClientSecret;
        options.SignInScheme = "External";
    });

var facebookAppId = Environment.GetEnvironmentVariable("FACEBOOK_APP_ID");
var facebookAppSecret = Environment.GetEnvironmentVariable("FACEBOOK_APP_SECRET");
if (!string.IsNullOrWhiteSpace(facebookAppId) && !string.IsNullOrWhiteSpace(facebookAppSecret))
    authentication.AddFacebook("Facebook", options =>
    {
        options.AppId = facebookAppId;
        options.AppSecret = facebookAppSecret;
        options.SignInScheme = "External";
        options.Scope.Add("email");
        options.Fields.Add("email");
    });
builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.WithOrigins(Environment.GetEnvironmentVariable("CLIENT_URL") ?? "http://localhost:5173")
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials()));

var app = builder.Build();

// Keep lightweight additive schema changes in sync for deployments that do not
// run EF migrations (for example the current Neon setup).
await using (var schemaScope = app.Services.CreateAsyncScope())
{
    var schemaDb = schemaScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await schemaDb.Database.ExecuteSqlRawAsync("""
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(1000);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255);
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL;
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS base_capacity INTEGER NOT NULL DEFAULT 2;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 2;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS extra_guest_allowed BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS extra_guest_fee NUMERIC(18,2) NOT NULL DEFAULT 0;
        UPDATE room_types SET base_capacity = LEAST(2, GREATEST(1, max_adults + max_children)),
          max_capacity = GREATEST(1, max_adults + max_children)
        WHERE base_capacity = 2 AND max_capacity = 2 AND max_adults + max_children <> 2;
        CREATE TABLE IF NOT EXISTS room_price_periods (
          price_period_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          room_type_id BIGINT NOT NULL REFERENCES room_types(room_type_id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          price_per_night NUMERIC(18,2) NOT NULL CHECK (price_per_night > 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK (end_date >= start_date)
        );
        CREATE INDEX IF NOT EXISTS ix_room_price_periods_room_dates
          ON room_price_periods(room_type_id,start_date,end_date);
        CREATE TABLE IF NOT EXISTS room_images (
          image_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          room_id BIGINT NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
          image_url VARCHAR(500) NOT NULL,
          caption VARCHAR(255),
          is_thumbnail BOOLEAN NOT NULL DEFAULT FALSE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_room_images_room ON room_images(room_id);
        """);
}

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(new { message = "Lỗi máy chủ." });
}));
app.UseCors("Frontend");
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/", () => Results.Ok(new
{
    name = "Homestay Auth API",
    status = "running",
    health = "/api/health",
    databaseHealth = "/api/health/database"
}));
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/health/database", async (AppDbContext db) =>
{
    if (!await db.Database.CanConnectAsync()) return Results.Problem("Không thể kết nối PostgreSQL.");
    _ = await db.Users.AsNoTracking().AnyAsync();
    return Results.Ok(new { status = "ok", database = "connected", schema = "ready" });
});
app.Run();
