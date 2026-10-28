import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthProvider } from '../auth/AuthContext.js';
import { FONT_FAMILY, colors } from '../theme.js';

// Be Vietnam Pro, the web app's typeface, registered as one family so fontWeight selects the face.
// Files are required one by one so only these weights are bundled.
const FONT_FACES = [
  { path: require('@expo-google-fonts/be-vietnam-pro/300Light/BeVietnamPro_300Light.ttf'), weight: 300 },
  { path: require('@expo-google-fonts/be-vietnam-pro/400Regular/BeVietnamPro_400Regular.ttf'), weight: 400 },
  { path: require('@expo-google-fonts/be-vietnam-pro/500Medium/BeVietnamPro_500Medium.ttf'), weight: 500 },
  { path: require('@expo-google-fonts/be-vietnam-pro/600SemiBold/BeVietnamPro_600SemiBold.ttf'), weight: 600 },
  { path: require('@expo-google-fonts/be-vietnam-pro/700Bold/BeVietnamPro_700Bold.ttf'), weight: 700 },
  { path: require('@expo-google-fonts/be-vietnam-pro/800ExtraBold/BeVietnamPro_800ExtraBold.ttf'), weight: 800 }
];

export default function RootLayout() {
  const [loaded, error] = useFonts([{ fontFamily: FONT_FAMILY, fontDefinitions: FONT_FACES }]);
  // On a font error the app still renders, falling back to the system font.
  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.navy,
          headerTitleStyle: { fontFamily: FONT_FAMILY, fontWeight: '700' },
          headerBackTitleStyle: { fontFamily: FONT_FAMILY },
          contentStyle: { backgroundColor: colors.background }
        }}
      >
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
