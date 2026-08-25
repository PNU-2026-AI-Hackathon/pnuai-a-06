// 미션 카드 목록과 일정에 담기 상태를 표시하는 UI입니다.

import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';
import type { MissionItem } from '@/lib/mission-api';
import type { TripSchedule, TripScheduleMission } from '@/lib/trip-schedule-api';

import { styles } from '../styles';

type MissionState = {
  addedMission: TripScheduleMission | null;
  isCompleted: boolean;
  isInProgress: boolean;
};

type MissionListProps = {
  missions: MissionItem[];
  targetScheduleId?: string;
  targetSchedule: TripSchedule | null;
  isAddingMission: boolean;
  isLoadingTargetSessions: boolean;
  selectedMission: MissionItem | null;
  getAddedMissionState: (mission: MissionItem) => MissionState;
  onAddMission: (mission: MissionItem) => void;
};

export function MissionList({
  missions,
  targetScheduleId,
  targetSchedule,
  isAddingMission,
  isLoadingTargetSessions,
  selectedMission,
  getAddedMissionState,
  onAddMission,
}: MissionListProps) {
  const addMissionTarget = useTutorialTarget('mission-list', { offsetY: 27 });

  return (
    <View style={styles.missionList}>
      {missions.map((mission, index) => {
        const { addedMission, isCompleted, isInProgress } = targetScheduleId
          ? getAddedMissionState(mission)
          : { addedMission: null, isCompleted: false, isInProgress: false };
        const isMissionBusy = isAddingMission && selectedMission?.id === mission.id;
        const isScheduleLoading = Boolean(targetScheduleId && !targetSchedule);
        const isCheckingSession = Boolean(addedMission && isLoadingTargetSessions);
        const missionButtonLabel = isCheckingSession ? '확인 중' : isCompleted ? '완료' : isInProgress ? '진행 중' : addedMission ? '담음' : '담기';

        return (
          <View key={mission.id} style={styles.missionCard}>
            <View style={styles.missionHeaderRow}>
              <View style={styles.missionTitleGroup}>
                <Text style={styles.missionTitle}>{mission.title}</Text>
                <Text style={styles.locationText}>{mission.location}</Text>
              </View>
              <View
                onLayout={index === 0 ? addMissionTarget.onLayout : undefined}
                ref={index === 0 ? addMissionTarget.ref : undefined}>
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel={`${mission.title} ${missionButtonLabel}`}
                  disabled={isMissionBusy || isScheduleLoading || Boolean(addedMission)}
                  onPress={() => onAddMission(mission)}
                  pressedScale={0.94}
                  style={[
                    addedMission ? styles.addedMissionButton : styles.addMissionButton,
                    (isMissionBusy || isScheduleLoading || addedMission) && styles.disabledButton,
                  ]}>
                  {isMissionBusy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.addMissionButtonText}>{missionButtonLabel}</Text>}
                </ScalePressable>
              </View>
            </View>
            <Text style={styles.descriptionText}>{mission.description}</Text>
            {mission.photoUrl ? (
              <Image source={{ uri: mission.photoUrl }} style={styles.missionPhoto} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholder} />
            )}
          </View>
        );
      })}
    </View>
  );
}
