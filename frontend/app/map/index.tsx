import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { getMissionCardLevel, MissionCard } from '@/components/mission-card';
import { ScalePressable } from '@/components/scale-pressable';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMissions, type MissionItem } from '@/lib/mission-api';

const dividedMap = require('../../assets/svg/map/divided_map.svg');
const themeMapByCategory: Record<MissionTheme, number> = {
  MOUNTAIN: require('../../assets/svg/map/mountain_map.svg'),
  SEA: require('../../assets/svg/map/sea_map.svg'),
  CITY: require('../../assets/svg/map/city_map.svg'),
  DEMO: dividedMap,
};

type MissionTheme = 'MOUNTAIN' | 'SEA' | 'CITY' | 'DEMO';
type CategoryValue = MissionTheme | 'ACQUIRED';

const categoryItems = [
  {
    icon: require('../../assets/svg/theme_icon/mountain.svg'),
    selectedIcon: require('../../assets/svg/theme_icon/mountain_filled.svg'),
    label: '산',
    value: 'MOUNTAIN',
  },
  {
    icon: require('../../assets/svg/theme_icon/sea.svg'),
    selectedIcon: require('../../assets/svg/theme_icon/sea_filled.svg'),
    label: '바다',
    value: 'SEA',
  },
  {
    icon: require('../../assets/svg/theme_icon/city.svg'),
    selectedIcon: require('../../assets/svg/theme_icon/city_filled.svg'),
    label: '도시',
    value: 'CITY',
  },
  {
    icon: require('../../assets/svg/theme_icon/flag.svg'),
    selectedIcon: require('../../assets/svg/theme_icon/flag_filled.svg'),
    label: '데모',
    value: 'DEMO',
  },
] satisfies { icon: number; selectedIcon: number; label: string; value: CategoryValue }[];

// 구 별 지도 터치 위치
const mapPieceTargets = [
  { number: 1, district: '강서구', districtCode: 'GANGSEO', x: 0.18, y: 0.64 },
  { number: 2, district: '사하구', districtCode: 'SAHA', x: 0.38, y: 0.74 },
  { number: 3, district: '사상구', districtCode: 'SASANG', x: 0.4, y: 0.54 },
  { number: 4, district: '북구', districtCode: 'BUK', x: 0.45, y: 0.37 },
  { number: 5, district: '금정구', districtCode: 'GEUMJEONG', x: 0.56, y: 0.33 },
  { number: 6, district: '동래구', districtCode: 'DONGNAE', x: 0.565, y: 0.44 },
  { number: 7, district: '연제구', districtCode: 'YEONJE', x: 0.586, y: 0.505 },
  { number: 8, district: '부산진구', districtCode: 'BUSANJIN', x: 0.486, y: 0.54 },
  { number: 9, district: '서구', districtCode: 'SEO', x: 0.45, y: 0.637 },
  { number: 10, district: '동구', districtCode: 'DONG', x: 0.528, y: 0.594 },
  { number: 11, district: '중구', districtCode: 'JUNG', x: 0.526, y: 0.674 },
  { number: 12, district: '수영구', districtCode: 'SUYEONG', x: 0.642, y: 0.543 },
  { number: 13, district: '남구', districtCode: 'NAM', x: 0.602, y: 0.657 },
  { number: 14, district: '영도구', districtCode: 'YEONGDO', x: 0.562, y: 0.747 },
  { number: 15, district: '해운대구', districtCode: 'HAEUNDAE', x: 0.735, y: 0.467 },
  { number: 16, district: '기장군', districtCode: 'GIJANG', x: 0.815, y: 0.247 },
];

const districtTouchPolygons: Record<number, string> = {
  1: '0.02,0.46 0.30,0.50 0.28,0.86 0.04,0.86 0.02,0.68',
  2: '0.27,0.66 0.44,0.69 0.44,0.83 0.26,0.88 0.20,0.76',
  3: '0.28,0.45 0.43,0.43 0.42,0.60 0.31,0.63 0.24,0.55',
  4: '0.36,0.23 0.51,0.18 0.51,0.38 0.43,0.44 0.33,0.36',
  5: '0.50,0.17 0.67,0.16 0.69,0.34 0.60,0.39 0.49,0.35',
  6: '0.52,0.38 0.62,0.38 0.64,0.46 0.54,0.47 0.49,0.43',
  7: '0.54,0.46 0.63,0.46 0.63,0.53 0.54,0.54',
  8: '0.42,0.48 0.54,0.47 0.54,0.58 0.43,0.60 0.38,0.54',
  9: '0.38,0.60 0.48,0.58 0.49,0.69 0.40,0.72 0.34,0.66',
  10: '0.50,0.55 0.58,0.55 0.58,0.64 0.48,0.64 0.46,0.59',
  11: '0.48,0.64 0.56,0.64 0.56,0.71 0.48,0.71',
  12: '0.59,0.49 0.70,0.49 0.70,0.60 0.62,0.60 0.57,0.54',
  13: '0.54,0.59 0.68,0.59 0.70,0.76 0.58,0.74 0.50,0.66',
  14: '0.48,0.72 0.64,0.72 0.68,0.88 0.47,0.88 0.43,0.78',
  15: '0.65,0.39 0.88,0.36 0.90,0.55 0.70,0.58 0.62,0.50',
  16: '0.68,0.02 0.98,0.02 0.96,0.37 0.80,0.42 0.67,0.31',
};
const DEFAULT_THEME_DISTRICTS: Record<MissionTheme, string[]> = {
  MOUNTAIN: [],
  SEA: [],
  CITY: [],
  DEMO: [],
};
const MAP_ASPECT_RATIO = 1;
const MISSION_FRAME_ASPECT_RATIO = 164 / 209;


function prefetchMissionEmojiIcons(missions: MissionItem[]) {
  const emojiUrls = Array.from(new Set(missions.map((mission) => mission.emojiUrl).filter(Boolean) as string[]));

  if (emojiUrls.length === 0) {
    return;
  }

  void Image.prefetch(emojiUrls, 'memory-disk').catch(() => undefined);
}

function getPolygonBounds(points: string) {
  const coordinates = points.split(' ').map((point) => {
    const [x, y] = point.split(',').map(Number);

    return { x, y };
  });
  const xValues = coordinates.map((coordinate) => coordinate.x);
  const yValues = coordinates.map((coordinate) => coordinate.y);

  return {
    maxX: Math.max(...xValues),
    maxY: Math.max(...yValues),
    minX: Math.min(...xValues),
    minY: Math.min(...yValues),
  };
}

export default function BusanMapScreen() {
  const {
    bottomActionInset,
    contentMaxWidth,
    horizontalPadding,
    mediaMaxWidth,
    topInset,
    width,
  } = useResponsiveLayout();
  const { language } = useLanguage();
  const [isMissionDeckOpen, setIsMissionDeckOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryValue>('MOUNTAIN');
  const [themeDistricts, setThemeDistricts] = useState(DEFAULT_THEME_DISTRICTS);
  const [isThemeDistrictLoading, setIsThemeDistrictLoading] = useState(false);
  const [themeDistrictError, setThemeDistrictError] = useState('');
  const [selectedMapPiece, setSelectedMapPiece] = useState<number | null>(null);
  const [activeMissionIndex, setActiveMissionIndex] = useState(0);
  const [deckMissions, setDeckMissions] = useState<MissionItem[]>([]);
  const [isDeckMissionLoading, setIsDeckMissionLoading] = useState(false);
  const [deckMissionError, setDeckMissionError] = useState('');
  const activeMissionIndexRef = useRef(0);
  const isCardAnimatingRef = useRef(false);
  const cardTranslateX = useRef(new Animated.Value(0)).current;
  const selectedMissionTheme = selectedCategory !== 'ACQUIRED' ? selectedCategory : null;
  const selectedMapSource = selectedMissionTheme ? themeMapByCategory[selectedMissionTheme] : dividedMap;
  const mapWidth = Math.min(width - 16, mediaMaxWidth, 430);
  const mapHeight = mapWidth / MAP_ASPECT_RATIO;
  const frameWidth = Math.min(width * 0.84, 344);
  const frameHeight = frameWidth / MISSION_FRAME_ASPECT_RATIO;
  const missionDeckCount = Math.max(deckMissions.length, 1);
  const shouldShowPreviousFrame = deckMissions.length > 2;
  const shouldShowNextFrame = deckMissions.length > 1;
  const hasThemeDistrictFilter = selectedMissionTheme ? themeDistricts[selectedMissionTheme].length > 0 : true;
  const activeDistrictKeys = useMemo(() => {
    if (!selectedMissionTheme) {
      return new Set(mapPieceTargets.flatMap((target) => [target.district, target.districtCode]));
    }

    return new Set(themeDistricts[selectedMissionTheme]);
  }, [selectedMissionTheme, themeDistricts]);
  const selectedTarget = mapPieceTargets.find((target) => target.number === selectedMapPiece) ?? null;
  const selectedDistrict = selectedTarget?.district ?? '강서구';

  useEffect(() => {
    if (!selectedMissionTheme) {
      return;
    }

    let isActive = true;
    const missionTheme = selectedMissionTheme;

    async function loadThemeDistricts() {
      try {
        setIsThemeDistrictLoading(true);
        setThemeDistrictError('');
        // 선택 테마에 미션이 있는 구만 요청
        const missions = await fetchMissions({ theme: missionTheme });
        prefetchMissionEmojiIcons(missions);
        const districts = Array.from(
          new Set(missions.flatMap((mission) => [mission.districtLabel, mission.districtCode].filter(Boolean) as string[]))
        );

        if (isActive) {
          setThemeDistricts((prev) => ({ ...prev, [missionTheme]: districts }));
        }
      } catch (error) {
        if (isActive) {
          setThemeDistricts((prev) => ({ ...prev, [missionTheme]: [] }));
          setThemeDistrictError(error instanceof Error ? error.message : '미션 구 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isActive) {
          setIsThemeDistrictLoading(false);
        }
      }
    }

    loadThemeDistricts();

    return () => {
      isActive = false;
    };
  }, [language, selectedMissionTheme]);

  useEffect(() => {
    setSelectedMapPiece(null);
  }, [selectedCategory]);

  const openMissionDeck = async (pieceNumber: number) => {
    const target = mapPieceTargets.find((item) => item.number === pieceNumber);

    setSelectedMapPiece(pieceNumber);
    activeMissionIndexRef.current = 0;
    isCardAnimatingRef.current = false;
    setActiveMissionIndex(0);
    setDeckMissions([]);
    setDeckMissionError('');
    cardTranslateX.setValue(0);
    setIsMissionDeckOpen(true);

    if (!target) {
      return;
    }

    try {
      setIsDeckMissionLoading(true);
      // 선택한 구와 테마의 실제 미션 요청
      const missions = await fetchMissions({
        districtCode: target.districtCode,
        ...(selectedMissionTheme ? { theme: selectedMissionTheme } : {}),
      });
      prefetchMissionEmojiIcons(missions);
      setDeckMissions(missions);
    } catch (error) {
      setDeckMissionError(error instanceof Error ? error.message : '미션 정보를 불러오지 못했습니다.');
    } finally {
      setIsDeckMissionLoading(false);
    }
  };

  const moveMissionCard = useCallback((direction: 1 | -1) => {
    if (isCardAnimatingRef.current || deckMissions.length === 0) {
      return;
    }

    isCardAnimatingRef.current = true;
    const nextIndex = (activeMissionIndexRef.current + direction + deckMissions.length) % deckMissions.length;
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
  }, [cardTranslateX, deckMissions.length, frameWidth]);

  const cardPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => deckMissions.length > 1 && Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
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
      }),
    [cardTranslateX, deckMissions.length, moveMissionCard]
  );

  const cardRotate = cardTranslateX.interpolate({
    inputRange: [-frameWidth, 0, frameWidth],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const nextMissionIndex = (activeMissionIndex + 1) % missionDeckCount;
  const previousMissionIndex = (activeMissionIndex - 1 + missionDeckCount) % missionDeckCount;
  const activeMission = deckMissions[activeMissionIndex];
  const nextMission = deckMissions[nextMissionIndex];
  const previousMission = deckMissions[previousMissionIndex];


  const openMissionDetail = () => {
    router.push({
      pathname: '/mission/detail',
      params: {
        district: selectedDistrict,
        districtCode: selectedTarget?.districtCode ?? '',
        missionCode: activeMission?.code ?? activeMission?.id ?? '',
        piece: String(selectedMapPiece ?? ''),
        ...(selectedCategory !== 'ACQUIRED' ? { theme: selectedCategory } : {}),
      },
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
        <View style={styles.categoryRow}>
          {categoryItems.map((item) => {
            const isSelected = item.value === selectedCategory;

            return (
              <ScalePressable
                accessibilityLabel={`${item.label} 미션 보기`}
                accessibilityRole="button"
                key={item.label}
                onPress={() => setSelectedCategory(item.value)}
                pressedScale={0.94}
                style={[styles.categoryButton, isSelected && styles.selectedCategoryButton]}>
                <Image source={isSelected ? item.selectedIcon : item.icon} style={styles.categoryIcon} contentFit="contain" />
                <Text style={[styles.categoryLabel, isSelected && styles.selectedCategoryLabel]}>{item.label}</Text>
              </ScalePressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.mapArea}>
        <View style={{ height: mapHeight, width: mapWidth }}>
          <View style={styles.mapPieceStage}>
            <Image contentFit="contain" pointerEvents="none" source={selectedMapSource} style={styles.mapImage} />
            {!isMissionDeckOpen ? (
              <View pointerEvents="box-none" style={styles.districtTouchLayer}>
                {mapPieceTargets.map((target) => {
                  const polygonPoints = districtTouchPolygons[target.number];

                  if (!polygonPoints) {
                    return null;
                  }

                  const bounds = getPolygonBounds(polygonPoints);
                  const isActive =
                    !hasThemeDistrictFilter || activeDistrictKeys.has(target.district) || activeDistrictKeys.has(target.districtCode);

                  return (
                    <Pressable
                      accessibilityLabel={`${target.district} ${isActive ? '미션 보기' : '비활성 구'}`}
                      accessibilityRole="button"
                      disabled={!isActive}
                      hitSlop={6}
                      key={`district-touch-${target.number}`}
                      onPress={() => openMissionDeck(target.number)}
                      style={[
                        styles.districtTouchTarget,
                        {
                          height: (bounds.maxY - bounds.minY) * mapHeight,
                          left: bounds.minX * mapWidth,
                          top: bounds.minY * mapHeight,
                          width: (bounds.maxX - bounds.minX) * mapWidth,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
            {!isMissionDeckOpen && isThemeDistrictLoading ? <ActivityIndicator color="#202124" size="small" style={styles.mapLoadingIndicator} /> : null}
            {!isMissionDeckOpen && !isThemeDistrictLoading && themeDistrictError ? (
              <View style={styles.mapStatusBox}>
                <Text style={styles.mapStatusText}>{themeDistrictError}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>


      {isMissionDeckOpen ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>넘겨서 다음 미션 보기</Text>
          <View style={[styles.frameDeck, { height: frameHeight, width: frameWidth + 72 }]}>
            {shouldShowPreviousFrame ? (
              <Image
                source={getMissionCardLevel(previousMission).frame}
                style={[styles.missionFrame, styles.backFrameLeft, { height: frameHeight, width: frameWidth }]}
                contentFit="contain"
              />
            ) : null}
            {shouldShowNextFrame ? (
              <Image
                source={getMissionCardLevel(nextMission).frame}
                style={[styles.missionFrame, styles.backFrameRight, { height: frameHeight, width: frameWidth }]}
                contentFit="contain"
              />
            ) : null}
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
              <MissionCard
                errorMessage={deckMissionError}
                isLoading={isDeckMissionLoading}
                mission={activeMission ? {
                  description: activeMission.description,
                  iconText: activeMission.rewardItemIcon,
                  iconUrl: activeMission.emojiUrl,
                  title: activeMission.title,
                  type: activeMission.type,
                } : null}
              />
            </Animated.View>
          </View>

          <View style={styles.pagination}>
            {Array.from({ length: missionDeckCount }).map((_, index) => (
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
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 38,
  },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 13,
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  selectedCategoryButton: {
    backgroundColor: '#64ABBF',
  },
  categoryIcon: {
    height: 24,
    width: 24,
  },
  categoryLabel: {
    color: '#224853',
    fontSize: 12,
    fontWeight: '500',
  },
  selectedCategoryLabel: {
    color: '#ffffff',
    fontWeight: '700',
  },
  mapArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginBottom: 28,
  },
  mapPieceStage: {
    height: '100%',
    position: 'relative',
    width: '100%',
  },
  mapImage: {
    height: '100%',
    opacity: 0.9,
    width: '100%',
  },
  districtTouchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  districtTouchTarget: {
    backgroundColor: 'transparent',
    position: 'absolute',
  },
  mapPieceTarget: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    position: 'absolute',
  },
  mapPieceDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: '#70A9BA',
    borderRadius: 999,
    borderWidth: 2,
    height: 20,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    width: 20,
  },
  inactiveMapPieceDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(94, 104, 109, 0.42)',
    borderStyle: 'dashed',
    height: 14,
    shadowOpacity: 0,
    width: 14,
  },
  selectedMapPieceDot: {
    backgroundColor: '#70A9BA',
    borderColor: '#ffffff',
    height: 26,
    width: 26,
  },
  mapPieceLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 999,
    color: '#202124',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  selectedMapPieceLabel: {
    backgroundColor: '#202124',
    color: '#ffffff',
  },
  mapLoadingIndicator: {
    left: '50%',
    position: 'absolute',
    top: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
  },
  mapStatusBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 14,
    gap: 7,
    left: '50%',
    minWidth: 156,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
    top: '50%',
    transform: [{ translateX: -78 }, { translateY: -24 }],
  },
  mapStatusText: {
    color: '#5e686d',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
  },
  selectedDistrictPanel: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: 18,
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    width: '100%',
  },
  selectedDistrictTextGroup: {
    flex: 1,
  },
  selectedDistrictEyebrow: {
    color: '#70A9BA',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
  },
  selectedDistrictTitle: {
    color: '#202124',
    fontSize: 19,
    fontWeight: '800',
  },
  panelButton: {
    alignItems: 'center',
    backgroundColor: '#70A9BA',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 104,
    paddingHorizontal: 18,
  },
  panelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
  pagination: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    marginTop: 10,
    transform: [{ translateY: -32 }],
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
