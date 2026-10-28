import { StyleSheet, View } from 'react-native';
import { Text } from '../Text.js';
import { colors } from '../../theme.js';

// Web section heading: yellow uppercase kicker, then a navy title whose last words are yellow
// (e.g. "HOMESTAY ĐƯỢC <em>YÊU THÍCH</em>").
export default function SectionTitle({ kicker, title, highlight, darkKicker = false, light = false, style }) {
  return (
    <View style={[styles.wrap, style]}>
      {kicker ? <Text style={[styles.kicker, darkKicker && { color: colors.navyDeep }]}>{kicker}</Text> : null}
      <Text style={[styles.title, light && { color: '#fff' }]}>
        {title}{highlight ? <Text style={styles.highlight}> {highlight}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  kicker: { color: colors.accent, fontSize: 14, fontWeight: '600', letterSpacing: 0.6 },
  title: { color: colors.navyDeep, fontSize: 26, lineHeight: 31, fontWeight: '600' },
  highlight: { color: colors.accent }
});
