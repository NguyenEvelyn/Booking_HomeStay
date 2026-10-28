import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { bookingApi } from '../../api/bookingApi.js';
import { openPayment } from '../../booking/openPayment.js';
import { Button, Card, ErrorMessage, Loading } from '../../components/ui.js';
import { colors, font, spacing } from '../../theme.js';
import { displayDate } from '../../utils/dates.js';
import { money } from '../../utils/format.js';

const OUTCOMES = {
  Confirmed: { icon: 'checkmark-circle', color: colors.success, title: 'Đặt phòng thành công!', text: 'Thanh toán đã được ghi nhận. Chủ nhà sẽ chuẩn bị đón bạn.' },
  Hold: { icon: 'time', color: colors.warning, title: 'Đang chờ thanh toán', text: 'Phòng đang được giữ cho bạn. Hãy hoàn tất thanh toán trước khi hết thời gian giữ phòng.' },
  Expired: { icon: 'close-circle', color: colors.danger, title: 'Hết thời gian giữ phòng', text: 'Đơn chưa được thanh toán kịp. Bạn có thể thanh toán lại nếu phòng vẫn còn.' },
  PaymentFailed: { icon: 'close-circle', color: colors.danger, title: 'Thanh toán không thành công', text: 'Giao dịch bị hủy hoặc thất bại. Bạn có thể thử thanh toán lại.' }
};
const RETRYABLE = ['Hold', 'Expired', 'PaymentFailed'];

// Shown after the VNPay browser closes: reads the booking's real status from the server.
export default function BookingResultScreen() {
  const { code } = useLocalSearchParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { items } = await bookingApi.mine();
      const found = items.find(x => x.bookingCode === code);
      if (!found) throw new Error('Không tìm thấy đơn đặt phòng.');
      setBooking(found);
    } catch (e) {
      setError(e.message);
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const retry = async () => {
    setBusy(true);
    try {
      const result = await bookingApi.retryPayment(booking.id);
      await openPayment(result.paymentUrl);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !booking) return <ErrorMessage message={error} onRetry={load} />;
  if (!booking) return <Loading label="Đang kiểm tra thanh toán…" />;

  const outcome = OUTCOMES[booking.status] ?? { icon: 'information-circle', color: colors.primary, title: `Trạng thái: ${booking.status}`, text: '' };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Ionicons name={outcome.icon} size={72} color={outcome.color} />
        <Text style={styles.title}>{outcome.title}</Text>
        <Text style={styles.text}>{outcome.text}</Text>
      </View>

      <Card style={styles.card}>
        <Row label="Mã đơn" value={booking.bookingCode} />
        <Row label="Homestay" value={booking.homestayName} />
        <Row label="Phòng" value={booking.rooms?.join(', ')} />
        <Row label="Nhận phòng" value={displayDate(booking.checkInDate)} />
        <Row label="Trả phòng" value={displayDate(booking.checkOutDate)} />
        <Row label="Tổng tiền" value={money(booking.totalAmount)} />
      </Card>

      {error ? <ErrorMessage message={error} /> : null}

      {RETRYABLE.includes(booking.status) ? <Button title="Thanh toán" onPress={retry} loading={busy} /> : null}
      {booking.status === 'Hold' ? <Button title="Tôi đã thanh toán, kiểm tra lại" variant="outline" onPress={load} /> : null}
      <Button title="Xem đơn của tôi" variant="outline" onPress={() => router.replace('/bookings')} />
      <Button title="Về trang chủ" variant="outline" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  title: { fontSize: font.heading - 2, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  text: { fontSize: font.body, color: colors.textMuted, textAlign: 'center' },
  card: { padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { fontSize: font.body - 1, color: colors.textMuted },
  value: { flex: 1, textAlign: 'right', fontSize: font.body - 1, fontWeight: '600', color: colors.text }
});
