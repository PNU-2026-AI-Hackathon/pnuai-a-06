// active 화면의 일정 조회, 세션 보충 조회, 포커스 기반 일정 동기화를 관리합니다.

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  getActiveMissionSession,
  getLatestMissionSession,
  getMissionSession,
  isMissionSessionNotFoundError,
  type MissionSession,
} from '@/lib/mission-session-api';
import { getTripSchedule, type TripSchedule } from '@/lib/trip-schedule-api';

import {
  getScheduleSyncSignature,
  prefetchMissionIcons,
  readCachedRevealedSessions,
} from '../active-data';

type UseActiveScheduleOptions = {
  scheduleId?: string;
  initialSessionId?: string;
  rememberFeedSession: (session: MissionSession, fallbackScheduleMissionId?: string) => void;
  refreshSession: (sessionId: string) => Promise<MissionSession>;
  onScheduleMissing: () => void;
  onScheduleSessionCacheLoaded: (sessions: Record<string, MissionSession>) => void;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setMessage: (message: string) => void;
  setSchedule: Dispatch<SetStateAction<TripSchedule | null>>;
};

export function useActiveSchedule({
  initialSessionId,
  rememberFeedSession,
  onScheduleMissing,
  onScheduleSessionCacheLoaded,
  refreshSession,
  scheduleId,
  setIsLoading,
  setMessage,
  setSchedule,
}: UseActiveScheduleOptions) {
  const refreshSchedule = useCallback(() => {
    if (!scheduleId) {
      setSchedule(null);
      onScheduleMissing();
      setMessage('일정 정보가 없습니다.');
      return;
    }

    const cachedRevealedSessions = readCachedRevealedSessions(scheduleId);
    onScheduleSessionCacheLoaded(cachedRevealedSessions);
    let isActive = true;

    setIsLoading(true);
    setMessage('');

    getTripSchedule(scheduleId)
      .then(async (nextSchedule) => {
        if (!isActive) {
          return;
        }

        prefetchMissionIcons(nextSchedule.missions);
        setSchedule(nextSchedule);

        void Promise.all(Object.values(cachedRevealedSessions).map(async (cachedSession) => {
          try {
            const latestSession = await getMissionSession(cachedSession.id);
            if (isActive) {
              rememberFeedSession(latestSession, cachedSession.scheduleMissionId);
            }
          } catch {
            // Cached feed sessions are best-effort and can disappear server-side.
          }
        }));

        void Promise.all(nextSchedule.missions.map(async (mission) => {
          try {
            const latestSession = await getLatestMissionSession(nextSchedule.scheduleId, mission.scheduleMissionId);
            if (isActive) {
              rememberFeedSession(latestSession, mission.scheduleMissionId);
            }
          } catch (error) {
            if (!isMissionSessionNotFoundError(error)) {
              throw error;
            }
          }
        })).catch(() => {
          // Schedule rendering should not fail just because one session refresh failed.
        });

        void getActiveMissionSession(nextSchedule.scheduleId)
          .then((activeSession) => {
            if (isActive) {
              rememberFeedSession(activeSession);
            }
          })
          .catch(() => {
            // A schedule can legitimately have no active mission session yet.
          });

        if (initialSessionId) {
          try {
            await refreshSession(initialSessionId);
          } catch (error) {
            if (isActive) {
              setMessage(error instanceof Error ? error.message : '세션을 불러오지 못했어요.');
            }
          }
        }
      })
      .catch((error) => {
        if (isActive) {
          setSchedule(null);
          setMessage(error instanceof Error ? error.message : '일정을 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [initialSessionId, onScheduleMissing, onScheduleSessionCacheLoaded, rememberFeedSession, refreshSession, scheduleId, setMessage]);

  useFocusEffect(refreshSchedule);

  useFocusEffect(
    useCallback(() => {
      if (!scheduleId) {
        return undefined;
      }

      let isActive = true;
      let isScheduleRequestInFlight = false;
      let isActiveSessionRequestInFlight = false;

      const syncSchedule = async () => {
        if (isScheduleRequestInFlight) {
          return;
        }

        isScheduleRequestInFlight = true;

        try {
          const nextSchedule = await getTripSchedule(scheduleId);

          if (!isActive) {
            return;
          }

          setSchedule((currentSchedule) => {
            if (currentSchedule && getScheduleSyncSignature(currentSchedule) === getScheduleSyncSignature(nextSchedule)) {
              return currentSchedule;
            }

            return nextSchedule;
          });
        } catch {
          // Keep the last rendered schedule when a background sync temporarily fails.
        } finally {
          isScheduleRequestInFlight = false;
        }
      };

      const syncActiveMissionSession = async () => {
        if (isActiveSessionRequestInFlight) {
          return;
        }

        isActiveSessionRequestInFlight = true;

        try {
          const activeSession = await getActiveMissionSession(scheduleId);

          if (isActive) {
            rememberFeedSession(activeSession);
          }
        } catch {
          // No active mission session is a valid state while the trip is idle.
        } finally {
          isActiveSessionRequestInFlight = false;
        }
      };

      void syncSchedule();
      void syncActiveMissionSession();

      return () => {
        isActive = false;
      };
    }, [rememberFeedSession, scheduleId])
  );

  const reloadCurrentSchedule = useCallback(async () => {
    if (!scheduleId) {
      return null;
    }

    const nextSchedule = await getTripSchedule(scheduleId);
    setSchedule(nextSchedule);

    return nextSchedule;
  }, [scheduleId]);

  return {
    reloadCurrentSchedule,
  };
}
