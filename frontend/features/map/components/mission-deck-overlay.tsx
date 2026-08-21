// 선택한 구의 미션 카드와 스와이프 오버레이를 담당합니다.
import { Image } from 'expo-image';
import { Animated, PanResponder, View } from 'react-native';

import { getMissionCardLevel, MissionCard } from '@/components/mission-card';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
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
  previousMission,
  shouldShowNextFrame,
  shouldShowPreviousFrame,
}: MissionDeckOverlayProps) {
  return (
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
          {...cardPanHandlers}
          style={[styles.frontMissionCard, { height: frameHeight, transform: [{ translateX: cardTranslateX }, { rotate: cardRotate }], width: frameWidth }]}>
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
        <ScalePressable accessibilityRole="button" accessibilityLabel="미션 상세 보기" onPress={onOpenMissionDetail} style={styles.overlayButton}>
          <Text style={styles.overlayButtonText}>미션 상세 보기</Text>
        </ScalePressable>
        <ScalePressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.overlayButton}>
          <Text style={styles.overlayButtonText}>닫기</Text>
        </ScalePressable>
      </View>
    </View>
  );
}
