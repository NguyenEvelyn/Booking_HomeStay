using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Bookings;

[ApiController, Authorize]
public sealed class GuestServiceRequestsController(AppDbContext db) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private static readonly string[] OpenStatuses = ["Pending", "Approved", "ChangeProposed", "InProgress", "HostCompleted"];

    [HttpGet("api/bookings/{bookingId:long}/service-requests")]
    public async Task<IActionResult> CustomerList(long bookingId)
    {
        var booking = await db.Bookings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == UserId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        var services = await db.HomestayServices.AsNoTracking().Where(x => x.HomestayId == booking.HomestayId && x.IsActive)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Category, x.Description, x.Unit, x.Price }).ToListAsync();
        var requests = await ShapeRequests(db.GuestServiceRequests.AsNoTracking().Where(x => x.BookingId == bookingId)).ToListAsync();
        return Ok(new { canRequest = booking.Status == "Confirmed" || booking.Status == "CheckedIn", booking.Status, services, requests });
    }

    [HttpPost("api/bookings/{bookingId:long}/service-requests")]
    public async Task<IActionResult> Create(long bookingId, CreateServiceRequest request)
    {
        var booking = await db.Bookings.SingleOrDefaultAsync(x => x.Id == bookingId && x.CustomerId == UserId);
        if (booking is null) return NotFound(new { message = "Không tìm thấy đơn đặt phòng." });
        if (booking.Status is not ("Confirmed" or "CheckedIn")) return BadRequest(new { message = "Chỉ đơn đã xác nhận hoặc đang lưu trú mới có thể gửi yêu cầu." });
        var service = await db.HomestayServices.SingleOrDefaultAsync(x => x.Id == request.ServiceId && x.HomestayId == booking.HomestayId && x.IsActive);
        if (service is null) return BadRequest(new { message = "Dịch vụ không còn khả dụng tại homestay này." });
        if (request.Quantity is < 1 or > 20) return BadRequest(new { message = "Số lượng phải từ 1 đến 20." });
        if (request.Note?.Length > 1000) return BadRequest(new { message = "Ghi chú tối đa 1.000 ký tự." });
        var entity = new GuestServiceRequest {
            BookingId = bookingId, HomestayServiceId = service.Id, CustomerId = UserId,
            RequestType = service.Category, Title = service.Name, Quantity = request.Quantity,
            RequestedFor = request.RequestedFor, EstimatedAmount = service.Price * request.Quantity,
            DetailsJson = JsonSerializer.Serialize(new { note = request.Note?.Trim(), request.DoNotDisturb }),
            Status = "Pending", ResponseDueAt = DateTime.UtcNow.AddHours(2), CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        db.GuestServiceRequests.Add(entity);
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã gửi yêu cầu đến Host.", id = entity.Id });
    }

    [HttpPatch("api/bookings/service-requests/{requestId:long}/confirm-completed")]
    public async Task<IActionResult> ConfirmCompleted(long requestId)
    {
        var item = await db.GuestServiceRequests.SingleOrDefaultAsync(x => x.Id == requestId && x.CustomerId == UserId);
        if (item is null) return NotFound(new { message = "Không tìm thấy yêu cầu." });
        if (item.Status != "HostCompleted") return BadRequest(new { message = "Host chưa đánh dấu yêu cầu này hoàn thành." });
        item.Status = "Completed"; item.CompletedAt = DateTime.UtcNow; item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Cảm ơn bạn đã xác nhận dịch vụ hoàn thành." });
    }

    [HttpPatch("api/bookings/service-requests/{requestId:long}/proposal")]
    public async Task<IActionResult> RespondToProposal(long requestId, ProposalResponse request)
    {
        var item = await db.GuestServiceRequests.SingleOrDefaultAsync(x => x.Id == requestId && x.CustomerId == UserId);
        if (item is null) return NotFound(new { message = "Không tìm thấy yêu cầu." });
        if (item.Status != "ChangeProposed") return BadRequest(new { message = "Yêu cầu này không còn chờ phản hồi đề xuất." });
        item.Status = request.Accepted ? "Approved" : "Cancelled";
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = request.Accepted ? "Đã chấp nhận đề xuất của Host." : "Đã từ chối đề xuất của Host." });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("api/host/service-requests")]
    public async Task<IActionResult> HostList()
    {
        var query = db.GuestServiceRequests.AsNoTracking().Where(x => db.Bookings.Any(b => b.Id == x.BookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == UserId)));
        var items = await ShapeRequests(query).ToListAsync();
        return Ok(new { pendingCount = items.Count(x => OpenStatuses.Contains(x.Status)), items });
    }

    [Authorize(Roles = "Host")]
    [HttpPatch("api/host/service-requests/{requestId:long}")]
    public async Task<IActionResult> HostUpdate(long requestId, UpdateServiceRequest request)
    {
        var item = await db.GuestServiceRequests.SingleOrDefaultAsync(x => x.Id == requestId && db.Bookings.Any(b => b.Id == x.BookingId && db.Homestays.Any(h => h.Id == b.HomestayId && h.HostId == UserId)));
        if (item is null) return NotFound(new { message = "Không tìm thấy yêu cầu." });
        var allowed = new[] { "Approved", "Rejected", "ChangeProposed", "InProgress", "HostCompleted" };
        if (!allowed.Contains(request.Status)) return BadRequest(new { message = "Trạng thái xử lý không hợp lệ." });
        if (request.Status == "Rejected" && string.IsNullOrWhiteSpace(request.RejectReasonCode)) return BadRequest(new { message = "Vui lòng chọn lý do từ chối." });
        if (request.Status == "Rejected" && request.RejectReasonCode == "OTHER" && string.IsNullOrWhiteSpace(request.RejectReasonNote)) return BadRequest(new { message = "Vui lòng nhập lý do từ chối khác." });
        if (request.Status == "ChangeProposed" && string.IsNullOrWhiteSpace(request.Response)) return BadRequest(new { message = "Vui lòng nhập nội dung đề xuất." });
        item.Status = request.Status; item.HostResponse = request.Response?.Trim(); item.ApprovedAmount = request.ApprovedAmount ?? item.EstimatedAmount;
        item.RejectReasonCode = request.Status == "Rejected" ? request.RejectReasonCode : null;
        item.RejectReasonNote = request.Status == "Rejected" ? request.RejectReasonNote?.Trim() : null;
        item.RespondedAt ??= DateTime.UtcNow; item.UpdatedAt = DateTime.UtcNow;
        if (request.Status == "HostCompleted") item.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật yêu cầu của khách." });
    }

    [Authorize(Roles = "Host")]
    [HttpGet("api/host/homestay-services")]
    public async Task<IActionResult> HostServices() => Ok(new { items = await db.HomestayServices.AsNoTracking()
        .Where(x => db.Homestays.Any(h => h.Id == x.HomestayId && h.HostId == UserId)).OrderBy(x => x.HomestayId).ThenBy(x => x.SortOrder)
        .Select(x => new { x.Id, x.HomestayId, HomestayName = db.Homestays.Where(h => h.Id == x.HomestayId).Select(h => h.Name).First(), x.Name, x.Category, x.Description, x.Unit, x.Price, x.IsActive }).ToListAsync() });

    [Authorize(Roles = "Host")]
    [HttpPost("api/host/homestays/{homestayId:long}/services")]
    public async Task<IActionResult> SaveService(long homestayId, SaveHomestayService request)
    {
        if (!await db.Homestays.AnyAsync(x => x.Id == homestayId && x.HostId == UserId)) return NotFound(new { message = "Không tìm thấy homestay." });
        if (string.IsNullOrWhiteSpace(request.Name) || request.Price < 0) return BadRequest(new { message = "Tên và giá dịch vụ không hợp lệ." });
        HomestayService? item = request.Id is null ? null : await db.HomestayServices.SingleOrDefaultAsync(x => x.Id == request.Id && x.HomestayId == homestayId);
        if (item is null) { item = new HomestayService { HomestayId = homestayId, Name = request.Name.Trim(), Category = request.Category, CreatedAt = DateTime.UtcNow }; db.HomestayServices.Add(item); }
        item.Name = request.Name.Trim(); item.Category = request.Category; item.Description = request.Description?.Trim(); item.Unit = request.Unit.Trim(); item.Price = request.Price; item.IsActive = request.IsActive; item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã lưu dịch vụ của homestay.", id = item.Id });
    }

    private IQueryable<ServiceRequestView> ShapeRequests(IQueryable<GuestServiceRequest> query) => query.OrderByDescending(x => x.CreatedAt).Select(x => new ServiceRequestView(
        x.Id, x.BookingId,
        db.Bookings.Where(b => b.Id == x.BookingId).Select(b => b.BookingCode).First(),
        db.Bookings.Where(b => b.Id == x.BookingId).Select(b => b.HomestayId).First(), x.HomestayServiceId,
        db.Bookings.Where(b => b.Id == x.BookingId).Select(b => db.Homestays.Where(h => h.Id == b.HomestayId).Select(h => h.Name).First()).First(),
        db.Users.Where(u => u.Id == x.CustomerId).Select(u => u.FullName).First(),
        db.Bookings.Where(b => b.Id == x.BookingId).Select(b => b.CheckInDate).First(),
        db.Bookings.Where(b => b.Id == x.BookingId).Select(b => b.CheckOutDate).First(),
        db.Bookings.Where(b => b.Id == x.BookingId).Select(b => b.Details.Select(d => d.RoomId == null
            ? db.RoomTypes.Where(t => t.Id == d.RoomTypeId).Select(t => t.Name).First()
            : "Phòng " + db.Rooms.Where(r => r.Id == d.RoomId).Select(r => r.RoomNumber).First()).FirstOrDefault() ?? "Chưa xếp phòng").First(),
        x.Title, x.RequestType, x.DetailsJson, x.Quantity, x.RequestedFor, x.EstimatedAmount, x.ApprovedAmount, x.Status, x.HostResponse, x.RejectReasonCode, x.RejectReasonNote, x.ResponseDueAt, x.CreatedAt, x.UpdatedAt));
}

public sealed record CreateServiceRequest(long ServiceId, int Quantity, DateTime? RequestedFor, string? Note, bool DoNotDisturb);
public sealed record UpdateServiceRequest(string Status, string? Response, decimal? ApprovedAmount, string? RejectReasonCode = null, string? RejectReasonNote = null);
public sealed record ProposalResponse(bool Accepted);
public sealed record SaveHomestayService(long? Id, string Name, string Category, string? Description, string Unit, decimal Price, bool IsActive);
public sealed record ServiceRequestView(long Id, long BookingId, string BookingCode, long HomestayId, long? HomestayServiceId, string HomestayName, string CustomerName, DateOnly CheckInDate, DateOnly CheckOutDate, string Rooms, string Title, string RequestType, string DetailsJson, int Quantity, DateTime? RequestedFor, decimal EstimatedAmount, decimal? ApprovedAmount, string Status, string? HostResponse, string? RejectReasonCode, string? RejectReasonNote, DateTime ResponseDueAt, DateTime CreatedAt, DateTime UpdatedAt);
