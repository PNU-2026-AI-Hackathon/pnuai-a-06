import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { TopBar } from '@/components/top-bar';
import { TripDatePicker } from '@/components/trip-date-picker';
import { TripInviteSheet } from '@/components/trip-invite-sheet';
import { formatDateLabel } from '@/features/trip/edit/trip-edit-data';
import type { TripInvite } from '@/lib/trip-invite-api';
import type { TripSchedule, TripScheduleMission, TripScheduleUser } from '@/lib/trip-schedule-api';

import { styles } from '@/features/trip/edit/trip-edit-styles';

const crownIcon = require('@/assets/svg/active/crown_black.svg');
const blackChevronIcon = require('@/assets/svg/active/inv_chevron_black.svg');
const greyChevronIcon = require('@/assets/svg/active/inv_chevron_grey.svg');

type TripEditFormProps = {
  bottomSafeInset: number;
  busyCompanionId: string | null;
  busyMissionId: string | null;
  canManageMissions: boolean;
  canSubmit: boolean;
  confirmRemoveCompanion: (participant: TripScheduleUser) => void;
  confirmRemoveMission: (mission: TripScheduleMission) => void;
  dateCount: number;
  datePickerVisible: boolean;
  endDate: string | null;
  handleCopyInvite: () => Promise<void>;
  handleCreateInvite: () => Promise<void>;
  handleDateConfirm: (nextStartDate: string, nextEndDate: string) => void;
  handleMissionDateConfirm: (nextStartDate: string) => Promise<void>;
  handleSave: () => Promise<void>;
  handleShareInvite: () => Promise<void>;
  horizontalPadding: number;
  invite: TripInvite | null;
  isCreatingInvite: boolean;
  isEndDateChanged: boolean;
  isCreator: boolean;
  isSaving: boolean;
  isSharingInvite: boolean;
  isStartDateChanged: boolean;
  isTripStarted: boolean;
  message: string;
  missionDatePickerId: string | null;
  missionForDatePicker?: TripScheduleMission;
  missionListVisible: boolean;
  schedule: TripSchedule | null;
  scheduleName: string;
  setDatePickerVisible: (visible: boolean) => void;
  setInvite: (invite: TripInvite | null) => void;
  setMissionDatePickerId: (id: string | null) => void;
  setMissionListVisible: (visible: boolean) => void;
  setScheduleName: (name: string) => void;
  startDate: string | null;
  topInset: number;
};

// 여행 일정 수정 화면의 입력·동행자·미션 관리 UI를 담당합니다.
export function TripEditForm({
  bottomSafeInset,
  busyCompanionId,
  busyMissionId,
  canManageMissions,
  canSubmit,
  confirmRemoveCompanion,
  confirmRemoveMission,
  dateCount,
  datePickerVisible,
  endDate,
  handleCopyInvite,
  handleCreateInvite,
  handleDateConfirm,
  handleMissionDateConfirm,
  handleSave,
  handleShareInvite,
  horizontalPadding,
  invite,
  isCreatingInvite,
  isEndDateChanged,
  isCreator,
  isSaving,
  isSharingInvite,
  isStartDateChanged,
  isTripStarted,
  message,
  missionDatePickerId,
  missionForDatePicker,
  missionListVisible,
  schedule,
  scheduleName,
  setDatePickerVisible,
  setInvite,
  setMissionDatePickerId,
  setMissionListVisible,
  setScheduleName,
  startDate,
  topInset,
}: TripEditFormProps) {
  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: topInset }}><TopBar title="여행 수정" /></View>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSafeInset + 120, paddingHorizontal: horizontalPadding }} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>일정 이름</Text>
        <View style={styles.inputBox}>
          <TextInput accessibilityLabel="일정 이름" onChangeText={setScheduleName} placeholder="우정 여행" placeholderTextColor="#A3AAAE" style={styles.input} value={scheduleName} />
          {scheduleName ? <Pressable accessibilityLabel="일정 이름 지우기" onPress={() => setScheduleName('')}><Text style={styles.clearText}>×</Text></Pressable> : null}
        </View>
        {!scheduleName.trim() ? <Text style={styles.inputMessage}>일정 이름을 입력해 주세요.</Text> : null}

        <Text style={[styles.sectionTitle, styles.periodTitle]}>기간</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !isCreator || isTripStarted }} disabled={!isCreator || isTripStarted} onPress={() => setDatePickerVisible(true)} style={[styles.periodRow, isTripStarted && styles.periodDisabled]}>
          <View style={[styles.dateBox, isStartDateChanged && styles.changedDateBox]}>
            <Text style={[styles.dateText, isStartDateChanged && styles.changedDateText]}>{formatDateLabel(startDate, false)}</Text>
            <Image source={isStartDateChanged ? blackChevronIcon : greyChevronIcon} style={styles.chevronIcon} />
          </View>
          <Text style={styles.wave}>~</Text>
          <View style={[styles.dateBox, isEndDateChanged && styles.changedDateBox]}>
            <Text style={[styles.dateText, isEndDateChanged && styles.changedDateText]}>{formatDateLabel(endDate, false)}</Text>
            <Image source={isEndDateChanged ? blackChevronIcon : greyChevronIcon} style={styles.chevronIcon} />
          </View>
        </Pressable>
        <Text style={styles.durationText}>{dateCount > 0 ? `${dateCount}일간 여행` : '여행 기간을 선택해 주세요.'}</Text>

        <Text style={[styles.sectionTitle, styles.companionTitle]}>동행자</Text>
        <ScrollView contentContainerStyle={styles.peopleRow} horizontal showsHorizontalScrollIndicator={false}>
          <Pressable accessibilityLabel="동행자 추가" disabled={!isCreator || isCreatingInvite} onPress={() => void handleCreateInvite()} style={styles.personItem}>
            <View style={styles.addPerson}><Text style={styles.plus}>＋</Text></View><Text style={styles.personName}>추가</Text>
          </Pressable>
          {(schedule?.participants ?? []).map((participant, index) => {
            const isOwner = participant.id === schedule?.creatorId || index === 0;
            const isBusy = busyCompanionId === participant.id;
            return <View key={`${participant.id ?? participant.email ?? index}`} style={styles.personItem}>
              <View style={styles.avatar}><ProfileAvatar profileEmoji={participant.profileEmoji} profileImageUrl={participant.profileImageUrl} size={56} />{isOwner ? <Image source={crownIcon} style={styles.crown} contentFit="contain" /> : null}{!isOwner && isCreator ? <Pressable accessibilityLabel="동행자 삭제" disabled={isBusy} onPress={() => confirmRemoveCompanion(participant)} style={styles.removePerson}><Text style={styles.removePersonText}>{isBusy ? '…' : '×'}</Text></Pressable> : null}</View>
              <Text numberOfLines={1} style={styles.personName}>{participant.nickname || participant.email || '동행자'}</Text>
            </View>;
          })}
        </ScrollView>

        <Pressable accessibilityRole="button" onPress={() => setMissionListVisible(!missionListVisible)} style={styles.missionHeader}>
          <Text style={styles.sectionTitle}>미션 리스트</Text><Text style={styles.missionChevron}>{missionListVisible ? '⌃' : '›'}</Text>
        </Pressable>
        <Text style={styles.missionSubtitle}>담아둔 미션을 일정별로 관리해 보세요.</Text>
        {missionListVisible ? <View style={styles.missionList}>
          {(schedule?.missions ?? []).length === 0 ? <Text style={styles.emptyMission}>담아둔 미션이 없어요.</Text> : (schedule?.missions ?? []).map((mission) => {
            const canEdit = canManageMissions && mission.status !== 'COMPLETED';
            return <View key={mission.scheduleMissionId} style={styles.missionItem}>
              <View style={styles.missionCopy}><Text numberOfLines={1} style={styles.missionTitle}>{mission.title}</Text><Text style={styles.missionDate}>{formatDateLabel(mission.plannedDate, false)}</Text></View>
              <Pressable accessibilityLabel="미션 날짜 변경" disabled={!canEdit} onPress={() => setMissionDatePickerId(mission.scheduleMissionId)} style={[styles.missionAction, !canEdit && styles.disabledAction]}><Text>▣</Text></Pressable>
              <Pressable accessibilityLabel="미션 삭제" disabled={!canEdit} onPress={() => confirmRemoveMission(mission)} style={[styles.missionAction, !canEdit && styles.disabledAction]}><Text style={styles.deleteText}>⌫</Text></Pressable>
            </View>;
          })}
        </View> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomSafeInset + 10, paddingHorizontal: horizontalPadding }]}>
        <ScalePressable accessibilityRole="button" disabled={isSaving || !canSubmit} onPress={() => void handleSave()} pressedScale={0.98} style={[styles.saveButton, canSubmit && styles.activeSaveButton]}>{isSaving ? <ActivityIndicator color={canSubmit ? '#FFFFFF' : '#6EA4BF'} /> : <Text style={[styles.saveText, canSubmit && styles.activeSaveText]}>수정 완료</Text>}</ScalePressable>
      </View>

      <TripDatePicker endDate={endDate} onClose={() => setDatePickerVisible(false)} onConfirm={handleDateConfirm} startDate={startDate} visible={datePickerVisible} />
      <TripDatePicker endDate={missionForDatePicker?.plannedDate ?? startDate} maxDate={endDate ?? undefined} minDate={startDate ?? undefined} onClose={() => setMissionDatePickerId(null)} onConfirm={(nextStartDate) => void handleMissionDateConfirm(nextStartDate)} startDate={missionForDatePicker?.plannedDate ?? startDate} visible={Boolean(missionForDatePicker)} />
      <TripInviteSheet
        bottomSafeInset={bottomSafeInset}
        invite={invite}
        isSharing={isSharingInvite}
        message={message}
        onClose={() => setInvite(null)}
        onCopy={() => void handleCopyInvite()}
        onShare={() => void handleShareInvite()}
        visible={Boolean(invite)}
      />
    </View>
  );
}
