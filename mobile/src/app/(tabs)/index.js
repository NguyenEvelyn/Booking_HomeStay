import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { homestayApi } from '../../api/homestayApi.js';
import HomestayCard from '../../components/HomestayCard.js';
import { EmptyState, ErrorMessage, Loading } from '../../components/ui.js';
import { useAuth } from '../../auth/AuthContext.js';
import { colors, font, spacing } from '../../theme.js';

const PAGE_SIZE = 10;

export default function HomeScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage, mode) => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'more') setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const data = await homestayApi.list({ page: nextPage, pageSize: PAGE_SIZE });
      setItems(prev => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(nextPage);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setRefreshing(false); setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  if (loading) return <Loading label="Đang tải homestay…" />;
  if (error && items.length === 0) return <ErrorMessage message={error} onRetry={() => load(1)} />;

  return (
    <FlatList
      data={items}
      keyExtractor={item => String(item.id)}
      renderItem={({ item }) => <HomestayCard item={item} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.greeting}>{user ? `Xin chào, ${user.fullName}` : 'Xin chào!'}</Text>
          <Text style={styles.subtitle}>Khám phá {total} homestay trên Tripio</Text>
        </View>
      }
      ListEmptyComponent={<EmptyState title="Chưa có homestay" description="Hiện chưa có homestay nào đang hoạt động." />}
      ListFooterComponent={loadingMore ? <Loading label="Đang tải thêm…" /> : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1, 'refresh')} tintColor={colors.primary} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (!loadingMore && items.length < total) load(page + 1, 'more'); }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  greeting: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: font.body, color: colors.textMuted, marginTop: spacing.xs }
});
