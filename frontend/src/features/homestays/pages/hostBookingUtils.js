// Pure helpers shared by the host booking screens: formatting, status grouping and policy-based fees.
export const money = value => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
export const date = value => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) : '—';
export const dateTime = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
export const day = value => date(value);
export const plainDate = value => date(value);
export const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};
export const dayDiff = (value, base) => Math.round((Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 86400000);
export const upcomingStatuses = ['Confirmed', 'PendingPayment', 'Pending', 'Hold'];
export const ongoingStatuses = ['CheckedIn', 'CheckoutPendingPayment'];
export const closedStatuses = ['Completed', 'CheckedOut', 'Cancelled', 'NoShow', 'Expired'];
export const isUpcoming = (item, now) => upcomingStatuses.includes(item.status) && item.checkInDate >= now;

export const urgencyFor = (item, now) => {
  if (ongoingStatuses.includes(item.status)) {
    const days = dayDiff(item.checkOutDate, now);
    return { level: 'staying', label: days <= 0 ? 'Check-out hôm nay' : `Đang ở · Check-out sau ${days} ngày`, urgent: days <= 0 };
  }
  if (!upcomingStatuses.includes(item.status)) return null;
  const days = Number.isFinite(Number(item.daysUntilCheckin)) ? Number(item.daysUntilCheckin) : dayDiff(item.checkInDate, now);
  // Server-computed: past the grace period (or the announced arrival) and still not checked in.
  if (item.noShowRisk) return { level: 'overdue', label: 'Nguy cơ no-show', urgent: true };
  if (item.expectedArrivalAt && days <= 0) return { level: 'today', label: 'Khách báo đến muộn', urgent: true };
  if (days < 0) return { level: 'overdue', label: `Trễ ${Math.abs(days)} ngày`, urgent: true };
  if (days === 0) return { level: 'today', label: 'Check-in hôm nay', urgent: true };
  if (days === 1) return { level: 'tomorrow', label: 'Ngày mai', urgent: true };
  if (days <= 3) return { level: 'soon', label: `Còn ${days} ngày`, urgent: false };
  if (days <= 7) return { level: 'week', label: `Còn ${days} ngày`, urgent: false };
  return { level: 'normal', label: `Còn ${days} ngày`, urgent: false };
};

export const bookingGroup = (item, now) => {
  if (ongoingStatuses.includes(item.status)) return 'staying';
  if (closedStatuses.includes(item.status)) return 'closed';
  const days = Number.isFinite(Number(item.daysUntilCheckin)) ? Number(item.daysUntilCheckin) : dayDiff(item.checkInDate, now);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'this-week';
  if (days <= 14) return 'next-week';
  return 'later';
};

export const groupLabels = {
  overdue: 'Cần xử lý ngay',
  staying: 'Đang ở',
  today: 'Hôm nay',
  tomorrow: 'Ngày mai',
  'this-week': 'Tuần này',
  'next-week': 'Tuần sau',
  later: 'Sau đó',
  closed: 'Đã hoàn thành / Đã hủy'
};

export const labels = {
  Hold: 'Chờ thanh toán',
  Pending: 'Chờ xác nhận',
  PendingPayment: 'Chờ thanh toán',
  PaymentFailed: 'Thanh toán lỗi',
  Expired: 'Hết hạn',
  Confirmed: 'Đã xác nhận',
  CheckedIn: 'Đang ở',
  CheckoutPendingPayment: 'Chờ thanh toán trả phòng',
  CheckedOut: 'Đã trả phòng',
  Completed: 'Hoàn thành',
  CancellationRequested: 'Chờ duyệt hủy',
  Cancelled: 'Đã hủy',
  NoShow: 'Không đến'
};

export const tabs = [
  ['all', 'Tất cả'],
  ['Pending', 'Chờ xác nhận'],
  ['PendingPayment', 'Chờ thanh toán'],
  ['Confirmed', 'Đã xác nhận'],
  ['upcoming', 'Sắp check-in'],
  ['CheckedIn', 'Đang ở'],
  ['Completed', 'Hoàn thành'],
  ['Cancelled', 'Đã hủy']
];

export const paymentState = item => {
  const paid = Number(item.paidAmount) || 0;
  const total = Number(item.totalAmount) || 0;
  if (paid >= total && total > 0) return 'paid';
  if (paid > 0) return 'deposit';
  return 'pending';
};

export const paymentLabel = {
  paid: 'Đã thanh toán đủ',
  deposit: 'Đã cọc',
  pending: 'Chờ thanh toán'
};

// Guest-entered text must not start a spreadsheet formula when the host opens the export in Excel.
export { csvCell } from '../../../shared/utils/csv.js';

// --- POLICY-DRIVEN PRICING HELPERS ---
export const calcEarlyCheckInPolicy = (timeStr, nightlyPrice, policyCheckInOut) => {
  if (!timeStr) return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (từ 14:00)', badge: 'normal' };
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = (h || 0) * 60 + (m || 0);

  const tiers = policyCheckInOut?.earlyCheckInTiers || [
    { from: '00:00:00', to: '06:00:00', percent: 100 },
    { from: '06:00:00', to: '10:00:00', percent: 50 },
    { from: '10:00:00', to: '14:00:00', percent: 0 }
  ];

  for (const tier of tiers) {
    const [fromH, fromM] = (tier.from || '00:00').split(':').map(Number);
    const [toH, toM] = (tier.to || '14:00').split(':').map(Number);
    const fromMin = fromH * 60 + (fromM || 0);
    const toMin = toH * 60 + (toM || 0);
    if (totalMinutes >= fromMin && totalMinutes < toMin) {
      const fee = Math.round(nightlyPrice * (Number(tier.percent) / 100));
      return {
        fee,
        percent: tier.percent,
        label: tier.percent === 0
          ? `Miễn phí nếu phòng sẵn sàng (${String(fromH).padStart(2, '0')}:00 – ${String(toH).padStart(2, '0')}:00)`
          : `Phụ thu ${tier.percent}% giá phòng/đêm (${String(fromH).padStart(2, '0')}:00 – ${String(toH).padStart(2, '0')}:00)`,
        badge: tier.percent === 0 ? 'free' : tier.percent >= 100 ? 'danger' : 'warning'
      };
    }
  }
  return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (từ 14:00)', badge: 'normal' };
};

export const calcLateCheckOutPolicy = (timeStr, nightlyPrice, policyCheckInOut) => {
  if (!timeStr) return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (trước 12:00)', badge: 'normal' };
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = (h || 0) * 60 + (m || 0);

  const tiers = policyCheckInOut?.lateCheckOutTiers || [
    { from: '12:00:00', to: '15:00:00', percent: 30 },
    { from: '15:00:00', to: '18:00:00', percent: 50 },
    { from: '18:00:00', to: '23:59:00', percent: 100 }
  ];

  if (totalMinutes <= 12 * 60) {
    return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (trước 12:00)', badge: 'normal' };
  }

  for (const tier of tiers) {
    const [fromH, fromM] = (tier.from || '12:00').split(':').map(Number);
    const [toH, toM] = (tier.to || '23:59').split(':').map(Number);
    const fromMin = fromH * 60 + (fromM || 0);
    const toMin = toH * 60 + (toM || 0);
    if (totalMinutes >= fromMin && totalMinutes <= toMin) {
      const fee = Math.round(nightlyPrice * (Number(tier.percent) / 100));
      return {
        fee,
        percent: tier.percent,
        label: `Phụ thu ${tier.percent}% giá phòng/đêm (${String(fromH).padStart(2, '0')}:00 – ${String(toH).padStart(2, '0')}:00)`,
        badge: tier.percent >= 100 ? 'danger' : 'warning'
      };
    }
  }
  return { fee: Math.round(nightlyPrice), percent: 100, label: 'Phụ thu 100% giá phòng/đêm (Sau 18:00)', badge: 'danger' };
};

// Mirror of backend OccupancyRules (preview only; the server recomputes): adults and children from 1.2 m fill the
// standard capacity, small children never count, tall children beyond it pay ExtraChildFee per night, extra
// tall + small children are capped by maxExtraChildren, and adults beyond capacity need a room change.
export const occupancyCheck = (party, room, quantity = 1) => {
  const adults = party.adults || 0, tall = party.tallChildren || 0, small = party.smallChildren || 0;
  const base = Math.max(1, Number(room?.baseCapacity) || 1) * quantity;
  const adultLimit = (room?.extraGuestAllowed ? Math.max(Number(room?.baseCapacity) || 1, Number(room?.maxCapacity) || 1) : Math.max(1, Number(room?.baseCapacity) || 1)) * quantity;
  const maxExtra = Math.max(0, Number(room?.maxExtraChildren ?? 2)) * quantity;
  if (adults < quantity) return { problem: "NoAdult", message: "Mỗi phòng cần ít nhất 1 người lớn.", extraAdults: 0, extraTall: 0, maxExtra };
  if (adults > adultLimit) return { problem: "TooManyAdults", message: `Phòng chỉ nhận tối đa ${adultLimit} người lớn — cần đổi phòng hoặc thêm phòng.`, extraAdults: 0, extraTall: 0, maxExtra };
  const extraAdults = Math.max(0, adults - base);
  const extraTall = Math.max(0, adults + tall - base) - extraAdults;
  if (extraTall + small > maxExtra) return { problem: "OverExtraLimit", message: `Vượt số trẻ ở thêm tối đa (${maxExtra}) — cần đổi phòng hoặc thêm phòng.`, extraAdults, extraTall, maxExtra };
  return { problem: null, message: null, extraAdults, extraTall, maxExtra };
};

export const calcExtraGuestSurcharge = (actual, capacity, nights) => {
  const check = occupancyCheck(actual, capacity);
  const units = nights || 1;
  const adultSurcharge = check.extraAdults * (Number(capacity?.extraGuestFee) || 0) * units;
  const childSurcharge = check.extraTall * (Number(capacity?.extraChildFee) || 0) * units;
  return {
    totalActualGuests: (actual.adults || 0) + (actual.tallChildren || 0) + (actual.smallChildren || 0),
    extraAdults: check.extraAdults,
    extraChildrenCount: check.extraTall,
    adultSurcharge,
    childSurcharge,
    totalSurcharge: check.problem ? 0 : adultSurcharge + childSurcharge,
    problem: check.problem,
    message: check.message
  };
};
