import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, TextInput } from '../../components/Text.js';
import { homestayApi } from '../../api/homestayApi.js';
import HomestayCard from '../../components/HomestayCard.js';
import { EmptyState, ErrorMessage, Loading } from '../../components/ui.js';
import { colors, radius, spacing } from '../../theme.js';
import { displayDate } from '../../utils/dates.js';

const PAGE_SIZE = 10;
// Values HomestayQueryService understands; anything else means featured first, then newest.
const SORTS = [['', 'Nổi bật'], ['rating', 'Đánh giá cao'], ['price-low', 'Giá thấp nhất']];

// Results for the home search panel, a destination card or "Xem tất cả". Dates and guests filter
// availability on the server exactly like the web listing.
export default function SearchScreen() {
  const params = useLocalSearchParams();
  const [query, setQuery] = useState(params.search ?? '');
  const [sort, setSort] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  // A new search from the home screen replaces the current text.
  useEffect(() => { setQuery(params.search ?? ''); }, [params.search]);

  const filters = { search: query.trim(), checkIn: params.checkIn ?? '', checkOut: params.checkOut ?? '', guests: Number(params.guests) || 1, sort };
  const key = JSON.stringify(filters);

  const load = useCallback(async (nextPage) => {
    const f = JSON.parse(key);
    nextPage === 1 ? setLoading(true) : setMore(true);
    setError('');
    try {
      const data = await homestayApi.list({ ...f, page: nextPage, pageSize: PAGE_SIZE });
      setItems(prev => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(nextPage);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false); setMore(false);
    }
  }, [key]);

  // Debounce typing; other filter changes apply at once.
  useEffect(() => { const t = setTimeout(() => load(1), 350); return () => clearTimeout(t); }, [load]);

  const stayText = params.checkIn && params.checkOut ? `${displayDate(params.checkIn)} → ${displayDate(params.checkOut)}` : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.bar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Địa điểm hoặc tên homestay" placeholderTextColor="#9aa4b2" style={styles.input} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable> : null}
        </View>
        {stayText ? <Text style={styles.filterInfo}>{stayText} · {filters.guests} khách</Text> : null}
        <View style={styles.sorts}>
          {SORTS.map(([value, label]) => (
            <Pressable key={value} onPress={() => setSort(value)} style={[styles.sort, sort === value && styles.sortActive]}>
              <Text style={[styles.sortText, sort === value && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? <Loading label="Đang tìm homestay…" />
        : error ? <ErrorMessage message={error} onRetry={() => load(1)} />
          : (
            <FlatList
              data={items}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => <HomestayCard item={item} />}
              contentContainerStyle={styles.list}
              ListHeaderComponent={<Text style={styles.count}>{total} homestay phù hợp</Text>}
              ListEmptyComponent={<EmptyState title="Không tìm thấy homestay" description="Thử từ khóa khác hoặc đổi ngày." />}
              ListFooterComponent={more ? <Loading label="Đang tải thêm…" /> : null}
              onEndReachedThreshold={0.4}
              onEndReached={() => { if (!more && items.length < total) load(page + 1); }}
            />
          )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#fff', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderWidth: 1, borderColor: '#d9dee7', borderRadius: radius.pill, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  filterInfo: { fontSize: 12, color: colors.navy, fontWeight: '600' },
  sorts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sort: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  sortActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  sortText: { fontSize: 12, fontWeight: '600', color: colors.text },
  list: { padding: spacing.lg, flexGrow: 1 },
  count: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md }
});
