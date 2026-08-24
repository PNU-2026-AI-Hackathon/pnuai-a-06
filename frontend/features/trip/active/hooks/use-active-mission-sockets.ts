import { router } from 'expo-router';
import { useEffect, type MutableRefObject } from 'react';

import {
  connectMissionSessionSocket,
  connectScheduleMissionSessionSocket,
  getActiveMissionSession,
  getMissionSession,
  type MissionSession,
} from '@/lib/mission-session-api';
import type { TripSchedule } from '@/lib/trip-schedule-api';
import { hasLeftMissionParticipation } from '../active-data';

type RememberFeedSession = (session: MissionSession, fallbackScheduleMissionId?: string) => void;

type UseActiveMissionSocketsOptions = {
  activeBlockingSession: MissionSession | null;
  currentUserId: string | null;
  isFocused: boolean;
  leaderStartingMissionRef: MutableRefObject<boolean>;
  openingParticipationSessionIdRef: MutableRefObject<string | null>;
  rememberFeedSession: RememberFeedSession;
  schedule: TripSchedule | null;
  scheduleId?: string;
  suppressedLeaderSessionIdsRef: MutableRefObject<Set<string>>;
  suppressedParticipationSessionId?: string;
};

// active 여행 화면의 미션 세션 실시간 동기화와 참여 화면 자동 진입을 담당합니다.
export function useActiveMissionSockets({
  activeBlockingSession,
  currentUserId,
  isFocused,
  leaderStartingMissionRef,
  openingParticipationSessionIdRef,
  rememberFeedSession,
  schedule,
  scheduleId,
  suppressedLeaderSessionIdsRef,
  suppressedParticipationSessionId,
}: UseActiveMissionSocketsOptions) {
  useEffect(() => {
    if (!activeBlockingSession?.id || !isFocused) {
      return;
    }

    const activeSessionId = activeBlockingSession.id;
    const socket = connectMissionSessionSocket(activeSessionId, {
      onError: () => {
        void getMissionSession(activeSessionId).then((nextSession) => rememberFeedSession(nextSession)).catch(() => undefined);
      },
      onMessage: ({ session: nextSession }) => {
        if (nextSession) {
          rememberFeedSession(nextSession);
        }
      },
    });

    return () => {
      socket.close();
    };
  }, [activeBlockingSession?.id, isFocused, rememberFeedSession]);

  useEffect(() => {
    if (!scheduleId || !isFocused) {
      return;
    }

    const openParticipation = (nextSession: MissionSession) => {
      const myMember = nextSession.members.find((member) => member.userId === currentUserId);

      if (
        !nextSession.id
        || leaderStartingMissionRef.current
        || suppressedLeaderSessionIdsRef.current.has(nextSession.id)
        || nextSession.id === suppressedParticipationSessionId
        || !['WAITING', 'READY'].includes(nextSession.status)
        || hasLeftMissionParticipation(myMember)
        || openingParticipationSessionIdRef.current === nextSession.id
      ) {
        return;
      }

      openingParticipationSessionIdRef.current = nextSession.id;
      rememberFeedSession(nextSession);
      const scheduleMission = schedule?.missions.find((mission) => mission.scheduleMissionId === nextSession.scheduleMissionId);
      router.replace({
        pathname: '/trip/participation',
        params: {
          scheduleId,
          scheduleMissionId: nextSession.scheduleMissionId,
          sessionId: nextSession.id,
          ...(nextSession.verificationType || scheduleMission?.verificationType
            ? { verificationType: nextSession.verificationType ?? scheduleMission?.verificationType ?? '' }
            : {}),
        },
      });
    };

    const socket = connectScheduleMissionSessionSocket(scheduleId, {
      onError: () => {
        void getActiveMissionSession(scheduleId).then((nextSession) => {
          rememberFeedSession(nextSession);
          if (nextSession.status === 'WAITING' || nextSession.status === 'READY') {
            openParticipation(nextSession);
          }
        }).catch(() => undefined);
      },
      onMessage: ({ session: nextSession, type }) => {
        if (nextSession) {
          rememberFeedSession(nextSession);
        }

        if (nextSession && (type === 'mission_session_created' || type === 'schedule_mission_snapshot')) {
          openParticipation(nextSession);
        }
      },
    });
    const syncActiveMissionSession = () => {
      void getActiveMissionSession(scheduleId)
        .then((nextSession) => {
          rememberFeedSession(nextSession);
          openParticipation(nextSession);
        })
        .catch(() => {
          // There may be no active mission session while the schedule is idle.
        });
    };
    syncActiveMissionSession();
    const timer = setInterval(syncActiveMissionSession, 1500);

    return () => {
      clearInterval(timer);
      socket.close();
    };
  }, [currentUserId, isFocused, leaderStartingMissionRef, openingParticipationSessionIdRef, rememberFeedSession, schedule, scheduleId, suppressedLeaderSessionIdsRef, suppressedParticipationSessionId]);
}
