import { useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../Text.js';

const HERO_FALLBACK = require('../../../assets/images/hero.jpg');
const LOGO = require('../../../assets/images/logo-white.png');
const HERO_HEIGHT = 560; // .hero at max-width 620px

// Web hero on a phone: full-bleed photo of the active AI pick, white logo and icons on top,
// "FIND YOUR PERFECT STAY" at the bottom, and the glass pick cards above it (swipe to change).
export default function HomeHero({ picks, loading }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);
  const cardWidth = width - 40;
  const current = picks[active];

  return (
    <View style={[styles.hero, { height: HERO_HEIGHT + insets.top }]}>
      <Image source={current?.thumbnailUrl ? { uri: current.thumbnailUrl } : HERO_FALLBACK} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(4,21,39,0.35)', 'rgba(4,21,39,0.02)', 'rgba(3,19,33,0.85)']}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.nav, { top: insets.top + 14 }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Tripio" />
        <View style={styles.navActions}>
          <GlassIcon name="heart-outline" label="Yêu thích" onPress={() => router.push('/search')} />
          <GlassIcon name="person-outline" label="Tài khoản" onPress={() => router.push('/account')} />
        </View>
      </View>

      {/* Picks sit right above the headline in one bottom-anchored column, so a two-line title never overlaps them. */}
      <View style={styles.bottomArea}>
      <View>
        {loading ? (
          <View style={[styles.pick, { width: cardWidth, justifyContent: 'center' }]}>
            <Text style={styles.pickLoading}>AI đang chọn Homestay phù hợp…</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            snapToInterval={cardWidth + 10}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
            scrollEventThrottle={32}
            onScroll={e => setActive(Math.min(picks.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 10)))))}
          >
            {picks.map((item, index) => (
              <Pressable key={item.id} style={[styles.pick, { width: cardWidth }, index === active && styles.pickActive]} onPress={() => router.push(`/homestay/${item.id}`)}>
                <Image source={{ uri: item.thumbnailUrl }} style={styles.pickImage} />
                <View style={styles.pickCopy}>
                  <Text style={[styles.pickTag, index === 0 && { color: '#ffd15a' }]}>
                    {index === 0 ? 'HOT NHẤT · AI GỢI Ý' : `${Math.round(item.score)}% PHÙ HỢP`}
                  </Text>
                  <Text style={styles.pickName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.pickPlace} numberOfLines={1}>{[item.district, item.province].filter(Boolean).join(', ') || item.reasons?.[0]}</Text>
                </View>
                <View style={styles.pickArrow}><Ionicons name="arrow-forward" size={16} color="#fff" style={{ transform: [{ rotate: '-45deg' }] }} /></View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.h1}>
          <Text style={{ fontWeight: '700' }}>FIND YOUR</Text> PERFECT STAY
        </Text>
        <Text style={styles.lead}>
          Khám phá những không gian lưu trú tuyệt vời, từ những căn homestay ấm cúng đến các điểm nghỉ dưỡng sang trọng,
          và bắt đầu hành trình của riêng bạn với những trải nghiệm đáng nhớ
        </Text>
      </View>
      </View>
    </View>
  );
}

function GlassIcon({ name, label, onPress }) {
  return (
    <Pressable style={styles.glassIcon} onPress={onPress} accessibilityLabel={label} hitSlop={6}>
      <Ionicons name={name} size={17} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', backgroundColor: '#0b1b33', overflow: 'hidden' },
  nav: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 82, height: 30 },
  navActions: { flexDirection: 'row', gap: 8 },
  glassIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  bottomArea: { position: 'absolute', left: 0, right: 0, bottom: 28, gap: 18 },
  pick: { height: 112, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(16,31,52,0.58)', flexDirection: 'row', alignItems: 'center', gap: 14 },
  pickActive: { borderColor: 'rgba(255,255,255,0.6)' },
  pickLoading: { color: '#fff', fontSize: 13, textAlign: 'center' },
  pickImage: { width: 96, height: 90, borderRadius: 10 },
  pickCopy: { flex: 1, gap: 4, paddingRight: 34 },
  pickTag: { color: '#b9d3ff', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  pickName: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  pickPlace: { color: 'rgba(255,255,255,0.68)', fontSize: 11 },
  pickArrow: { position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  content: { paddingHorizontal: 20 },
  h1: { color: '#fff', fontSize: 38, lineHeight: 40, fontWeight: '300', letterSpacing: -1.5 },
  lead: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18, marginTop: 12 }
});
