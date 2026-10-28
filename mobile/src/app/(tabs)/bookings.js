import { router } from 'expo-router';
import { Button, EmptyState } from '../../components/ui.js';
import { useAuth } from '../../auth/AuthContext.js';

// The booking list arrives in the customer phase; for now it only gates on login.
export default function BookingsScreen() {
  const { user } = useAuth();
  if (!user) {
    return (
      <EmptyState title="Bạn chưa đăng nhập" description="Đăng nhập để xem các đơn đặt phòng của bạn.">
        <Button title="Đăng nhập" onPress={() => router.push('/login')} style={{ marginTop: 12, alignSelf: 'stretch' }} />
      </EmptyState>
    );
  }
  return <EmptyState title="Đơn của tôi" description="Danh sách đơn đặt phòng đang được xây dựng." />;
}
