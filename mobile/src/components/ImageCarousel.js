import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme.js';

// Full-width swipeable photo strip with a page counter, like the gallery on booking apps.
export default function ImageCarousel({ images, height = 260 }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (!images?.length) return <View style={[{ width, height }, styles.placeholder]} />;

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {images.map(image => (
          <Image key={image.id ?? image.url} source={{ uri: image.url }} style={{ width, height }} resizeMode="cover" accessibilityLabel={image.caption ?? undefined} />
        ))}
      </ScrollView>
      {images.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>{index + 1}/{images.length}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.border },
  counter: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(15,23,42,.7)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' }
});
