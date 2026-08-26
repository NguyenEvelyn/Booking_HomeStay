using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using HomestayAuth.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var workingDirectory = Directory.GetCurrentDirectory();
var envPath = Path.Combine(workingDirectory, ".env");
if (!File.Exists(envPath))
    envPath = Path.Combine(workingDirectory, "backend", ".env");
EnvLoader.Load(envPath);

var builder = WebApplication.CreateBuilder(args);

var requiredVariables = new[] { "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET" };
foreach (var variable in requiredVariables)
{
    if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(variable)))
        throw new InvalidOperationException($"Thiếu biến môi trường {variable}");
}

var dbHost = Environment.GetEnvironmentVariable("DB_HOST");
var dbPort = Environment.GetEnvironmentVariable("DB_PORT") ?? "1433";
var dbName = Environment.GetEnvironmentVariable("DB_NAME");
var dbUser = Environment.GetEnvironmentVariable("DB_USER");
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");
var encrypt = Environment.GetEnvironmentVariable("DB_ENCRYPT") ?? "false";
var trustCertificate = Environment.GetEnvironmentVariable("DB_TRUST_SERVER_CERTIFICATE") ?? "true";
var connectionString = $"Server={dbHost},{dbPort};Database={dbName};User Id={dbUser};Password={dbPassword};Encrypt={encrypt};TrustServerCertificate={trustCertificate};";

builder.WebHost.UseUrls($"http://localhost:{Environment.GetEnvironmentVariable("PORT") ?? "5000"}");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("JWT_SECRET")!)),
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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.Run();
