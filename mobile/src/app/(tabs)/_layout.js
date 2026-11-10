import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FONT_FAMILY, colors } from '../../theme.js';

const icon = (name) => ({ color, size }) => <Ionicons name={name} size={size} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.navyDeep,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: FONT_FAMILY, fontWeight: '600', fontSize: 11 },
        headerTitleStyle: { color: colors.navyDeep, fontFamily: FONT_FAMILY, fontWeight: '700' }
      }}
    >
      {/* The home hero draws its own logo bar, like the web. */}
      <Tabs.Screen name="index" options={{ title: 'Trang chủ', headerShown: false, tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'Tìm kiếm', tabBarIcon: icon('search-outline') }} />
      <Tabs.Screen name="bookings" options={{ title: 'Đơn của tôi', tabBarIcon: icon('receipt-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Tài khoản', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
