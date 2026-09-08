using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using HomestayAuth.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var workingDirectory = Directory.GetCurrentDirectory();
var envPath = Path.Combine(workingDirectory, ".env");
if (!File.Exists(envPath))
    envPath = Path.Combine(workingDirectory, "backend", ".env");
EnvLoader.Load(envPath);

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddSingleton<IEmailOtpSender, EmailOtpSender>();
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth-login", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});
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
            ValidateIssuer = false,
            ValidateAudience = false,
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
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(new { message = "Lỗi máy chủ." });
}));
app.UseCors("Frontend");
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
