using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Security.Claims;
using System.Text;
using System.Xml;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

[ApiController]
[Route("api/partner/revenue")]
[Authorize(Roles = "Host")]
public sealed class PartnerRevenueController(AppDbContext db) : ControllerBase
{
    private long HostId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private static readonly HashSet<string> RevenueStatuses = ["Confirmed", "CheckedIn", "Completed"];

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery(Name = "homestay_id")] long? homestayId, [FromQuery(Name = "payment_method")] string? paymentMethod,
        [FromQuery] string grain = "day")
    {
        var period = NormalizePeriod(from, to);
        if (period.Error is not null) return BadRequest(new { message = period.Error });
        if (homestayId.HasValue && !await db.Homestays.AnyAsync(x => x.Id == homestayId && x.HostId == HostId))
            return Forbid();

        var days = period.To.DayNumber - period.From.DayNumber + 1;
        var previousTo = period.From.AddDays(-1);
        var previousFrom = previousTo.AddDays(-(days - 1));
        var allFrom = previousFrom;
        var allTo = period.To;
        var allStartUtc = LocalToUtc(allFrom);
        var allEndUtc = LocalToUtc(allTo.AddDays(1));
        var bookings = await db.Bookings.AsNoTracking()
            .Where(x => x.Homestay.HostId == HostId && (!homestayId.HasValue || x.HomestayId == homestayId)
                && ((x.CheckInDate <= allTo && x.CheckOutDate >= allFrom) || x.Payments.Any(p => p.PaidAt >= allStartUtc && p.PaidAt < allEndUtc)))
            .Include(x => x.Payments).Include(x => x.Details).ToListAsync();
        var homestays = await db.Homestays.AsNoTracking().Where(x => x.HostId == HostId && (!homestayId.HasValue || x.Id == homestayId))
            .Select(x => new { x.Id, x.Name, x.Status }).ToListAsync();
        var roomCounts = await db.Rooms.AsNoTracking().Where(x => x.RoomType.Homestay.HostId == HostId && (!homestayId.HasValue || x.RoomType.HomestayId == homestayId))
            .GroupBy(x => x.RoomType.HomestayId).Select(g => new { HomestayId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.HomestayId, x => x.Count);

        var current = Metrics(bookings, period.From, period.To, paymentMethod, homestays.Select(x => x.Id).ToHashSet(), roomCounts);
        var previous = Metrics(bookings, previousFrom, previousTo, paymentMethod, homestays.Select(x => x.Id).ToHashSet(), roomCounts);
        var statusRows = bookings.Where(x => x.CheckInDate <= period.To && x.CheckOutDate >= period.From).GroupBy(x => x.Status)
            .Select(g => new { status = g.Key, count = g.Count() }).ToList();
        var statusTotal = statusRows.Sum(x => x.count);

        var ranking = homestays.Select(h =>
        {
            var rows = current.Bookings.Where(x => x.HomestayId == h.Id).ToList();
            var revenue = rows.Sum(x => NetPaid(x, paymentMethod, period.From, period.To));
            var sold = rows.Sum(x => OverlapNights(x, period.From, period.To) * Math.Max(1, x.Details.Sum(d => d.Quantity)));
            var capacity = Math.Max(0, roomCounts.GetValueOrDefault(h.Id) * days);
            var rooms = rows.SelectMany(b => b.Details).GroupBy(d => d.RoomId?.ToString() ?? $"type-{d.RoomTypeId}")
                .Select(g => new { room = g.First().RoomId.HasValue ? $"Phòng #{g.First().RoomId}" : $"Loại phòng #{g.First().RoomTypeId}", revenue = g.Sum(d => d.LineTotal), bookings = g.Select(d => d.BookingId).Distinct().Count() })
                .OrderByDescending(x => x.revenue).ToList();
            return new { id = h.Id, name = h.Name, revenue = Round(revenue), bookings = rows.Count, occupancyRate = Rate(sold, capacity), adr = sold == 0 ? 0 : Round(rows.Sum(x => x.RoomAmount) / sold), rooms };
        }).OrderByDescending(x => x.revenue).ToList();
        var rankingTotal = ranking.Sum(x => x.revenue);
        var rankingMax = ranking.Select(x => x.revenue).DefaultIfEmpty(0).Max();

        var series = Series(current.Bookings, period.From, period.To, grain, paymentMethod);
        var response = new
        {
            period = new { from = period.From, to = period.To, previousFrom, previousTo },
            kpis = new
            {
                confirmedRevenue = Kpi(current.Revenue, previous.Revenue),
                revenueBookings = Kpi(current.Bookings.Count, previous.Bookings.Count),
                averageValue = Kpi(current.Bookings.Count == 0 ? 0 : Round(current.Revenue / current.Bookings.Count), previous.Bookings.Count == 0 ? 0 : Round(previous.Revenue / previous.Bookings.Count)),
                activeHomestays = Kpi(homestays.Count(x => x.Status == "Approved"), homestays.Count(x => x.Status == "Approved")),
                expectedRevenue = Kpi(current.Expected, previous.Expected),
                depositCollected = Kpi(current.DepositCollected, previous.DepositCollected),
                depositOutstanding = Kpi(current.Outstanding, previous.Outstanding),
                refunds = Kpi(current.Refunds, previous.Refunds),
                netRevenue = Kpi(current.NetRevenue, previous.NetRevenue)
            },
            timeseries = series,
            occupancyMetrics = new { occupancyRate = current.Occupancy, adr = current.Adr, revpar = current.RevPar, averageLos = current.AverageLos, averageLeadTime = current.AverageLead },
            homestayRanking = ranking.Select(x => new { x.id, x.name, x.revenue, x.bookings, x.occupancyRate, x.adr, contribution = Rate(x.revenue, rankingTotal), relative = Rate(x.revenue, rankingMax), x.rooms }),
            statusBreakdown = statusRows.Select(x => new { x.status, x.count, percentage = Rate(x.count, statusTotal) }),
            cancellationRate = Rate(statusRows.Where(x => x.status == "Cancelled").Sum(x => x.count), statusTotal),
            completionRate = Rate(statusRows.Where(x => x.status == "Completed").Sum(x => x.count), statusTotal)
        };
        return Ok(response);
    }

    [HttpGet("transactions")]
    public async Task<IActionResult> Transactions([FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery(Name = "homestay_id")] long? homestayId, [FromQuery(Name = "payment_method")] string? paymentMethod,
        [FromQuery] int page = 1, [FromQuery(Name = "page_size")] int pageSize = 10, [FromQuery] string? q = null, [FromQuery] string sort = "date_desc")
    {
        var period = NormalizePeriod(from, to);
        if (period.Error is not null) return BadRequest(new { message = period.Error });
        page = Math.Max(1, page); pageSize = new[] { 10, 20, 50 }.Contains(pageSize) ? pageSize : 10;
        var startUtc = LocalToUtc(period.From);
        var endUtc = LocalToUtc(period.To.AddDays(1));
        var query = db.Payments.AsNoTracking().Where(x => x.Booking.Homestay.HostId == HostId && x.Status == "Success" && x.PaidAt >= startUtc && x.PaidAt < endUtc
            && (!homestayId.HasValue || x.Booking.HomestayId == homestayId) && (string.IsNullOrEmpty(paymentMethod) || paymentMethod == "all" || x.TransactionType == paymentMethod));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(x => x.Booking.BookingCode.ToLower().Contains(term) || (x.Booking.ContactName ?? x.Booking.GuestName ?? "").ToLower().Contains(term));
        }
        query = sort switch { "amount_asc" => query.OrderBy(x => x.Amount), "amount_desc" => query.OrderByDescending(x => x.Amount), "date_asc" => query.OrderBy(x => x.PaidAt), _ => query.OrderByDescending(x => x.PaidAt) };
        var total = await query.CountAsync();
        var totals = await query.GroupBy(_ => 1).Select(g => new { amount = g.Sum(x => x.TransactionType == "Refund" ? -x.Amount : x.Amount), fees = g.Where(x => x.TransactionType != "Refund").Sum(x => x.Amount * x.Booking.CommissionRate) }).FirstOrDefaultAsync();
        var rows = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(x => new
        {
            x.Id, x.Booking.BookingCode, customer = x.Booking.ContactName ?? x.Booking.GuestName ?? "Khách lưu trú", homestay = x.Booking.Homestay.Name,
            room = x.Booking.Details.Select(d => d.RoomId.HasValue ? "#" + d.RoomId : "Loại #" + d.RoomTypeId).FirstOrDefault(),
            paidAt = x.PaidAt, method = x.PaymentMethod, amount = x.TransactionType == "Refund" ? -x.Amount : x.Amount,
            platformFee = x.TransactionType == "Refund" ? 0 : decimal.Round(x.Amount * x.Booking.CommissionRate, 0),
            netAmount = x.TransactionType == "Refund" ? -x.Amount : decimal.Round(x.Amount * (1 - x.Booking.CommissionRate), 0),
            status = x.TransactionType == "Refund" ? "Refunded" : x.Booking.PaymentStatus
        }).ToListAsync();
        return Ok(new { items = rows, page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize), totals = new { amount = totals?.amount ?? 0, fees = totals?.fees ?? 0, netAmount = (totals?.amount ?? 0) - (totals?.fees ?? 0) } });
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string format = "csv", [FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null,
        [FromQuery(Name = "homestay_id")] long? homestayId = null, [FromQuery(Name = "payment_method")] string? paymentMethod = null)
    {
        var period = NormalizePeriod(from, to);
        if (period.Error is not null) return BadRequest(new { message = period.Error });
        var startUtc = LocalToUtc(period.From); var endUtc = LocalToUtc(period.To.AddDays(1));
        var items = await db.Payments.AsNoTracking().Where(x => x.Booking.Homestay.HostId == HostId && x.Status == "Success" && x.PaidAt >= startUtc && x.PaidAt < endUtc
            && (!homestayId.HasValue || x.Booking.HomestayId == homestayId) && (string.IsNullOrEmpty(paymentMethod) || paymentMethod == "all" || x.TransactionType == paymentMethod))
            .OrderByDescending(x => x.PaidAt).Select(x => new { x.Booking.BookingCode, customer = x.Booking.ContactName ?? x.Booking.GuestName ?? "Khách lưu trú", x.Booking.Homestay.Name, x.PaidAt, x.PaymentMethod, x.Amount, x.TransactionType, x.Booking.CommissionRate }).ToListAsync();
        static string Csv(object? value) => $"\"{Convert.ToString(value, CultureInfo.InvariantCulture)?.Replace("\"", "\"\"")}\"";
        var csv = new StringBuilder("Mã đơn,Khách,Homestay,Ngày thanh toán,Phương thức,Số tiền,Phí nền tảng,Thực nhận,Trạng thái\r\n");
        foreach (var x in items)
        {
            var amount = x.TransactionType == "Refund" ? -x.Amount : x.Amount; var fee = x.TransactionType == "Refund" ? 0 : decimal.Round(x.Amount * x.CommissionRate, 0);
            csv.AppendLine(string.Join(',', Csv(x.BookingCode), Csv(x.customer), Csv(x.Name), Csv(x.PaidAt?.AddHours(7).ToString("dd/MM/yyyy HH:mm")), Csv(x.PaymentMethod), amount, fee, amount - fee, Csv(x.TransactionType == "Refund" ? "Đã hoàn" : "Đã thanh toán")));
        }
        var name = $"bao-cao-doanh-thu_{period.From:yyyy-MM-dd}_{period.To:yyyy-MM-dd}";
        if (format.Equals("xlsx", StringComparison.OrdinalIgnoreCase))
            return File(BuildXlsx(csv.ToString()), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{name}.xlsx");
        if (format.Equals("pdf", StringComparison.OrdinalIgnoreCase))
            return File(BuildPdf(items.Select(x => $"{x.BookingCode} | {x.Name} | {x.Amount:N0} VND").ToList(), period.From, period.To), "application/pdf", $"{name}.pdf");
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        return File(bytes, "text/csv", $"{name}.csv");
    }

    private static (DateOnly From, DateOnly To, string? Error) NormalizePeriod(DateOnly? from, DateOnly? to)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var start = from ?? new DateOnly(today.Year, today.Month, 1); var end = to ?? today;
        if (end < start) return (start, end, "Ngày kết thúc phải sau ngày bắt đầu.");
        if (end.DayNumber - start.DayNumber > 731) return (start, end, "Khoảng báo cáo tối đa là 2 năm.");
        return (start, end, null);
    }
    private static DateTime LocalToUtc(DateOnly value) => DateTime.SpecifyKind(value.ToDateTime(TimeOnly.MinValue).AddHours(-7), DateTimeKind.Utc);
    private static decimal Round(decimal value) => decimal.Round(value, 0, MidpointRounding.AwayFromZero);
    private static decimal Rate(decimal value, decimal total) => total <= 0 ? 0 : decimal.Round(value * 100m / total, 1);
    private static int OverlapNights(Booking x, DateOnly from, DateOnly to) => Math.Max(0, Math.Min(x.CheckOutDate.DayNumber, to.AddDays(1).DayNumber) - Math.Max(x.CheckInDate.DayNumber, from.DayNumber));
    private static decimal GrossPaid(Booking x, string? method) => x.Payments.Where(p => p.Status == "Success" && p.TransactionType != "Refund" && (string.IsNullOrEmpty(method) || method == "all" || p.TransactionType == method)).Sum(p => p.Amount);
    private static decimal Refunds(Booking x, string? method) => x.Payments.Where(p => p.Status == "Success" && p.TransactionType == "Refund" && (string.IsNullOrEmpty(method) || method == "all" || p.TransactionType == method)).Sum(p => p.Amount);
    private static decimal NetPaid(Booking x, string? method) => GrossPaid(x, method) - Refunds(x, method);
    private static bool InPeriod(Payment payment, DateOnly from, DateOnly to) => payment.PaidAt.HasValue && DateOnly.FromDateTime(payment.PaidAt.Value.AddHours(7)) >= from && DateOnly.FromDateTime(payment.PaidAt.Value.AddHours(7)) <= to;
    private static decimal GrossPaid(Booking x, string? method, DateOnly from, DateOnly to) => x.Payments.Where(p => InPeriod(p, from, to) && p.Status == "Success" && p.TransactionType != "Refund" && (string.IsNullOrEmpty(method) || method == "all" || p.TransactionType == method)).Sum(p => p.Amount);
    private static decimal Refunds(Booking x, string? method, DateOnly from, DateOnly to) => x.Payments.Where(p => InPeriod(p, from, to) && p.Status == "Success" && p.TransactionType == "Refund" && (string.IsNullOrEmpty(method) || method == "all" || p.TransactionType == method)).Sum(p => p.Amount);
    private static decimal NetPaid(Booking x, string? method, DateOnly from, DateOnly to) => GrossPaid(x, method, from, to) - Refunds(x, method, from, to);
    private static object Kpi(decimal value, decimal previous) => new { value = Round(value), previous = Round(previous), change = previous == 0 ? (decimal?)null : decimal.Round((value - previous) * 100 / Math.Abs(previous), 1), isNew = previous == 0 && value > 0 };

    private sealed record MetricResult(List<Booking> Bookings, decimal Revenue, decimal Expected, decimal DepositCollected, decimal Outstanding, decimal Refunds, decimal NetRevenue, decimal Occupancy, decimal Adr, decimal RevPar, decimal AverageLos, decimal AverageLead);
    private static MetricResult Metrics(List<Booking> all, DateOnly from, DateOnly to, string? method, HashSet<long> homestayIds, Dictionary<long, int> rooms)
    {
        var rows = all.Where(x => RevenueStatuses.Contains(x.Status) && ((x.CheckInDate <= to && x.CheckOutDate >= from) || x.Payments.Any(p => InPeriod(p, from, to)))).ToList();
        var stayRows = rows.Where(x => x.CheckInDate <= to && x.CheckOutDate >= from).ToList();
        var revenue = rows.Sum(x => NetPaid(x, method, from, to)); var refunds = rows.Sum(x => Refunds(x, method, from, to));
        var expected = rows.Where(x => x.Status is "Confirmed" or "CheckedIn").Sum(x => Math.Max(0, x.TotalAmount - GrossPaid(x, method)));
        var deposit = rows.Sum(x => Math.Min(GrossPaid(x, method), x.DepositAmount));
        var outstanding = rows.Sum(x => Math.Max(0, x.TotalAmount - GrossPaid(x, method)));
        var sold = stayRows.Sum(x => OverlapNights(x, from, to) * Math.Max(1, x.Details.Sum(d => d.Quantity)));
        var capacity = homestayIds.Sum(id => rooms.GetValueOrDefault(id)) * (to.DayNumber - from.DayNumber + 1);
        var roomRevenue = stayRows.Sum(x => x.RoomAmount);
        return new(rows, Round(revenue), Round(expected), Round(deposit), Round(outstanding), Round(refunds), Round(revenue - rows.Sum(x => GrossPaid(x, method, from, to) * x.CommissionRate)), Rate(sold, capacity), sold == 0 ? 0 : Round(roomRevenue / sold), capacity == 0 ? 0 : Round(roomRevenue / capacity), stayRows.Count == 0 ? 0 : decimal.Round((decimal)stayRows.Average(x => Math.Max(0, x.CheckOutDate.DayNumber - x.CheckInDate.DayNumber)), 1), stayRows.Count == 0 ? 0 : decimal.Round((decimal)stayRows.Average(x => Math.Max(0, x.CheckInDate.DayNumber - DateOnly.FromDateTime(x.CreatedAt.AddHours(7)).DayNumber)), 1));
    }
    private static IEnumerable<object> Series(List<Booking> rows, DateOnly from, DateOnly to, string grain, string? method)
    {
        var normalized = grain is "week" or "month" ? grain : "day";
        var payments = rows.SelectMany(x => x.Payments.Where(p => InPeriod(p, from, to) && p.Status == "Success" && (string.IsNullOrEmpty(method) || method == "all" || p.TransactionType == method)), (booking, payment) => new { booking, payment, day = DateOnly.FromDateTime(payment.PaidAt!.Value.AddHours(7)) });
        return payments.GroupBy(x => normalized == "month" ? $"{x.day:yyyy-MM}" : normalized == "week" ? $"{x.day.Year}-W{ISOWeek.GetWeekOfYear(x.day.ToDateTime(TimeOnly.MinValue)):00}" : x.day.ToString("yyyy-MM-dd"))
            .Select(g => new { label = g.Key, revenue = Round(g.Sum(x => x.payment.TransactionType == "Refund" ? -x.payment.Amount : x.payment.Amount)), bookings = g.Select(x => x.booking.Id).Distinct().Count() }).OrderBy(x => x.label).Cast<object>().ToList();
    }

    private static byte[] BuildXlsx(string csv)
    {
        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            WriteZip(zip, "[Content_Types].xml", "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            WriteZip(zip, "_rels/.rels", "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            WriteZip(zip, "xl/workbook.xml", "<?xml version=\"1.0\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Doanh thu\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            WriteZip(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
            var sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
            foreach (var line in csv.Split(["\r\n", "\n"], StringSplitOptions.RemoveEmptyEntries))
            {
                sheet.Append("<row>");
                foreach (var cell in ParseCsvLine(line)) sheet.Append("<c t=\"inlineStr\"><is><t>").Append(XmlEscape(cell)).Append("</t></is></c>");
                sheet.Append("</row>");
            }
            sheet.Append("</sheetData></worksheet>"); WriteZip(zip, "xl/worksheets/sheet1.xml", sheet.ToString());
        }
        return output.ToArray();
    }
    private static void WriteZip(ZipArchive zip, string path, string content) { var entry = zip.CreateEntry(path); using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false)); writer.Write(content); }
    private static IEnumerable<string> ParseCsvLine(string line) { var values = new List<string>(); var value = new StringBuilder(); var quoted = false; for (var i = 0; i < line.Length; i++) { var c = line[i]; if (c == '"' && quoted && i + 1 < line.Length && line[i + 1] == '"') { value.Append('"'); i++; } else if (c == '"') quoted = !quoted; else if (c == ',' && !quoted) { values.Add(value.ToString()); value.Clear(); } else value.Append(c); } values.Add(value.ToString()); return values; }
    private static string XmlEscape(string value) => SecurityElement.Escape(value) ?? string.Empty;
    private static byte[] BuildPdf(List<string> rows, DateOnly from, DateOnly to)
    {
        static string Safe(string value) => string.Concat(value.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)).Replace("đ", "d").Replace("Đ", "D").Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
        var lines = new List<string> { "BAO CAO DOANH THU", $"Tu {from:dd/MM/yyyy} den {to:dd/MM/yyyy}", "" }; lines.AddRange(rows.Take(42));
        var stream = new StringBuilder("BT /F1 12 Tf 45 790 Td"); foreach (var line in lines) stream.Append(" 0 -17 Td (").Append(Safe(line)).Append(") Tj"); stream.Append(" ET");
        var objects = new[] { "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", $"<< /Length {Encoding.ASCII.GetByteCount(stream.ToString())} >>\nstream\n{stream}\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" };
        var pdf = new StringBuilder("%PDF-1.4\n"); var offsets = new List<int> { 0 }; for (var i = 0; i < objects.Length; i++) { offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString())); pdf.Append(i + 1).Append(" 0 obj\n").Append(objects[i]).Append("\nendobj\n"); } var xref = Encoding.ASCII.GetByteCount(pdf.ToString()); pdf.Append("xref\n0 ").Append(objects.Length + 1).Append("\n0000000000 65535 f \n"); foreach (var offset in offsets.Skip(1)) pdf.Append(offset.ToString("0000000000")).Append(" 00000 n \n"); pdf.Append("trailer << /Size ").Append(objects.Length + 1).Append(" /Root 1 0 R >>\nstartxref\n").Append(xref).Append("\n%%EOF"); return Encoding.ASCII.GetBytes(pdf.ToString());
    }
}
