import { colors } from '../theme.js';
import { toIsoDate } from '../utils/dates.js';

// Same wording and grouping as the web "Đơn của tôi" page. The API already reports an unpaid hold past
// its deadline as Expired.
export const STATUS = {
  Hold: { label: 'Chờ thanh toán', color: colors.warning, bg: '#fef3c7' },
  PaymentFailed: { label: 'Thanh toán lỗi', color: colors.danger, bg: '#fee2e2' },
  Expired: { label: 'Hết hạn', color: colors.textMuted, bg: '#f1f5f9' },
  Confirmed: { label: 'Đã xác nhận', color: colors.success, bg: '#dcfce7' },
  CheckedIn: { label: 'Đang ở', color: colors.primary, bg: '#e3ebfd' },
  CheckoutPendingPayment: { label: 'Chờ xác nhận trả phòng', color: colors.primary, bg: '#e3ebfd' },
  CheckedOut: { label: 'Hoàn thành', color: colors.navy, bg: '#e2e8f0' },
  Cancelled: { label: 'Đã hủy', color: colors.danger, bg: '#fee2e2' },
  NoShow: { label: 'Không đến', color: colors.danger, bg: '#fee2e2' }
};

export const GROUPS = [
  { key: 'upcoming', label: 'Sắp tới', statuses: ['Hold', 'PaymentFailed', 'Confirmed'] },
  { key: 'staying', label: 'Đang ở', statuses: ['CheckedIn', 'CheckoutPendingPayment'] },
  { key: 'completed', label: 'Hoàn thành', statuses: ['CheckedOut'] },
  { key: 'cancelled', label: 'Đã hủy', statuses: ['Cancelled', 'Expired', 'NoShow'] }
];

const today = () => toIsoDate(new Date());

// BookingRules.CanCancel: before the check-in day, for a confirmed booking or a hold still being paid.
export const canCancel = (b) => b.checkInDate > today() && (b.status === 'Confirmed' || b.status === 'Hold');

// retry-payment accepts these while the check-in date has not passed.
export const canPay = (b) => ['Hold', 'PaymentFailed', 'Expired'].includes(b.status) && b.checkInDate >= today();

// The web shows the late-arrival form from the day before check-in through the check-in day.
export const canAnnounceLateArrival = (b) => {
  if (b.status !== 'Confirmed') return false;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  return b.checkInDate >= today() && b.checkInDate <= toIsoDate(tomorrow);
};
