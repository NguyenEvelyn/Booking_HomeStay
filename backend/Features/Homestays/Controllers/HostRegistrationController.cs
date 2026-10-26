using HomestayAuth.Api.Features.Notifications;
using System.Security.Claims;
using System.Text.Json;
using HomestayAuth.Api.Domain.Entities;
using HomestayAuth.Api.Features.Admin.Audit;
using HomestayAuth.Api.Features.Admin.Authorization;
using HomestayAuth.Api.Features.Homestays.Services;
using HomestayAuth.Api.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HomestayAuth.Api.Features.Homestays.Controllers;

public sealed record RegisterHostRequest(
    string? PhoneNumber,
    string? IdCardNumber,
    string? BankName,
    string? BankAccountNumber,
    string? BankAccountName,
    object? HomestayData = null
);

public sealed record HostRegistrationDecisionRequest(string? Reason);

[ApiController]
public sealed class HostRegistrationController(AppDbContext db, IAuditLogService audit, SupabaseStorageService storage, NotificationService notifications) : ControllerBase
{
    private long UserId => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Applicants are not Hosts yet, so they cannot use /api/host/profile/upload for listing photos.
    [HttpPost("api/host-registration/upload"), Authorize, RequestSizeLimit(ImageUpload.MaxBytes)]
    public async Task<IActionResult> UploadImage(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0 || file.Length > ImageUpload.MaxBytes) return BadRequest(new { message = "Ảnh phải nhỏ hơn 8 MB." });
        if (await ImageUpload.Validate(file, cancellationToken) is not (var extension, var contentType))
            return BadRequest(new { message = "Chỉ hỗ trợ JPG, PNG hoặc WEBP hợp lệ." });
        await using var stream = file.OpenReadStream();
        var url = await storage.UploadPublicImageAsync(stream, $"registrations/{UserId}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension}", contentType, cancellationToken);
        return Ok(new { url });
    }

    // 1. Khách hàng gửi đơn đăng ký làm Host
    [HttpPost("api/HostRegistration/register"), HttpPost("api/host-registration/register"), Authorize]
    public async Task<IActionResult> Register(RegisterHostRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == UserId);
        if (user is null) return NotFound(new { message = "Không tìm thấy tài khoản người dùng." });

        if (user.Role == "Host")
        {
            return Ok(new { message = "Bạn đã là Host trên hệ thống." });
        }

        var existingPending = await db.HostRegistrations
            .Where(r => r.UserId == UserId && r.Status == "Pending")
            .FirstOrDefaultAsync();

        string? homestayJson = request.HomestayData is not null
            ? JsonSerializer.Serialize(request.HomestayData)
            : null;

        var now = DateTime.UtcNow;

        if (existingPending is not null)
        {
            existingPending.PhoneNumber = request.PhoneNumber?.Trim() ?? existingPending.PhoneNumber;
            existingPending.IdCardNumber = request.IdCardNumber?.Trim() ?? existingPending.IdCardNumber;
            existingPending.BankName = request.BankName?.Trim() ?? existingPending.BankName;
            existingPending.BankAccountNumber = request.BankAccountNumber?.Trim() ?? existingPending.BankAccountNumber;
            existingPending.BankAccountName = request.BankAccountName?.Trim() ?? existingPending.BankAccountName;
            if (homestayJson is not null) existingPending.HomestayDataJson = homestayJson;
            existingPending.UpdatedAt = now;
        }
        else
        {
            var reg = new HostRegistration
            {
                UserId = UserId,
                PhoneNumber = request.PhoneNumber?.Trim(),
                IdCardNumber = request.IdCardNumber?.Trim(),
                BankName = request.BankName?.Trim(),
                BankAccountNumber = request.BankAccountNumber?.Trim(),
                BankAccountName = request.BankAccountName?.Trim(),
                HomestayDataJson = homestayJson,
                Status = "Pending",
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.HostRegistrations.Add(reg);
        }

        await notifications.NotifyStaff(NotificationTemplates.StaffNewHostRegistration(user.FullName));
        await db.SaveChangesAsync();
        return Ok(new
        {
            message = "Gửi hồ sơ đăng ký làm Host thành công! Ban quản trị sẽ sớm duyệt hồ sơ của bạn.",
            status = "Pending"
        });
    }

    // 2. Khách hàng kiểm tra tình trạng hồ sơ đăng ký làm Host của mình
    [HttpGet("api/HostRegistration/my-registration"), HttpGet("api/host-registration/my-registration"), Authorize]
    public async Task<IActionResult> GetMyRegistration()
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == UserId);
        if (user is null) return NotFound();

        var reg = await db.HostRegistrations.AsNoTracking()
            .Where(r => r.UserId == UserId)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync();

        return Ok(new
        {
            isHost = user.Role == "Host",
            currentRole = user.Role,
            registration = reg is null ? null : new
            {
                reg.Id,
                reg.Status,
                reg.PhoneNumber,
                reg.IdCardNumber,
                reg.BankName,
                reg.BankAccountNumber,
                reg.BankAccountName,
                reg.RejectionReason,
                reg.CreatedAt,
                reg.ReviewedAt,
            }
        });
    }

    // 3. Admin: Danh sách hồ sơ đăng ký từ Customer lên Host
    [HttpGet("api/admin/host-registrations"), Authorize(Policy = AdminPolicies.Access)]
    public async Task<IActionResult> ListAdminRegistrations(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20
    )
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 5, 100);

        var query = db.HostRegistrations.Include(r => r.User).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(r => r.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r =>
                EF.Functions.ILike(r.User.FullName, $"%{term}%") ||
                EF.Functions.ILike(r.User.Email, $"%{term}%") ||
                (r.PhoneNumber != null && EF.Functions.ILike(r.PhoneNumber, $"%{term}%")) ||
                (r.IdCardNumber != null && EF.Functions.ILike(r.IdCardNumber, $"%{term}%"))
            );
        }

        var total = await query.CountAsync();
        var pendingCount = await db.HostRegistrations.CountAsync(r => r.Status == "Pending");

        var items = await query
            .OrderBy(r => r.Status == "Pending" ? 0 : 1)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.UserId,
                UserName = r.User.FullName,
                UserEmail = r.User.Email,
                UserAvatar = r.User.AvatarUrl,
                UserCurrentRole = r.User.Role,
                r.PhoneNumber,
                r.IdCardNumber,
                r.BankName,
                r.BankAccountNumber,
                r.BankAccountName,
                HomestayData = r.HomestayDataJson,
                r.Status,
                r.RejectionReason,
                r.ReviewedBy,
                ReviewedByName = db.Users.Where(u => u.Id == r.ReviewedBy).Select(u => u.FullName).FirstOrDefault(),
                r.ReviewedAt,
                r.CreatedAt,
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            page,
            pageSize,
            total,
            totalPages = (int)Math.Ceiling(total / (double)pageSize),
            pendingCount
        });
    }

    // 4. Admin: Phê duyệt nâng cấp tài khoản từ Customer sang Host
    [HttpPatch("api/admin/host-registrations/{id:long}/approve"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> ApproveRegistration(long id)
    {
        var adminId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await using var tx = await db.Database.BeginTransactionAsync();

        var reg = await db.HostRegistrations.SingleOrDefaultAsync(r => r.Id == id);
        if (reg is null) return NotFound(new { message = "Không tìm thấy hồ sơ đăng ký." });
        if (reg.Status != "Pending") return BadRequest(new { message = "Chỉ có thể phê duyệt hồ sơ đang chờ duyệt." });

        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == reg.UserId);
        if (user is null) return NotFound(new { message = "Không tìm thấy tài khoản người dùng tương ứng." });

        var beforeRole = user.Role;
        user.Role = "Host";
        if (!string.IsNullOrWhiteSpace(reg.PhoneNumber))
        {
            user.PhoneNumber = reg.PhoneNumber;
        }
        user.UpdatedAt = DateTime.UtcNow;

        reg.Status = "Approved";
        reg.ReviewedBy = adminId;
        reg.ReviewedAt = DateTime.UtcNow;
        reg.UpdatedAt = DateTime.UtcNow;

        // Nếu trong hồ sơ có kèm dữ liệu Homestay khởi tạo, tự động lưu Homestay cho Host mới
        if (!string.IsNullOrWhiteSpace(reg.HomestayDataJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(reg.HomestayDataJson);
                var root = doc.RootElement;
                string homestayName = root.TryGetProperty("homestayName", out var n) ? n.GetString() ?? "" : "";
                string addressLine = root.TryGetProperty("addressLine", out var a) ? a.GetString() ?? "" : "";
                string ward = root.TryGetProperty("ward", out var w) ? w.GetString() ?? "" : "";
                string district = root.TryGetProperty("district", out var d) ? d.GetString() ?? "" : "";
                string province = root.TryGetProperty("province", out var p) ? p.GetString() ?? "" : "";
                string description = root.TryGetProperty("description", out var desc) ? desc.GetString() ?? "" : $"Homestay tại {district}, {province}";

                if (!string.IsNullOrWhiteSpace(homestayName) && !string.IsNullOrWhiteSpace(addressLine))
                {
                    var now = DateTime.UtcNow;
                    var homestay = new Homestay
                    {
                        HostId = user.Id,
                        Name = homestayName.Trim(),
                        Description = string.IsNullOrWhiteSpace(description) ? $"Homestay của {user.FullName}" : description.Trim(),
                        AddressLine = addressLine.Trim(),
                        Ward = ward.Trim(),
                        District = district.Trim(),
                        Province = province.Trim(),
                        CheckInTime = new TimeOnly(14, 0),
                        CheckOutTime = new TimeOnly(12, 0),
                        // The application has no rooms yet: the host adds room types/rooms and submits it, then an
                        // admin approves it like any other homestay (DecideHomestay requires images and rooms).
                        Status = "Draft",
                        CreatedAt = now,
                        UpdatedAt = now,
                    };
                    db.Homestays.Add(homestay);
                    await db.SaveChangesAsync();

                    // Gán ảnh nếu có
                    if (root.TryGetProperty("images", out var imgs) && imgs.ValueKind == JsonValueKind.Array)
                    {
                        int order = 0;
                        foreach (var img in imgs.EnumerateArray())
                        {
                            var url = img.ValueKind == JsonValueKind.String ? img.GetString()?.Trim() : null;
                            // Older applications may hold base64 data URLs that do not fit image_url; skip them
                            // instead of failing the whole approval.
                            if (ImageUpload.IsAllowedUrl(url))
                            {
                                db.HomestayImages.Add(new HomestayImage
                                {
                                    HomestayId = homestay.Id,
                                    ImageUrl = url!,
                                    Caption = order == 0 ? "Ảnh bìa chính homestay" : $"Ảnh homestay #{order + 1}",
                                    IsThumbnail = order == 0,
                                    SortOrder = order++,
                                    CreatedAt = now
                                });
                            }
                        }
                    }

                    // Gán hạng phòng nếu có
                    string roomTypeName = root.TryGetProperty("roomTypeName", out var rt) ? rt.GetString() ?? "Phòng tiêu chuẩn" : "Phòng tiêu chuẩn";
                    decimal basePrice = root.TryGetProperty("roomBasePrice", out var bp) && bp.TryGetDecimal(out var decBp) ? decBp : 500000;
                    var roomType = new RoomType
                    {
                        HomestayId = homestay.Id,
                        Name = roomTypeName,
                        Description = $"{roomTypeName} tiện nghi.",
                        BasePrice = basePrice,
                        MaxAdults = 2,
                        MaxChildren = 1,
                        BedType = "Queen",
                        RoomSize = 25,
                        Status = "Active",
                        CreatedAt = now,
                        UpdatedAt = now,
                    };
                    db.RoomTypes.Add(roomType);
                    await db.SaveChangesAsync();

                    db.Rooms.Add(new Room
                    {
                        RoomTypeId = roomType.Id,
                        RoomNumber = "101",
                        FloorNumber = 1,
                        Status = "Available",
                        Note = "Phòng chính",
                        CreatedAt = now,
                        UpdatedAt = now,
                    });
                }
            }
            catch
            {
                // Bỏ qua lỗi phụ nếu dữ liệu homestay kèm theo không chuẩn
            }
        }

        audit.Add(HttpContext, "host_registration.approve", "user", user.Id,
            new { Role = beforeRole }, new { Role = user.Role, HostRegistrationId = id });
        notifications.Notify(user.Id, NotificationTemplates.HostRegistrationResult(true, null));

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { message = $"Đã phê duyệt thành công! Tài khoản {user.FullName} đã được cấp quyền Host." });
    }

    // 5. Admin: Từ chối đơn đăng ký làm Host
    [HttpPatch("api/admin/host-registrations/{id:long}/reject"), Authorize(Policy = AdminPolicies.FullAccess)]
    public async Task<IActionResult> RejectRegistration(long id, HostRegistrationDecisionRequest request)
    {
        var adminId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason)) return BadRequest(new { message = "Vui lòng nhập lý do từ chối hồ sơ." });

        await using var tx = await db.Database.BeginTransactionAsync();
        var reg = await db.HostRegistrations.SingleOrDefaultAsync(r => r.Id == id);
        if (reg is null) return NotFound(new { message = "Không tìm thấy hồ sơ đăng ký." });
        if (reg.Status != "Pending") return BadRequest(new { message = "Chỉ có thể từ chối hồ sơ đang chờ duyệt." });

        reg.Status = "Rejected";
        reg.RejectionReason = reason;
        reg.ReviewedBy = adminId;
        reg.ReviewedAt = DateTime.UtcNow;
        reg.UpdatedAt = DateTime.UtcNow;

        audit.Add(HttpContext, "host_registration.reject", "host_registration", id,
            new { reg.Status }, new { reg.Status, reg.RejectionReason }, reason);
        notifications.Notify(reg.UserId, NotificationTemplates.HostRegistrationResult(false, reason));

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { message = "Đã từ chối đơn đăng ký làm Host." });
    }
}
