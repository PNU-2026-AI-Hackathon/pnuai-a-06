import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollView as ScrollViewType,
} from 'react-native';

import { FlowButton } from '@/components/flow-screen';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const districtMap = require('../../assets/svg/gu_map.svg');
const redFlag = require('../../assets/svg/flag/red_flag.svg');
const yellowFlag = require('../../assets/svg/flag/yellow_flag.svg');
const blueFlag = require('../../assets/svg/flag/blue_flag.svg');
const MAP_ASPECT_RATIO = 328 / 273;
const CARD_GAP = 12;

type FlagKey = 'red' | 'yellow' | 'blue';

type FlagItem = {
  key: FlagKey;
  title: string;
  description: string;
  source: number;
  x: number;
  y: number;
};

const flagItems: FlagItem[] = [
  {
    key: 'red',
    title: '미션명',
    description: '미션 설명을 한줄 이내로 요약하는 부분입니다.',
    source: redFlag,
    x: 0.78,
    y: 0.1,
  },
  {
    key: 'yellow',
    title: '미션명',
    description: '미션 설명을 한줄 이내로 요약하는 부분입니다.',
    source: yellowFlag,
    x: 0.25,
    y: 0.35,
  },
  {
    key: 'blue',
    title: '미션명',
    description: '미션 설명을 한줄 이내로 요약하는 부분입니다.',
    source: blueFlag,
    x: 0.72,
    y: 0.58,
  },
];

export default function DistrictScreen() {
  const {
    availableWidth,
    bottomActionInset,
    centerContentOffset,
    contentMaxWidth,
    horizontalPadding,
    mediaMaxWidth,
    topInset,
  } = useResponsiveLayout();
  const [selectedFlag, setSelectedFlag] = useState<FlagKey | null>(null);
  const deckProgress = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollViewType>(null);
  const mapWidth = Math.min(availableWidth, mediaMaxWidth);
  const mapHeight = mapWidth / MAP_ASPECT_RATIO;
  const flagSize = Math.max(42, Math.min(58, mapWidth * 0.13));
  const deckWidth = Math.min(availableWidth, contentMaxWidth);
  const cardWidth = Math.max(228, deckWidth * 0.58);
  const selectedIndex = selectedFlag
    ? flagItems.findIndex((item) => item.key === selectedFlag)
    : 0;
  const isDeckOpen = selectedFlag !== null;

  useEffect(() => {
    Animated.timing(deckProgress, {
      duration: 220,
      toValue: isDeckOpen ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [deckProgress, isDeckOpen]);

  useEffect(() => {
    if (!isDeckOpen || selectedIndex < 0) {
      return;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        animated: false,
        x: selectedIndex * (cardWidth + CARD_GAP),
        y: 0,
      });
    });
  }, [cardWidth, isDeckOpen, selectedIndex]);

  const deckTranslateY = deckProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [520, 0],
  });

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Text style={styles.title}>MAP02 구 상세</Text>
        <Text style={styles.subtitle}>혼잡도, 통계, 명소, 액상</Text>
      </View>

      <View pointerEvents="box-none" style={styles.mapLayer}>
        <View
          style={[
            styles.mapStage,
            {
              height: mapHeight,
              transform: [{ translateY: centerContentOffset }],
              width: mapWidth,
            },
          ]}>
          <Image source={districtMap} style={styles.mapImage} contentFit="contain" />
          {flagItems.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title} 카드 보기`}
              key={item.key}
              onPress={() => setSelectedFlag(item.key)}
              style={[
                styles.flagButton,
                {
                  height: flagSize,
                  left: mapWidth * item.x - flagSize / 2,
                  top: mapHeight * item.y - flagSize / 2,
                  width: flagSize,
                },
              ]}>
              <Image source={item.source} style={styles.flagImage} contentFit="contain" />
            </Pressable>
          ))}
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.backLayer,
          {
            bottom: bottomActionInset,
            left: horizontalPadding,
            right: horizontalPadding,
          },
        ]}>
        <View style={[styles.backActions, { maxWidth: contentMaxWidth }]}>
          <FlowButton label="지도 돌아가기" onPress={() => router.back()} />
        </View>
      </View>

      {isDeckOpen ? (
        <Pressable
          accessibilityLabel="카드 덱 바깥 영역"
          onPress={() => setSelectedFlag(null)}
          style={styles.deckDismissLayer}
        />
      ) : null}

      <Animated.View
        pointerEvents={isDeckOpen ? 'auto' : 'none'}
        style={[
          styles.deckLayer,
          {
            bottom: bottomActionInset,
            left: horizontalPadding,
            maxWidth: contentMaxWidth,
            right: horizontalPadding,
            transform: [{ translateY: deckTranslateY }],
          },
        ]}>
        <View style={styles.deck}>
          <ScrollView
            contentContainerStyle={styles.cardsContent}
            horizontal
            ref={scrollViewRef}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + CARD_GAP}
            decelerationRate="fast">
            {flagItems.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.card,
                  {
                    marginRight: index === flagItems.length - 1 ? 0 : CARD_GAP,
                    width: cardWidth,
                  },
                ]}>
                <Image source={item.source} style={styles.cardFlag} contentFit="contain" />
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
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
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  mapStage: {
    maxWidth: '100%',
  },
  mapImage: {
    height: '100%',
    width: '100%',
  },
  flagButton: {
    position: 'absolute',
  },
  flagImage: {
    height: '100%',
    width: '100%',
  },
  backLayer: {
    alignItems: 'center',
    position: 'absolute',
  },
  backActions: {
    width: '100%',
  },
  deckLayer: {
    alignSelf: 'center',
    position: 'absolute',
    width: '100%',
  },
  deckDismissLayer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  deck: {
    backgroundColor: 'rgba(157, 181, 194, 0.82)',
    borderRadius: 8,
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 16,
  },
  cardsContent: {
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#fbfdff',
    borderRadius: 22,
    justifyContent: 'flex-start',
    minHeight: 230,
    padding: 28,
    shadowColor: '#000000',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cardFlag: {
    height: 46,
    marginBottom: 42,
    width: 46,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 28,
  },
  cardDescription: {
    color: '#9fa5aa',
    fontSize: 15,
    lineHeight: 22,
  },
});
