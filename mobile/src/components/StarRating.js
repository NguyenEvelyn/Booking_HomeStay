import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme.js';

export default function StarRating({ value, onChange, size = 32 }) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange?.(n)} disabled={!onChange} hitSlop={4} accessibilityLabel={`${n} sao`}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={colors.warning} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 6 } });
