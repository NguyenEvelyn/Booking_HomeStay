import { useCallback, useEffect, useState } from 'react';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text.js';
import Ionicons from '@expo/vector-icons/Ionicons';
import { bookingApi } from '../../api/bookingApi.js';
import { canAnnounceLateArrival, canCancel, canPay } from '../../booking/bookingStatus.js';
import { openPayment } from '../../booking/openPayment.js';
import ChoiceChips from '../../components/ChoiceChips.js';
import StarRating from '../../components/StarRating.js';
import StatusBadge from '../../components/StatusBadge.js';
import { Button, Card, ErrorMessage, Loading, TextField } from '../../components/ui.js';
import { colors, font, radius, spacing } from '../../theme.js';
import { addDays, displayDate, fromIsoDate } from '../../utils/dates.js';
import { money, shortDate } from '../../utils/format.js';

const timeOf = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dateTimeOf = (iso) => `${timeOf(iso)} ${shortDate(iso)}`;
// "2026-11-10" -> "10/11" without going through Date (no time-zone shift).
const dayMonth = (isoDate) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [panel, setPanel] = useState(null); // which action form is open

  // The list endpoint already carries everything this screen shows.
  const load = useCallback(async () => {
    setError('');
    try {
      const found = (await bookingApi.mine()).items.find(b => String(b.id) === String(id));
      if (!found) throw new Error('Không tìm thấy đơn đặt phòng.');
      setBooking(found);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error && !booking) return <ErrorMessage message={error} onRetry={load} />;
  if (!booking) return <Loading />;

  const done = async (message) => { setPanel(null); setNotice(message); await load(); };
  const guests = booking.adultCount + booking.childCount;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: booking.bookingCode }} />

      <Card>
        {booking.homestayImage ? <Image source={{ uri: booking.homestayImage }} style={styles.hero} /> : null}
        <View style={styles.cardBody}>
          <StatusBadge status={booking.status} />
          <Text style={styles.name}>{booking.homestayName}</Text>
          <Text style={styles.muted}>{booking.address}</Text>
          <Button title="Xem homestay" variant="outline" onPress={() => router.push(`/homestay/${booking.homestayId}`)} style={{ marginTop: spacing.sm }} />
        </View>
      </Card>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <ErrorMessage message={error} /> : null}

      <Card style={styles.cardBody}>
        <Row label="Mã đơn" value={booking.bookingCode} />
        <Row label="Nhận phòng" value={displayDate(booking.checkInDate)} />
        <Row label="Trả phòng" value={displayDate(booking.checkOutDate)} />
        <Row label="Số đêm" value={String(booking.nights)} />
        <Row label="Khách" value={`${booking.adultCount} người lớn${booking.childCount ? `, ${booking.childCount} trẻ em` : ''}`} />
        <Row label="Phòng" value={booking.rooms?.join(', ')} />
        <Row label="Tổng tiền" value={money(booking.totalAmount)} strong />
        {booking.status === 'Hold' && booking.holdExpiresAt ? <Row label="Giữ phòng đến" value={dateTimeOf(booking.holdExpiresAt)} /> : null}
        {booking.expectedArrivalAt ? <Row label="Giờ đến đã báo" value={dateTimeOf(booking.expectedArrivalAt)} /> : null}
      </Card>

      {booking.cancellation ? (
        <Card style={styles.cardBody}>
          <Text style={styles.heading}>Thông tin hủy</Text>
          <Row label="Lý do" value={booking.cancellation.reason} />
          <Row label="Phí hủy" value={money(booking.cancellation.cancellationFee)} />
          <Row label="Hoàn lại" value={money(booking.cancellation.refundAmount)} />
          {booking.cancellation.status === 'RefundPending' ? <Text style={styles.muted}>Khoản hoàn đang chờ chủ nhà chuyển.</Text> : null}
        </Card>
      ) : null}

      {booking.noShow ? <NoShowCard booking={booking} open={panel === 'dispute'} onOpen={() => setPanel('dispute')} onDone={done} /> : null}

      {booking.hostPhone ? (
        <Button title={`Gọi chủ nhà ${booking.hostPhone}`} variant="outline" onPress={() => Linking.openURL(`tel:${booking.hostPhone.replace(/\s/g, '')}`)} />
      ) : null}

      {canPay(booking) ? <PayButton booking={booking} onError={setError} onDone={load} /> : null}

      {canAnnounceLateArrival(booking)
        ? panel === 'late'
          ? <LateArrivalForm booking={booking} onCancel={() => setPanel(null)} onDone={done} />
          : <Button title={booking.expectedArrivalAt ? 'Đổi giờ đến muộn' : 'Tôi sẽ đến muộn'} variant="outline" onPress={() => setPanel('late')} />
        : null}

      {booking.canReview
        ? panel === 'review'
          ? <ReviewForm booking={booking} onCancel={() => setPanel(null)} onDone={done} />
          : <Button title="Viết đánh giá" onPress={() => setPanel('review')} />
        : null}
      {booking.review ? <ReviewCard review={booking.review} /> : null}

      {canCancel(booking)
        ? panel === 'cancel'
          ? <CancelForm booking={booking} onCancel={() => setPanel(null)} onDone={done} />
          : <Button title="Hủy đơn" variant="outline" onPress={() => setPanel('cancel')} style={{ borderColor: colors.danger }} />
        : null}

      <Text style={styles.footnote}>{guests} khách · đặt lúc {dateTimeOf(booking.createdAt)}</Text>
    </ScrollView>
  );
}

function Row({ label, value, strong }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && { color: colors.primary, fontSize: font.title, fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

function PayButton({ booking, onError, onDone }) {
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      const result = await bookingApi.retryPayment(booking.id);
      await openPayment(result.paymentUrl);
      await onDone();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return <Button title="Thanh toán qua VNPay" onPress={pay} loading={busy} />;
}

// Shows the refund the server would give (cancellation-quote) before the guest confirms.
function CancelForm({ booking, onCancel, onDone }) {
  const [quote, setQuote] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    bookingApi.cancellationQuote(booking.id).then(setQuote).catch(e => setError(e.message));
  }, [booking.id]);

  const confirm = async () => {
    if (!reason.trim()) { setError('Vui lòng cho biết lý do hủy.'); return; }
    setBusy(true); setError('');
    try {
      const result = await bookingApi.cancel(booking.id, reason.trim());
      await onDone(result.message);
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  return (
    <Card style={[styles.cardBody, styles.danger]}>
      <Text style={styles.heading}>Hủy đơn đặt phòng</Text>
      {!quote && !error ? <Loading label="Đang tính tiền hoàn…" /> : null}
      {quote ? (
        <>
          <Text style={styles.muted}>Còn {quote.daysBeforeCheckIn} ngày đến ngày nhận phòng.</Text>
          <Row label="Phí hủy" value={money(quote.cancellationFee)} />
          <Row label={`Hoàn lại (${Number(quote.refundPercent)}%)`} value={money(quote.refundAmount)} strong />
        </>
      ) : null}
      <TextField label="Lý do hủy *" value={reason} onChangeText={setReason} multiline maxLength={500} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Xác nhận hủy" onPress={confirm} loading={busy} disabled={!quote} style={{ backgroundColor: colors.danger }} />
      <Button title="Không hủy nữa" variant="outline" onPress={onCancel} />
    </Card>
  );
}

// The server accepts arrivals from the check-in time until 06:00 the next morning (NoShowRules).
function LateArrivalForm({ booking, onCancel, onDone }) {
  const [day, setDay] = useState('checkin');
  const [time, setTime] = useState(booking.expectedArrivalAt ? timeOf(booking.expectedArrivalAt) : '');
  const [note, setNote] = useState(booking.lateArrivalNote ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) { setError('Giờ đến không hợp lệ (ví dụ 21:30).'); return; }
    const date = fromIsoDate(day === 'checkin' ? booking.checkInDate : addDays(booking.checkInDate, 1));
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    setBusy(true); setError('');
    try {
      const result = await bookingApi.announceLateArrival(booking.id, { expectedArrivalAt: date.toISOString(), note: note.trim() || null });
      await onDone(result.message);
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  return (
    <Card style={styles.cardBody}>
      <Text style={styles.heading}>Báo đến muộn</Text>
      <Text style={styles.muted}>Chủ nhà sẽ giữ phòng cho bạn đến giờ bạn báo.</Text>
      <ChoiceChips label="Ngày đến" value={day} onChange={setDay}
        options={[{ value: 'checkin', label: dayMonth(booking.checkInDate) }, { value: 'next', label: `Sáng ${dayMonth(addDays(booking.checkInDate, 1))}` }]} />
      <TextField label="Giờ đến dự kiến *" value={time} onChangeText={setTime} placeholder="21:30" keyboardType="numbers-and-punctuation" />
      <TextField label="Ghi chú cho chủ nhà" value={note} onChangeText={setNote} maxLength={500} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Gửi cho chủ nhà" onPress={submit} loading={busy} />
      <Button title="Đóng" variant="outline" onPress={onCancel} />
    </Card>
  );
}

function NoShowCard({ booking, open, onOpen, onDone }) {
  const n = booking.noShow;
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const disputeLabels = { Pending: 'Khiếu nại đang chờ xử lý', Accepted: 'Khiếu nại được chấp nhận', Rejected: 'Khiếu nại bị từ chối' };

  const submit = async () => {
    if (reason.trim().length < 10) { setError('Vui lòng mô tả lý do khiếu nại (ít nhất 10 ký tự).'); return; }
    setBusy(true); setError('');
    try {
      const result = await bookingApi.disputeNoShow(booking.id, reason.trim());
      await onDone(result.message);
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  return (
    <Card style={styles.cardBody}>
      <Text style={styles.heading}>Ghi nhận không đến</Text>
      <Text style={styles.muted}>Chủ nhà ghi nhận lúc {dateTimeOf(n.markedAt)}.</Text>
      <Row label="Đã thanh toán" value={money(n.paidAmount)} />
      <Row label="Chủ nhà giữ lại" value={money(n.retainedAmount)} />
      <Row label="Hoàn lại cho bạn" value={money(n.refundAmount)} />
      {n.disputeStatus ? <Text style={styles.muted}>{disputeLabels[n.disputeStatus] ?? n.disputeStatus}{n.resolutionNote ? `: ${n.resolutionNote}` : ''}</Text> : null}
      {n.canDispute && !open ? <Button title="Khiếu nại" variant="outline" onPress={onOpen} /> : null}
      {n.canDispute && open ? (
        <>
          <TextField label="Lý do khiếu nại *" value={reason} onChangeText={setReason} multiline placeholder="Ví dụ: tôi đã báo đến muộn lúc 20:00 và đến nơi lúc 21:00" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Gửi khiếu nại" onPress={submit} loading={busy} />
        </>
      ) : null}
    </Card>
  );
}

function ReviewForm({ booking, onCancel, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await bookingApi.createReview({ bookingId: booking.id, rating, comment: comment.trim() || null });
      await onDone('Cảm ơn bạn đã đánh giá!');
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  return (
    <Card style={styles.cardBody}>
      <Text style={styles.heading}>Đánh giá kỳ nghỉ</Text>
      <StarRating value={rating} onChange={setRating} />
      <TextField label="Nhận xét" value={comment} onChangeText={setComment} multiline maxLength={1000} placeholder="Phòng, chủ nhà, vị trí…" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Gửi đánh giá" onPress={submit} loading={busy} />
      <Button title="Để sau" variant="outline" onPress={onCancel} />
    </Card>
  );
}

function ReviewCard({ review }) {
  return (
    <Card style={styles.cardBody}>
      <Text style={styles.heading}>Đánh giá của bạn</Text>
      <StarRating value={review.rating} size={20} />
      {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
      {review.hostReply ? (
        <View style={styles.reply}>
          <View style={styles.inline}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
            <Text style={styles.replyLabel}>Chủ nhà phản hồi</Text>
          </View>
          <Text style={styles.body}>{review.hostReply}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  hero: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.border },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  danger: { borderColor: '#fecaca' },
  name: { fontSize: font.title + 2, fontWeight: '800', color: colors.navy },
  heading: { fontSize: font.title - 1, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted },
  body: { fontSize: font.body, color: colors.text, lineHeight: 22 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  rowLabel: { fontSize: font.body - 1, color: colors.textMuted },
  rowValue: { flex: 1, textAlign: 'right', fontSize: font.body - 1, fontWeight: '600', color: colors.text },
  notice: { backgroundColor: '#dcfce7', color: colors.success, borderRadius: radius.md, padding: spacing.md, fontSize: font.body - 1 },
  error: { color: colors.danger, fontSize: font.small + 1 },
  reply: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyLabel: { fontSize: 12, fontWeight: '700', color: colors.primary },
  footnote: { textAlign: 'center', fontSize: 12, color: colors.textMuted }
});
