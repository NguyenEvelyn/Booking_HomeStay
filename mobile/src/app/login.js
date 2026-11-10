import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/Text.js';
import { Button, ErrorMessage, TextField } from '../components/ui.js';
import { useAuth } from '../auth/AuthContext.js';
import { colors, font, spacing } from '../theme.js';

export default function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!identifier.trim() || !password) { setError('Vui lòng nhập email/số điện thoại và mật khẩu.'); return; }
    setLoading(true);
    setError('');
    try {
      await login(identifier.trim(), password);
      router.back();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Chào mừng trở lại</Text>
        <Text style={styles.subtitle}>Đăng nhập để đặt phòng và theo dõi đơn của bạn.</Text>
        <TextField
          label="Email hoặc số điện thoại"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          placeholder="ban@example.com"
        />
        <TextField
          label="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="••••••••"
          onSubmitEditing={submit}
        />
        {error ? <ErrorMessage message={error} /> : null}
        <Button title="Đăng nhập" onPress={submit} loading={loading} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xl * 1.5 },
  title: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }
});
