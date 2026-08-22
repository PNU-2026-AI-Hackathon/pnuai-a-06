import { router } from 'expo-router';
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { getAuthItem } from '@/lib/auth-storage';
import { connectMissionSessionSocket, getLatestMissionSession, getMissionSession, type MissionSession } from '@/lib/mission-session-api';
import { getTripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';
import { isRetryableJudgementStatus } from '../mission-capture-data';

type UseMissionCaptureSessionOptions = {
  capturedPhotoUri: string | null;
  hasNavigatedAwayRef: MutableRefObject<boolean>;
  isShootingExpired: boolean;
  isUploadExpired: boolean;
  scheduleId?: string;
  scheduleMissionId?: string;
  session: MissionSession | null;
  sessionId?: string;
  setMission: Dispatch<SetStateAction<TripScheduleMission | null>>;
  setMissionError: Dispatch<SetStateAction<string>>;
  setIsMissionLoading: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<MissionSession | null>>;
  timeoutRefreshKeyRef: MutableRefObject<string | null>;
};

// capture 화면의 세션·미션 초기 조회, 타임아웃 동기화와 실시간 세션 갱신을 담당합니다.
export function useMissionCaptureSession({
  capturedPhotoUri,
  hasNavigatedAwayRef,
  isShootingExpired,
  isUploadExpired,
  scheduleId,
  scheduleMissionId,
  session,
  sessionId,
  setMission,
  setMissionError,
  setIsMissionLoading,
  setSession,
  timeoutRefreshKeyRef,
}: UseMissionCaptureSessionOptions) {
  useEffect(() => {
    let isActive = true;

    async function loadSessionTimer() {
      try {
        if (sessionId) {
          const nextSession = await getMissionSession(sessionId);
          if (isActive) {
            setSession(nextSession);
          }
          return;
        }

        if (scheduleId && scheduleMissionId) {
          const latestSession = await getLatestMissionSession(scheduleId, scheduleMissionId);
          if (isActive) {
            setSession(latestSession);
          }
        }
      } catch {
        // Timer metadata is optional; upload flow still resolves the authoritative session.
      }
    }

    loadSessionTimer();

    return () => {
      isActive = false;
    };
  }, [scheduleId, scheduleMissionId, sessionId, setSession]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let isActive = true;

    const applyTimeoutSession = (nextSession: MissionSession) => {
      if (!isActive) {
        return;
      }

      setSession(nextSession);
      const myMember = nextSession.members.find((member) => member.userId === getAuthItem('user_id'));
      const hasTimedOut = myMember?.participationStatus === 'TIMED_OUT';
      const isCancelled = nextSession.status === 'CANCELLED';

      if (isCancelled) {
        if (hasNavigatedAwayRef.current) {
          return;
        }

        hasNavigatedAwayRef.current = true;
        router.replace({
          pathname: '/trip/active',
          ...(scheduleId ? { params: { scheduleId } } : {}),
        });
        return;
      }

      if (hasTimedOut && nextSession.members.length === 1) {
        if (hasNavigatedAwayRef.current) {
          return;
        }

        hasNavigatedAwayRef.current = true;
        router.replace({
          pathname: '/trip/active',
          ...(scheduleId ? { params: { scheduleId } } : {}),
        });
        return;
      }

      if (hasTimedOut && ['REVEALED', 'VOTING', 'COMPLETED'].includes(nextSession.status)) {
        if (hasNavigatedAwayRef.current) {
          return;
        }

        hasNavigatedAwayRef.current = true;
        router.replace({
          pathname: '/trip/review',
          params: {
            ...(scheduleId ? { scheduleId } : {}),
            sessionId: nextSession.id,
          },
        });
      }
    };

    const socket = connectMissionSessionSocket(sessionId, {
      onError: () => {
        void getMissionSession(sessionId).then(applyTimeoutSession).catch(() => undefined);
      },
      onMessage: ({ session: nextSession }) => {
        if (nextSession) {
          applyTimeoutSession(nextSession);
        }
      },
    });
    const timer = setInterval(() => {
      void getMissionSession(sessionId).then(applyTimeoutSession).catch(() => undefined);
    }, 1500);

    return () => {
      isActive = false;
      clearInterval(timer);
      socket.close();
    };
  }, [hasNavigatedAwayRef, scheduleId, sessionId, setSession]);

  useEffect(() => {
    if (!sessionId || !session) {
      return;
    }

    const isDeadlineExpired = capturedPhotoUri ? isUploadExpired : isShootingExpired;
    if (!isDeadlineExpired) {
      timeoutRefreshKeyRef.current = null;
      return;
    }

    const deadline = capturedPhotoUri
      ? session.photoUploadEndsAt ?? session.shootingEndsAt
      : session.shootingEndsAt ?? session.photoUploadEndsAt;
    const refreshKey = `${session.id}:${capturedPhotoUri ? 'upload' : 'shooting'}:${deadline ?? 'unknown'}`;
    if (timeoutRefreshKeyRef.current === refreshKey) {
      return;
    }

    timeoutRefreshKeyRef.current = refreshKey;
    void getMissionSession(sessionId).then((nextSession) => {
      setSession(nextSession);

      const currentUserId = getAuthItem('user_id');
      const hasActiveSubmission = nextSession.submissions.some((submission) => (
        submission.userId === currentUserId && !isRetryableJudgementStatus(submission.judgeStatus)
      ));

      if (nextSession.members.length === 1 && !hasActiveSubmission && !hasNavigatedAwayRef.current) {
        hasNavigatedAwayRef.current = true;
        router.replace({
          pathname: '/trip/active',
          ...(scheduleId ? { params: { scheduleId } } : {}),
        });
      }
    }).catch(() => undefined);
  }, [capturedPhotoUri, hasNavigatedAwayRef, isShootingExpired, isUploadExpired, scheduleId, session, sessionId, setSession, timeoutRefreshKeyRef]);

  useEffect(() => {
    if (!scheduleId || !scheduleMissionId) {
      setMission(null);
      setMissionError('미션 정보가 없습니다.');
      return;
    }

    let isActive = true;
    const currentScheduleId = scheduleId;
    const currentScheduleMissionId = scheduleMissionId;

    async function loadMission() {
      try {
        setIsMissionLoading(true);
        setMissionError('');
        const nextSchedule = await getTripSchedule(currentScheduleId);
        const nextMission = nextSchedule.missions.find((item) => item.scheduleMissionId === currentScheduleMissionId) ?? null;

        if (isActive) {
          setMission(nextMission);
          setMissionError(nextMission ? '' : '미션 정보를 찾지 못했어요.');
        }
      } catch (error) {
        if (isActive) {
          setMission(null);
          setMissionError(error instanceof Error ? error.message : '미션 정보를 불러오지 못했어요.');
        }
      } finally {
        if (isActive) {
          setIsMissionLoading(false);
        }
      }
    }

    loadMission();

    return () => {
      isActive = false;
    };
  }, [scheduleId, scheduleMissionId, setIsMissionLoading, setMission, setMissionError]);
}
