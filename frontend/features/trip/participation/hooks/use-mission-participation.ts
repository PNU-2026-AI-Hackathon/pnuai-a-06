import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { chooseMissionParticipation, cancelMissionSession, connectMissionSessionSocket, getMissionSession, isMissionSessionNotFoundError, startMissionSession, type MissionSession } from '@/lib/mission-session-api';
import { getCurrentParticipationLocation } from '@/lib/mission-location';
import { getParticipationErrorMessage, hasLeftParticipation, isParticipating } from '../mission-participation-data';

type UseMissionParticipationOptions = {
  currentUserId: string | null;
  isFocused: boolean;
  routeVerificationType?: string;
  scheduleId?: string;
  sessionId?: string;
};

// 미션 참여 화면의 세션 조회, 실시간 동기화, 참여·패스·시작 처리를 담당합니다.
export function useMissionParticipation({
  currentUserId,
  isFocused,
  routeVerificationType,
  scheduleId,
  sessionId,
}: UseMissionParticipationOptions) {
  const [session, setSession] = useState<MissionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const hasNavigated = useRef(false);
  const leaderParticipationRequested = useRef(false);
  const soloStartRequested = useRef(false);

  const myMember = useMemo(
    () => session?.members.find((member) => member.userId === currentUserId) ?? null,
    [currentUserId, session?.members],
  );
  const isMissionLeader = Boolean(session?.createdByUserId && currentUserId && session.createdByUserId === currentUserId);
  const missionLeader = session?.members.find((member) => member.userId === session.createdByUserId) ?? null;
  const participatingMembers = session?.members.filter((member) => isParticipating(member.participationStatus)) ?? [];
  const participantCount = session?.members.filter((member) => (
    member.userId !== session.createdByUserId && isParticipating(member.participationStatus)
  )).length ?? 0;
  const isMyParticipationActive = isParticipating(myMember?.participationStatus);
  const canChangeParticipation = Boolean(!isMissionLeader && session && ['WAITING', 'READY'].includes(session.status) && myMember && myMember.participationStatus !== 'LOCKED_OUT');
  const requiresGps = (session?.verificationType ?? routeVerificationType)?.toUpperCase() === 'GPS_PHOTO';

  const goBack = useCallback(() => {
    if (scheduleId) {
      router.replace({
        pathname: '/trip/active',
        params: {
          scheduleId,
          ...(sessionId ? { suppressedParticipationSessionId: sessionId } : {}),
        },
      });
    } else {
      router.back();
    }
  }, [scheduleId, sessionId]);

  const returnToActiveAfterMissingSession = useCallback(() => {
    if (!isFocused || hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    goBack();
  }, [goBack, isFocused]);

  const returnToActiveAfterCancellation = useCallback(() => {
    if (hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    goBack();
  }, [goBack]);

  const navigateToCapture = useCallback((nextSession: MissionSession) => {
    const nextMember = nextSession.members.find((member) => member.userId === currentUserId);
    if (!scheduleId || !nextSession.id || !nextMember || !isParticipating(nextMember.participationStatus) || hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace({
      pathname: '/trip/capture',
      params: {
        scheduleId,
        scheduleMissionId: nextSession.scheduleMissionId,
        sessionId: nextSession.id,
      },
    });
  }, [currentUserId, scheduleId]);

  const navigateToReview = useCallback((nextSession: MissionSession) => {
    if (!scheduleId || !nextSession.id || hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace({
      pathname: '/trip/review',
      params: {
        scheduleId,
        sessionId: nextSession.id,
        ...(nextSession.members.length === 1 ? { mode: 'mission-timeout' } : {}),
      },
    });
  }, [scheduleId]);

  const applySession = useCallback((nextSession: MissionSession) => {
    setSession(nextSession);
    if (nextSession.status === 'CANCELLED') {
      returnToActiveAfterCancellation();
      return;
    }
    const nextMember = nextSession.members.find((member) => member.userId === currentUserId);
    if (nextMember?.participationStatus === 'TIMED_OUT') {
      navigateToReview(nextSession);
      return;
    }
    if (nextSession.status === 'COMPLETED') {
      returnToActiveAfterMissingSession();
      return;
    }
    if (hasLeftParticipation(nextMember?.participationStatus)) {
      returnToActiveAfterMissingSession();
      return;
    }
    if (['SHOOTING', 'UPLOADING'].includes(nextSession.status) && !isParticipating(nextMember?.participationStatus)) {
      returnToActiveAfterMissingSession();
      return;
    }
    if (nextSession.status === 'SHOOTING' || nextSession.status === 'UPLOADING') {
      navigateToCapture(nextSession);
    }
  }, [currentUserId, navigateToCapture, navigateToReview, returnToActiveAfterCancellation, returnToActiveAfterMissingSession]);

  useEffect(() => {
    if (
      !sessionId
      || !isMissionLeader
      || !myMember
      || !session
      || !['WAITING', 'READY'].includes(session.status)
    ) {
      return;
    }

    const isSoloMission = session.members.length === 1;

    if (isSoloMission) {
      if (soloStartRequested.current) {
        return;
      }

      soloStartRequested.current = true;
      setIsSubmitting(true);
      setMessage('');

      void (async () => {
        try {
          let nextSession = session;

          if (!isParticipating(myMember.participationStatus)) {
            const location = requiresGps ? await getCurrentParticipationLocation() : undefined;
            nextSession = await chooseMissionParticipation(sessionId, 'PARTICIPATE', location);
            applySession(nextSession);
          }

          if (['WAITING', 'READY'].includes(nextSession.status)) {
            nextSession = await startMissionSession(sessionId);
            applySession(nextSession);
          }

          navigateToCapture(nextSession);
        } catch (error) {
          soloStartRequested.current = false;
          if (isMissionSessionNotFoundError(error)) {
            returnToActiveAfterMissingSession();
            return;
          }
          setMessage(getParticipationErrorMessage(error));
        } finally {
          setIsSubmitting(false);
        }
      })();

      return;
    }

    if (isParticipating(myMember.participationStatus) || leaderParticipationRequested.current) {
      return;
    }

    leaderParticipationRequested.current = true;
    setIsSubmitting(true);
    setMessage('');

    void (async () => {
      const location = requiresGps ? await getCurrentParticipationLocation() : undefined;
      return chooseMissionParticipation(sessionId, 'PARTICIPATE', location);
    })()
      .then((nextSession) => {
        applySession(nextSession);
      })
      .catch((error) => {
        leaderParticipationRequested.current = false;
        if (isMissionSessionNotFoundError(error)) {
          returnToActiveAfterMissingSession();
          return;
        }
        setMessage(getParticipationErrorMessage(error));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [applySession, isMissionLeader, myMember, navigateToCapture, requiresGps, returnToActiveAfterMissingSession, session, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setMessage('미션 세션 정보가 없습니다.');
      setIsLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const nextSession = await getMissionSession(sessionId);
        if (active) {
          applySession(nextSession);
        }
      } catch (error) {
        if (active) {
          if (isMissionSessionNotFoundError(error)) {
            returnToActiveAfterMissingSession();
            return;
          }
          setMessage(error instanceof Error ? error.message : '미션 정보를 불러오지 못했어요.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [applySession, returnToActiveAfterMissingSession, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const socket = connectMissionSessionSocket(sessionId, {
      onError: () => {
        void getMissionSession(sessionId).then(applySession).catch((error) => {
          if (isMissionSessionNotFoundError(error)) {
            returnToActiveAfterMissingSession();
          }
        });
      },
      onMessage: ({ session: nextSession }) => {
        if (nextSession) {
          applySession(nextSession);
        }
      },
    });
    const timer = setInterval(() => {
      void getMissionSession(sessionId).then(applySession).catch((error) => {
        if (isMissionSessionNotFoundError(error)) {
          returnToActiveAfterMissingSession();
        }
      });
    }, 1500);

    return () => {
      clearInterval(timer);
      socket.close();
    };
  }, [applySession, returnToActiveAfterMissingSession, sessionId]);

  const handleParticipation = async (decision: 'PARTICIPATE' | 'PASS') => {
    if (!sessionId || !canChangeParticipation || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const location = decision === 'PARTICIPATE' && requiresGps
        ? await getCurrentParticipationLocation()
        : undefined;
      const nextSession = await chooseMissionParticipation(sessionId, decision, location);
      applySession(nextSession);
    } catch (error) {
      if (isMissionSessionNotFoundError(error)) {
        returnToActiveAfterMissingSession();
        return;
      }
      setMessage(getParticipationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!sessionId || isSubmitting) {
      return;
    }

    if (!isMissionLeader || !['WAITING', 'READY'].includes(session?.status ?? '')) {
      goBack();
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const nextSession = await cancelMissionSession(sessionId);
      applySession(nextSession);
    } catch (error) {
      if (isMissionSessionNotFoundError(error)) {
        returnToActiveAfterMissingSession();
        return;
      }
      setMessage(error instanceof Error ? error.message : '미션을 취소하지 못했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!sessionId || !isMissionLeader || participantCount === 0 || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const nextSession = await startMissionSession(sessionId);
      applySession(nextSession);
      navigateToCapture(nextSession);
    } catch (error) {
      if (isMissionSessionNotFoundError(error)) {
        returnToActiveAfterMissingSession();
        return;
      }
      setMessage(error instanceof Error ? error.message : '미션을 시작하지 못했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    canChangeParticipation,
    handleClose,
    handleParticipation,
    handleStart,
    isMissionLeader,
    isMyParticipationActive,
    isLoading,
    isSubmitting,
    message,
    missionLeader,
    participantCount,
    participatingMembers,
    session,
  };
}
