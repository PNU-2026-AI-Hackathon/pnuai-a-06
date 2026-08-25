import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getAuthItem, setAuthItem } from '@/lib/auth-storage';
import { getMissionSession, getPassedMissionSubmissions, likeMissionSessionSubmission, MissionSessionApiError, type MissionSession } from '@/lib/mission-session-api';

type UseMissionVoteOptions = {
  currentUserId: string | null;
  scheduleId?: string;
  sessionId?: string;
};

// 미션 투표 화면의 세션 조회, 투표 제출, 중복 투표 복원과 대기 화면 이동을 담당합니다.
export function useMissionVote({ currentUserId, scheduleId, sessionId }: UseMissionVoteOptions) {
  const voteStorageKey = sessionId ? `mission_session_vote:${sessionId}:${currentUserId ?? 'anonymous'}` : null;
  const [session, setSession] = useState<MissionSession | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [message, setMessage] = useState('');
  const hasNavigated = useRef(false);
  const submissions = useMemo(() => getPassedMissionSubmissions(session), [session]);

  useEffect(() => {
    if (!voteStorageKey) {
      return;
    }

    const savedSubmissionId = getAuthItem(voteStorageKey);

    if (savedSubmissionId) {
      setSelectedSubmissionId(savedSubmissionId);
      setHasVoted(true);
    }
  }, [voteStorageKey]);

  useEffect(() => {
    if (!sessionId) {
      setMessage('세션 정보가 없습니다.');
      setIsLoading(false);
      return;
    }

    getMissionSession(sessionId)
      .then((nextSession) => {
        setSession(nextSession);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '투표 사진을 불러오지 못했어요.'))
      .finally(() => setIsLoading(false));
  }, [scheduleId, sessionId]);

  const goWaiting = useCallback(() => {
    if (!sessionId || hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace({
      pathname: '/trip/vote-waiting',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId,
      },
    });
  }, [scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId || !hasVoted || isLoading) {
      return;
    }
    goWaiting();
  }, [goWaiting, hasVoted, isLoading, sessionId]);

  const handleVote = async () => {
    const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId);
    const isOwnSubmission = Boolean(currentUserId && selectedSubmission?.userId === currentUserId);

    if (!sessionId || !selectedSubmissionId || isSubmitting || isOwnSubmission) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      await likeMissionSessionSubmission(sessionId, selectedSubmissionId);
      if (voteStorageKey) {
        setAuthItem(voteStorageKey, selectedSubmissionId);
      }
      setHasVoted(true);
      goWaiting();
    } catch (error) {
      if (error instanceof MissionSessionApiError && error.status === 409) {
        if (voteStorageKey) {
          setAuthItem(voteStorageKey, selectedSubmissionId);
        }
        setHasVoted(true);
        goWaiting();
        return;
      }

      setMessage(error instanceof Error ? error.message : '투표하지 못했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleVote,
    hasVoted,
    isLoading,
    isSubmitting,
    message,
    selectedSubmissionId,
    setSelectedSubmissionId,
    submissions,
  };
}
