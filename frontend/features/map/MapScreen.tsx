// 부산 지도 화면을 조립하고 미션 상세 이동을 연결합니다.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { useTutorial } from '@/components/tutorial-provider';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

import { InteractiveMap } from './components/interactive-map';
import { MapCategorySelector } from './components/map-category-selector';
import { MapHeader } from './components/map-header';
import { MissionDeckOverlay } from './components/mission-deck-overlay';
import {
  MAP_ASPECT_RATIO,
  MISSION_FRAME_ASPECT_RATIO,
} from './map-data';
import { useMapScreen } from './hooks/use-map-screen';
import { styles } from './styles';

export default function MapScreen() {
  const {
    bottomActionInset,
    contentMaxWidth,
    horizontalPadding,
    mediaMaxWidth,
    topInset,
    width,
  } = useResponsiveLayout();
  const { language } = useLanguage();
  const { start: startTutorial } = useTutorial();
  const { tutorialMissionCode: tutorialMissionCodeParam, tutorialRestoreDeck: tutorialRestoreDeckParam } = useLocalSearchParams<{
    tutorialMissionCode?: string | string[];
    tutorialRestoreDeck?: string | string[];
  }>();
  const tutorialMissionCode = Array.isArray(tutorialMissionCodeParam) ? tutorialMissionCodeParam[0] : tutorialMissionCodeParam;
  const tutorialRestoreDeck = Array.isArray(tutorialRestoreDeckParam) ? tutorialRestoreDeckParam[0] : tutorialRestoreDeckParam;
  const hasRestoredMissionDeck = useRef(false);
  const hasClosedReturnedMissionDeck = useRef(false);
  const mapWidth = Math.min(width - 16, mediaMaxWidth, 400);
  const mapHeight = mapWidth / MAP_ASPECT_RATIO;
  const frameWidth = Math.min(width * 0.84, 344);
  const frameHeight = frameWidth / MISSION_FRAME_ASPECT_RATIO;
  const map = useMapScreen({
    frameWidth,
    initialCategory: tutorialMissionCode || tutorialRestoreDeck === 'true' ? 'DEMO' : undefined,
    language,
    tutorialMissionCode,
  });

  useEffect(() => {
    void startTutorial('map');
  }, [startTutorial]);

  useEffect(() => {
    if (tutorialRestoreDeck !== 'true' || hasRestoredMissionDeck.current) {
      return;
    }

    hasRestoredMissionDeck.current = true;
    void map.openMissionDeck(6);
  }, [map.isMissionDeckOpen, map.openMissionDeck, tutorialRestoreDeck]);

  useEffect(() => {
    if (tutorialMissionCode && tutorialRestoreDeck !== 'true' && !hasClosedReturnedMissionDeck.current) {
      hasClosedReturnedMissionDeck.current = true;
      map.closeMissionDeck();
    }
  }, [map.closeMissionDeck, tutorialMissionCode, tutorialRestoreDeck]);

  const openMissionDetail = () => {
    router.push({
      pathname: '/mission/detail',
      params: {
        district: map.selectedDistrict,
        districtCode: map.selectedTarget?.districtCode ?? '',
        missionCode: map.activeMission?.code ?? map.activeMission?.id ?? '',
        piece: String(map.selectedMapPiece ?? ''),
        ...(map.selectedCategory !== 'ACQUIRED' ? { theme: map.selectedCategory } : {}),
      },
    });
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomActionInset, paddingHorizontal: horizontalPadding, paddingTop: topInset }]}>
      <MapHeader />

      {!map.isMissionDeckOpen ? (
        <MapCategorySelector onSelectCategory={map.setSelectedCategory} selectedCategory={map.selectedCategory} />
      ) : null}

      <InteractiveMap
        activeDistrictKeys={map.activeDistrictKeys}
        hasThemeDistrictFilter={map.hasThemeDistrictFilter}
        isMissionDeckOpen={map.isMissionDeckOpen}
        isThemeDistrictLoading={map.isThemeDistrictLoading}
        mapHeight={mapHeight}
        mapSource={map.mapSource}
        mapWidth={mapWidth}
        onOpenMissionDeck={map.openMissionDeck}
        themeDistrictError={map.themeDistrictError}
      />

      {map.isMissionDeckOpen ? (
        <MissionDeckOverlay
          activeMission={map.activeMission}
          activeMissionIndex={map.activeMissionIndex}
          cardPanHandlers={map.cardPanResponder.panHandlers}
          cardRotate={map.cardRotate}
          cardTranslateX={map.cardTranslateX}
          contentMaxWidth={contentMaxWidth}
          deckMissionError={map.deckMissionError}
          frameHeight={frameHeight}
          frameWidth={frameWidth}
          isDeckMissionLoading={map.isDeckMissionLoading}
          missionDeckCount={map.missionDeckCount}
          nextMission={map.nextMission}
          onClose={map.closeMissionDeck}
          onOpenMissionDetail={openMissionDetail}
          onTutorialSwipe={map.moveMissionCard}
          previousMission={map.previousMission}
          shouldShowNextFrame={map.shouldShowNextFrame}
          shouldShowPreviousFrame={map.shouldShowPreviousFrame}
        />
      ) : null}
    </View>
  );
}
