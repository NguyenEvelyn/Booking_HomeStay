import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../Text.js';
import SectionTitle from './SectionTitle.js';
import { colors, shadow } from '../../theme.js';
import { money } from '../../utils/format.js';

// Web HotDealsSection: admin-approved banners and tonight's last-minute deals. Hidden when both are empty.
export default function HotDeals({ banners, deals }) {
  if (!banners.length && !deals.length) return null;

  // Banner targets are typed (BannerRules); the app opens the homestay or a search.
  const openBanner = (b) => {
    const link = b.link || {};
    if (link.homestayId) router.push(`/homestay/${link.homestayId}`);
    else if (link.type === 'Search') router.push({ pathname: '/search', params: { search: link.province ?? '' } });
  };

  return (
    <View style={styles.section}>
      {banners.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
          {banners.map(b => (
            <Pressable key={b.id} onPress={() => openBanner(b)}>
              <ImageBackground source={{ uri: b.imageUrl }} style={styles.banner} imageStyle={{ borderRadius: 16 }}>
                <LinearGradient colors={['rgba(9,39,95,0.82)', 'rgba(9,39,95,0.15)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
                <Text style={styles.bannerTitle}>{b.title}</Text>
                {b.subtitle ? <Text style={styles.bannerSubtitle}>{b.subtitle}</Text> : null}
                {b.link?.type === 'Deal' ? <Countdown until={b.link.saleEndsAt} light /> : null}
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {deals.length ? (
        <>
          <View style={styles.head}>
            <SectionTitle kicker="SĂN PHÒNG GIÁ RẺ" darkKicker title="🔥 Deal phút chót tối nay" />
            <Text style={styles.lead}>Phòng trống vào phút chót với giá giảm sâu. Số lượng có hạn, giá deal không hoàn tiền khi hủy.</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
            {deals.map(d => (
              <Pressable key={d.id} style={styles.card} onPress={() => router.push(`/homestay/${d.homestayId}`)}>
                <ImageBackground source={d.image ? { uri: d.image } : undefined} style={styles.cardImage}>
                  <Text style={styles.discount}>−{Number(d.discountPercent)}%</Text>
                </ImageBackground>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>{d.homestayName}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>{d.roomTypeName} · {[d.district, d.province].filter(Boolean).join(', ')}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.oldPrice}>{money(d.basePrice)}</Text>
                    <Text style={styles.newPrice}>{money(d.estimatedPrice)}</Text>
                    <Text style={styles.cardMeta}>/đêm</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.remaining}>Còn {d.remaining} phòng</Text>
                    <Countdown until={d.saleEndsAt} />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

function Countdown({ until, light }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, new Date(until).getTime() - now);
  if (!until || left === 0) return null;
  const h = Math.floor(left / 3600000), m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
  return <Text style={[styles.countdown, light && { color: '#ffd15a' }]}>⏱ {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</Text>;
}

const styles = StyleSheet.create({
  section: { paddingTop: 40, gap: 18 },
  head: { paddingHorizontal: 18, gap: 10 },
  lead: { color: 'rgba(0,0,0,0.6)', fontSize: 14, lineHeight: 21 },
  track: { paddingHorizontal: 18, gap: 14, paddingBottom: 10 },
  banner: { width: 300, height: 150, padding: 18, justifyContent: 'flex-end', gap: 4 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  card: { width: 240, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden', ...shadow },
  cardImage: { height: 140, backgroundColor: colors.border, padding: 10 },
  discount: { alignSelf: 'flex-start', backgroundColor: colors.danger, color: '#fff', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  cardBody: { padding: 12, gap: 4 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  oldPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  newPrice: { fontSize: 17, fontWeight: '800', color: colors.danger },
  remaining: { fontSize: 12, color: colors.navy, fontWeight: '600' },
  countdown: { fontSize: 12, fontWeight: '700', color: colors.danger }
});
