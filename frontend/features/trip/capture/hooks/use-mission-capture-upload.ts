import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { getAuthItem } from '@/lib/auth-storage';
import { completeMissionSession, connectMissionSessionSocket, getMissionSession, hasAllPassedMissionParticipants, revealMissionSession, uploadMissionSessionPhoto, type MissionJudgementStatus, type MissionSession, type MissionSubmission } from '@/lib/mission-session-api';
import { getRemainingMs } from '@/features/trip/trip-data';
import {
  getJudgementFailureMessage,
  getJudgementWaitingMessage,
  getMyLatestSubmission,
  isDuplicateSubmissionError,
  isRetryableJudgementStatus,
  isWaitingJudgementStatus,
  runWithNetworkRetry,
} from '../mission-capture-data';
import { ensureCurrentUserCanSubmit, resolveMissionUploadSessionId } from '../mission-capture-upload-data';

type UseMissionCaptureUploadOptions = {
  capturedPhotoUri: string | null;
  hasNavigatedAwayRef: MutableRefObject<boolean>;
  isUploadExpired: boolean;
  scheduleId?: string;
  scheduleMissionId?: string;
  sessionId?: string;
  setCapturedPhotoUri: Dispatch<SetStateAction<string | null>>;
  setSession: Dispatch<SetStateAction<MissionSession | null>>;
};

// capture 화면의 사진 업로드, AI 판정 동기화와 결과 화면 이동을 담당합니다.
export function useMissionCaptureUpload({
  capturedPhotoUri,
  hasNavigatedAwayRef,
  isUploadExpired,
  scheduleId,
  scheduleMissionId,
  sessionId,
  setCapturedPhotoUri,
  setSession,
}: UseMissionCaptureUploadOptions) {
  const [isMissionComplete, setIsMissionComplete] = useState(false);
  const [isTransitioningToResult, setIsTransitioningToResult] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [returnCountdown, setReturnCountdown] = useState<number | null>(null);
  const [completionSessionId, setCompletionSessionId] = useState<string | null>(null);
  const [judgementSessionId, setJudgementSessionId] = useState<string | null>(null);
  const [submittedSubmissionId, setSubmittedSubmissionId] = useState<string | null>(null);
  const [judgeReason, setJudgeReason] = useState<string | null>(null);
  const [judgeStatus, setJudgeStatus] = useState<MissionJudgementStatus | null>(null);
  const [judgementDotCount, setJudgementDotCount] = useState(1);
  const revealRequestedRef = useRef(false);
  const revealRequestInFlightRef = useRef(false);
  const isWaitingForJudgement = isWaitingJudgementStatus(judgeStatus);
  const needsRetakeAfterJudgement = isRetryableJudgementStatus(judgeStatus);

  useEffect(() => {
    if (!isWaitingForJudgement) {
      setJudgementDotCount(1);
      return;
    }

    const timer = setInterval(() => {
      setJudgementDotCount((currentCount) => currentCount >= 3 ? 1 : currentCount + 1);
    }, 450);

    return () => clearInterval(timer);
  }, [isWaitingForJudgement]);

  const finishPassedJudgement = useCallback(async (passedSessionId: string, passedSession?: MissionSession | null) => {
    if (hasNavigatedAwayRef.current) {
      return;
    }

    const isSoloMission = passedSession?.members.length === 1;

    if (isSoloMission) {
      hasNavigatedAwayRef.current = true;
      setIsTransitioningToResult(true);
      setJudgementSessionId(null);
      setIsMissionComplete(true);
      setUploadMessage('AI 판독이 완료됐어요. 결과를 준비하고 있어요.');

      try {
        const completedSession = await completeMissionSession(passedSessionId);
        setSession(completedSession);
      } catch {
        // The server may have completed the session automatically; result can still load the authoritative session.
      }

      router.replace({
        pathname: '/trip/result',
        params: {
          ...(scheduleId ? { scheduleId } : {}),
          sessionId: passedSessionId,
        },
      });
      return;
    }

    setJudgementSessionId(null);
    setIsMissionComplete(true);
    setCompletionSessionId(passedSessionId);
    setUploadMessage('AI 판독이 완료됐어요. 다른 참여자의 결과를 기다리고 있어요.');
  }, [hasNavigatedAwayRef, scheduleId, setSession]);

  useEffect(() => {
    if (!completionSessionId || !isMissionComplete || hasNavigatedAwayRef.current) {
      return;
    }

    let isActive = true;

    const navigateToReview = () => {
      if (!isActive || hasNavigatedAwayRef.current) {
        return;
      }

      hasNavigatedAwayRef.current = true;
      router.replace({
        pathname: '/trip/review',
        params: {
          ...(scheduleId ? { scheduleId } : {}),
          sessionId: completionSessionId,
        },
      });
    };

    const syncCompletionSession = async (nextSession?: MissionSession) => {
      const currentSession = nextSession ?? await getMissionSession(completionSessionId);

      if (!isActive) {
        return;
      }

      setSession(currentSession);

      if (currentSession.status === 'REVEALED') {
        navigateToReview();
        return;
      }

      if (!hasAllPassedMissionParticipants(currentSession) || revealRequestedRef.current || revealRequestInFlightRef.current) {
        return;
      }

      revealRequestInFlightRef.current = true;
      try {
        const revealedSession = await revealMissionSession(completionSessionId);
        if (!isActive) {
          return;
        }

        setSession(revealedSession);
        if (revealedSession.status === 'REVEALED') {
          revealRequestedRef.current = true;
          navigateToReview();
        }
      } catch {
        // Keep polling; the server remains the source of truth for the reveal transition.
      } finally {
        revealRequestInFlightRef.current = false;
      }
    };

    const socket = connectMissionSessionSocket(completionSessionId, {
      onError: () => {
        void syncCompletionSession().catch(() => undefined);
      },
      onMessage: ({ session: nextSession }) => {
        if (nextSession) {
          void syncCompletionSession(nextSession).catch(() => undefined);
        }
      },
    });
    const timer = setInterval(() => {
      void syncCompletionSession().catch(() => undefined);
    }, 1500);

    void syncCompletionSession().catch(() => undefined);

    return () => {
      isActive = false;
      clearInterval(timer);
      socket.close();
    };
  }, [completionSessionId, hasNavigatedAwayRef, isMissionComplete, scheduleId, setSession]);

  useEffect(() => {
    if (!judgementSessionId) {
      return;
    }

    let isActive = true;
    const currentUserId = getAuthItem('user_id');

    const applyJudgementSession = (nextSession: MissionSession) => {
      if (!isActive) {
        return;
      }

      setSession(nextSession);
      const mySubmission = getMyLatestSubmission(nextSession, currentUserId, submittedSubmissionId);

      if (!mySubmission) {
        return;
      }

      const nextJudgeStatus = mySubmission.judgeStatus ?? null;
      setJudgeStatus(nextJudgeStatus);
      setJudgeReason(mySubmission.judgeReason ?? null);

      if (isWaitingJudgementStatus(nextJudgeStatus)) {
        setUploadMessage(getJudgementWaitingMessage(nextJudgeStatus));
        return;
      }

      setJudgementSessionId(null);

      if (nextJudgeStatus === 'PASSED') {
        void finishPassedJudgement(nextSession.id, nextSession);
        return;
      }

      if (nextJudgeStatus === 'REJECTED' || nextJudgeStatus === 'ERROR') {
        setIsMissionComplete(false);
        setUploadMessage(getJudgementFailureMessage(nextJudgeStatus));
        setReturnCountdown(null);
        return;
      }

      setJudgeStatus('PENDING');
      setUploadMessage(getJudgementWaitingMessage('PENDING'));
      setJudgementSessionId(nextSession.id);
    };

    const socket = connectMissionSessionSocket(judgementSessionId, {
      onError: () => {
        void getMissionSession(judgementSessionId).then(applyJudgementSession).catch(() => undefined);
      },
      onMessage: ({ session: nextSession, type }) => {
        if (nextSession && (type === 'judgement_updated' || nextSession.id === judgementSessionId)) {
          applyJudgementSession(nextSession);
        }
      },
    });

    const refreshTimer = setInterval(() => {
      void getMissionSession(judgementSessionId).then(applyJudgementSession).catch(() => undefined);
    }, 3000);

    void getMissionSession(judgementSessionId).then(applyJudgementSession).catch(() => undefined);

    return () => {
      isActive = false;
      clearInterval(refreshTimer);
      socket.close();
    };
  }, [finishPassedJudgement, judgementSessionId, setSession, submittedSubmissionId]);

  useEffect(() => {
    if (returnCountdown === null) {
      return;
    }

    if (returnCountdown <= 0) {
      if (hasNavigatedAwayRef.current) {
        return;
      }

      hasNavigatedAwayRef.current = true;
      if (scheduleId) {
        router.replace({
          pathname: '/trip/active',
          params: { scheduleId },
        });
      } else {
        router.back();
      }
      return;
    }

    const timer = setTimeout(() => {
      setReturnCountdown((currentValue) => (currentValue === null ? null : currentValue - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [hasNavigatedAwayRef, returnCountdown, scheduleId]);

  const handleRetake = () => {
    setCapturedPhotoUri(null);
    setIsMissionComplete(false);
    setIsTransitioningToResult(false);
    setUploadMessage('');
    setReturnCountdown(null);
    setCompletionSessionId(null);
    revealRequestedRef.current = false;
    revealRequestInFlightRef.current = false;
    setJudgementSessionId(null);
    setJudgeReason(null);
    setJudgeStatus(null);
    setSubmittedSubmissionId(null);
  };

  const handleComplete = async () => {
    if (!capturedPhotoUri || isUploading || isUploadExpired) {
      return;
    }

    try {
      setIsUploading(true);
      setUploadMessage('세션을 확인하는 중이에요.');
      setReturnCountdown(null);
      setJudgementSessionId(null);
      setJudgeReason(null);
      setJudgeStatus(null);
      setSubmittedSubmissionId(null);
      const uploadSessionId = await resolveMissionUploadSessionId({ scheduleId, scheduleMissionId, sessionId });
      const uploadSession = await getMissionSession(uploadSessionId);
      setSession(uploadSession);
      const deadlineMs = getRemainingMs(uploadSession.photoUploadEndsAt ?? uploadSession.shootingEndsAt, Date.now());
      if (deadlineMs !== null && deadlineMs <= 0) {
        throw new Error('제한 시간이 종료되어 업로드할 수 없어요.');
      }
      setUploadMessage('제출 가능 여부를 확인하는 중이에요.');
      await ensureCurrentUserCanSubmit(uploadSessionId, getAuthItem('user_id'));
      setUploadMessage('사진을 업로드하는 중이에요.');
      const uploadedSubmission: MissionSubmission = await runWithNetworkRetry(() => uploadMissionSessionPhoto(uploadSessionId, capturedPhotoUri), 1);
      const nextJudgeStatus = uploadedSubmission.judgeStatus ?? null;
      setSubmittedSubmissionId(uploadedSubmission.id);
      setJudgeStatus(nextJudgeStatus);
      setJudgeReason(uploadedSubmission.judgeReason ?? null);

      if (nextJudgeStatus === 'PASSED') {
        void finishPassedJudgement(uploadSessionId, uploadSession);
        return;
      }

      if (nextJudgeStatus === 'REJECTED' || nextJudgeStatus === 'ERROR') {
        setIsMissionComplete(false);
        setUploadMessage(getJudgementFailureMessage(nextJudgeStatus));
        setReturnCountdown(null);
        return;
      }

      if (isWaitingJudgementStatus(nextJudgeStatus)) {
        setUploadMessage(getJudgementWaitingMessage(nextJudgeStatus));
        setJudgementSessionId(uploadSessionId);
        return;
      }

      setJudgeStatus('PENDING');
      setUploadMessage(getJudgementWaitingMessage('PENDING'));
      setJudgementSessionId(uploadSessionId);
    } catch (error) {
      setUploadMessage(isDuplicateSubmissionError(error) ? '이미 수행한 미션이에요. 한 미션은 한 번만 제출할 수 있어요.' : error instanceof Error ? error.message : '사진 업로드에 실패했어요.');
    } finally {
      setIsUploading(false);
    }
  };

  return {
    handleComplete,
    handleRetake,
    isMissionComplete,
    isTransitioningToResult,
    isUploading,
    isWaitingForJudgement,
    judgeReason,
    judgeStatus,
    judgementDotCount,
    needsRetakeAfterJudgement,
    returnCountdown,
    setJudgeReason,
    setJudgeStatus,
    setSubmittedSubmissionId,
    setIsMissionComplete,
    submittedSubmissionId,
    uploadMessage,
  };
}
