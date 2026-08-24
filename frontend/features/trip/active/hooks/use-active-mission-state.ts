import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getFeedSubmissions,
  getCalendarDayNumber,
  getScheduleDateOptions,
  getTripDayLabel,
  hasSameMissionSessionSnapshot,
  isCompletedScheduleMission,
  isFeedReadySession,
  isFinishedSession,
  isParticipatingMissionMember,
  isStartedMissionSession,
  parseDateValue,
  saveCachedRevealedSessions,
} from '@/features/trip/active/active-data';
import {
  getMissionSession,
  mergeMissionSessions,
  type MissionSession,
} from '@/lib/mission-session-api';
import type { TripSchedule, TripScheduleMission } from '@/lib/trip-schedule-api';

type UseActiveMissionStateOptions = {
  currentUserId: string | null;
  ignoredSessionId?: string;
  requiredScheduleMemberCount: number;
  schedule: TripSchedule | null;
  scheduleId?: string;
};

// active 화면의 미션 세션 캐시·파생 목록·실시간 세션 병합을 담당합니다.
export function useActiveMissionState({ currentUserId, ignoredSessionId, requiredScheduleMemberCount, schedule, scheduleId }: UseActiveMissionStateOptions) {
  const [revealedSessions, setRevealedSessions] = useState<Record<string, MissionSession>>({});
  const [missionSessions, setMissionSessions] = useState<Record<string, MissionSession>>({});
  const missionSessionsRef = useRef<Record<string, MissionSession>>({});
  const revealedSessionsRef = useRef<Record<string, MissionSession>>({});
  const leaderStartingMissionRef = useRef(false);
  const openingParticipationSessionIdRef = useRef<string | null>(null);
  const suppressedLeaderSessionIdsRef = useRef(new Set<string>());
  const [todayDay, setTodayDay] = useState(() => getCalendarDayNumber(new Date()));
  const missions = useMemo(() => schedule?.missions ?? [], [schedule]);
  const visibleMissions = missions.filter((mission) => {
    const session = missionSessions[mission.scheduleMissionId] ?? revealedSessions[mission.scheduleMissionId];

    return !isCompletedScheduleMission(mission) && !isFinishedSession(session);
  });
  const activeMissions = visibleMissions.filter((mission) => {
    const plannedDay = parseDateValue(mission.plannedDate);

    return !plannedDay || getCalendarDayNumber(plannedDay) >= todayDay;
  });
  const scheduleDateOptions = useMemo(() => getScheduleDateOptions(schedule), [schedule]);
  const tripDayLabel = useMemo(() => getTripDayLabel(schedule), [schedule]);
  const missionDateGroups = useMemo(() => {
    const groups = scheduleDateOptions.map((date) => ({
      date,
      missions: visibleMissions.filter((mission) => mission.plannedDate === date),
    }));
    const unplannedMissions = visibleMissions.filter((mission) => !mission.plannedDate || !scheduleDateOptions.includes(mission.plannedDate));

    if (unplannedMissions.length > 0) {
      groups.push({ date: 'UNPLANNED', missions: unplannedMissions });
    }

    return groups;
  }, [scheduleDateOptions, visibleMissions]);
  const activeBlockingSession = Object.values(missionSessions).find((nextSession) => (
    !isFinishedSession(nextSession)
    && isParticipatingMissionMember(nextSession.members.find((member) => member.userId === currentUserId))
  )) ?? null;
  const hasStartedMissionSession = Object.values(missionSessions).some(isStartedMissionSession);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextTodayDay = getCalendarDayNumber(new Date());
      setTodayDay((currentTodayDay) => currentTodayDay === nextTodayDay ? currentTodayDay : nextTodayDay);
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  const rememberFeedSession = useCallback((nextSession: MissionSession, fallbackScheduleMissionId?: string) => {
    if (ignoredSessionId && nextSession.id === ignoredSessionId) {
      return;
    }

    const scheduleMissionId = nextSession.scheduleMissionId || fallbackScheduleMissionId;

    if (!scheduleMissionId) {
      return;
    }

    if (nextSession.status === 'CANCELLED') {
      if (!missionSessionsRef.current[scheduleMissionId] && !revealedSessionsRef.current[scheduleMissionId]) {
        return;
      }

      delete missionSessionsRef.current[scheduleMissionId];
      setMissionSessions((currentSessions) => {
        const nextSessions = { ...currentSessions };
        delete nextSessions[scheduleMissionId];
        return nextSessions;
      });
      delete revealedSessionsRef.current[scheduleMissionId];
      setRevealedSessions((currentSessions) => {
        const nextSessions = { ...currentSessions };
        delete nextSessions[scheduleMissionId];
        if (scheduleId) {
          saveCachedRevealedSessions(scheduleId, nextSessions);
        }
        return nextSessions;
      });
      return;
    }

    const normalizedIncomingSession = { ...nextSession, scheduleMissionId };
    const mergedMissionSession = mergeMissionSessions(missionSessionsRef.current[scheduleMissionId], normalizedIncomingSession);
    const hasMissionSessionChanged = !hasSameMissionSessionSnapshot(missionSessionsRef.current[scheduleMissionId], mergedMissionSession);

    if (hasMissionSessionChanged) {
      missionSessionsRef.current = { ...missionSessionsRef.current, [scheduleMissionId]: mergedMissionSession };
      setMissionSessions((currentSessions) => {
        const currentSession = currentSessions[scheduleMissionId];
        const nextSessions = mergeMissionSessions(currentSession, mergedMissionSession);

        if (hasSameMissionSessionSnapshot(currentSession, nextSessions)) {
          return currentSessions;
        }

        return { ...currentSessions, [scheduleMissionId]: nextSessions };
      });
    }

    const shouldShowInFeed = isFeedReadySession(mergedMissionSession, requiredScheduleMemberCount) && getFeedSubmissions(mergedMissionSession).length > 0;

    if (!shouldShowInFeed) {
      return;
    }

    const normalizedSession = mergeMissionSessions(revealedSessionsRef.current[scheduleMissionId], mergedMissionSession);
    if (hasSameMissionSessionSnapshot(revealedSessionsRef.current[scheduleMissionId], normalizedSession)) {
      return;
    }

    const nextRevealedSessions = { ...revealedSessionsRef.current, [scheduleMissionId]: normalizedSession };
    revealedSessionsRef.current = nextRevealedSessions;
    setRevealedSessions(() => {
      if (scheduleId) {
        saveCachedRevealedSessions(scheduleId, nextRevealedSessions);
      }

      return nextRevealedSessions;
    });
  }, [ignoredSessionId, requiredScheduleMemberCount, scheduleId]);

  const refreshSession = useCallback(async (sessionId: string) => {
    const nextSession = await getMissionSession(sessionId);
    rememberFeedSession(nextSession);
    return nextSession;
  }, [rememberFeedSession]);

  const handleScheduleMissing = useCallback(() => {
    setRevealedSessions({});
    setMissionSessions({});
    revealedSessionsRef.current = {};
    missionSessionsRef.current = {};
  }, []);

  const handleScheduleSessionCacheLoaded = useCallback((cachedSessions: Record<string, MissionSession>) => {
    revealedSessionsRef.current = cachedSessions;
    missionSessionsRef.current = cachedSessions;
    setRevealedSessions(cachedSessions);
    setMissionSessions(cachedSessions);
  }, []);

  const clearMissionState = useCallback((scheduleMissionId: string) => {
    const nextMissionSessions = { ...missionSessionsRef.current };
    delete nextMissionSessions[scheduleMissionId];
    missionSessionsRef.current = nextMissionSessions;
    setMissionSessions(nextMissionSessions);

    const nextRevealedSessions = { ...revealedSessionsRef.current };
    delete nextRevealedSessions[scheduleMissionId];
    revealedSessionsRef.current = nextRevealedSessions;
    setRevealedSessions(nextRevealedSessions);
    if (scheduleId) {
      saveCachedRevealedSessions(scheduleId, nextRevealedSessions);
    }
  }, [scheduleId]);

  const isMissionLockedForEdit = useCallback((mission: TripScheduleMission) => {
    return isCompletedScheduleMission(mission) || Boolean(missionSessions[mission.scheduleMissionId]) || isFinishedSession(revealedSessions[mission.scheduleMissionId]);
  }, [missionSessions, revealedSessions]);

  const isTemporaryMission = useCallback((mission: TripScheduleMission) => {
    const session = missionSessions[mission.scheduleMissionId];

    return Boolean(session && !isCompletedScheduleMission(mission) && !isFinishedSession(session));
  }, [missionSessions]);

  return {
    activeBlockingSession,
    activeMissions,
    clearMissionState,
    handleScheduleMissing,
    handleScheduleSessionCacheLoaded,
    hasStartedMissionSession,
    isMissionLockedForEdit,
    isTemporaryMission,
    leaderStartingMissionRef,
    missionDateGroups,
    missionSessions,
    missionSessionsRef,
    missions,
    openingParticipationSessionIdRef,
    refreshSession,
    rememberFeedSession,
    revealedSessions,
    revealedSessionsRef,
    scheduleDateOptions,
    suppressedLeaderSessionIdsRef,
    tripDayLabel,
    visibleMissions,
  };
}
