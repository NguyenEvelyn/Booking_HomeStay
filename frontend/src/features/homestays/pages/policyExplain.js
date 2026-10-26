// Plain-language explanations of the homestay policy returned by GET /homestays/{id}/effective-policies.
// They mirror the backend rules: PolicyService.RefundPercent / BookingRules.Cancellation (refund = paid × %,
// days = check-in date − today in UTC+7), BookingRules.CanCancel (no self-cancel on the check-in day),
// DealRules.NonRefundable and NoShowRules.

const DAY_MS = 86400000;

const parseDate = (value) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
const formatIso = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (value, days) => formatIso(parseDate(value) + days * DAY_MS);
export const daysBetween = (from, to) => Math.round((parseDate(to) - parseDate(from)) / DAY_MS);

// Same calendar day as BookingRules.Today (UTC+7).
export const vietnamToday = (now = Date.now()) => formatIso(now + 7 * 3600000);

const tone = (percent) => percent >= 100 ? 'full' : percent <= 0 ? 'none' : 'partial';
const sortTiers = (tiers = []) => [...tiers].sort((a, b) => b.minimumDays - a.minimumDays);

export function describeCancellationTiers(tiers) {
  return sortTiers(tiers).map((tier) => ({
    label: tier.maximumDays == null
      ? `Còn từ ${tier.minimumDays} ngày trở lên`
      : tier.minimumDays === 0
        ? `Còn ${tier.maximumDays} ngày trở xuống`
        : tier.minimumDays === tier.maximumDays ? `Còn ${tier.minimumDays} ngày` : `Còn ${tier.minimumDays}–${tier.maximumDays} ngày`,
    refundPercent: Number(tier.refundPercent),
    tone: tone(Number(tier.refundPercent)),
    result: Number(tier.refundPercent) >= 100 ? 'Hoàn 100% – miễn phí hủy' : Number(tier.refundPercent) <= 0 ? 'Không hoàn tiền' : `Hoàn ${Number(tier.refundPercent)}%`
  }));
}

export function cancellationHeadline(tiers) {
  const sorted = sortTiers(tiers);
  if (!sorted.length) return 'Xem điều kiện khi đặt phòng';
  const best = sorted[0];
  if (sorted.every((tier) => Number(tier.refundPercent) <= 0)) return 'Không hoàn tiền khi hủy';
  if (Number(best.refundPercent) >= 100) return `Miễn phí hủy khi còn từ ${best.minimumDays} ngày`;
  return `Hoàn tối đa ${Number(best.refundPercent)}% khi hủy`;
}

// Concrete date ranges for a chosen check-in date. Each entry covers the days on which a guest cancellation
// gets that refund; past days and the check-in day itself (no self-cancel) are excluded from the tiers.
export function cancellationTimeline(tiers, checkInDate, today) {
  if (!checkInDate || !today || checkInDate < today) return [];
  const lastCancelDay = addDays(checkInDate, -1);
  const entries = [];
  for (const tier of sortTiers(tiers)) {
    const to = addDays(checkInDate, -Math.max(tier.minimumDays, 1));
    const earliest = tier.maximumDays == null ? today : addDays(checkInDate, -tier.maximumDays);
    const from = earliest < today ? today : earliest;
    if (to < from || to > lastCancelDay) continue;
    entries.push({ from, to, refundPercent: Number(tier.refundPercent), tone: tone(Number(tier.refundPercent)), isToday: from === today });
  }
  entries.push({ from: checkInDate, to: checkInDate, refundPercent: null, tone: 'none', checkInDay: true });
  return entries;
}

// Refund percent the backend would apply if the guest cancelled on `today`.
export function refundPercentOn(tiers, checkInDate, today) {
  const days = daysBetween(today, checkInDate);
  const tier = sortTiers(tiers).find((x) => days >= x.minimumDays && (x.maximumDays == null || days <= x.maximumDays));
  return tier ? Number(tier.refundPercent) : 0;
}

export const estimateRefund = (paidAmount, refundPercent) => Math.round(Math.max(0, Number(paidAmount) || 0) * Math.min(100, Math.max(0, refundPercent)) / 100);

const clock = (value) => String(value || '').slice(0, 5);

export function describeNoShow(noShow, checkInTime) {
  const graceHours = Math.min(24, Math.max(1, Number(noShow?.graceHours) || 6));
  const [hours, minutes] = clock(checkInTime || '14:00').split(':').map(Number);
  const total = hours * 60 + (minutes || 0) + graceHours * 60;
  const deadline = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}${total >= 1440 ? ' hôm sau' : ''}`;
  const remaining = Number(noShow?.remainingRefundPercent ?? 100);
  return {
    graceHours,
    deadline,
    penalty: noShow?.penalty === 'FirstNight' ? 'tiền 1 đêm đầu tiên' : 'tiền cọc',
    remainingRefundPercent: remaining
  };
}

export function describeLateCheckout(tiers = []) {
  return [...tiers].sort((a, b) => a.fromMinutes - b.fromMinutes).map((tier) => {
    const fromHours = Math.round(Math.max(0, tier.fromMinutes - 1) / 60);
    const toHours = tier.toMinutes == null ? null : Math.round((tier.toMinutes + 1) / 60);
    return {
      label: toHours == null ? `Trễ trên ${fromHours} giờ` : fromHours === 0 ? `Trễ đến ${toHours} giờ` : `Trễ ${fromHours}–${toHours} giờ`,
      fee: tier.calculationType === 'Fixed' ? { type: 'fixed', value: Number(tier.value) } : { type: 'percent', value: Number(tier.value) }
    };
  });
}

// Deposit share the guest pays when choosing "Đặt cọc". The quote is authoritative; without one we can only
// state the homestay minimum (room types and holidays/villas may require more).
export function describeDeposit(policy, quote, isDayUse = false) {
  if (quote?.depositPercent != null) return { percent: Number(quote.depositPercent), fromQuote: true };
  const document = policy?.document || {};
  const percent = isDayUse ? document.dayUse?.depositPercent : document.payment?.standardDepositPercent;
  return percent == null ? null : { percent: Number(percent), fromQuote: false };
}
