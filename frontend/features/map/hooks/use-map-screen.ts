// 지도 테마·구역 조회와 미션 카드 스와이프 상태를 관리합니다.
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

import { fetchMissions, type MissionItem } from '@/lib/mission-api';

import {
  DEFAULT_THEME_DISTRICTS,
  dividedMap,
  mapPieceTargets,
  themeMapByCategory,
} from '../map-data';
import type { CategoryValue } from '../types';

function prefetchMissionEmojiIcons(missions: MissionItem[]) {
  const emojiUrls = Array.from(new Set(missions.map((mission) => mission.emojiUrl).filter(Boolean) as string[]));

  if (emojiUrls.length === 0) {
    return;
  }

  void Image.prefetch(emojiUrls, 'memory-disk').catch(() => undefined);
}

type UseMapScreenOptions = {
  frameWidth: number;
  language: string;
};

export function useMapScreen({ frameWidth, language }: UseMapScreenOptions) {
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
          new Set(missions.flatMap((mission) => [mission.districtLabel, mission.districtCode].filter(Boolean) as string[])),
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

    void loadThemeDistricts();

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
    [cardTranslateX, deckMissions.length, moveMissionCard],
  );

  const cardRotate = cardTranslateX.interpolate({
    inputRange: [-frameWidth, 0, frameWidth],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const nextMissionIndex = (activeMissionIndex + 1) % missionDeckCount;
  const previousMissionIndex = (activeMissionIndex - 1 + missionDeckCount) % missionDeckCount;

  return {
    activeDistrictKeys,
    activeMission: deckMissions[activeMissionIndex],
    activeMissionIndex,
    cardPanResponder,
    cardRotate,
    cardTranslateX,
    closeMissionDeck: () => setIsMissionDeckOpen(false),
    deckMissionError,
    deckMissions,
    hasThemeDistrictFilter,
    isDeckMissionLoading,
    isMissionDeckOpen,
    isThemeDistrictLoading,
    mapSource: selectedMapSource,
    missionDeckCount,
    moveMissionCard,
    nextMission: deckMissions[nextMissionIndex],
    openMissionDeck,
    previousMission: deckMissions[previousMissionIndex],
    selectedCategory,
    selectedDistrict,
    selectedMapPiece,
    selectedMissionTheme,
    selectedTarget,
    setSelectedCategory,
    shouldShowNextFrame,
    shouldShowPreviousFrame,
    themeDistrictError,
  };
}
