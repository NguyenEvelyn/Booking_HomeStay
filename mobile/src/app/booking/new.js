import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { homestayApi } from '../../api/homestayApi.js';
import { bookingApi } from '../../api/bookingApi.js';
import { useAuth } from '../../auth/AuthContext.js';
import { setBookingDraft, stayPayload } from '../../booking/bookingDraft.js';
import RangeCalendar from '../../components/RangeCalendar.js';
import Stepper from '../../components/Stepper.js';
import ChoiceChips from '../../components/ChoiceChips.js';
import PriceSummary from '../../components/PriceSummary.js';
import { Button, Card, ErrorMessage, Loading } from '../../components/ui.js';
import { colors, font, spacing } from '../../theme.js';
import { displayDate, nightsBetween } from '../../utils/dates.js';

// Step 1 of booking: dates, party and payment option, priced live by /bookings/quote.
export default function NewBookingScreen() {
  const { homestayId, roomTypeId } = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [homestay, setHomestay] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [stay, setStay] = useState({ checkIn: '', checkOut: '' });
  const [adults, setAdults] = useState(2);
  const [tallChildren, setTallChildren] = useState(0);
  const [smallChildren, setSmallChildren] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [paymentOption, setPaymentOption] = useState('Deposit');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    homestayApi.detail(homestayId).then(setHomestay).catch(e => setLoadError(e.message));
  }, [homestayId]);

  const room = useMemo(() => homestay?.roomTypes?.find(r => String(r.id) === String(roomTypeId)), [homestay, roomTypeId]);
  const nights = stay.checkIn && stay.checkOut ? nightsBetween(stay.checkIn, stay.checkOut) : 0;
  const draft = room && nights > 0 ? { homestay: { id: homestay.id, name: homestay.name }, room: { id: room.id, name: room.name }, ...stay, adults, tallChildren, smallChildren, quantity, paymentOption } : null;
  const draftKey = draft ? JSON.stringify(stayPayload(draft)) : '';

  // Re-quote (debounced) whenever the stay changes; the server answers 409 with a reason when the party
  // does not fit the room or the dates are sold out.
  useEffect(() => {
    if (!draftKey) { setQuote(null); setQuoteError(''); return undefined; }
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const result = await bookingApi.quote(JSON.parse(draftKey));
        if (!cancelled) { setQuote(result); setQuoteError(''); }
      } catch (e) {
        if (!cancelled) { setQuote(null); setQuoteError(e.message); }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [draftKey]);

  if (loadError) return <ErrorMessage message={loadError} />;
  if (!homestay) return <Loading />;
  if (!room) return <ErrorMessage message="Không tìm thấy loại phòng này." />;

  const next = () => {
    setBookingDraft({ ...draft, quote });
    if (!user) router.push('/login');
    else router.push('/booking/guest');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 110 + insets.bottom }]}>
        <View>
          <Text style={styles.homestay}>{homestay.name}</Text>
          <Text style={styles.room}>{room.name}</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.heading}>Chọn ngày</Text>
          <View style={styles.dates}>
            <DateBox label="Nhận phòng" value={stay.checkIn} />
            <DateBox label="Trả phòng" value={stay.checkOut} />
          </View>
          <RangeCalendar checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={setStay} />
          <Text style={styles.hint}>
            {!stay.checkIn ? 'Chạm ngày nhận phòng.' : !stay.checkOut ? 'Chạm ngày trả phòng.' : `${nights} đêm`}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Số khách và phòng</Text>
          <Stepper label="Người lớn" hint="Từ 12 tuổi" value={adults} min={1} onChange={setAdults} />
          <Stepper label="Trẻ em cao từ 1m2" hint="Tính vào sức chứa phòng" value={tallChildren} onChange={setTallChildren} />
          <Stepper label="Trẻ em dưới 1m2" hint="Miễn phí, không tính sức chứa" value={smallChildren} onChange={setSmallChildren} />
          <Stepper label="Số phòng" hint={`Còn ${room.availableRoomCount} phòng`} value={quantity} min={1} max={Math.max(1, room.availableRoomCount)} onChange={setQuantity} />
          <Text style={styles.hint}>Sức chứa tiêu chuẩn {room.baseCapacity} khách/phòng.</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Hình thức thanh toán</Text>
          <ChoiceChips
            options={[{ value: 'Deposit', label: 'Đặt cọc', hint: 'Trả phần còn lại khi nhận phòng' }, { value: 'Full', label: 'Trả toàn bộ', hint: 'Thanh toán ngay' }]}
            value={paymentOption}
            onChange={setPaymentOption}
          />
        </Card>

        {nights > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Chi tiết giá</Text>
            {quoting && !quote ? <Loading label="Đang tính giá…" /> : null}
            {quoteError ? <Text style={styles.error}>{quoteError}</Text> : null}
            {quote ? <PriceSummary quote={quote} /> : null}
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button
          title={user ? 'Tiếp tục' : 'Đăng nhập để đặt phòng'}
          onPress={next}
          disabled={!quote || quoting || Boolean(quoteError)}
        />
      </View>
    </View>
  );
}

function DateBox({ label, value }) {
  return (
    <View style={styles.dateBox}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={[styles.dateValue, !value && { color: colors.textMuted }]}>{value ? displayDate(value) : 'Chưa chọn'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  homestay: { fontSize: font.heading - 2, fontWeight: '800', color: colors.navy },
  room: { fontSize: font.body, color: colors.textMuted, marginTop: 2 },
  card: { padding: spacing.lg, gap: spacing.sm },
  heading: { fontSize: font.title - 1, fontWeight: '700', color: colors.text },
  dates: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dateBox: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
  dateLabel: { fontSize: 12, color: colors.textMuted },
  dateValue: { fontSize: font.body, fontWeight: '700', color: colors.text, marginTop: 2 },
  hint: { fontSize: font.small, color: colors.textMuted },
  error: { fontSize: font.body - 1, color: colors.danger },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md }
});
