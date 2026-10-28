import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../Text.js';
import SectionTitle from './SectionTitle.js';
import { colors, shadow } from '../../theme.js';
import { money } from '../../utils/format.js';

const FALLBACK_DESCRIPTION = 'Khám phá điểm dừng chân hoàn hảo với trải nghiệm nghỉ dưỡng tiện nghi và đầy cảm hứng';

// "DÀNH CHO BẠN / HOMESTAY ĐƯỢC YÊU THÍCH": tall photo cards (82% of the screen wide on phones) with a
// glass location badge, rating pill, price and a glass "Đặt phòng" button.
export default function StaySlider({ stays }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.82);
  if (!stays.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.intro}>
        <SectionTitle kicker="DÀNH CHO BẠN" darkKicker title="HOMESTAY ĐƯỢC" highlight="YÊU THÍCH" />
        <Text style={styles.lead}>Khám phá các homestay được nhiều du khách yêu thích và lựa chọn cho hành trình đáng nhớ cùng những trải nghiệm trọn vẹn</Text>
        <Pressable style={styles.allButton} onPress={() => router.push('/search')}>
          <Text style={styles.allText}>Xem tất cả</Text>
          <View style={styles.arrowCircle}><Ionicons name="arrow-forward" size={16} color={colors.navyDeep} style={{ transform: [{ rotate: '-45deg' }] }} /></View>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 14} decelerationRate="fast" contentContainerStyle={styles.track}>
        {stays.map(stay => {
          const place = [stay.district, stay.province].filter(Boolean).join(', ') || 'Việt Nam';
          const open = () => router.push(`/homestay/${stay.id}`);
          return (
            <Pressable key={stay.id} style={[styles.card, { width: cardWidth }]} onPress={open}>
              <Image source={{ uri: stay.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.top}>
                <View style={styles.badge}>
                  <Ionicons name="location-outline" size={13} color="#fff" />
                  <Text style={styles.badgeText} numberOfLines={1}>{place}</Text>
                </View>
              </View>
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={styles.overlay} />
              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <Text style={styles.name} numberOfLines={1}>{stay.name}</Text>
                  <View style={styles.rating}>
                    <Text style={styles.ratingText}>{stay.averageRating ? Number(stay.averageRating).toFixed(1).replace('.', ',') : 'Mới'} </Text>
                    <Ionicons name="star" size={12} color="#ffd15a" />
                  </View>
                </View>
                <Text style={styles.description} numberOfLines={2}>{stay.description || FALLBACK_DESCRIPTION}</Text>
                <View style={styles.footer}>
                  <Text style={styles.price}>{stay.fromPrice ? `${money(stay.fromPrice)}` : 'Liên hệ'}<Text style={styles.perNight}>{stay.fromPrice ? '/đêm' : ''}</Text></Text>
                  <Pressable style={styles.bookButton} onPress={open}>
                    <Text style={styles.bookText}>Đặt phòng</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 48, gap: 24 },
  intro: { paddingHorizontal: 18, gap: 14 },
  lead: { color: 'rgba(0,0,0,0.6)', fontSize: 14, lineHeight: 21 },
  allButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6, paddingRight: 6, paddingLeft: 22, borderRadius: 999, backgroundColor: colors.navyDeep },
  allText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  arrowCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  track: { paddingHorizontal: 18, gap: 14, paddingBottom: 12 },
  card: { height: 390, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1a2233', ...shadow },
  top: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', maxWidth: '100%' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '500', flexShrink: 1 },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 210 },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' },
  rating: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  ratingText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  description: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  price: { color: '#fff', fontSize: 20, fontWeight: '700' },
  perNight: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },
  bookButton: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  bookText: { color: '#fff', fontSize: 15, fontWeight: '600' }
});
