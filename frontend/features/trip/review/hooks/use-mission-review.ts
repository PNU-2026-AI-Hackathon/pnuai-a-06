import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import { connectMissionSessionSocket, completeMissionSession, getMissionSession, getPassedMissionSubmissions, mergeMissionSessions, MissionSessionApiError, postMissionSessionComment, type MissionSession } from '@/lib/mission-session-api';
import { getCommentParticipantIds, shouldSkipMissionVote } from '../mission-review-data';
import { getRemainingMs } from '../../trip-data';

type UseMissionReviewOptions = {
  currentUserId: string | null;
  isMissionTimeout?: boolean;
  scheduleId?: string;
  sessionId?: string;
};

// review 화면의 세션 동기화, 댓글 제출, 진행 상태와 다음 화면 이동을 담당합니다.
export function useMissionReview({ currentUserId, isMissionTimeout = false, scheduleId, sessionId }: UseMissionReviewOptions) {
  const [session, setSession] = useState<MissionSession | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [transitionSubmissionId, setTransitionSubmissionId] = useState<string | null>(null);
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);
  const sessionRef = useRef<MissionSession | null>(null);
  const transitionSubmissionIdRef = useRef<string | null>(null);
  const hasNavigatedForward = useRef(false);
  const isCompletingSingle = useRef(false);

  const applySession = useCallback((nextSession: MissionSession) => {
    const previousSession = sessionRef.current;
    const mergedSession = mergeMissionSessions(previousSession, nextSession);

    if (previousSession?.id === mergedSession.id && transitionSubmissionIdRef.current === null) {
      const commentParticipantCount = getCommentParticipantIds(mergedSession).size;
      const requiredComments = Math.max(1, commentParticipantCount || mergedSession.members.length);
      const newlyCompletedSubmission = mergedSession.submissions.find((submission) => {
        if (submission.comments.length < requiredComments) {
          return false;
        }

        const previousSubmission = previousSession.submissions.find((item) => item.id === submission.id);
        return !previousSubmission || previousSubmission.comments.length < requiredComments;
      });

      if (newlyCompletedSubmission) {
        transitionSubmissionIdRef.current = newlyCompletedSubmission.id;
        setTransitionSubmissionId(newlyCompletedSubmission.id);
        setTransitionCountdown(3);
      }
    }

    sessionRef.current = mergedSession;
    setSession(mergedSession);
    return mergedSession;
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      setMessage('세션 정보가 없습니다.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const nextSession = await getMissionSession(sessionId);
      return applySession(nextSession);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '세션을 불러오지 못했어요.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applySession, sessionId]);

  useFocusEffect(
    useCallback(() => {
      if (isMissionTimeout) {
        return;
      }

      refreshSession();
    }, [isMissionTimeout, refreshSession])
  );

  const navigateToResult = useCallback(() => {
    if (!sessionId || hasNavigatedForward.current) {
      return;
    }

    hasNavigatedForward.current = true;
    router.replace({
      pathname: '/trip/result',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId,
      },
    });
  }, [scheduleId, sessionId]);

  const completeSingleSubmission = useCallback(async () => {
    if (!sessionId || isCompletingSingle.current || hasNavigatedForward.current) {
      return;
    }

    isCompletingSingle.current = true;

    try {
      const nextSession = await completeMissionSession(sessionId);
      applySession(nextSession);
    } catch {
      // The result screen can still render the single passed photo if the session was completed by the server.
    } finally {
      isCompletingSingle.current = false;
    }

    navigateToResult();
  }, [applySession, navigateToResult, sessionId]);

  const navigateToVote = useCallback(() => {
    if (!sessionId || hasNavigatedForward.current) {
      return;
    }

    hasNavigatedForward.current = true;
    router.replace({
      pathname: '/trip/vote',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId,
      },
    });
  }, [scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId || isMissionTimeout) {
      return;
    }

    const socket = connectMissionSessionSocket(sessionId, {
      onMessage: ({ session: nextSession, type }) => {
        if (nextSession) {
          applySession(nextSession);
        }

        if (nextSession?.status === 'COMPLETED') {
          setTimeout(() => {
            navigateToResult();
          }, 700);
        } else if (type === 'voting_started' || nextSession?.status === 'VOTING') {
          setTimeout(() => {
            if (nextSession && shouldSkipMissionVote(nextSession, getPassedMissionSubmissions(nextSession))) {
              void completeSingleSubmission();
            } else {
              navigateToVote();
            }
          }, 3000);
        }
      },
    });

    return () => {
      socket.close();
    };
  }, [applySession, completeSingleSubmission, isMissionTimeout, navigateToResult, navigateToVote, sessionId]);

  const commentParticipantIds = useMemo(() => getCommentParticipantIds(session), [session]);
  const passedSubmissions = useMemo(() => {
    const submissions = getPassedMissionSubmissions(session);
    return commentParticipantIds.size === 0
      ? submissions
      : submissions.filter((submission) => commentParticipantIds.has(submission.userId));
  }, [commentParticipantIds, session]);
  const requiredCommentsPerPhoto = Math.max(1, commentParticipantIds.size || session?.members.length || 0);
  const currentSubmissionIndex = useMemo(() => {
    if (transitionSubmissionId) {
      const transitionIndex = passedSubmissions.findIndex((submission) => submission.id === transitionSubmissionId);
      if (transitionIndex >= 0) {
        return transitionIndex;
      }
    }

    const nextIndex = passedSubmissions.findIndex((submission) => submission.comments.length < requiredCommentsPerPhoto);

    return nextIndex >= 0 ? nextIndex : Math.max(0, passedSubmissions.length - 1);
  }, [passedSubmissions, requiredCommentsPerPhoto, transitionSubmissionId]);
  const currentSubmission = passedSubmissions[currentSubmissionIndex] ?? null;
  const shouldSkipVoting = useMemo(() => shouldSkipMissionVote(session, passedSubmissions), [passedSubmissions, session]);
  const commentRemainingMs = getRemainingMs(session?.commentEndsAt, now);
  const isCommentExpired = commentRemainingMs !== null && commentRemainingMs <= 0;
  const hasCommentedCurrentPhoto = Boolean(currentUserId && currentSubmission?.comments.some((comment) => comment.userId === currentUserId));
  const commentProgress = passedSubmissions.reduce((count, submission) => count + submission.comments.length, 0);
  const requiredCommentCount = passedSubmissions.length * requiredCommentsPerPhoto;
  const isAllCommentsComplete = Boolean(session && passedSubmissions.length > 0 && session.members.length > 0 && requiredCommentCount > 0 && commentProgress >= requiredCommentCount);

  useEffect(() => {
    if (isMissionTimeout || !transitionSubmissionId || transitionCountdown === null) {
      return;
    }

    if (transitionCountdown <= 0) {
      transitionSubmissionIdRef.current = null;
      setTransitionSubmissionId(null);
      setTransitionCountdown(null);
      setCommentText('');

      if (isAllCommentsComplete) {
        if (shouldSkipVoting) {
          void completeSingleSubmission();
        } else {
          navigateToVote();
        }
      }

      return;
    }

    const timer = setTimeout(() => setTransitionCountdown((countdown) => countdown === null ? null : countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [completeSingleSubmission, isAllCommentsComplete, isMissionTimeout, navigateToVote, shouldSkipVoting, transitionCountdown, transitionSubmissionId]);

  useEffect(() => {
    if (isMissionTimeout || !isAllCommentsComplete || transitionSubmissionId) {
      return;
    }

    const timer = setTimeout(() => {
      if (shouldSkipVoting) {
        void completeSingleSubmission();
      } else {
        navigateToVote();
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [completeSingleSubmission, isAllCommentsComplete, isMissionTimeout, navigateToVote, shouldSkipVoting, transitionSubmissionId]);

  const handleSubmitComment = async () => {
    const content = commentText.trim();

    if (!sessionId || !currentSubmission || !content || isSubmitting || hasCommentedCurrentPhoto || isCommentExpired) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      await postMissionSessionComment(sessionId, currentSubmission.id, content);
      setCommentText('');
      await refreshSession();
    } catch (error) {
      if (error instanceof MissionSessionApiError && error.status === 409) {
        await refreshSession();
        return;
      }

      setMessage(error instanceof Error ? error.message : '댓글 등록에 실패했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    if (shouldSkipVoting) {
      void completeSingleSubmission();
      return;
    }

    navigateToVote();
  };

  const goBackToTrip = () => {
    if (scheduleId) {
      router.replace({ pathname: '/trip/active', params: { scheduleId } });
      return;
    }

    router.back();
  };

  const isWaitingForReveal = Boolean(session && !['REVEALED', 'VOTING', 'COMPLETED'].includes(session.status));

  return {
    commentRemainingMs,
    commentText,
    currentSubmission,
    currentSubmissionIndex,
    goBackToTrip,
    goNext,
    handleSubmitComment,
    hasCommentedCurrentPhoto,
    isAllCommentsComplete,
    isCommentExpired,
    isLoading,
    isSubmitting,
    isWaitingForReveal,
    keyboardHeight,
    message,
    passedSubmissions,
    requiredCommentsPerPhoto,
    session,
    setCommentText,
    transitionCountdown,
    transitionSubmissionId,
  };
}
