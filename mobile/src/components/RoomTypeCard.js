import { Image, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './ui.js';
import { colors, font, radius, spacing } from '../theme.js';
import { money } from '../utils/format.js';

// One room type on the homestay detail screen. Capacity wording follows OccupancyRules: the standard
// capacity counts adults and children from 1.2 m; extra tall children may be allowed for a fee.
export default function RoomTypeCard({ room, onSelect }) {
  const facts = [
    room.bedType,
    room.roomSize ? `${room.roomSize} m²` : null,
    `Tiêu chuẩn ${room.baseCapacity} khách`
  ].filter(Boolean);
  const soldOut = room.availableRoomCount === 0;

  return (
    <Card style={styles.card}>
      {room.thumbnailUrl ? <Image source={{ uri: room.thumbnailUrl }} style={styles.image} resizeMode="cover" /> : null}
      <View style={styles.body}>
        <Text style={styles.name}>{room.name}</Text>
        <Text style={styles.facts}>{facts.join(' · ')}</Text>
        {room.maxExtraChildren > 0
          ? <Text style={styles.note}>Ở thêm tối đa {room.maxExtraChildren} trẻ{room.extraChildFee > 0 ? ` (phụ thu ${money(room.extraChildFee)}/đêm)` : ''}</Text>
          : null}
        <View style={styles.footer}>
          <Text style={[styles.badge, soldOut ? styles.badgeOut : styles.badgeIn]}>
            {soldOut ? 'Hết phòng' : `Còn ${room.availableRoomCount} phòng`}
          </Text>
          <Text style={styles.price}><Text style={styles.priceValue}>{money(room.basePrice)}</Text>/đêm</Text>
        </View>
        {onSelect ? <Button title={soldOut ? 'Hết phòng' : 'Chọn phòng này'} onPress={onSelect} disabled={soldOut} style={{ marginTop: spacing.sm }} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  image: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.border },
  body: { padding: spacing.md, gap: 4 },
  name: { fontSize: font.body + 1, fontWeight: '700', color: colors.text },
  facts: { fontSize: font.small, color: colors.textMuted },
  note: { fontSize: font.small, color: colors.textMuted },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  badgeIn: { color: colors.success, backgroundColor: '#dcfce7' },
  badgeOut: { color: colors.danger, backgroundColor: '#fee2e2' },
  price: { fontSize: font.small, color: colors.textMuted },
  priceValue: { fontSize: font.title, fontWeight: '800', color: colors.primary }
});
