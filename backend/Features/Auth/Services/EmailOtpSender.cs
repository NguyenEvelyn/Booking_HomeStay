using System.Net;
using System.Net.Mail;

namespace HomestayAuth.Api.Features.Auth.Services;

public interface IEmailOtpSender
{
    bool IsConfigured { get; }
    Task SendAsync(string email, string fullName, string code);
    Task SendPasswordResetAsync(string email, string fullName, string code);
    // Plain-text transactional notice (booking reminders, no-show notices). No-op when SMTP is not configured.
    Task SendNotificationAsync(string email, string fullName, string subject, string body);
}

public sealed class EmailOtpSender : IEmailOtpSender
{
    private readonly string? host = Environment.GetEnvironmentVariable("SMTP_HOST");
    private readonly string? username = Environment.GetEnvironmentVariable("SMTP_USERNAME");
    private readonly string? password = Environment.GetEnvironmentVariable("SMTP_PASSWORD")?.Replace(" ", "");
    private readonly string? configuredFrom = Environment.GetEnvironmentVariable("SMTP_FROM");
    private readonly int port = int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out var value) ? value : 587;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(host) && !string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password);

    public Task SendAsync(string email, string fullName, string code) => Send(email,
        "Mã xác minh tài khoản Tripio",
        $"Xin chào {fullName},\n\nMã OTP xác minh tài khoản Tripio của bạn là: {code}\nMã có hiệu lực trong 10 phút.\n\nKhông chia sẻ mã này với bất kỳ ai.");

    public Task SendPasswordResetAsync(string email, string fullName, string code) => Send(email,
        "Mã đặt lại mật khẩu Tripio",
        $"Xin chào {fullName},\n\nMã OTP đặt lại mật khẩu Tripio của bạn là: {code}\nMã có hiệu lực trong 10 phút.\n\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.");

    public Task SendNotificationAsync(string email, string fullName, string subject, string body) =>
        Send(email, subject, $"Xin chào {fullName},\n\n{body}\n\nTrân trọng,\nTripio");

    private async Task Send(string email, string subject, string body)
    {
        if (!IsConfigured) return;
        var from = host!.Equals("smtp.gmail.com", StringComparison.OrdinalIgnoreCase)
            ? username!
            : string.IsNullOrWhiteSpace(configuredFrom) ? username! : configuredFrom;
        using var client = new SmtpClient(host!, port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(username, password)
        };
        using var message = new MailMessage(from, email) { Subject = subject, Body = body };
        await client.SendMailAsync(message);
    }
}
