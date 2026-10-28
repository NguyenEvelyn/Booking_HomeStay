import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../Text.js';
import SectionTitle from './SectionTitle.js';
import { shadow } from '../../theme.js';

// Same eight destinations and photos as the web home page.
const DESTINATIONS = [
  ['01', 'Phú Quốc', require('../../../assets/images/dest-phuquoc.jpg')],
  ['02', 'Quy Nhơn', require('../../../assets/images/dest-quynhon.jpg')],
  ['03', 'Vũng Tàu', require('../../../assets/images/dest-vungtau.jpg')],
  ['04', 'Đà Nẵng', require('../../../assets/images/dest-danang.jpg')],
  ['05', 'Vịnh Hạ Long', require('../../../assets/images/dest-halong.jpg')],
  ['06', 'Hòn Sơn', require('../../../assets/images/dest-honson.jpg')],
  ['07', 'Cần Thơ', require('../../../assets/images/dest-cantho.jpg')],
  ['08', 'Phú Quý', require('../../../assets/images/dest-phuquy.jpg')]
];

export default function Destinations() {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.6);

  return (
    <View style={styles.section}>
      <SectionTitle kicker="XU HƯỚNG DU LỊCH" darkKicker title="CÁC ĐIỂM ĐẾN ĐANG" highlight="THỊNH HÀNH" style={{ paddingHorizontal: 18 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 14} decelerationRate="fast" contentContainerStyle={styles.track}>
        {DESTINATIONS.map(([number, name, image]) => (
          <Pressable key={number} style={[styles.card, { width: cardWidth }]} onPress={() => router.push({ pathname: '/search', params: { search: name } })}>
            <Image source={image} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
            <Text style={styles.number}>{number}</Text>
            <View style={styles.bottom}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.arrow}><Ionicons name="arrow-forward" size={16} color="#fff" style={{ transform: [{ rotate: '-45deg' }] }} /></View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 40, gap: 22 },
  track: { paddingHorizontal: 18, gap: 14, paddingBottom: 12 },
  card: { height: 360, borderRadius: 18, overflow: 'hidden', backgroundColor: '#141c2e', ...shadow },
  number: { position: 'absolute', top: 20, left: 20, color: '#fff', fontSize: 34, fontWeight: '600', letterSpacing: -1 },
  bottom: { position: 'absolute', left: 20, right: 16, bottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: '#fff', fontSize: 20, fontWeight: '600' },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }
});
