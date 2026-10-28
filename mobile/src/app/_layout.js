import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../auth/AuthContext.js';
import { colors } from '../theme.js';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: colors.navy, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Đăng nhập', presentation: 'modal' }} />
        <Stack.Screen name="homestay/[id]" options={{ title: '', headerBackTitle: 'Quay lại' }} />
      </Stack>
    </AuthProvider>
  );
}
