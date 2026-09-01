// 선택한 구의 미션 카드와 스와이프 오버레이를 담당합니다.
import { useEffect } from 'react';
import { Animated, PanResponder, View } from 'react-native';

import { MissionCard } from '@/components/mission-card';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';
import type { MissionItem } from '@/lib/mission-api';

import { styles } from '../styles';

type MissionDeckOverlayProps = {
  activeMission: MissionItem | undefined;
  activeMissionIndex: number;
  cardPanHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  cardRotate: Animated.AnimatedInterpolation<string>;
  cardTranslateX: Animated.Value;
  contentMaxWidth: number;
  deckMissionError: string;
  frameHeight: number;
  frameWidth: number;
  isDeckMissionLoading: boolean;
  missionDeckCount: number;
  nextMission: MissionItem | undefined;
  onClose: () => void;
  onOpenMissionDetail: () => void;
  onTutorialSwipe: (direction: 1 | -1) => void;
  previousMission: MissionItem | undefined;
  shouldShowNextFrame: boolean;
  shouldShowPreviousFrame: boolean;
};

export function MissionDeckOverlay({
  activeMission,
  activeMissionIndex,
  cardPanHandlers,
  cardRotate,
  cardTranslateX,
  contentMaxWidth,
  deckMissionError,
  frameHeight,
  frameWidth,
  isDeckMissionLoading,
  missionDeckCount,
  nextMission,
  onClose,
  onOpenMissionDetail,
  onTutorialSwipe,
  previousMission,
  shouldShowNextFrame,
  shouldShowPreviousFrame,
}: MissionDeckOverlayProps) {
  const toMissionCardData = (mission: MissionItem) => ({
    description: mission.description,
    iconText: mission.rewardItemIcon,
    iconUrl: mission.emojiUrl,
    title: mission.title,
    type: mission.type,
  });
  const cardTarget = useTutorialTarget('mission-card', {
    height: frameHeight,
    metadata: activeMission?.code ?? activeMission?.id,
    offsetY: 20,
    onSwipe: onTutorialSwipe,
    width: frameWidth,
  });
  const detailTarget = useTutorialTarget('mission-detail', { offsetY: 27, onPress: onOpenMissionDetail });

  useEffect(() => {
    cardTarget.onLayout();
  }, [activeMission?.code, activeMission?.id, cardTarget.onLayout]);

  return (
    <View style={styles.overlay}>
      <Text style={styles.overlayTitle}>넘겨서 다음 미션 보기</Text>
      <View style={[styles.frameDeck, { height: frameHeight, width: frameWidth + 72 }]}>
        {shouldShowPreviousFrame && previousMission ? (
          <View style={[styles.backMissionCard, styles.backFrameLeft, { height: frameHeight, width: frameWidth }]}>
            <MissionCard blurContent mission={toMissionCardData(previousMission)} />
          </View>
        ) : null}
        {shouldShowNextFrame && nextMission ? (
          <View style={[styles.backMissionCard, styles.backFrameRight, { height: frameHeight, width: frameWidth }]}>
            <MissionCard blurContent mission={toMissionCardData(nextMission)} />
          </View>
        ) : null}
        <View
          onLayout={cardTarget.onLayout}
          ref={cardTarget.ref}
          style={[styles.frontMissionCard, { height: frameHeight, width: frameWidth }]}>
          <Animated.View
            {...cardPanHandlers}
            style={[styles.frontMissionCard, { height: frameHeight, transform: [{ translateX: cardTranslateX }, { rotate: cardRotate }], width: frameWidth }]}>
            <MissionCard
              errorMessage={deckMissionError}
              isLoading={isDeckMissionLoading}
              mission={activeMission ? {
                ...toMissionCardData(activeMission),
              } : null}
            />
          </Animated.View>
        </View>
      </View>

      <View style={styles.pagination}>
        {Array.from({ length: missionDeckCount }).map((_, index) => (
          <View key={`mission-page-${index}`} style={[styles.pageDot, index === activeMissionIndex ? styles.activeDot : null]} />
        ))}
      </View>

      <View style={[styles.overlayActions, { maxWidth: contentMaxWidth }]}>
        <View onLayout={detailTarget.onLayout} ref={detailTarget.ref} style={styles.overlayButtonTarget}>
          <ScalePressable accessibilityRole="button" accessibilityLabel="미션 상세 보기" onPress={onOpenMissionDetail} style={styles.overlayButton}>
            <Text style={styles.overlayButtonText}>미션 상세 보기</Text>
          </ScalePressable>
        </View>
        <ScalePressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.overlayButton}>
          <Text style={styles.overlayButtonText}>닫기</Text>
        </ScalePressable>
      </View>
    </View>
  );
}
