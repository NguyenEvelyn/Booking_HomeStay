import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { bookingApi } from '../../api/bookingApi.js';
import { useAuth } from '../../auth/AuthContext.js';
import { GROUPS } from '../../booking/bookingStatus.js';
import StatusBadge from '../../components/StatusBadge.js';
import { Button, Card, EmptyState, ErrorMessage, Loading } from '../../components/ui.js';
import { colors, font, radius, spacing } from '../../theme.js';
import { displayDate } from '../../utils/dates.js';
import { money } from '../../utils/format.js';

export default function BookingsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [group, setGroup] = useState('upcoming');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    if (refresh) setRefreshing(true);
    setError('');
    try {
      setItems((await bookingApi.mine()).items);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  // Reload whenever the tab comes back into view (after paying, cancelling or reviewing).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <EmptyState title="Bạn chưa đăng nhập" description="Đăng nhập để xem các đơn đặt phòng của bạn.">
        <Button title="Đăng nhập" onPress={() => router.push('/login')} style={{ marginTop: 12, alignSelf: 'stretch' }} />
      </EmptyState>
    );
  }
  if (error && !items) return <ErrorMessage message={error} onRetry={() => load()} />;
  if (!items) return <Loading label="Đang tải đơn đặt phòng…" />;

  const current = GROUPS.find(g => g.key === group);
  const visible = items.filter(b => current.statuses.includes(b.status));
  const count = (g) => items.filter(b => g.statuses.includes(b.status)).length;

  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {GROUPS.map(g => (
            <Pressable key={g.key} onPress={() => setGroup(g.key)} style={[styles.filter, g.key === group && styles.filterActive]}>
              <Text style={[styles.filterText, g.key === group && styles.filterTextActive]}>{g.label} ({count(g)})</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={visible}
        keyExtractor={b => String(b.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <BookingCard booking={item} />}
        ListEmptyComponent={<EmptyState title="Chưa có đơn nào" description={`Không có đơn ở mục “${current.label}”.`} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      />
    </View>
  );
}

function BookingCard({ booking }) {
  return (
    <Pressable onPress={() => router.push(`/booking/${booking.id}`)} style={({ pressed }) => pressed && { opacity: 0.9 }}>
      <Card style={styles.card}>
        {booking.homestayImage
          ? <Image source={{ uri: booking.homestayImage }} style={styles.thumb} />
          : <View style={[styles.thumb, { backgroundColor: colors.border }]} />}
        <View style={styles.cardBody}>
          <StatusBadge status={booking.status} />
          <Text style={styles.name} numberOfLines={1}>{booking.homestayName}</Text>
          <Text style={styles.muted}>{displayDate(booking.checkInDate)} → {displayDate(booking.checkOutDate)}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.muted} numberOfLines={1}>{booking.bookingCode}</Text>
            <Text style={styles.total}>{money(booking.totalAmount)}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  filter: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  filterActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterText: { fontSize: font.small + 1, fontWeight: '600', color: colors.text },
  filterTextActive: { color: '#fff' },
  list: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  card: { flexDirection: 'row', marginBottom: spacing.md },
  thumb: { width: 96, minHeight: 112 },
  cardBody: { flex: 1, padding: spacing.md, gap: 4 },
  name: { fontSize: font.body + 1, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  total: { fontSize: font.body, fontWeight: '800', color: colors.primary }
});
