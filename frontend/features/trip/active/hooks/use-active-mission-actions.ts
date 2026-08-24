import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import {
  getMissionStartErrorMessage,
  isFeedReadySession,
} from '@/features/trip/active/active-data';
import { getCurrentParticipationLocation } from '@/lib/mission-location';
import {
  chooseMissionParticipation,
  createMissionSession,
  type MissionSession,
  type MissionParticipationLocation,
} from '@/lib/mission-session-api';
import { removeMissionFromSchedule, updateScheduleMissionDate, type TripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';

type UseActiveMissionActionsOptions = {
  activeBlockingSession: MissionSession | null;
  clearMissionState: (scheduleMissionId: string) => void;
  isScheduleCreator: boolean;
  isMissionLockedForEdit: (mission: TripScheduleMission) => boolean;
  isTemporaryMission: (mission: TripScheduleMission) => boolean;
  leaderStartingMissionRef: React.MutableRefObject<boolean>;
  missionSessions: Record<string, MissionSession>;
  onMessage: (message: string) => void;
  reloadCurrentSchedule: () => Promise<TripSchedule | null>;
  rememberFeedSession: (session: MissionSession, fallbackScheduleMissionId?: string) => void;
  requiredScheduleMemberCount: number;
  schedule: TripSchedule | null;
  scheduleId?: string;
  suppressedParticipationSessionId?: string;
  suppressedLeaderSessionIdsRef: React.MutableRefObject<Set<string>>;
};

// active 화면의 미션 시작·편집·삭제와 다음 미션 화면 이동을 담당합니다.
export function useActiveMissionActions({
  activeBlockingSession,
  clearMissionState,
  isScheduleCreator,
  isMissionLockedForEdit,
  isTemporaryMission,
  leaderStartingMissionRef,
  missionSessions,
  onMessage,
  reloadCurrentSchedule,
  rememberFeedSession,
  requiredScheduleMemberCount,
  schedule,
  scheduleId,
  suppressedParticipationSessionId,
  suppressedLeaderSessionIdsRef,
}: UseActiveMissionActionsOptions) {
  const [isSessionBusy, setIsSessionBusy] = useState(false);
  const [missionListVisible, setMissionListVisible] = useState(false);
  const [pendingMission, setPendingMission] = useState<TripScheduleMission | null>(null);
  const [dateEditorMissionId, setDateEditorMissionId] = useState<string | null>(null);
  const [busyScheduleMissionId, setBusyScheduleMissionId] = useState<string | null>(null);
  const [missionListMessage, setMissionListMessage] = useState('');
  const pendingMissionLocationRef = useRef<MissionParticipationLocation | null>(null);

  const isMissionBlockedForPlay = useCallback((mission: TripScheduleMission) => {
    return Boolean(activeBlockingSession?.scheduleMissionId && activeBlockingSession.scheduleMissionId !== mission.scheduleMissionId);
  }, [activeBlockingSession]);

  const handleChangeMissionDate = async (mission: TripScheduleMission, plannedDate: string) => {
    if (!schedule?.scheduleId || busyScheduleMissionId || plannedDate === mission.plannedDate) {
      return;
    }

    if (isMissionLockedForEdit(mission)) {
      setMissionListMessage('진행 중이거나 완료된 미션은 날짜를 바꿀 수 없어요.');
      return;
    }

    try {
      setBusyScheduleMissionId(mission.scheduleMissionId);
      setMissionListMessage('');
      await updateScheduleMissionDate(schedule.scheduleId, mission.scheduleMissionId, plannedDate);
      await reloadCurrentSchedule();
      setDateEditorMissionId(null);
      setMissionListMessage(`${mission.title} 미션 날짜를 ${plannedDate}로 바꿨어요.`);
    } catch (error) {
      setMissionListMessage(error instanceof Error ? error.message : '미션 날짜를 바꾸지 못했어요.');
    } finally {
      setBusyScheduleMissionId(null);
    }
  };

  const removeScheduledMission = async (mission: TripScheduleMission) => {
    if (!schedule?.scheduleId || busyScheduleMissionId) {
      return;
    }

    if (!schedule.permissions.canRemoveMission) {
      setMissionListMessage('미션 삭제 권한이 없습니다.');
      return;
    }

    if (isMissionLockedForEdit(mission) && !isTemporaryMission(mission)) {
      setMissionListMessage('진행 중이거나 완료된 미션은 삭제할 수 없어요.');
      return;
    }

    try {
      setBusyScheduleMissionId(mission.scheduleMissionId);
      setMissionListMessage('');
      await removeMissionFromSchedule(schedule.scheduleId, mission.scheduleMissionId);
      await reloadCurrentSchedule();
      setDateEditorMissionId(null);
      clearMissionState(mission.scheduleMissionId);
      setMissionListMessage(`${mission.title} 미션을 삭제했어요.`);
    } catch (error) {
      setMissionListMessage(error instanceof Error ? error.message : '미션을 삭제하지 못했어요.');
    } finally {
      setBusyScheduleMissionId(null);
    }
  };

  const handleRemoveScheduledMission = (mission: TripScheduleMission) => {
    Alert.alert('미션 삭제', `${mission.title} 미션을 일정에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void removeScheduledMission(mission) },
    ]);
  };

  const openMissionDetail = () => {
    if (!schedule?.scheduleId) {
      onMessage('일정 정보가 없습니다.');
      return;
    }

    router.push({ pathname: '/mission/detail', params: { scheduleId: schedule.scheduleId } });
  };

  const openMissionSession = (mission: TripScheduleMission) => {
    if (!schedule?.scheduleId || isSessionBusy) {
      return;
    }

    if (isMissionBlockedForPlay(mission)) {
      onMessage('진행 중인 미션을 먼저 완료해주세요.');
      return;
    }

    onMessage('');
    setMissionListVisible(false);

    const existingSession = missionSessions[mission.scheduleMissionId];
    if (
      existingSession
      && existingSession.id !== suppressedParticipationSessionId
      && ['WAITING', 'READY'].includes(existingSession.status)
    ) {
      router.push({
        pathname: '/trip/participation',
        params: {
          scheduleId: schedule.scheduleId,
          scheduleMissionId: mission.scheduleMissionId,
          sessionId: existingSession.id,
          ...(existingSession.verificationType || mission.verificationType
            ? { verificationType: existingSession.verificationType ?? mission.verificationType ?? '' }
            : {}),
        },
      });
      return;
    }

    if (isScheduleCreator && mission.verificationType?.toUpperCase() === 'GPS_PHOTO') {
      setIsSessionBusy(true);
      void getCurrentParticipationLocation()
        .then((location) => {
          pendingMissionLocationRef.current = location;
          setPendingMission(mission);
        })
        .catch((error) => {
          onMessage(getMissionStartErrorMessage(error));
        })
        .finally(() => {
          setIsSessionBusy(false);
        });
      return;
    }

    setPendingMission(mission);
  };

  const startPendingMission = async () => {
    if (!schedule?.scheduleId || !pendingMission || isSessionBusy) {
      return;
    }

    const mission = pendingMission;
    const requiresGps = isScheduleCreator && mission.verificationType?.toUpperCase() === 'GPS_PHOTO';
    let createdSessionId: string | null = null;

    try {
      setIsSessionBusy(true);
      onMessage('');
      leaderStartingMissionRef.current = true;
      const createdSession = await createMissionSession(schedule.scheduleId, mission.scheduleMissionId);
      createdSessionId = createdSession.id;
      const nextSession = requiresGps
        ? await chooseMissionParticipation(
          createdSession.id,
          'PARTICIPATE',
          pendingMissionLocationRef.current ?? await getCurrentParticipationLocation(),
        )
        : createdSession;

      rememberFeedSession(nextSession, mission.scheduleMissionId);
      pendingMissionLocationRef.current = null;
      setPendingMission(null);
      router.push({
        pathname: '/trip/participation',
        params: {
          scheduleId: schedule.scheduleId,
          scheduleMissionId: mission.scheduleMissionId,
          sessionId: nextSession.id,
          ...(nextSession.verificationType || mission.verificationType
            ? { verificationType: nextSession.verificationType ?? mission.verificationType ?? '' }
            : {}),
        },
      });
    } catch (error) {
      if (createdSessionId) {
        suppressedLeaderSessionIdsRef.current.add(createdSessionId);
      }
      pendingMissionLocationRef.current = null;
      setPendingMission(null);
      onMessage(getMissionStartErrorMessage(error));
    } finally {
      leaderStartingMissionRef.current = false;
      setIsSessionBusy(false);
    }
  };

  const openFeedSession = (targetSession: MissionSession | undefined) => {
    if (!targetSession?.id || !isFeedReadySession(targetSession, requiredScheduleMemberCount)) {
      return;
    }

    if (targetSession.status === 'VOTING') {
      router.push({ pathname: '/trip/vote', params: { ...(scheduleId ? { scheduleId } : {}), sessionId: targetSession.id } });
      return;
    }

    if (targetSession.status === 'COMPLETED') {
      router.push({ pathname: '/trip/result', params: { ...(scheduleId ? { scheduleId } : {}), sessionId: targetSession.id } });
      return;
    }

    router.push({ pathname: '/trip/review', params: { ...(scheduleId ? { scheduleId } : {}), sessionId: targetSession.id } });
  };

  return {
    busyScheduleMissionId,
    dateEditorMissionId,
    handleChangeMissionDate,
    handleRemoveScheduledMission,
    isMissionBlockedForPlay,
    isMissionLockedForEdit,
    isSessionBusy,
    isTemporaryMission,
    missionListMessage,
    missionListVisible,
    onClosePendingMission: () => {
      pendingMissionLocationRef.current = null;
      setPendingMission(null);
    },
    openFeedSession,
    openMissionDetail,
    openMissionSession,
    pendingMission,
    setDateEditorMissionId,
    setMissionListVisible,
    startPendingMission,
  };
}
