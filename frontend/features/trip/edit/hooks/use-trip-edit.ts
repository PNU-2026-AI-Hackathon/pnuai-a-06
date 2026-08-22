import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { createFallbackInviteUrl, getDateCount, isTripStartedDate } from '@/features/trip/edit/trip-edit-data';
import { getAuthItem } from '@/lib/auth-storage';
import { shareKakaoInvite } from '@/lib/kakao-share';
import { removeTripCompanion } from '@/lib/trip-companion-api';
import { createKakaoInviteTemplateArgs, createTripInvite, type TripInvite } from '@/lib/trip-invite-api';
import { removeMissionFromSchedule, getTripSchedule, updateDraftSchedule, updateScheduleMissionDate, type TripSchedule, type TripScheduleMission, type TripScheduleUser } from '@/lib/trip-schedule-api';

type UseTripEditOptions = {
  onSaveSuccess: () => void;
  scheduleId?: string;
};

// 여행 일정 수정에 필요한 조회·저장·동행자·미션 관리 상태를 담당합니다.
export function useTripEdit({ onSaveSuccess, scheduleId }: UseTripEditOptions) {
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
      onSaveSuccess();
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

  return {
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
    hasScheduleChanges,
    invite,
    isCreatingInvite,
    isEndDateChanged,
    isCreator,
    isLoading,
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
    setEndDate,
    setInvite,
    setMissionDatePickerId,
    setMissionListVisible,
    setScheduleName,
    startDate,
  };
}
