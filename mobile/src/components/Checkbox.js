import { Pressable, StyleSheet } from 'react-native';
import { Text } from './Text.js';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, spacing } from '../theme.js';

export default function Checkbox({ checked, onChange, label }) {
  return (
    <Pressable style={styles.row} onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.primary : colors.textMuted} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  label: { flex: 1, fontSize: font.body - 1, color: colors.text, lineHeight: 20 }
});
