import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './Text.js';
import { colors, font, radius, spacing } from '../theme.js';

// Shared building blocks that replace the web app's CSS classes.

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }) {
  const outline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        outline ? styles.buttonOutline : styles.buttonPrimary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style
      ]}
    >
      {loading
        ? <ActivityIndicator color={outline ? colors.primary : '#fff'} />
        : <Text style={[styles.buttonText, outline && { color: colors.primary }]}>{title}</Text>}
    </Pressable>
  );
}

export function TextField({ label, error, style, ...inputProps }) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, error && { borderColor: colors.danger }]} {...inputProps} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Loading({ label = 'Đang tải…' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorBoxText}>{message}</Text>
      {onRetry ? <Button title="Thử lại" variant="outline" onPress={onRetry} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function EmptyState({ title, description, children }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={[styles.muted, { textAlign: 'center' }]}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: '#fff', fontSize: font.body, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  field: { marginBottom: spacing.md },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, fontSize: font.body, color: colors.text, backgroundColor: colors.surface
  },
  errorText: { color: colors.danger, fontSize: font.small, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden'
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: font.body },
  emptyTitle: { fontSize: font.title, fontWeight: '700', color: colors.text },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: radius.md, padding: spacing.md, margin: spacing.lg },
  errorBoxText: { color: colors.danger, fontSize: font.body }
});
