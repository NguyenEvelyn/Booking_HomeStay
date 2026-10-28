import { Image, StyleSheet, View } from 'react-native';
import { Text } from '../Text.js';
import SectionTitle from './SectionTitle.js';
import { colors } from '../../theme.js';

const ABOUT_IMAGE = require('../../../assets/images/about.jpg');

// "VỀ CHÚNG TÔI" block with the same copy and figures as the web.
const STATS = [['1000+', 'Chỗ ở chất lượng'], ['50+', 'Điểm đến hấp dẫn'], ['98%', 'Khách hàng hài lòng'], ['2000+', 'Lượt đặt thành công']];

export default function About() {
  return (
    <View style={styles.section}>
      <Image source={ABOUT_IMAGE} style={styles.image} resizeMode="cover" accessibilityLabel="Biệt thự nghỉ dưỡng Tripio" />
      <SectionTitle kicker="VỀ CHÚNG TÔI" title="CÙNG TRIPIO KẾT NỐI NHỮNG HÀNH TRÌNH" highlight="ĐÁNG NHỚ" />
      <Text style={styles.body}>
        Tripio là nền tảng đặt phòng homestay trực tuyến, giúp bạn dễ dàng tìm kiếm, khám phá và lựa chọn không gian lưu trú
        phù hợp cho mỗi chuyến đi. Chúng tôi mang đến đa dạng lựa chọn lưu trú cùng trải nghiệm đặt phòng nhanh chóng, tiện lợi và đáng tin cậy.
      </Text>
      <View style={styles.trust}>
        <View style={{ flex: 1 }}>
          <Text style={styles.trustTitle}>Tin tưởng bởi</Text>
          <Text style={styles.trustText}>900+ Khách hàng</Text>
        </View>
        <View style={styles.divider} />
        <View style={{ flex: 1 }}>
          <Text style={styles.trustTitle}>4.8 ⭐⭐⭐⭐⭐</Text>
          <Text style={styles.trustText}>600+ Lượt đánh giá</Text>
        </View>
      </View>
      <View style={styles.stats}>
        {STATS.map(([value, label]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 18, paddingVertical: 48, gap: 18, backgroundColor: '#fff' },
  image: { width: '100%', aspectRatio: 580 / 610, borderRadius: 18 },
  body: { color: 'rgba(0,0,0,0.65)', fontSize: 14, lineHeight: 22 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  trustTitle: { fontSize: 14, fontWeight: '700', color: colors.navyDeep },
  trustText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 20 },
  stat: { width: '50%' },
  statValue: { fontSize: 27, fontWeight: '700', color: colors.navyDeep },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 }
});
