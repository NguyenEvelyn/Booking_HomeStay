import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingApi } from '../../api/bookingApi.js';
import { useAuth } from '../../auth/AuthContext.js';
import { clearBookingDraft, getBookingDraft, stayPayload } from '../../booking/bookingDraft.js';
import { openPayment } from '../../booking/openPayment.js';
import Checkbox from '../../components/Checkbox.js';
import ChoiceChips from '../../components/ChoiceChips.js';
import PriceSummary from '../../components/PriceSummary.js';
import { Button, Card, EmptyState, ErrorMessage, TextField } from '../../components/ui.js';
import { colors, font, spacing } from '../../theme.js';
import { ageOn, displayDate, parseVnDate } from '../../utils/dates.js';
import { money } from '../../utils/format.js';

// Rules mirror BookingsController.ValidateGuest so most mistakes are caught before the server call.
function validate(form) {
  if (!form.fullName.trim()) return 'Vui lòng nhập họ tên khách chính.';
  const birthDate = parseVnDate(form.birthDate);
  if (!birthDate) return 'Ngày sinh không hợp lệ (định dạng ngày/tháng/năm, ví dụ 25/12/1995).';
  if (ageOn(birthDate) < 14) return 'Khách chính phải từ 14 tuổi trở lên.';
  if (!form.gender) return 'Vui lòng chọn giới tính.';
  if (!form.nationality.trim()) return 'Vui lòng nhập quốc tịch.';
  const doc = form.documentNumber.trim();
  if (form.documentType === 'CCCD' && !/^\d{12}$/.test(doc)) return 'Số CCCD phải gồm đúng 12 chữ số.';
  if (form.documentType === 'Hộ chiếu' && !/^[A-Za-z0-9]{6,12}$/.test(doc)) return 'Số hộ chiếu không hợp lệ (6–12 chữ hoặc số).';
  if (!form.address.trim()) return 'Vui lòng nhập địa chỉ thường trú.';
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Email không hợp lệ.';
  if (!/^\d{8,15}$/.test(form.phone.replace(/\s/g, ''))) return 'Số điện thoại phải có 8–15 chữ số.';
  return null;
}

// Step 2 of booking: primary guest declaration (required for residence registration), consents, VNPay.
export default function GuestDetailsScreen() {
  const draft = getBookingDraft();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '', birthDate: '', gender: '', nationality: 'Việt Nam', documentType: 'CCCD',
    documentNumber: '', address: '', email: user?.email ?? '', phone: user?.phoneNumber ?? '', arrivalTime: '', note: ''
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!draft?.quote) {
    return (
      <EmptyState title="Chưa có phòng được chọn" description="Vui lòng chọn ngày và phòng trước.">
        <Button title="Quay lại" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 12 }} />
      </EmptyState>
    );
  }

  const guests = draft.adults + draft.tallChildren + draft.smallChildren;
  const set = (field) => (value) => { setForm(f => ({ ...f, [field]: value })); setError(''); };

  const pay = async () => {
    const problem = validate(form) ?? (!privacyAccepted || !policyAccepted ? 'Vui lòng đồng ý xử lý dữ liệu cá nhân và chính sách hủy/hoàn cọc.' : null);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      const customerNote = [
        `Email: ${form.email.trim()}`,
        `Điện thoại: ${form.phone.trim()}`,
        `Giờ nhận phòng dự kiến: ${form.arrivalTime.trim() || 'Chưa biết'}`,
        form.note.trim() ? `Ghi chú: ${form.note.trim()}` : ''
      ].filter(Boolean).join('\n');
      const result = await bookingApi.createVnPayPayment({
        ...stayPayload(draft),
        customerNote,
        primaryGuest: {
          type: 'adult', fullName: form.fullName.trim(), birthDate: parseVnDate(form.birthDate), gender: form.gender,
          nationality: form.nationality.trim(), documentType: form.documentType, documentNumber: form.documentNumber.trim(),
          address: form.address.trim(), accompanyingAdult: null
        },
        companions: [],
        declareCompanionsLater: guests > 1,
        privacyAccepted,
        policyAccepted,
        expectedDealId: draft.quote.deal?.id ?? null
      });
      clearBookingDraft();
      await openPayment(result.paymentUrl);
      router.replace({ pathname: '/booking/result', params: { code: result.bookingCode } });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.homestay}>{draft.homestay.name}</Text>
          <Text style={styles.muted}>{draft.room.name} · {draft.quantity} phòng · {guests} khách</Text>
          <Text style={styles.muted}>{displayDate(draft.checkIn)} → {displayDate(draft.checkOut)}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Thông tin khách chính</Text>
          <Text style={styles.muted}>Dùng để khai báo lưu trú theo quy định.</Text>
          <TextField label="Họ và tên *" value={form.fullName} onChangeText={set('fullName')} autoCapitalize="words" />
          <TextField label="Ngày sinh * (ngày/tháng/năm)" value={form.birthDate} onChangeText={set('birthDate')} placeholder="25/12/1995" keyboardType="numbers-and-punctuation" />
          <ChoiceChips label="Giới tính *" options={['Nam', 'Nữ', 'Khác']} value={form.gender} onChange={set('gender')} />
          <TextField label="Quốc tịch *" value={form.nationality} onChangeText={set('nationality')} />
          <ChoiceChips label="Loại giấy tờ *" options={['CCCD', 'Hộ chiếu']} value={form.documentType} onChange={set('documentType')} />
          <TextField label={`Số ${form.documentType} *`} value={form.documentNumber} onChangeText={set('documentNumber')} keyboardType={form.documentType === 'CCCD' ? 'number-pad' : 'default'} autoCapitalize="characters" />
          <TextField label="Địa chỉ thường trú *" value={form.address} onChangeText={set('address')} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Liên hệ</Text>
          <TextField label="Email *" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
          <TextField label="Số điện thoại *" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <TextField label="Giờ nhận phòng dự kiến" value={form.arrivalTime} onChangeText={set('arrivalTime')} placeholder="Ví dụ: 15:00" />
          <TextField label="Ghi chú cho chủ nhà" value={form.note} onChangeText={set('note')} multiline style={{ marginBottom: 0 }} />
          {guests > 1 ? <Text style={styles.muted}>Thông tin {guests - 1} khách đi cùng sẽ được khai báo sau (trong mục Đơn của tôi hoặc khi nhận phòng).</Text> : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Thanh toán</Text>
          <PriceSummary quote={draft.quote} />
          <Checkbox checked={privacyAccepted} onChange={setPrivacyAccepted} label="Tôi đồng ý cho Tripio và chủ nhà xử lý dữ liệu cá nhân để khai báo lưu trú." />
          <Checkbox checked={policyAccepted} onChange={setPolicyAccepted} label="Tôi đã đọc và đồng ý chính sách hủy phòng và hoàn cọc của homestay." />
        </Card>

        {error ? <ErrorMessage message={error} /> : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button title={`Thanh toán ${money(draft.quote.amountDueNow)} qua VNPay`} onPress={pay} loading={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.xs },
  homestay: { fontSize: font.title, fontWeight: '800', color: colors.navy },
  heading: { fontSize: font.title - 1, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  muted: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.xs },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md }
});
