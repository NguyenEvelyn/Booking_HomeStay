import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme.js';

const icon = (name) => ({ color, size }) => <Ionicons name={name} size={size} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerTitleStyle: { color: colors.navy, fontWeight: '700' }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang chủ', headerTitle: 'Tripio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'Tìm kiếm', tabBarIcon: icon('search-outline') }} />
      <Tabs.Screen name="bookings" options={{ title: 'Đơn của tôi', tabBarIcon: icon('receipt-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Tài khoản', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
