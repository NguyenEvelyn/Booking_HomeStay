import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState } from '../../components/ui.js';
import { useAuth } from '../../auth/AuthContext.js';
import { API_URL } from '../../api/client.js';
import { colors, font, spacing } from '../../theme.js';

const ROLE_LABELS = { Customer: 'Khách hàng', Host: 'Chủ nhà', Admin: 'Quản trị viên', Support: 'Hỗ trợ' };

export default function AccountScreen() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <EmptyState title="Tài khoản" description="Đăng nhập để đặt phòng và quản lý đơn của bạn.">
        <Button title="Đăng nhập" onPress={() => router.push('/login')} style={{ marginTop: 12, alignSelf: 'stretch' }} />
      </EmptyState>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.line}>{user.email}</Text>
        {user.phoneNumber ? <Text style={styles.line}>{user.phoneNumber}</Text> : null}
        <Text style={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</Text>
      </Card>
      <Button title="Đăng xuất" variant="outline" onPress={logout} />
      {__DEV__ ? <Text style={styles.dev}>API: {API_URL}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.xs },
  name: { fontSize: font.title, fontWeight: '700', color: colors.text },
  line: { fontSize: font.body, color: colors.textMuted },
  role: { marginTop: spacing.sm, alignSelf: 'flex-start', color: colors.primary, fontWeight: '700' },
  dev: { fontSize: 12, color: colors.textMuted, textAlign: 'center' }
});
