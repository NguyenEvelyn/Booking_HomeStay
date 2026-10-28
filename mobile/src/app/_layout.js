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
        <Stack.Screen name="booking/new" options={{ title: 'Chọn ngày & khách', headerBackTitle: 'Quay lại' }} />
        <Stack.Screen name="booking/guest" options={{ title: 'Thông tin đặt phòng', headerBackTitle: 'Quay lại' }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Chi tiết đơn', headerBackTitle: 'Quay lại' }} />
        <Stack.Screen name="booking/result" options={{ title: 'Kết quả đặt phòng', headerBackVisible: false, gestureEnabled: false }} />
      </Stack>
    </AuthProvider>
  );
}
