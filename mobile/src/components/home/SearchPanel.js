import { useState } from 'react';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, TextInput } from '../Text.js';
import RangeCalendar from '../RangeCalendar.js';
import Stepper from '../Stepper.js';
import { Button } from '../ui.js';
import { colors, radius, spacing } from '../../theme.js';
import { displayDate } from '../../utils/dates.js';

// The web's white search bar under the hero, stacked into one column as on a phone.
export default function SearchPanel() {
  const [location, setLocation] = useState('');
  const [stay, setStay] = useState({ checkIn: '', checkOut: '' });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [picker, setPicker] = useState(null); // 'dates' | 'guests'

  const submit = () => router.push({
    pathname: '/search',
    params: { search: location.trim(), checkIn: stay.checkIn, checkOut: stay.checkOut, guests: adults + children }
  });

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Địa điểm hoặc tên khách sạn</Text>
      <View style={styles.control}>
        <TextInput value={location} onChangeText={setLocation} placeholder="Bạn muốn đến đâu?" placeholderTextColor="#9aa4b2" style={styles.input} returnKeyType="search" onSubmitEditing={submit} />
        <Ionicons name="location-outline" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.row}>
        <Field label="Ngày nhận" value={stay.checkIn ? displayDate(stay.checkIn) : 'Chọn ngày'} empty={!stay.checkIn} onPress={() => setPicker('dates')} />
        <Field label="Ngày trả" value={stay.checkOut ? displayDate(stay.checkOut) : 'Chọn ngày'} empty={!stay.checkOut} onPress={() => setPicker('dates')} />
      </View>
      <Field label="Khách" value={`${adults} người lớn${children ? `, ${children} trẻ em` : ''}`} onPress={() => setPicker('guests')} icon="people-outline" />

      <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} onPress={submit}>
        <Text style={styles.buttonText}>Tìm phòng</Text>
      </Pressable>

      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{picker === 'dates' ? 'Chọn ngày nhận và trả phòng' : 'Số khách'}</Text>
          {picker === 'dates'
            ? <RangeCalendar checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={setStay} />
            : (
              <>
                <Stepper label="Người lớn" hint="Từ 12 tuổi" value={adults} min={1} onChange={setAdults} />
                <Stepper label="Trẻ em" hint="Dưới 12 tuổi" value={children} onChange={setChildren} />
              </>
            )}
          <Button title="Xong" onPress={() => setPicker(null)} style={{ marginTop: spacing.md }} />
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, empty, onPress, icon = 'calendar-outline' }) {
  return (
    <Pressable style={{ flex: 1 }} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>
        <Text style={[styles.value, empty && { color: '#9aa4b2' }]} numberOfLines={1}>{value}</Text>
        <Ionicons name={icon} size={17} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 22, gap: 6,
    shadowColor: '#051937', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4
  },
  label: { color: '#151515', fontSize: 12, fontWeight: '600', marginTop: 6, marginBottom: 6 },
  control: { flexDirection: 'row', alignItems: 'center', height: 42, borderWidth: 1, borderColor: '#d9dee7', borderRadius: 6, paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  value: { flex: 1, fontSize: 13, color: colors.text },
  row: { flexDirection: 'row', gap: 10 },
  button: { marginTop: 14, height: 44, borderRadius: 5, backgroundColor: colors.searchButton, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.searchButtonText, fontSize: 14, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl * 1.5 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.navyDeep, marginBottom: spacing.md }
});
