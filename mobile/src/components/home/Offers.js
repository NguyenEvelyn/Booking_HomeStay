import { useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../Text.js';
import { colors } from '../../theme.js';
import { money } from '../../utils/format.js';

const OFFERS_BACKGROUND = require('../../../assets/images/offers-bg.jpg');
const VOUCHER_IMAGES = [
  require('../../../assets/images/voucher-week.jpg'),
  require('../../../assets/images/voucher-hotdeal.jpg'),
  require('../../../assets/images/voucher-summer.jpg')
];

// Same wording as the web voucherCardContent(): the discount is the headline, conditions below.
function describe(v) {
  const percent = v.discountType === 'Percentage';
  return {
    discount: percent ? `Giảm ${Number(v.discountValue)}%` : `Giảm ${money(v.discountValue)}`,
    meta: [
      Number(v.minimumBookingAmount) > 0 ? `Đơn từ ${money(v.minimumBookingAmount)}` : 'Không yêu cầu đơn tối thiểu',
      percent && Number(v.maximumDiscount) > 0 ? `Giảm tối đa ${money(v.maximumDiscount)}` : null,
      `Hạn ${new Date(v.validUntil).toLocaleDateString('vi-VN')}`,
      v.homestayName ? `Chỉ áp dụng tại ${v.homestayName}` : null
    ].filter(Boolean).join(' · ')
  };
}

// The navy "ƯU ĐÃI" block with voucher cards; tapping a card reveals its code to enter at booking.
export default function Offers({ vouchers }) {
  const [revealed, setRevealed] = useState(null);
  if (!vouchers.length) return null;

  return (
    <ImageBackground source={OFFERS_BACKGROUND} style={styles.section} imageStyle={{ borderRadius: 28 }}>
      <LinearGradient colors={['rgba(1,30,96,0.88)', 'rgba(1,30,96,0.55)']} style={[StyleSheet.absoluteFill, { borderRadius: 28 }]} />
      <Text style={styles.kicker}>ƯU ĐÃI CÙNG TRIPIO</Text>
      <Text style={styles.title}>SĂN NGAY NHỮNG <Text style={{ color: colors.accent }}>KHUYẾN MÃI</Text> HẤP DẪN NHẤT</Text>
      <Text style={styles.lead}>Chạm vào voucher để xem mã, nhập mã khi đặt phòng.</Text>
      <View style={styles.list}>
        {vouchers.slice(0, 5).map((v, index) => {
          const card = describe(v);
          return (
            <Pressable key={v.id} style={styles.card} onPress={() => setRevealed(revealed === v.id ? null : v.id)}>
              <Image source={VOUCHER_IMAGES[index % VOUCHER_IMAGES.length]} style={styles.image} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>{v.name}</Text>
                <Text style={styles.discount}>{card.discount}</Text>
                <Text style={styles.meta} numberOfLines={2}>{card.meta}</Text>
                <Text style={styles.code}>{revealed === v.id ? `Mã: ${v.code}` : 'Chạm để xem mã'}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 14, marginVertical: 24, borderRadius: 28, overflow: 'hidden', paddingVertical: 24, paddingHorizontal: 16, gap: 8 },
  kicker: { color: colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 32 },
  lead: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 6 },
  list: { gap: 12 },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.97)', minHeight: 120 },
  image: { width: 104, height: 96, borderRadius: 10 },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  discount: { fontSize: 17, fontWeight: '800', color: colors.primary },
  meta: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
  code: { fontSize: 12, fontWeight: '700', color: colors.navy, marginTop: 2 }
});
