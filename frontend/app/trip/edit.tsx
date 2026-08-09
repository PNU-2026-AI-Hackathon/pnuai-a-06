import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { TopBar } from '@/components/top-bar';
import { TripInviteSheet } from '@/components/trip-invite-sheet';
import { TripDatePicker } from '@/components/trip-date-picker';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import { shareKakaoInvite } from '@/lib/kakao-share';
import { removeTripCompanion } from '@/lib/trip-companion-api';
import { createKakaoInviteTemplateArgs, createTripInvite, type TripInvite } from '@/lib/trip-invite-api';
import { removeMissionFromSchedule, getTripSchedule, updateDraftSchedule, updateScheduleMissionDate, type TripSchedule, type TripScheduleMission, type TripScheduleUser } from '@/lib/trip-schedule-api';

const crownIcon = require('../../assets/svg/active/crown.svg');
const blackChevronIcon = require('../../assets/svg/active/inv_chevron_black.svg');
const greyChevronIcon = require('../../assets/svg/active/inv_chevron_grey.svg');

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(year, month - 1, day) : null;
}

function getDateCount(startDate: string | null | undefined, endDate: string | null | undefined) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1;
}

function isTripStartedDate(startDate: string | null | undefined) {
  const start = parseDate(startDate);
  if (!start) return false;

  const today = new Date();
  const todayValue = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startValue = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());

  return todayValue >= startValue;
}
function formatDateLabel(value: string | null | undefined, withYear = true) {
  const date = parseDate(value);
  if (!date) return '날짜 선택';
  return withYear ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일` : `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function createFallbackInviteUrl(invite: TripInvite) {
  if (invite.inviteUrl) return invite.inviteUrl;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL('/trip/invite', window.location.origin);
    url.searchParams.set('inviteToken', invite.inviteToken);
    return url.toString();
  }
  return Linking.createURL('/trip/invite', { isTripleSlashed: true, queryParams: { inviteToken: invite.inviteToken } });
}

export default function EditTripScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [schedule, setSchedule] = useState<TripSchedule | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [missionDatePickerId, setMissionDatePickerId] = useState<string | null>(null);
  const [missionListVisible, setMissionListVisible] = useState(false);
  const [busyMissionId, setBusyMissionId] = useState<string | null>(null);
  const [busyCompanionId, setBusyCompanionId] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [invite, setInvite] = useState<TripInvite | null>(null);

  const currentUserId = getAuthItem('user_id');
  const isCreator = Boolean(schedule?.permissions.canUpdateSchedule && (!schedule.creatorId || schedule.creatorId === currentUserId));
  const dateCount = useMemo(() => getDateCount(startDate, endDate), [endDate, startDate]);
  const hasScheduleChanges = Boolean(schedule && (scheduleName !== schedule.roomName || startDate !== (schedule.startDate ?? null) || endDate !== (schedule.endDate ?? schedule.startDate ?? null)));
  const isTripStarted = isTripStartedDate(schedule?.startDate);
  const canSubmit = Boolean(isCreator && hasScheduleChanges && scheduleName.trim() && startDate && endDate);
  const isStartDateChanged = Boolean(schedule && startDate !== (schedule.startDate ?? null));
  const isEndDateChanged = Boolean(schedule && endDate !== (schedule.endDate ?? schedule.startDate ?? null));
  const missionForDatePicker = schedule?.missions.find((mission) => mission.scheduleMissionId === missionDatePickerId);
  const canManageMissions = Boolean(isCreator && schedule?.permissions.canRemoveMission);

  useEffect(() => {
    let isActive = true;
    if (!scheduleId) {
      setMessage('일정 정보가 없습니다.');
      setIsLoading(false);
      return () => { isActive = false; };
    }

    setIsLoading(true);
    getTripSchedule(scheduleId)
      .then((nextSchedule) => {
        if (!isActive) return;
        setSchedule(nextSchedule);
        setScheduleName(nextSchedule.roomName);
        setStartDate(nextSchedule.startDate ?? null);
        setEndDate(nextSchedule.endDate ?? nextSchedule.startDate ?? null);
      })
      .catch((error) => isActive && setMessage(error instanceof Error ? error.message : '일정을 불러오지 못했어요.'))
      .finally(() => isActive && setIsLoading(false));

    return () => { isActive = false; };
  }, [scheduleId]);

  const reloadSchedule = async () => {
    if (!scheduleId) return null;
    const nextSchedule = await getTripSchedule(scheduleId);
    setSchedule(nextSchedule);
    setScheduleName(nextSchedule.roomName);
    setStartDate(nextSchedule.startDate ?? null);
    setEndDate(nextSchedule.endDate ?? nextSchedule.startDate ?? null);
    return nextSchedule;
  };

  const handleDateConfirm = (nextStartDate: string, nextEndDate: string) => {
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setDatePickerVisible(false);
    setMessage('');
  };

  const handleSave = async () => {
    if (!schedule || !isCreator) {
      setMessage('일정을 만든 사람만 여행 정보를 수정할 수 있어요.');
      return;
    }
    if (!scheduleName.trim() || !startDate || !endDate) {
      setMessage('일정 이름과 여행 기간을 입력해 주세요.');
      return;
    }

    try {
      setIsSaving(true);
      setMessage('');
      await updateDraftSchedule({ endDate, peopleCount: schedule.peopleCount ?? String(schedule.participants.length || 1), roomName: scheduleName.trim(), scheduleId: schedule.scheduleId, startDate });
      router.back();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '여행 일정 수정에 실패했어요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!schedule || !isCreator || !schedule.permissions.canInviteCompanion) {
      setMessage('일정을 만든 사람만 동행자를 추가할 수 있어요.');
      return;
    }
    try {
      setIsCreatingInvite(true);
      const nextInvite = await createTripInvite({ roomName: schedule.roomName, scheduleId: schedule.scheduleId });
      setInvite(nextInvite);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '초대장을 만들지 못했어요.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    if (!invite || isSharingInvite) return;
    try {
      setIsSharingInvite(true);
      await shareKakaoInvite(createKakaoInviteTemplateArgs({ ...invite, inviteUrl: createFallbackInviteUrl(invite) }));
      setInvite(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '카카오 초대에 실패했어요.');
    } finally {
      setIsSharingInvite(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(createFallbackInviteUrl(invite));
    setInvite(null);
    setMessage('초대 링크를 복사했어요.');
  };

  const confirmRemoveCompanion = (participant: TripScheduleUser) => {
    const participantId = participant.id;
    if (!schedule || !participantId || participantId === schedule.creatorId || !isCreator || !schedule.permissions.canRemoveCompanion) return;
    Alert.alert('동행자 삭제', `${participant.nickname || participant.email || '동행자'}님을 여행에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          setBusyCompanionId(participantId);
          await removeTripCompanion(schedule.scheduleId, participantId);
          await reloadSchedule();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : '동행자를 삭제하지 못했어요.');
        } finally {
          setBusyCompanionId(null);
        }
      } },
    ]);
  };

  const handleMissionDateConfirm = async (nextStartDate: string) => {
    if (!schedule || !missionForDatePicker || !canManageMissions || busyMissionId) return;
    try {
      setBusyMissionId(missionForDatePicker.scheduleMissionId);
      await updateScheduleMissionDate(schedule.scheduleId, missionForDatePicker.scheduleMissionId, nextStartDate);
      await reloadSchedule();
      setMissionDatePickerId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '미션 날짜를 바꾸지 못했어요.');
    } finally {
      setBusyMissionId(null);
    }
  };

  const confirmRemoveMission = (mission: TripScheduleMission) => {
    if (!schedule || !canManageMissions || busyMissionId || mission.status === 'COMPLETED') return;
    Alert.alert('미션 삭제', `${mission.title} 미션을 일정에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          setBusyMissionId(mission.scheduleMissionId);
          await removeMissionFromSchedule(schedule.scheduleId, mission.scheduleMissionId);
          await reloadSchedule();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : '미션을 삭제하지 못했어요.');
        } finally {
          setBusyMissionId(null);
        }
      } },
    ]);
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#6EA4BF" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: topSafeInset }}><TopBar title="여행 수정" /></View>
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
          <Pressable accessibilityLabel="동행자 추가" disabled={!isCreator || isCreatingInvite} onPress={handleCreateInvite} style={styles.personItem}>
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

        <Pressable accessibilityRole="button" onPress={() => setMissionListVisible((value) => !value)} style={styles.missionHeader}>
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
        <ScalePressable accessibilityRole="button" disabled={isSaving || !canSubmit} onPress={handleSave} pressedScale={0.98} style={[styles.saveButton, canSubmit && styles.activeSaveButton]}>{isSaving ? <ActivityIndicator color={canSubmit ? "#FFFFFF" : "#6EA4BF"} /> : <Text style={[styles.saveText, canSubmit && styles.activeSaveText]}>수정 완료</Text>}</ScalePressable>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  center: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  sectionTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 28,
  },
  inputBox: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    flexDirection: 'row',
    height: 51,
    marginTop: 18,
    paddingHorizontal: 22,
  },
  input: {
    color: '#8A9194',
    flex: 1,
    fontSize: 16,
  },
  clearText: {
    alignItems: 'center',
    backgroundColor: '#8A9194',
    borderRadius: 20,
    color: '#ffffff',
    fontSize: 19,
    height: 22,
    lineHeight: 22,
    textAlign: 'center',
    width: 22,
  },
  inputMessage: {
    color: '#D06958',
    fontSize: 11,
    marginLeft: 12,
    marginTop: 6,
  },
  periodTitle: {
    marginTop: 38,
  },
  periodDisabled: {
    opacity: 0.55,
  },
  periodRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  dateBox: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    height: 47,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  changedDateBox: {
    backgroundColor: '#E3F0F6',
  },
  dateText: {
    color: '#8A9194',
    fontSize: 16,
    fontWeight: '500',
  },
  changedDateText: {
    color: '#10161F',
  },
  chevronIcon: {
    height: 5,
    width: 8,
  },
  wave: {
    color: '#10161F',
    fontSize: 16,
  },
  durationText: {
    color: '#8A9194',
    fontSize: 12,
    marginLeft: 12,
    marginTop: 10,
  },
  companionTitle: {
    marginTop: 38,
  },
  peopleRow: {
    gap: 8,
    paddingBottom: 2,
    paddingTop: 20,
  },
  personItem: {
    alignItems: 'center',
    width: 67,
  },
  addPerson: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 44,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  plus: {
    color: '#8A9194',
    fontSize: 20,
    fontWeight: '500',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#DCEAF0',
    borderRadius: 44,
    height: 56,
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
    width: 56,
  },
  crown: {
    elevation: 5,
    height: 20,
    position: 'absolute',
    right: -5,
    top: -2,
    width: 20,
    zIndex: 5,
  },
  removePerson: {
    alignItems: 'center',
    backgroundColor: '#10161F',
    borderRadius: 15,
    elevation: 6,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -5,
    top: -2,
    width: 20,
    zIndex: 6,
  },
  removePersonText: {
    color: '#ffffff',
    fontSize: 21,
    lineHeight: 24,
  },
  personName: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 8,
    maxWidth: 82,
    textAlign: 'center',
  },
  missionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  missionHeaderText: {
    color: '#10161F',
    fontSize: 21,
    fontWeight: '700',
  },
  missionChevron: {
    color: '#10161F',
    fontSize: 30,
    marginTop: 4,
  },
  missionSubtitle: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 8,
  },
  missionList: {
    backgroundColor: '#F8FAFB',
    borderRadius: 18,
    gap: 10,
    marginTop: 18,
    padding: 12,
  },
  emptyMission: {
    color: '#8A9194',
    padding: 14,
  },
  missionItem: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  missionCopy: {
    flex: 1,
  },
  missionTitle: {
    color: '#26343B',
    fontSize: 15,
    fontWeight: '600',
  },
  missionDate: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 4,
  },
  missionAction: {
    alignItems: 'center',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  disabledAction: {
    opacity: 0.35,
  },
  deleteText: {
    color: '#D06958',
    fontSize: 20,
  },
  message: {
    color: '#D06958',
    fontSize: 13,
    marginTop: 18,
  },
  bottomBar: {
    backgroundColor: '#fff',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#E3F0F6',
    borderRadius: 42,
    height: 63,
    justifyContent: 'center',
  },
  activeSaveButton: {
    backgroundColor: '#63B5CD',
  },
  saveText: {
    color: '#6EA4BF',
    fontSize: 16,
    fontWeight: '600',
  },
  activeSaveText: {
    color: '#FFFFFF',
  },
  inviteOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  inviteCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    width: '100%',
  },
  inviteTitle: {
    color: '#10161F',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: '#FEE500',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
  },
  inviteButtonText: {
    color: '#3A2D00',
    fontSize: 16,
    fontWeight: '700',
  },
  copyButton: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
  },
  copyButtonText: {
    color: '#626E75',
    fontSize: 15,
  },
});