import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { getEligibleVoterCount } from '@/features/trip/vote-waiting/mission-vote-waiting-data';
import { completeMissionSession, getMissionSession, getPassedMissionSubmissions } from '@/lib/mission-session-api';

type UseMissionVoteWaitingOptions = {
  scheduleId?: string;
  sessionId?: string;
};

// 투표 대기 화면의 투표 완료 감시, 세션 완료 처리와 결과 이동을 담당합니다.
export function useMissionVoteWaiting({ scheduleId, sessionId }: UseMissionVoteWaitingOptions) {
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);
  const hasNavigated = useRef(false);
  const isCompleting = useRef(false);
  const hasStartedResultCountdown = useRef(false);

  const startResultCountdown = () => {
    if (hasNavigated.current || hasStartedResultCountdown.current) {
      return;
    }

    hasStartedResultCountdown.current = true;
    setResultCountdown(3);
  };

  useEffect(() => {
    if (resultCountdown === null) {
      return;
    }

    if (resultCountdown <= 0) {
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace({ pathname: '/trip/result', params: { ...(scheduleId ? { scheduleId } : {}), sessionId: sessionId ?? '' } });
      }
      return;
    }

    const timer = setTimeout(() => {
      setResultCountdown((currentCountdown) => currentCountdown === null ? null : currentCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resultCountdown, scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const refresh = async () => {
      try {
        const session = await getMissionSession(sessionId);
        const submissions = getPassedMissionSubmissions(session);
        const voterCount = getEligibleVoterCount(session, submissions);
        const votes = submissions.reduce((sum, submission) => sum + submission.likeCount, 0);

        if (session.status === 'COMPLETED') {
          startResultCountdown();
          return;
        }

        if (voterCount <= 0 || votes < voterCount || isCompleting.current) {
          return;
        }

        isCompleting.current = true;
        startResultCountdown();
        void completeMissionSession(sessionId).catch(() => undefined).finally(() => {
          isCompleting.current = false;
        });
      } catch {
        // 다음 주기에 다시 확인한다.
      }
    };

    void refresh();
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [scheduleId, sessionId]);

  return { resultCountdown };
}
