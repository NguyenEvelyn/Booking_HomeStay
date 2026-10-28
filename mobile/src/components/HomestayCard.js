import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text.js';
import { router } from 'expo-router';
import { Card } from './ui.js';
import { colors, font, spacing } from '../theme.js';
import { money } from '../utils/format.js';

export default function HomestayCard({ item }) {
  const place = [item.district, item.province].filter(Boolean).join(', ');
  return (
    <Pressable onPress={() => router.push(`/homestay/${item.id}`)} style={({ pressed }) => pressed && { opacity: 0.9 }}>
      <Card style={styles.card}>
        {item.thumbnailUrl
          ? <Image source={{ uri: item.thumbnailUrl }} style={styles.image} resizeMode="cover" />
          : <View style={[styles.image, styles.placeholder]} />}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {place ? <Text style={styles.place} numberOfLines={1}>{place}</Text> : null}
          <View style={styles.row}>
            <Text style={styles.rating}>
              {item.averageRating ? `★ ${Number(item.averageRating).toFixed(1)} (${item.reviewCount})` : 'Chưa có đánh giá'}
            </Text>
            <Text style={styles.price}>
              {item.fromPrice ? <>từ <Text style={styles.priceValue}>{money(item.fromPrice)}</Text>/đêm</> : 'Liên hệ'}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  image: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.border },
  placeholder: { backgroundColor: '#dbe4f3' },
  body: { padding: spacing.md, gap: 4 },
  name: { fontSize: font.title, fontWeight: '700', color: colors.text },
  place: { fontSize: font.small, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  rating: { fontSize: font.small, color: colors.textMuted },
  price: { fontSize: font.small, color: colors.textMuted },
  priceValue: { fontSize: font.body, fontWeight: '700', color: colors.primary }
});
