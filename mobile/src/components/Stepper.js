import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, radius, spacing } from '../theme.js';

// "−  2  +" counter row used for guests and rooms.
export default function Stepper({ label, hint, value, min = 0, max = 20, onChange }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.controls}>
        <StepButton icon="remove" disabled={value <= min} onPress={() => onChange(value - 1)} />
        <Text style={styles.value}>{value}</Text>
        <StepButton icon="add" disabled={value >= max} onPress={() => onChange(value + 1)} />
      </View>
    </View>
  );
}

function StepButton({ icon, disabled, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={[styles.button, disabled && { opacity: 0.35 }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  label: { fontSize: font.body, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  button: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 24, textAlign: 'center', fontSize: font.title, fontWeight: '700', color: colors.text }
});
