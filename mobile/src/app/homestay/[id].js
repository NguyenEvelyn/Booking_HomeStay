import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { homestayApi } from '../../api/homestayApi.js';
import ImageCarousel from '../../components/ImageCarousel.js';
import RoomTypeCard from '../../components/RoomTypeCard.js';
import { Button, ErrorMessage, Loading } from '../../components/ui.js';
import { colors, font, radius, spacing } from '../../theme.js';
import { money, shortDate, shortTime } from '../../utils/format.js';

const REVIEW_PREVIEW = 3;

export default function HomestayDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const [roomsY, setRoomsY] = useState(0);
  const [homestay, setHomestay] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, reviewData] = await Promise.all([
        homestayApi.detail(id),
        homestayApi.reviews(id).catch(() => null) // reviews are secondary; the page still works without them
      ]);
      setHomestay(detail);
      setReviews(reviewData);
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!homestay) return <Loading label="Đang tải homestay…" />;

  const address = [homestay.addressLine, homestay.ward, homestay.district, homestay.province].filter(Boolean).join(', ');
  const rooms = homestay.roomTypes ?? [];
  const fromPrice = rooms.length ? Math.min(...rooms.map(r => r.basePrice)) : null;
  const images = [...(homestay.images ?? [])].sort((a, b) => (b.isThumbnail - a.isThumbnail) || (a.sortOrder - b.sortOrder));

  const scrollToRooms = () => scrollRef.current?.scrollTo({ y: roomsY, animated: true });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: homestay.name }} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}>
        <ImageCarousel images={images} />

        <View style={styles.section}>
          <Text style={styles.name}>{homestay.name}</Text>
          {address ? (
            <View style={styles.inline}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.muted}>{address}</Text>
            </View>
          ) : null}
          <View style={styles.inline}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.muted}>
              {reviews?.total ? `${Number(reviews.average).toFixed(1)} · ${reviews.total} đánh giá` : 'Chưa có đánh giá'}
            </Text>
          </View>
          <View style={styles.times}>
            <TimeBox icon="log-in-outline" label="Nhận phòng" value={`từ ${shortTime(homestay.checkInTime)}`} />
            <TimeBox icon="log-out-outline" label="Trả phòng" value={`trước ${shortTime(homestay.checkOutTime)}`} />
          </View>
        </View>

        {homestay.description ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Giới thiệu</Text>
            <Text style={styles.body} numberOfLines={expanded ? undefined : 4}>{homestay.description}</Text>
            <Pressable onPress={() => setExpanded(v => !v)}>
              <Text style={styles.link}>{expanded ? 'Thu gọn' : 'Xem thêm'}</Text>
            </Pressable>
          </View>
        ) : null}

        {homestay.amenities?.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Tiện nghi</Text>
            <View style={styles.chips}>
              {homestay.amenities.map(a => <Text key={a.id} style={styles.chip}>{a.name}</Text>)}
            </View>
          </View>
        ) : null}

        <View style={styles.section} onLayout={e => setRoomsY(e.nativeEvent.layout.y)}>
          <Text style={styles.heading}>Loại phòng ({rooms.length})</Text>
          {rooms.length
            ? rooms.map(room => (
              <RoomTypeCard key={room.id} room={room}
                onSelect={() => router.push({ pathname: '/booking/new', params: { homestayId: homestay.id, roomTypeId: room.id } })} />
            ))
            : <Text style={styles.muted}>Homestay chưa mở bán phòng nào.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Đánh giá của khách</Text>
          {reviews?.items?.length
            ? reviews.items.slice(0, REVIEW_PREVIEW).map(r => <ReviewItem key={r.id} review={r} />)
            : <Text style={styles.muted}>Chưa có đánh giá nào.</Text>}
          {reviews?.total > REVIEW_PREVIEW ? <Text style={styles.muted}>Và {reviews.total - REVIEW_PREVIEW} đánh giá khác.</Text> : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: spacing.md + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Giá chỉ từ</Text>
          <Text style={styles.bottomPrice}>{fromPrice != null ? `${money(fromPrice)}/đêm` : 'Liên hệ'}</Text>
        </View>
        <Button title="Chọn phòng" onPress={scrollToRooms} disabled={!rooms.length} />
      </View>
    </View>
  );
}

function TimeBox({ icon, label, value }) {
  return (
    <View style={styles.timeBox}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <View>
        <Text style={styles.timeLabel}>{label}</Text>
        <Text style={styles.timeValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReviewItem({ review }) {
  return (
    <View style={styles.review}>
      <View style={styles.reviewHead}>
        <Text style={styles.reviewName}>{review.customerName}</Text>
        <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
      </View>
      <Text style={styles.reviewDate}>{shortDate(review.createdAt)}</Text>
      {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
      {review.hostReply ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>Phản hồi của chủ nhà</Text>
          <Text style={styles.body}>{review.hostReply}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, padding: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm },
  name: { fontSize: font.heading, fontWeight: '800', color: colors.navy },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: spacing.lg },
  muted: { fontSize: font.small + 1, color: colors.textMuted },
  heading: { fontSize: font.title, fontWeight: '700', color: colors.text },
  body: { fontSize: font.body, color: colors.text, lineHeight: 22 },
  link: { color: colors.primary, fontWeight: '700', fontSize: font.body },
  times: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  timeBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  timeLabel: { fontSize: 12, color: colors.textMuted },
  timeValue: { fontSize: font.body, fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { fontSize: font.small, color: colors.navy, backgroundColor: '#eef3fe', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden' },
  review: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: 4 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  reviewStars: { color: colors.warning, fontSize: font.body },
  reviewDate: { fontSize: 12, color: colors.textMuted },
  reply: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs, gap: 2 },
  replyLabel: { fontSize: 12, fontWeight: '700', color: colors.primary },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md
  },
  bottomPrice: { fontSize: font.title, fontWeight: '800', color: colors.primary }
});
