import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FlowButton } from '@/components/flow-screen';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const wholeMap = require('../../assets/svg/whole_map.svg');
const MAP_ASPECT_RATIO = 94 / 47;

export default function BusanMapScreen() {
  const {
    availableWidth,
    bottomActionInset,
    centerContentOffset,
    contentMaxWidth,
    horizontalPadding,
    mediaMaxWidth,
    topInset,
  } = useResponsiveLayout();
  const mapWidth = Math.min(availableWidth, mediaMaxWidth);
  const mapHeight = mapWidth / MAP_ASPECT_RATIO;

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Text style={styles.title}>MAP01 부산 지도</Text>
        <Text style={styles.subtitle}>가본 구와 뱃지 표시</Text>
      </View>

      <View pointerEvents="box-none" style={styles.mapLayer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="구 선택"
          onPress={() => router.push('/map/district')}
          style={[
            styles.mapButton,
            {
              height: mapHeight,
              transform: [{ translateY: centerContentOffset }],
              width: mapWidth,
            },
          ]}>
          <Image source={wholeMap} style={styles.mapImage} contentFit="contain" />
        </Pressable>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.actionsLayer,
          {
            bottom: bottomActionInset,
            left: horizontalPadding,
            right: horizontalPadding,
          },
        ]}>
        <View style={[styles.actions, { maxWidth: contentMaxWidth }]}>
          <FlowButton label="가본 곳 컬렉션" onPress={() => router.push('/collection/districts')} />
          <FlowButton label="메인으로" onPress={() => router.replace('/main')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#555555',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  mapLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  mapButton: {
    maxWidth: '100%',
  },
  mapImage: {
    height: '100%',
    width: '100%',
  },
  actionsLayer: {
    alignItems: 'center',
    position: 'absolute',
  },
  actions: {
    gap: 10,
    width: '100%',
  },
});
