import { StyleSheet, Text } from 'react-native';
import { STATUS } from '../booking/bookingStatus.js';
import { radius } from '../theme.js';

export default function StatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, color: '#334155', bg: '#e2e8f0' };
  return <Text style={[styles.badge, { color: s.color, backgroundColor: s.bg }]}>{s.label}</Text>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' }
});
