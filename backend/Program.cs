using HomestayAuth.Api.Features.Auth.Services;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Features.Recommendations;
using HomestayAuth.Api.Features.DemandForecasting;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Infrastructure.Persistence;
using HomestayAuth.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
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

// Neon suspends idle compute and closes idle connections; without this the pool hands out dead sockets
// ("forcibly closed by the remote host" / read timeouts). No EF retry strategy: the booking flows use
// user-initiated transactions (advisory locks), which EnableRetryOnFailure does not allow.
var npgsqlSettings = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
npgsqlSettings.KeepAlive = npgsqlSettings.KeepAlive > 0 ? npgsqlSettings.KeepAlive : 30;
npgsqlSettings.ConnectionIdleLifetime = Math.Min(npgsqlSettings.ConnectionIdleLifetime, 60);
npgsqlSettings.Timeout = Math.Max(npgsqlSettings.Timeout, 15);
connectionString = npgsqlSettings.ConnectionString;

/*
 * The connection string is intentionally never logged: it contains credentials.
 * Configure it in the hosting platform's secret/environment-variable settings.
 */

builder.WebHost.UseUrls($"http://0.0.0.0:{Environment.GetEnvironmentVariable("PORT") ?? "5000"}");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IHomestayQueryService, HomestayQueryService>();
builder.Services.AddHttpClient<SupabaseStorageService>();
builder.Services.AddScoped<RecommendationService>();
builder.Services.AddScoped<DemandForecastService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Notifications.NotificationService>();
builder.Services.AddSingleton(new RecommendationWeightsProvider(builder.Environment.ContentRootPath));
builder.Services.AddHostedService<RecommendationEventRetentionService>();
builder.Services.AddSingleton<HomestayAuth.Api.Features.Bookings.VnPayService>();
builder.Services.AddHostedService<HomestayAuth.Api.Features.Bookings.ExpiredBookingWorker>();
builder.Services.AddHostedService<HomestayAuth.Api.Features.Bookings.OutboxWorker>();
builder.Services.AddSingleton<HomestayAuth.Api.Features.Bookings.IHomestayClock, HomestayAuth.Api.Features.Bookings.HomestayClock>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.RoomInventoryService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.PaymentService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.IdempotencyService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.BookingService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.AdditionalChargeService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.PolicyService>();
builder.Services.AddSingleton<HomestayAuth.Api.Features.Bookings.BookingPricingService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.VoucherService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.NoShowService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.DealService>();
builder.Services.AddScoped<HomestayAuth.Api.Features.Bookings.OccupancySuggestionService>();
builder.Services.AddHostedService<HomestayAuth.Api.Features.Bookings.NoShowReminderWorker>();
builder.Services.AddSingleton<IEmailOtpSender, EmailOtpSender>();
// Render (and similar hosts) terminate TLS at a proxy, so without this every request appears to come
// from the proxy IP over http: rate limits become global and OAuth builds http callback URLs.
// ForwardLimit = 1 only trusts the entry appended by the nearest proxy, which a client cannot spoof.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});
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
    options.AddPolicy("recommendation-events", context => FixedWindow(context, 60, TimeSpan.FromMinutes(1)));
    options.AddPolicy("booking-quote", context => FixedWindow(context, 60, TimeSpan.FromMinutes(1)));
    options.AddPolicy("newsletter", context => FixedWindow(context, 5, TimeSpan.FromMinutes(10)));
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
                // Safari/iOS can block the authentication cookie when the frontend
                // and API are hosted on different sites. Prefer an explicit Bearer
                // token in that case and keep the cookie as a backwards-compatible
                // fallback for same-site/local clients.
                if (!context.Request.Headers.ContainsKey("Authorization"))
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
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AdminPolicies.Access, policy => policy.RequireRole(AdminRoles.Admin, AdminRoles.Support));
    options.AddPolicy(AdminPolicies.FullAccess, policy => policy.RequireRole(AdminRoles.Admin));
});
builder.Services.AddControllers();
var configuredClientUrl = Environment.GetEnvironmentVariable("CLIENT_URL") ?? "http://localhost:5173";
var additionalClientUrls = (Environment.GetEnvironmentVariable("CLIENT_URLS") ?? string.Empty)
    .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
var allowedClientUrls = new HashSet<string>(additionalClientUrls, StringComparer.OrdinalIgnoreCase)
{
    configuredClientUrl.TrimEnd('/')
};
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
    policy.SetIsOriginAllowed(origin =>
    {
        var normalizedOrigin = origin.TrimEnd('/');
        if (allowedClientUrls.Contains(normalizedOrigin)) return true;
        // Capacitor serves the bundled app from these fixed origins on Android and iOS.
        if (normalizedOrigin is "https://localhost" or "capacitor://localhost") return true;
        // Any local port (Vite, LAN testing) is only trusted during development; in production a
        // credentialed request from an arbitrary local web server must not be accepted.
        if (builder.Environment.IsDevelopment() && Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            return uri.Host == "localhost" || uri.Host == "127.0.0.1" || IsPrivateLanAddress(uri.Host);
        }
        return false;
    })
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

// Keep lightweight additive schema changes in sync for deployments that do not
// run EF migrations (for example the current Neon setup).
if (!string.Equals(Environment.GetEnvironmentVariable("SKIP_SCHEMA_SYNC"), "true", StringComparison.OrdinalIgnoreCase))
{
    await using var schemaScope = app.Services.CreateAsyncScope();
    var schemaDb = schemaScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await schemaDb.Database.ExecuteSqlRawAsync("""
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(1000);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(255);
        DO $role$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'users'::regclass AND conname = 'users_role_check'
              AND pg_get_constraintdef(oid) NOT LIKE '%Support%'
          ) THEN
            ALTER TABLE users DROP CONSTRAINT users_role_check;
            ALTER TABLE users ADD CONSTRAINT users_role_check
              CHECK (role IN ('Admin','Support','Host','Customer'));
          END IF;
        END $role$;
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          actor_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          actor_role VARCHAR(20) NOT NULL,
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(60) NOT NULL,
          target_id VARCHAR(100) NOT NULL,
          before JSONB,
          after JSONB,
          reason VARCHAR(1000),
          ip INET,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_created ON audit_logs(actor_id,created_at DESC);
        CREATE INDEX IF NOT EXISTS ix_audit_logs_action_created ON audit_logs(action,created_at DESC);
        CREATE TABLE IF NOT EXISTS vouchers (
          voucher_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(150) NOT NULL,
          description VARCHAR(500),
          discount_type VARCHAR(20) NOT NULL CHECK(discount_type IN ('Percentage','FixedAmount')),
          discount_value NUMERIC(18,2) NOT NULL CHECK(discount_value > 0),
          maximum_discount NUMERIC(18,2),
          minimum_booking_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
          valid_from TIMESTAMPTZ NOT NULL,
          valid_until TIMESTAMPTZ NOT NULL,
          usage_limit INTEGER,
          usage_limit_per_customer INTEGER NOT NULL DEFAULT 1,
          homestay_id BIGINT REFERENCES homestays(homestay_id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'Active',
          created_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK(valid_until > valid_from)
        );
        CREATE TABLE IF NOT EXISTS voucher_usages (
          voucher_usage_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          voucher_id BIGINT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE RESTRICT,
          booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
          customer_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
          code_used VARCHAR(50) NOT NULL,
          discount_amount NUMERIC(18,2) NOT NULL,
          used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_vouchers_active_dates ON vouchers(status,valid_from,valid_until);
        CREATE INDEX IF NOT EXISTS ix_vouchers_homestay ON vouchers(homestay_id);
        CREATE INDEX IF NOT EXISTS ix_voucher_usages_voucher_customer ON voucher_usages(voucher_id,customer_id);
        ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS funded_by VARCHAR(20) NOT NULL DEFAULT 'Platform';
        ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE voucher_usages ADD COLUMN IF NOT EXISTS funded_by VARCHAR(20) NOT NULL DEFAULT 'Platform';
        CREATE TABLE IF NOT EXISTS host_registrations (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          phone_number VARCHAR(50),
          id_card_number VARCHAR(50),
          bank_name VARCHAR(100),
          bank_account_number VARCHAR(50),
          bank_account_name VARCHAR(100),
          homestay_data JSONB,
          status VARCHAR(30) NOT NULL DEFAULT 'Pending',
          rejection_reason VARCHAR(500),
          reviewed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_host_registrations_status ON host_registrations(status);
        CREATE INDEX IF NOT EXISTS ix_host_registrations_user_id ON host_registrations(user_id);
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS id_card_number VARCHAR(50);
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(100);
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS homestay_data JSONB;
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'Pending';
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL;
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE host_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
        CREATE INDEX IF NOT EXISTS ix_audit_logs_target_created ON audit_logs(target_type,target_id,created_at DESC);
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(80) PRIMARY KEY,
          value_json JSONB NOT NULL DEFAULT '{{}}'::jsonb,
          updated_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS homestay_services (
          service_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          homestay_id BIGINT NOT NULL REFERENCES homestays(homestay_id) ON DELETE CASCADE,
          name VARCHAR(150) NOT NULL, category VARCHAR(40) NOT NULL,
          description VARCHAR(500), unit VARCHAR(30) NOT NULL DEFAULT 'lần',
          price NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(price >= 0),
          is_active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(homestay_id,name)
        );
        CREATE TABLE IF NOT EXISTS guest_service_requests (
          request_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
          service_id BIGINT REFERENCES homestay_services(service_id) ON DELETE SET NULL,
          customer_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
          request_type VARCHAR(40) NOT NULL, title VARCHAR(150) NOT NULL,
          details_json JSONB NOT NULL DEFAULT '{{}}'::jsonb,
          quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0), requested_for TIMESTAMPTZ,
          estimated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
          approved_amount NUMERIC(18,2), status VARCHAR(30) NOT NULL DEFAULT 'Pending',
          host_response VARCHAR(1000), response_due_at TIMESTAMPTZ NOT NULL,
          responded_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK(status IN ('Pending','Approved','Rejected','ChangeProposed','InProgress','HostCompleted','Completed','Cancelled'))
        );
        CREATE INDEX IF NOT EXISTS ix_guest_service_requests_booking ON guest_service_requests(booking_id,created_at DESC);
        CREATE INDEX IF NOT EXISTS ix_guest_service_requests_status ON guest_service_requests(status,response_due_at);
        ALTER TABLE guest_service_requests ADD COLUMN IF NOT EXISTS reject_reason_code VARCHAR(40);
        ALTER TABLE guest_service_requests ADD COLUMN IF NOT EXISTS reject_reason_note VARCHAR(1000);
        INSERT INTO homestay_services(homestay_id,name,category,description,unit,price,sort_order)
        SELECT h.homestay_id, x.name, x.category, x.description, x.unit, x.price, x.sort_order
        FROM homestays h CROSS JOIN (VALUES
          ('Dọn phòng','Cleaning','Dọn phòng theo khung giờ khách chọn','lần',0::numeric,1),
          ('Thay khăn','Cleaning','Thay mới khăn tắm trong phòng','lần',0::numeric,2),
          ('Thay ga giường','Cleaning','Thay ga và vỏ gối mới','lần',0::numeric,3),
          ('Bổ sung nước uống','Amenity','Bổ sung nước uống cho phòng','lần',0::numeric,4),
          ('Bổ sung dụng cụ vệ sinh','Amenity','Bàn chải, kem đánh răng và đồ dùng cơ bản','bộ',0::numeric,5)
        ) AS x(name,category,description,unit,price,sort_order)
        ON CONFLICT(homestay_id,name) DO NOTHING;
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL;
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS ix_homestays_featured ON homestays(is_featured DESC, updated_at DESC) WHERE status = 'Approved';
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS base_capacity INTEGER NOT NULL DEFAULT 2;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 2;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS extra_guest_allowed BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS extra_guest_fee NUMERIC(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS extra_child_fee NUMERIC(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS child_max_age INTEGER NOT NULL DEFAULT 11;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_extra_children INTEGER NOT NULL DEFAULT 2;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tall_child_count INTEGER;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS small_child_count INTEGER;
        ALTER TABLE room_types ADD COLUMN IF NOT EXISTS deposit_percent NUMERIC(5,4) NOT NULL DEFAULT .30;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_status VARCHAR(30) NOT NULL DEFAULT 'Clean';
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_started_at TIMESTAMPTZ;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_completed_at TIMESTAMPTZ;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_checklist JSONB;
        UPDATE rooms SET cleaning_status = 'NeedCleaning' WHERE status = 'Cleaning' AND cleaning_status = 'Clean';
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS time_zone_id VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS cleaning_buffer_minutes INTEGER NOT NULL DEFAULT 120;
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS late_checkout_1_3h_fee NUMERIC(18,2) NOT NULL DEFAULT 200000;
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS late_checkout_4_6h_fee NUMERIC(18,2) NOT NULL DEFAULT 400000;
        ALTER TABLE homestays ADD COLUMN IF NOT EXISTS late_checkout_half_day_fee NUMERIC(18,2) NOT NULL DEFAULT 500000;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(18,2) NOT NULL DEFAULT 0;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'Unpaid';
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{{}}'::jsonb;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NOT NULL DEFAULT '{{}}'::jsonb;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review_create_until DATE;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review_edit_until DATE;
        UPDATE bookings
        SET review_create_until = check_out_date + 14
        WHERE review_create_until IS NULL;
        UPDATE bookings
        SET review_edit_until = check_out_date + 14
        WHERE review_edit_until IS NULL;
        ALTER TABLE bookings ALTER COLUMN review_create_until SET NOT NULL;
        ALTER TABLE bookings ALTER COLUMN review_edit_until SET NOT NULL;
        CREATE TABLE IF NOT EXISTS booking_guests (
          booking_guest_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          guest_type VARCHAR(20) NOT NULL CHECK (guest_type IN ('adult','child')),
          full_name VARCHAR(150) NOT NULL,
          birth_date DATE,
          gender VARCHAR(20) NOT NULL,
          nationality VARCHAR(80) NOT NULL,
          document_type VARCHAR(30) NOT NULL,
          document_number VARCHAR(50), address VARCHAR(500), accompanying_adult VARCHAR(150),
          declaration_deferred BOOLEAN NOT NULL DEFAULT FALSE,
          declaration_status VARCHAR(30) NOT NULL DEFAULT 'Completed' CHECK (declaration_status IN ('Completed','Deferred','Incomplete')),
          declaration_due_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_booking_guests_booking ON booking_guests(booking_id);
        CREATE UNIQUE INDEX IF NOT EXISTS ux_booking_guests_primary ON booking_guests(booking_id) WHERE is_primary;
        ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
        UPDATE bookings SET status='Hold' WHERE status='PendingPayment';
        UPDATE bookings SET status='CheckedOut' WHERE status='Completed';
        UPDATE bookings SET status='Confirmed' WHERE status='CancellationRequested';
        ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
          CHECK (status IN ('Hold','Confirmed','CheckedIn','CheckoutPendingPayment','CheckedOut','Cancelled','NoShow','Expired','PaymentFailed'));
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_transaction_type_check;
        UPDATE payments SET transaction_type='Deposit' WHERE transaction_type='Payment';
        ALTER TABLE payments ADD CONSTRAINT payments_transaction_type_check
          CHECK (transaction_type IN ('Deposit','FinalPayment','AdditionalPayment','Refund'));
        -- Refunds are queued as 'Original' (back to the original method) and staff-recorded payments default to 'Manual'.
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
        ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
          CHECK (payment_method IN ('Cash','BankTransfer','VNPay','MoMo','Original','Manual'));
        CREATE TABLE IF NOT EXISTS additional_charges (
          additional_charge_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
          type VARCHAR(40) NOT NULL, description VARCHAR(500) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
          unit_price NUMERIC(18,2) NOT NULL CHECK (unit_price >= 0),
          total_price NUMERIC(18,2) NOT NULL CHECK (total_price >= 0),
          is_paid BOOLEAN NOT NULL DEFAULT FALSE,
          status VARCHAR(40) NOT NULL DEFAULT 'Approved', evidence_json JSONB,
          reviewed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          review_reason VARCHAR(1000), reviewed_at TIMESTAMPTZ,
          recorded_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE additional_charges ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'Approved';
        ALTER TABLE additional_charges ADD COLUMN IF NOT EXISTS evidence_json JSONB;
        ALTER TABLE additional_charges ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL;
        ALTER TABLE additional_charges ADD COLUMN IF NOT EXISTS review_reason VARCHAR(1000);
        ALTER TABLE additional_charges ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
        CREATE TABLE IF NOT EXISTS booking_room_stays (
          booking_room_stay_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
          room_id BIGINT NOT NULL REFERENCES rooms(room_id) ON DELETE RESTRICT,
          start_date DATE NOT NULL, end_date DATE NOT NULL,
          nightly_price NUMERIC(18,2) NOT NULL CHECK (nightly_price >= 0),
          status VARCHAR(20) NOT NULL DEFAULT 'Active'
            CHECK (status IN ('Active','Completed','Replaced','Cancelled')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK (end_date > start_date)
        );
        CREATE INDEX IF NOT EXISTS ix_booking_room_stays_schedule
          ON booking_room_stays(room_id,start_date,end_date) WHERE status='Active';
        CREATE TABLE IF NOT EXISTS booking_date_changes (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
          old_check_in_date DATE NOT NULL,
          old_check_out_date DATE NOT NULL,
          new_check_in_date DATE NOT NULL,
          new_check_out_date DATE NOT NULL,
          days_before_check_in INTEGER NOT NULL,
          date_change_fee NUMERIC(18,2) NOT NULL DEFAULT 0,
          price_difference NUMERIC(18,2) NOT NULL DEFAULT 0,
          total_amount_difference NUMERIC(18,2) NOT NULL DEFAULT 0,
          reason VARCHAR(500),
          changed_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS booking_extensions (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
          old_check_out_date DATE NOT NULL,
          new_check_out_date DATE NOT NULL,
          extended_nights INTEGER NOT NULL,
          total_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
          reason VARCHAR(500),
          extended_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS homestay_policies (
          policy_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          homestay_id BIGINT NOT NULL REFERENCES homestays(homestay_id) ON DELETE CASCADE,
          version INTEGER NOT NULL CHECK (version > 0),
          hold_minutes INTEGER NOT NULL CHECK (hold_minutes BETWEEN 5 AND 120),
          review_create_days INTEGER NOT NULL CHECK (review_create_days BETWEEN 1 AND 90),
          review_edit_days INTEGER NOT NULL CHECK (review_edit_days BETWEEN 0 AND 90),
          commission_rate NUMERIC(5,4) NOT NULL CHECK (commission_rate BETWEEN 0 AND 1),
          guest_downgrade_refund_mode VARCHAR(20) NOT NULL
            CHECK (guest_downgrade_refund_mode IN ('None','Full','Percent')),
          guest_downgrade_refund_percent NUMERIC(5,2) NOT NULL CHECK (guest_downgrade_refund_percent BETWEEN 0 AND 100),
          auto_approve_late_checkout BOOLEAN NOT NULL DEFAULT TRUE,
          effective_from TIMESTAMPTZ NOT NULL, effective_to TIMESTAMPTZ,
          status VARCHAR(20) NOT NULL CHECK (status IN ('Active','Retired')),
          created_by BIGINT NOT NULL REFERENCES users(user_id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(homestay_id,version), CHECK (effective_to IS NULL OR effective_to > effective_from)
        );
        ALTER TABLE homestay_policies ADD COLUMN IF NOT EXISTS operational_policy JSONB NOT NULL DEFAULT '{{}}'::jsonb;
        CREATE TABLE IF NOT EXISTS cancellation_policy_tiers (
          tier_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          policy_id BIGINT NOT NULL REFERENCES homestay_policies(policy_id) ON DELETE CASCADE,
          minimum_days INTEGER NOT NULL CHECK (minimum_days >= 0), maximum_days INTEGER,
          refund_percent NUMERIC(5,2) NOT NULL CHECK (refund_percent BETWEEN 0 AND 100),
          CHECK (maximum_days IS NULL OR maximum_days >= minimum_days)
        );
        CREATE TABLE IF NOT EXISTS late_checkout_fee_tiers (
          tier_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          policy_id BIGINT NOT NULL REFERENCES homestay_policies(policy_id) ON DELETE CASCADE,
          from_minutes INTEGER NOT NULL CHECK (from_minutes > 0), to_minutes INTEGER,
          calculation_type VARCHAR(20) NOT NULL CHECK (calculation_type IN ('Fixed','NightlyPercent')),
          value NUMERIC(18,4) NOT NULL CHECK (value >= 0),
          CHECK (to_minutes IS NULL OR to_minutes >= from_minutes)
        );
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
        CREATE TABLE IF NOT EXISTS recommendation_events (
          event_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          customer_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          session_id VARCHAR(100) NOT NULL,
          event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('search', 'view', 'booking')),
          homestay_id BIGINT REFERENCES homestays(homestay_id) ON DELETE SET NULL,
          query_data JSONB NOT NULL DEFAULT '{{}}'::jsonb,
          source VARCHAR(20) NOT NULL DEFAULT 'real' CHECK (source IN ('real', 'synthetic')),
          CHECK (event_type = 'search' OR homestay_id IS NOT NULL)
        );
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recommendation_session_id VARCHAR(100);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_note VARCHAR(1000);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_viewed_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_name VARCHAR(150);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_name_edit_count INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_updated_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expected_arrival_at TIMESTAMPTZ;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_arrival_note VARCHAR(500);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_reminder_sent_at TIMESTAMPTZ;
        CREATE TABLE IF NOT EXISTS booking_no_shows (
          booking_no_show_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
          marked_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
          marked_at TIMESTAMPTZ NOT NULL,
          contact_note VARCHAR(1000) NOT NULL,
          penalty VARCHAR(20) NOT NULL,
          paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
          retained_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
          refund_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
          dispute_status VARCHAR(20) CHECK (dispute_status IN ('Pending','Accepted','Rejected')),
          dispute_reason VARCHAR(1000),
          disputed_at TIMESTAMPTZ,
          resolved_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          resolved_at TIMESTAMPTZ,
          resolution_note VARCHAR(1000)
        );
        CREATE INDEX IF NOT EXISTS ix_booking_no_shows_dispute ON booking_no_shows(dispute_status, disputed_at);
        CREATE TABLE IF NOT EXISTS room_deals (
          room_deal_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          homestay_id BIGINT NOT NULL REFERENCES homestays(homestay_id) ON DELETE CASCADE,
          room_type_id BIGINT NOT NULL REFERENCES room_types(room_type_id) ON DELETE CASCADE,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
          rooms_limit INTEGER NOT NULL CHECK (rooms_limit > 0),
          sale_ends_at TIMESTAMPTZ NOT NULL,
          allow_voucher BOOLEAN NOT NULL DEFAULT FALSE,
          status VARCHAR(20) NOT NULL DEFAULT 'Active',
          source VARCHAR(20) NOT NULL DEFAULT 'Manual',
          source_booking_id BIGINT REFERENCES bookings(booking_id) ON DELETE SET NULL,
          created_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK (end_date > start_date)
        );
        CREATE INDEX IF NOT EXISTS ix_room_deals_active ON room_deals(status, sale_ends_at, room_type_id);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_deal_id BIGINT REFERENCES room_deals(room_deal_id) ON DELETE SET NULL;
        CREATE TABLE IF NOT EXISTS notifications (
          notification_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          type VARCHAR(60) NOT NULL,
          title VARCHAR(150) NOT NULL,
          body VARCHAR(500) NOT NULL,
          link_type VARCHAR(20),
          link_id BIGINT,
          link_extra VARCHAR(160),
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_notifications_user_unread ON notifications(user_id, read_at, created_at DESC);
        CREATE TABLE IF NOT EXISTS news_posts (
          post_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          slug VARCHAR(160) NOT NULL UNIQUE,
          title VARCHAR(150) NOT NULL,
          summary VARCHAR(300) NOT NULL,
          content TEXT NOT NULL,
          cover_image_url VARCHAR(500),
          category VARCHAR(20) NOT NULL DEFAULT 'CamNang' CHECK (category IN ('CamNang','DiemDen','UuDai','TinTripio')),
          status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published','Hidden')),
          is_featured BOOLEAN NOT NULL DEFAULT FALSE,
          published_at TIMESTAMPTZ,
          author_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          view_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_news_posts_live ON news_posts(status, published_at DESC);
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
          subscriber_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          email VARCHAR(254) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Unsubscribed')),
          source VARCHAR(20) NOT NULL DEFAULT 'home',
          unsubscribe_token VARCHAR(64) NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          unsubscribed_at TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS banners (
          banner_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          title VARCHAR(80) NOT NULL,
          subtitle VARCHAR(160),
          image_url VARCHAR(500) NOT NULL,
          placement VARCHAR(20) NOT NULL DEFAULT 'HomeHero' CHECK (placement IN ('HomeHero','HomeDeals')),
          target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('Deal','Homestay','Voucher','Search')),
          target_id BIGINT,
          target_query VARCHAR(100),
          starts_at TIMESTAMPTZ NOT NULL,
          ends_at TIMESTAMPTZ NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Pending','Active','Inactive','Rejected')),
          requested_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          review_note VARCHAR(500),
          created_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK (ends_at > starts_at)
        );
        CREATE INDEX IF NOT EXISTS ix_banners_live ON banners(status, placement, starts_at, ends_at);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10;
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS vnp_transaction_no VARCHAR(30);
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS response_code VARCHAR(10);
        ALTER TABLE payments ADD COLUMN IF NOT EXISTS bank_code VARCHAR(30);
        CREATE TABLE IF NOT EXISTS booking_conflict_events (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          customer_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
          room_type_id BIGINT NOT NULL REFERENCES room_types(room_type_id) ON DELETE RESTRICT,
          check_in_date DATE NOT NULL,
          check_out_date DATE NOT NULL,
          requested_quantity INTEGER NOT NULL,
          available_quantity INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_booking_conflict_events_created ON booking_conflict_events(created_at DESC);
        CREATE INDEX IF NOT EXISTS ix_booking_conflict_events_room_type ON booking_conflict_events(room_type_id,created_at DESC);
        ALTER TABLE reviews ADD COLUMN IF NOT EXISTS cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5);
        ALTER TABLE reviews ADD COLUMN IF NOT EXISTS location_rating INTEGER CHECK (location_rating BETWEEN 1 AND 5);
        ALTER TABLE reviews ADD COLUMN IF NOT EXISTS host_rating INTEGER CHECK (host_rating BETWEEN 1 AND 5);
        ALTER TABLE reviews ADD COLUMN IF NOT EXISTS value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5);
        CREATE TABLE IF NOT EXISTS review_reports (
          report_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          review_id BIGINT NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
          host_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          reason VARCHAR(30) NOT NULL CHECK (reason IN ('Spam','Abusive','FalseInformation','Other')),
          detail VARCHAR(500), status VARCHAR(20) NOT NULL DEFAULT 'Pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(review_id,host_id)
        );
        CREATE INDEX IF NOT EXISTS ix_review_reports_status ON review_reports(status,created_at DESC);
        CREATE TABLE IF NOT EXISTS host_customer_notes (
          note_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          host_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          customer_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          note VARCHAR(1000), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(host_id,customer_id)
        );
        CREATE INDEX IF NOT EXISTS ix_reviews_host_filters ON reviews(homestay_id,rating,status,created_at DESC);
        ALTER TABLE recommendation_events ADD COLUMN IF NOT EXISTS booking_id BIGINT REFERENCES bookings(booking_id) ON DELETE SET NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_recommendation_events_booking ON recommendation_events(booking_id) WHERE booking_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS ix_recommendation_events_customer_time ON recommendation_events(customer_id, occurred_at DESC);
        CREATE INDEX IF NOT EXISTS ix_recommendation_events_homestay_time ON recommendation_events(homestay_id, occurred_at DESC);
        CREATE INDEX IF NOT EXISTS ix_recommendation_events_source_time ON recommendation_events(source, occurred_at DESC);
        CREATE INDEX IF NOT EXISTS ix_recommendation_events_session_type_time ON recommendation_events(session_id, event_type, occurred_at DESC);
        """);
}

app.UseForwardedHeaders();
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var logger = context.RequestServices
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("GlobalExceptionHandler");

    logger.LogError(
        exception,
        "Unhandled exception while processing {Method} {Path}. TraceId: {TraceId}",
        context.Request.Method,
        context.Request.Path,
        context.TraceIdentifier);

    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(new
    {
        message = "Lỗi máy chủ.",
        traceId = context.TraceIdentifier
    });
}));
app.UseCors("Frontend");
// CSRF guard: the auth cookie is SameSite=None in production, so a foreign page could make the browser
// send it on a form POST. Cookie-authenticated writes must carry a custom header, which a cross-site
// form cannot set and which CORS only allows for trusted origins. Bearer-token requests are unaffected.
app.Use(async (context, next) =>
{
    var request = context.Request;
    var isWrite = !(HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method));
    if (isWrite && request.Cookies.ContainsKey("token") && !request.Headers.ContainsKey("Authorization")
        && !request.Headers.ContainsKey("X-Requested-With"))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { message = "Yêu cầu không hợp lệ (thiếu header chống CSRF)." });
        return;
    }
    await next();
});
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

// Private IPv4 ranges (10/8, 172.16/12, 192.168/16): a phone or emulator reaching the dev machine over Wi-Fi.
static bool IsPrivateLanAddress(string host)
{
    if (!System.Net.IPAddress.TryParse(host, out var address) || address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) return false;
    var b = address.GetAddressBytes();
    return b[0] == 10 || (b[0] == 172 && b[1] is >= 16 and <= 31) || (b[0] == 192 && b[1] == 168);
}
