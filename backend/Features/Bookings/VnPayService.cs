using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace HomestayAuth.Api.Features.Bookings;

public sealed class VnPayService
{
    private readonly string _tmnCode = Environment.GetEnvironmentVariable("VNPAY_TMN_CODE") ?? "";
    private readonly string _hashSecret = Environment.GetEnvironmentVariable("VNPAY_HASH_SECRET") ?? "";
    private readonly string _paymentUrl = Environment.GetEnvironmentVariable("VNPAY_PAYMENT_URL") ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private readonly string _returnUrl = Environment.GetEnvironmentVariable("VNPAY_RETURN_URL") ?? "http://localhost:5000/api/bookings/vnpay-return";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_tmnCode) && !string.IsNullOrWhiteSpace(_hashSecret);

    public string CreatePaymentUrl(string transactionCode, decimal amount, string orderInfo, string ipAddress)
    {
        if (!IsConfigured) throw new InvalidOperationException("VNPay chưa được cấu hình.");
        var vietnamTimeZone = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "SE Asia Standard Time" : "Asia/Ho_Chi_Minh");
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vietnamTimeZone);
        var values = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"] = "2.1.0", ["vnp_Command"] = "pay", ["vnp_TmnCode"] = _tmnCode,
            ["vnp_Amount"] = decimal.ToInt64(amount * 100).ToString(), ["vnp_CreateDate"] = now.ToString("yyyyMMddHHmmss"),
            ["vnp_CurrCode"] = "VND", ["vnp_IpAddr"] = string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress,
            ["vnp_Locale"] = "vn", ["vnp_OrderInfo"] = orderInfo, ["vnp_OrderType"] = "other",
            ["vnp_ReturnUrl"] = _returnUrl, ["vnp_TxnRef"] = transactionCode,
            ["vnp_ExpireDate"] = now.AddMinutes(15).ToString("yyyyMMddHHmmss")
        };
        var query = string.Join("&", values.Select(x => $"{WebUtility.UrlEncode(x.Key)}={WebUtility.UrlEncode(x.Value)}"));
        return $"{_paymentUrl}?{query}&vnp_SecureHash={Sign(query)}";
    }

    public bool Validate(IQueryCollection query)
    {
        var received = query["vnp_SecureHash"].ToString();
        var values = query.Where(x => x.Key.StartsWith("vnp_", StringComparison.Ordinal) && x.Key is not "vnp_SecureHash" and not "vnp_SecureHashType")
            .OrderBy(x => x.Key, StringComparer.Ordinal)
            .Select(x => $"{WebUtility.UrlEncode(x.Key)}={WebUtility.UrlEncode(x.Value.ToString())}");
        var expected = Sign(string.Join("&", values));
        var expectedBytes = Encoding.ASCII.GetBytes(expected.ToLowerInvariant());
        var receivedBytes = Encoding.ASCII.GetBytes(received.ToLowerInvariant());
        return expectedBytes.Length == receivedBytes.Length && CryptographicOperations.FixedTimeEquals(expectedBytes, receivedBytes);
    }

    private string Sign(string value)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(_hashSecret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }
}
