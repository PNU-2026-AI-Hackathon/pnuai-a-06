import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Modal, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { getMissionCardLevel } from '@/components/mission-card';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import type { TripScheduleMission } from '@/lib/trip-schedule-api';
import { styles } from './active-mission-start-modal-styles';

type ActiveMissionStartModalProps = {
  bottomSafeInset: number;
  isSessionBusy: boolean;
  onClose: () => void;
  onStart: () => void;
  pendingMission: TripScheduleMission | null;
};

// active 여행 화면에서 미션 시작 전 안내와 시작 액션을 담당합니다.
export function ActiveMissionStartModal({
  bottomSafeInset,
  isSessionBusy,
  onClose,
  onStart,
  pendingMission,
}: ActiveMissionStartModalProps) {
  const pendingMissionLevel = getMissionCardLevel(pendingMission);

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!isSessionBusy) {
          onClose();
        }
      }}
      transparent
      visible={Boolean(pendingMission)}>
      <Pressable accessibilityLabel="미션 시작 팝업 닫기" disabled={isSessionBusy} onPress={onClose} style={styles.missionStartOverlay}>
        <Pressable style={[styles.missionStartDialog, { paddingBottom: bottomSafeInset + 22 }]}>
          <Image contentFit="fill" source={pendingMissionLevel.frame} style={styles.missionStartFrame} />
          <View style={styles.missionStartContent}>
            <Text numberOfLines={2} style={[styles.missionStartQuestion, { color: pendingMissionLevel.titleColor }]}>{pendingMission?.title ?? '미션'}</Text>
            {pendingMission?.emojiUrl ? <Image contentFit="contain" source={{ uri: pendingMission.emojiUrl }} style={styles.missionStartCardIcon} /> : <Ionicons color={pendingMissionLevel.titleColor} name="camera-outline" size={72} />}

            <Text numberOfLines={3} style={[styles.missionStartDescription, { color: pendingMissionLevel.accentColor }]}>{pendingMission?.description ?? '미션 설명이 아직 없습니다.'}</Text>
            <ScalePressable
              disabled={isSessionBusy}
              onPress={onStart}
              pressedScale={0.97}
              style={[styles.missionStartButton, { backgroundColor: '#63B5CD' }]}>
              {isSessionBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.missionStartButtonText}>미션 시작하기</Text>}
            </ScalePressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
