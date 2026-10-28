import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme.js';

// Single-choice pills (gender, document type, payment option).
export default function ChoiceChips({ label, options, value, onChange }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map(option => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          const active = item.value === value;
          return (
            <Pressable key={item.value} onPress={() => onChange(item.value)} style={[styles.chip, active && styles.active]}>
              <Text style={[styles.text, active && styles.activeText]}>{item.label}</Text>
              {item.hint ? <Text style={[styles.hint, active && { color: '#dbe6ff' }]}>{item.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexGrow: 1, alignItems: 'center' },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: font.body, fontWeight: '600', color: colors.text },
  activeText: { color: '#fff' },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 2 }
});
