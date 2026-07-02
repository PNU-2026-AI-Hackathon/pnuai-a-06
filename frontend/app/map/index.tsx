import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const basketIcon = require('../../assets/svg/basket.svg');
const dividedMap = require('../../assets/svg/dividedMap.svg');
const missionFrame = require('../../assets/svg/missionFrame.svg');

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
const MISSION_FRAME_ASPECT_RATIO = 293 / 390;

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
  const mapWidth = Math.min(width - 16, mediaMaxWidth, 430);
  const mapHeight = mapWidth / MAP_ASPECT_RATIO;
  const targetSize = Math.min(58, Math.max(40, mapWidth * 0.11));
  const basketSize = Math.min(68, Math.max(58, availableWidth * 0.16));
  const frameWidth = Math.min(availableWidth * 0.78, 300);
  const frameHeight = frameWidth / MISSION_FRAME_ASPECT_RATIO;
  const selectedDistrict = mapPieceTargets.find((target) => target.number === selectedMapPiece)?.district ?? '강서구';

  const openMissionDeck = (pieceNumber: number) => {
    setSelectedMapPiece(pieceNumber);
    setIsMissionDeckOpen(true);
  };

  const openMissionList = () => {
    router.push({
      pathname: '/map/spot-list',
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
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="구 선택하기"
            onPress={() => router.push('/map/district')}
            style={styles.selectButton}>
            <Text style={styles.selectButtonText}>구 선택하기</Text>
          </Pressable>
        </View>
      ) : null}

      {isMissionDeckOpen ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>넘겨서 다음 미션 보기</Text>

          <View style={[styles.frameDeck, { height: frameHeight + 42, width: frameWidth + 72 }]}>
            <View
              pointerEvents="none"
              style={[
                styles.backCardShade,
                styles.backShadeLeft,
                {
                  height: frameHeight * 0.88,
                  width: frameWidth * 0.84,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.backCardShade,
                styles.backShadeRight,
                {
                  height: frameHeight * 0.88,
                  width: frameWidth * 0.84,
                },
              ]}
            />
            <Image
              source={missionFrame}
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
              source={missionFrame}
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
            <Image
              source={missionFrame}
              style={[
                styles.missionFrame,
                styles.frontFrame,
                {
                  height: frameHeight,
                  width: frameWidth,
                },
              ]}
              contentFit="contain"
            />
            <View style={styles.selectedPieceBadge}>
              <Text style={styles.selectedPieceNumber}>{selectedDistrict}</Text>
            </View>
          </View>

          <View style={styles.pagination}>
            <View style={[styles.pageDot, styles.activeDot]} />
            <View style={styles.pageDot} />
            <View style={styles.pageDot} />
          </View>

          <View style={[styles.overlayActions, { maxWidth: contentMaxWidth }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="미션 전체 보기"
              onPress={openMissionList}
              style={styles.overlayButton}>
              <Text style={styles.overlayButtonText}>미션 전체 보기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={() => setIsMissionDeckOpen(false)}
              style={styles.overlayButton}>
              <Text style={styles.overlayButtonText}>닫기</Text>
            </Pressable>
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
    backgroundColor: 'rgba(20, 25, 27, 0.62)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 24,
    paddingTop: 74,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlayTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 32,
  },
  frameDeck: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionFrame: {
    position: 'absolute',
  },
  backCardShade: {
    backgroundColor: 'rgba(53, 74, 82, 0.34)',
    borderRadius: 34,
    elevation: 18,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
  },
  backShadeLeft: {
    transform: [{ translateX: -26 }, { translateY: 20 }, { rotate: '-7deg' }],
  },
  backShadeRight: {
    transform: [{ translateX: 26 }, { translateY: 8 }, { rotate: '7deg' }],
  },
  backFrameLeft: {
    elevation: 18,
    opacity: 0.78,
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: -12 },
    shadowOpacity: 0.36,
    shadowRadius: 24,
    transform: [{ translateX: -26 }, { translateY: 12 }, { rotate: '-7deg' }],
  },
  backFrameRight: {
    elevation: 18,
    opacity: 0.8,
    shadowColor: '#000000',
    shadowOffset: { height: 16, width: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    transform: [{ translateX: 26 }, { translateY: -6 }, { rotate: '7deg' }],
  },
  frontFrame: {
    transform: [{ translateY: 2 }],
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
    marginBottom: 66,
    marginTop: 16,
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


