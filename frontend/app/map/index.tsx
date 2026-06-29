import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const basketIcon = require('../../assets/svg/basket.svg');
const dividedMap = require('../../assets/svg/dividedMap.svg');
const missionLevelFrames = [
  require('../../assets/svg/mission_level/standard_frame.svg'),
  require('../../assets/svg/mission_level/rare_frame.svg'),
  require('../../assets/svg/mission_level/side_frame.svg'),
];

// 구 별로 나누기
const mapPieceTargets = [
  { number: 1, district: '강서구', x: 0.18, y: 0.64 },
  { number: 2, district: '사하구', x: 0.38, y: 0.74 },
  { number: 3, district: '사상구', x: 0.4, y: 0.54 },
  { number: 4, district: '북구', x: 0.45, y: 0.37 },
  { number: 5, district: '금정구', x: 0.56, y: 0.33 },
  { number: 6, district: '동래구', x: 0.565, y: 0.44 },
  { number: 7, district: '연제구', x: 0.586, y: 0.505 },
  { number: 8, district: '부산진구', x: 0.486, y: 0.54 },
  { number: 9, district: '서구', x: 0.45, y: 0.637 },
  { number: 10, district: '동구', x: 0.528, y: 0.594 },
  { number: 11, district: '중구', x: 0.526, y: 0.674 },
  { number: 12, district: '수영구', x: 0.642, y: 0.543 },
  { number: 13, district: '남구', x: 0.602, y: 0.657 },
  { number: 14, district: '영도구', x: 0.562, y: 0.747 },
  { number: 15, district: '해운대구', x: 0.735, y: 0.467 },
  { number: 16, district: '기장군', x: 0.815, y: 0.247 },
];
const MAP_ASPECT_RATIO = 1;
const MISSION_FRAME_ASPECT_RATIO = 164 / 209;

export default function BusanMapScreen() {
  const {
    availableWidth,
    bottomActionInset,
    contentMaxWidth,
    horizontalPadding,
    mediaMaxWidth,
    topInset,
    width,
  } = useResponsiveLayout();
  const [isMissionDeckOpen, setIsMissionDeckOpen] = useState(false);
  const [selectedMapPiece, setSelectedMapPiece] = useState(1);
  const [activeMissionIndex, setActiveMissionIndex] = useState(0);
  const activeMissionIndexRef = useRef(0);
  const isCardAnimatingRef = useRef(false);
  const cardTranslateX = useRef(new Animated.Value(0)).current;
  const mapWidth = Math.min(width - 16, mediaMaxWidth, 430);
  const mapHeight = mapWidth / MAP_ASPECT_RATIO;
  const targetSize = Math.min(58, Math.max(40, mapWidth * 0.11));
  const basketSize = Math.min(68, Math.max(58, availableWidth * 0.16));
  const frameWidth = Math.min(width * 0.84, 344);
  const frameHeight = frameWidth / MISSION_FRAME_ASPECT_RATIO;
  const selectedDistrict = mapPieceTargets.find((target) => target.number === selectedMapPiece)?.district ?? '강서구';

  const openMissionDeck = (pieceNumber: number) => {
    setSelectedMapPiece(pieceNumber);
    activeMissionIndexRef.current = 0;
    isCardAnimatingRef.current = false;
    setActiveMissionIndex(0);
    cardTranslateX.setValue(0);
    setIsMissionDeckOpen(true);
  };

  const moveMissionCard = (direction: 1 | -1) => {
    if (isCardAnimatingRef.current) {
      return;
    }

    isCardAnimatingRef.current = true;
    const nextIndex = (activeMissionIndexRef.current + direction + missionLevelFrames.length) % missionLevelFrames.length;
    Animated.timing(cardTranslateX, {
      duration: 180,
      toValue: direction === 1 ? -frameWidth : frameWidth,
      useNativeDriver: true,
    }).start(() => {
      activeMissionIndexRef.current = nextIndex;
      setActiveMissionIndex(nextIndex);
      cardTranslateX.setValue(direction === 1 ? frameWidth * 0.34 : -frameWidth * 0.34);
      Animated.spring(cardTranslateX, {
        friction: 7,
        tension: 150,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        isCardAnimatingRef.current = false;
      });
    });
  };

  const cardPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        cardTranslateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -48) {
          moveMissionCard(1);
          return;
        }
        if (gestureState.dx > 48) {
          moveMissionCard(-1);
          return;
        }
        Animated.spring(cardTranslateX, {
          friction: 7,
          tension: 150,
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(cardTranslateX, {
          friction: 7,
          tension: 150,
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const cardRotate = cardTranslateX.interpolate({
    inputRange: [-frameWidth, 0, frameWidth],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const nextMissionIndex = (activeMissionIndex + 1) % missionLevelFrames.length;
  const previousMissionIndex = (activeMissionIndex - 1 + missionLevelFrames.length) % missionLevelFrames.length;

  const openMissionDetail = () => {
    router.push({
      pathname: '/mission/detail',
      params: { district: selectedDistrict, piece: String(selectedMapPiece) },
    });
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomActionInset,
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <View style={styles.header}>
        <ScalePressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} pressedScale={0.86} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </ScalePressable>
        <Text style={styles.title}>부산</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!isMissionDeckOpen ? (
        <View style={styles.basketRow}>
          {['산 바구니', '바다 바구니', '도시 바구니'].map((label) => (
            <Image
              accessibilityLabel={label}
              contentFit="contain"
              key={label}
              source={basketIcon}
              style={{ height: basketSize, width: basketSize }}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.mapArea}>
        <View style={{ height: mapHeight, width: mapWidth }}>
          <View style={styles.mapPieceStage}>
            <Image contentFit="contain" pointerEvents="none" source={dividedMap} style={styles.mapImage} />
            {!isMissionDeckOpen
              ? mapPieceTargets.map((target) => (
                  <Pressable
                    accessibilityLabel={`${target.number}번 지도 조각 미션 보기`}
                    accessibilityRole="button"
                    key={`map-target-${target.number}`}
                    onPress={() => openMissionDeck(target.number)}
                    style={[
                      styles.mapPieceTarget,
                      {
                        height: targetSize,
                        left: target.x * mapWidth - targetSize / 2,
                        top: target.y * mapHeight - targetSize / 2,
                        width: targetSize,
                      },
                    ]}
                  />
                ))
              : null}
          </View>
        </View>
      </View>

      {!isMissionDeckOpen ? (
        <View style={[styles.actions, { maxWidth: contentMaxWidth }]}>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="구 선택하기"
            onPress={() => router.push('/map/district')}
            style={styles.selectButton}>
            <Text style={styles.selectButtonText}>구 선택하기</Text>
          </ScalePressable>
        </View>
      ) : null}

      {isMissionDeckOpen ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>넘겨서 다음 미션 보기</Text>
          <View style={[styles.frameDeck, { height: frameHeight + 20, width: frameWidth + 72 }]}>
            <Image
              source={missionLevelFrames[previousMissionIndex]}
              style={[
                styles.missionFrame,
                styles.backFrameLeft,
                {
                  height: frameHeight,
                  width: frameWidth,
                },
              ]}
              contentFit="contain"
            />
            <Image
              source={missionLevelFrames[nextMissionIndex]}
              style={[
                styles.missionFrame,
                styles.backFrameRight,
                {
                  height: frameHeight,
                  width: frameWidth,
                },
              ]}
              contentFit="contain"
            />
            <Animated.View
              {...cardPanResponder.panHandlers}
              style={[
                styles.frontMissionCard,
                {
                  height: frameHeight,
                  transform: [{ translateX: cardTranslateX }, { rotate: cardRotate }],
                  width: frameWidth,
                },
              ]}>
              <Image source={missionLevelFrames[activeMissionIndex]} style={styles.frontMissionImage} contentFit="contain" />
              <View style={styles.selectedPieceBadge}>
                <Text style={styles.selectedPieceNumber}>{selectedDistrict}</Text>
              </View>
            </Animated.View>
          </View>

          <View style={styles.pagination}>
            {missionLevelFrames.map((_, index) => (
              <View key={`mission-page-${index}`} style={[styles.pageDot, index === activeMissionIndex ? styles.activeDot : null]} />
            ))}
          </View>

          <View style={[styles.overlayActions, { maxWidth: contentMaxWidth }]}>
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel="미션 상세 보기"
              onPress={openMissionDetail}
              style={styles.overlayButton}>
              <Text style={styles.overlayButtonText}>미션 상세 보기</Text>
            </ScalePressable>
            <ScalePressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={() => setIsMissionDeckOpen(false)}
              style={styles.overlayButton}>
              <Text style={styles.overlayButtonText}>닫기</Text>
            </ScalePressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f1f8fb',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    marginBottom: 48,
  },
  backButton: {
    alignItems: 'flex-start',
    height: 44,
    justifyContent: 'center',
    width: 48,
  },
  backIcon: {
    color: '#202124',
    fontSize: 44,
    lineHeight: 44,
  },
  headerSpacer: {
    width: 48,
  },
  title: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  basketRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 22,
    justifyContent: 'center',
    marginBottom: 44,
  },
  mapArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginBottom: 48,
  },
  mapPieceStage: {
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  mapImage: {
    height: '100%',
    width: '100%',
  },
  mapPieceTarget: {
    borderRadius: 999,
    position: 'absolute',
  },
  actions: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  selectButton: {
    alignItems: 'center',
    backgroundColor: '#70A9BA',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 65,
    paddingHorizontal: 24,
    width: '100%',
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 25, 27, 0.72)',
    bottom: 0,
    justifyContent: 'flex-start',
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 132,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 20,
  },
  frameDeck: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionFrame: {
    position: 'absolute',
    zIndex: 1,
  },
  backFrameLeft: {
    opacity: 1,
    transform: [{ translateX: -4 }, { translateY: 7 }, { rotate: '-11deg' }],
  },
  backFrameRight: {
    opacity: 1,
    transform: [{ translateX: 3 }, { translateY: 7 }, { rotate: '11deg' }],
  },
  frontMissionCard: {
    alignItems: 'center',
    elevation: 0,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 3,
  },
  frontMissionImage: {
    height: '100%',
    width: '100%',
    zIndex: 1,
  },
  selectedPieceBadge: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d94242',
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 76,
    paddingHorizontal: 12,
    position: 'absolute',
    zIndex: 2,
  },
  selectedPieceNumber: {
    color: '#d94242',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 42,
    marginTop: 10,
  },
  pageDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  activeDot: {
    backgroundColor: '#ffffff',
  },
  overlayActions: {
    flexDirection: 'row',
    gap: 8,
    width: '90%',
  },
  overlayButton: {
    alignItems: 'center',
    backgroundColor: '#E1E9EC',
    borderRadius: 24,
    flex: 1,
    justifyContent: 'center',
    minHeight: 65,
    paddingHorizontal: 16,
  },
  overlayButtonText: {
    color: '#5e686d',
    fontSize: 16,
    fontWeight: '500',
  },
});





