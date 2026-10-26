import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancellationHeadline, cancellationTimeline, describeCancellationTiers, describeLateCheckout,
  describeNoShow, estimateRefund, refundPercentOn, vietnamToday
} from './policyExplain.js';

// PolicyService default tiers.
const tiers = [
  { minimumDays: 14, maximumDays: null, refundPercent: 100 },
  { minimumDays: 7, maximumDays: 13, refundPercent: 70 },
  { minimumDays: 3, maximumDays: 6, refundPercent: 50 },
  { minimumDays: 0, maximumDays: 2, refundPercent: 0 }
];
const nonRefundable = [{ minimumDays: 0, maximumDays: null, refundPercent: 0 }];

test('describeCancellationTiers labels tiers from the most generous one', () => {
  const rows = describeCancellationTiers([...tiers].reverse());
  assert.deepEqual(rows.map((x) => x.label), ['Còn từ 14 ngày trở lên', 'Còn 7–13 ngày', 'Còn 3–6 ngày', 'Còn 2 ngày trở xuống']);
  assert.deepEqual(rows.map((x) => x.tone), ['full', 'partial', 'partial', 'none']);
  assert.equal(cancellationHeadline(tiers), 'Miễn phí hủy khi còn từ 14 ngày');
  assert.equal(cancellationHeadline(nonRefundable), 'Không hoàn tiền khi hủy');
});

test('cancellationTimeline turns tiers into concrete dates for a check-in', () => {
  const timeline = cancellationTimeline(tiers, '2026-11-20', '2026-10-26');
  assert.deepEqual(timeline.map(({ from, to, refundPercent }) => [from, to, refundPercent]), [
    ['2026-10-26', '2026-11-06', 100],
    ['2026-11-07', '2026-11-13', 70],
    ['2026-11-14', '2026-11-17', 50],
    ['2026-11-18', '2026-11-19', 0],
    ['2026-11-20', '2026-11-20', null]
  ]);
  assert.equal(timeline.at(-1).checkInDay, true);
});

test('cancellationTimeline drops past ranges and clips the current one to today', () => {
  const timeline = cancellationTimeline(tiers, '2026-11-20', '2026-11-15');
  assert.deepEqual(timeline.map(({ from, to, refundPercent }) => [from, to, refundPercent]), [
    ['2026-11-15', '2026-11-17', 50],
    ['2026-11-18', '2026-11-19', 0],
    ['2026-11-20', '2026-11-20', null]
  ]);
  assert.equal(timeline[0].isToday, true);
});

test('a deal booking has a single non-refundable range', () => {
  const timeline = cancellationTimeline(nonRefundable, '2026-10-28', '2026-10-26');
  assert.deepEqual(timeline.map(({ from, to, refundPercent }) => [from, to, refundPercent]), [
    ['2026-10-26', '2026-10-27', 0],
    ['2026-10-28', '2026-10-28', null]
  ]);
});

test('refundPercentOn and estimateRefund match PolicyService.RefundPercent and BookingRules.Cancellation', () => {
  assert.equal(refundPercentOn(tiers, '2026-11-20', '2026-11-06'), 100);
  assert.equal(refundPercentOn(tiers, '2026-11-20', '2026-11-07'), 70);
  assert.equal(refundPercentOn(tiers, '2026-11-20', '2026-11-19'), 0);
  assert.equal(estimateRefund(1_234_567, 70), 864_197);
  assert.equal(vietnamToday(Date.UTC(2026, 9, 26, 18, 0)), '2026-10-27');
});

test('describeNoShow and describeLateCheckout explain the timing in hours', () => {
  assert.deepEqual(describeNoShow({ graceHours: 6, penalty: 'Deposit', remainingRefundPercent: 100 }, '14:00:00'),
    { graceHours: 6, deadline: '20:00', penalty: 'tiền cọc', remainingRefundPercent: 100 });
  assert.equal(describeNoShow({ graceHours: 6, penalty: 'FirstNight' }, '22:00').deadline, '04:00 hôm sau');
  assert.deepEqual(describeLateCheckout([
    { fromMinutes: 360, toMinutes: null, calculationType: 'NightlyPercent', value: 100 },
    { fromMinutes: 1, toMinutes: 179, calculationType: 'NightlyPercent', value: 30 },
    { fromMinutes: 180, toMinutes: 359, calculationType: 'Fixed', value: 200000 }
  ]).map((x) => x.label), ['Trễ đến 3 giờ', 'Trễ 3–6 giờ', 'Trễ trên 6 giờ']);
});
