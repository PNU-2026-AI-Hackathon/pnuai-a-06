import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import type { TripScheduleMission } from '@/lib/trip-schedule-api';
import { getMissionDateLabel, isCompletedScheduleMission } from '../active-data';
import { styles } from './active-mission-list-modal-styles';

type MissionDateGroup = {
  date: string;
  missions: TripScheduleMission[];
};

type ActiveMissionListModalProps = {
  visible: boolean;
  missionListMessage: string;
  visibleMissions: TripScheduleMission[];
  missionDateGroups: MissionDateGroup[];
  scheduleDateOptions: string[];
  dateEditorMissionId: string | null;
  busyScheduleMissionId: string | null;
  canRemoveMission: boolean;
  isMissionLockedForEdit: (mission: TripScheduleMission) => boolean;
  isTemporaryMission: (mission: TripScheduleMission) => boolean;
  isMissionBlockedForPlay: (mission: TripScheduleMission) => boolean;
  onClose: () => void;
  onOpenMissionSession: (mission: TripScheduleMission) => void;
  onToggleDateEditor: (missionId: string) => void;
  onRemoveMission: (mission: TripScheduleMission) => void;
  onChangeMissionDate: (mission: TripScheduleMission, plannedDate: string) => void;
};

// active 여행 화면에서 날짜별 미션 조회, 시작, 날짜 변경, 삭제를 담당합니다.
export function ActiveMissionListModal({
  busyScheduleMissionId,
  canRemoveMission,
  dateEditorMissionId,
  isMissionBlockedForPlay,
  isMissionLockedForEdit,
  isTemporaryMission,
  missionDateGroups,
  missionListMessage,
  onChangeMissionDate,
  onClose,
  onOpenMissionSession,
  onRemoveMission,
  onToggleDateEditor,
  scheduleDateOptions,
  visible,
  visibleMissions,
}: ActiveMissionListModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="담긴 미션 닫기" onPress={onClose} style={styles.modalBackdrop}>
        <Pressable style={styles.missionPanel}>
          <Text style={styles.panelTitle}>날짜별 담긴 미션</Text>
          {missionListMessage ? <Text style={styles.missionListMessage}>{missionListMessage}</Text> : null}
          <ScrollView contentContainerStyle={styles.panelMissionList} showsVerticalScrollIndicator={false}>
            {visibleMissions.length === 0 ? (
              <View style={styles.panelEmptyBox}>
                <Text style={styles.emptyTitle}>담긴 미션이 없어요</Text>
                <Text style={styles.emptyText}>미션 상세 리스트에서 원하는 미션을 담아보세요.</Text>
              </View>
            ) : missionDateGroups.map((group) => (
              <View key={group.date} style={styles.missionDateGroup}>
                <Text style={styles.missionDateTitle}>{getMissionDateLabel(group.date)}</Text>
                {group.missions.length === 0 ? (
                  <View style={styles.emptyDateBox}>
                    <Text style={styles.emptyDateText}>담긴 미션 없음</Text>
                  </View>
                ) : group.missions.map((mission) => {
                  const isBusy = busyScheduleMissionId === mission.scheduleMissionId;
                  const isLocked = isMissionLockedForEdit(mission);
                  const isTemporary = isTemporaryMission(mission);
                  const isPlayBlocked = isMissionBlockedForPlay(mission);
                  const canEditMission = !isLocked && !isBusy;
                  const canDeleteMission = !isBusy && !isCompletedScheduleMission(mission) && (!isLocked || isTemporary);

                  return (
                    <View key={mission.scheduleMissionId} style={styles.panelMissionItem}>
                      <ScalePressable accessibilityRole="button" disabled={isBusy || isPlayBlocked} onPress={() => onOpenMissionSession(mission)} pressedScale={0.98} style={[styles.panelMissionOpenArea, isPlayBlocked && styles.blockedMissionOpenArea]}>
                        {mission.photoUrl ? <Image source={{ uri: mission.photoUrl }} style={styles.panelMissionPhoto} contentFit="cover" /> : <View style={styles.panelMissionPhotoPlaceholder} />}
                        <View style={styles.panelMissionCopy}>
                          <Text numberOfLines={1} style={styles.panelMissionTitle}>{mission.title}</Text>
                          <Text numberOfLines={2} style={styles.panelMissionDescription}>{mission.description}</Text>
                          <Text style={styles.panelMissionStatus}>{mission.status ?? 'ADDED'}</Text>
                        </View>
                      </ScalePressable>
                      <View style={styles.panelMissionActions}>
                        <ScalePressable accessibilityLabel="미션 날짜 변경" disabled={!canEditMission} onPress={() => onToggleDateEditor(mission.scheduleMissionId)} pressedScale={0.9} style={[styles.iconActionButton, !canEditMission && styles.disabledButton]}>
                          {isBusy ? <ActivityIndicator color="#626E75" /> : <Ionicons color="#626E75" name="calendar-outline" size={18} />}
                        </ScalePressable>
                        <ScalePressable accessibilityLabel="미션 삭제" disabled={!canDeleteMission || !canRemoveMission} onPress={() => onRemoveMission(mission)} pressedScale={0.9} style={[styles.iconActionButton, (!canDeleteMission || !canRemoveMission) && styles.disabledButton]}>
                          <Ionicons color="#D06958" name="trash-outline" size={18} />
                        </ScalePressable>
                      </View>
                      {dateEditorMissionId === mission.scheduleMissionId ? (
                        <View style={styles.dateEditorGrid}>
                          {scheduleDateOptions.map((date) => {
                            const isSelectedDate = mission.plannedDate === date;

                            return (
                              <ScalePressable
                                accessibilityRole="button"
                                disabled={isSelectedDate || isBusy}
                                key={date}
                                onPress={() => onChangeMissionDate(mission, date)}
                                pressedScale={0.96}
                                style={[styles.dateEditorOption, isSelectedDate && styles.selectedDateEditorOption, isBusy && styles.disabledButton]}>
                                <Text style={[styles.dateEditorText, isSelectedDate && styles.selectedDateEditorText]}>{date}</Text>
                              </ScalePressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
