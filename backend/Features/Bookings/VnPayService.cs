using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;

namespace HomestayAuth.Api.Features.Bookings;

public sealed class VnPayService
{
    private static readonly HttpClient QueryClient = new() { Timeout = TimeSpan.FromSeconds(12) };
    private readonly string _tmnCode = Environment.GetEnvironmentVariable("VNPAY_TMN_CODE") ?? "";
    private readonly string _hashSecret = Environment.GetEnvironmentVariable("VNPAY_HASH_SECRET") ?? "";
    private readonly string _paymentUrl = Environment.GetEnvironmentVariable("VNPAY_PAYMENT_URL") ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private readonly string _returnUrl = Environment.GetEnvironmentVariable("VNPAY_RETURN_URL") ?? "http://localhost:5000/api/bookings/vnpay-return";
    private readonly string _apiUrl = Environment.GetEnvironmentVariable("VNPAY_API_URL") ?? "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_tmnCode) && !string.IsNullOrWhiteSpace(_hashSecret);

    public string CreatePaymentUrl(string transactionCode, decimal amount, string orderInfo, string ipAddress, int expiryMinutes = 15)
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
            ["vnp_ExpireDate"] = now.AddMinutes(Math.Clamp(expiryMinutes, 5, 120)).ToString("yyyyMMddHHmmss")
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

    public async Task<VnPayQueryResult> QueryTransaction(string transactionCode, DateTime createdAtUtc, string ipAddress, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new InvalidOperationException("VNPAY chưa được cấu hình.");
        var zone = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "SE Asia Standard Time" : "Asia/Ho_Chi_Minh");
        var requestId = Guid.NewGuid().ToString("N");
        var transactionDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(createdAtUtc, DateTimeKind.Utc), zone).ToString("yyyyMMddHHmmss");
        var createDate = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone).ToString("yyyyMMddHHmmss");
        var orderInfo = $"Tra cuu giao dich {transactionCode}";
        var ip = string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress;
        var signature = Sign(string.Join('|', requestId, "2.1.0", "querydr", _tmnCode, transactionCode,
            transactionDate, createDate, ip, orderInfo));
        var payload = new Dictionary<string, string>
        {
            ["vnp_RequestId"] = requestId, ["vnp_Version"] = "2.1.0", ["vnp_Command"] = "querydr",
            ["vnp_TmnCode"] = _tmnCode, ["vnp_TxnRef"] = transactionCode,
            ["vnp_TransactionDate"] = transactionDate, ["vnp_CreateDate"] = createDate,
            ["vnp_IpAddr"] = ip, ["vnp_OrderInfo"] = orderInfo, ["vnp_SecureHash"] = signature
        };
        using var response = await QueryClient.PostAsJsonAsync(_apiUrl, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var root = json.RootElement;
        string Get(string name) => root.TryGetProperty(name, out var value) ? value.ToString() : "";
        var hash = Get("vnp_SecureHash");
        var expected = Sign(string.Join('|', new[] { "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message",
            "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo",
            "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount" }.Select(Get)));
        var valid = hash.Length == expected.Length && CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(hash.ToLowerInvariant()), Encoding.ASCII.GetBytes(expected));
        if (!valid || Get("vnp_TmnCode") != _tmnCode || Get("vnp_TxnRef") != transactionCode || Get("vnp_Command") != "querydr")
            throw new InvalidOperationException("Phản hồi đối soát VNPAY không hợp lệ.");
        if (!long.TryParse(Get("vnp_Amount"), out var amount)) amount = 0;
        return new VnPayQueryResult(Get("vnp_ResponseCode"), Get("vnp_TransactionStatus"), Get("vnp_TransactionType"), amount,
            Get("vnp_TransactionNo"), Get("vnp_BankCode"), Get("vnp_PayDate"));
    }

    private string Sign(string value)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(_hashSecret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }
}

public sealed record VnPayQueryResult(string ResponseCode, string TransactionStatus, string TransactionType, long Amount,
    string TransactionNo, string BankCode, string PayDate);
