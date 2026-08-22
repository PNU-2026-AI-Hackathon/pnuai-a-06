import { router } from 'expo-router';
import { useCallback, useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { getAuthItem } from '@/lib/auth-storage';
import { completeMissionSession, connectMissionSessionSocket, getLatestMissionSession, getMissionSession, isMissionSessionNotFoundError, uploadMissionSessionPhoto, type MissionJudgementStatus, type MissionSession, type MissionSubmission } from '@/lib/mission-session-api';
import {
  getJudgementWaitingMessage,
  getMyLatestSubmission,
  getRemainingMs,
  isDuplicateSubmissionError,
  isRetryableJudgementStatus,
  isWaitingJudgementStatus,
  runWithNetworkRetry,
} from '../mission-capture-data';

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [returnCountdown, setReturnCountdown] = useState<number | null>(null);
  const [judgementSessionId, setJudgementSessionId] = useState<string | null>(null);
  const [submittedSubmissionId, setSubmittedSubmissionId] = useState<string | null>(null);
  const [judgeReason, setJudgeReason] = useState<string | null>(null);
  const [judgeStatus, setJudgeStatus] = useState<MissionJudgementStatus | null>(null);
  const [judgementDotCount, setJudgementDotCount] = useState(1);
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

    hasNavigatedAwayRef.current = true;
    setJudgementSessionId(null);
    setIsMissionComplete(true);

    const isSoloMission = passedSession?.members.length === 1;

    if (isSoloMission) {
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

    setUploadMessage('AI 판독이 완료됐어요. 댓글 화면으로 이동합니다.');
    router.replace({
      pathname: '/trip/review',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId: passedSessionId,
      },
    });
  }, [hasNavigatedAwayRef, scheduleId, setSession]);

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

      if (nextJudgeStatus === 'REJECTED') {
        // TEMP: AI 실패 여부와 관계없이 업로드 이후 플로우를 테스트한다.
        // setIsMissionComplete(true);
        // setUploadMessage('테스트용으로 사진 업로드를 완료했어요.');
        // setReturnCountdown(3);
        setIsMissionComplete(false);
        setUploadMessage('AI 판정에 통과하지 못했어요. 다시 촬영해 주세요.');
        setReturnCountdown(null);
        return;
      }

      if (nextJudgeStatus === 'ERROR') {
        // TEMP: AI 오류 사진도 성공 처리하던 테스트 우회 코드.
        // setIsMissionComplete(true);
        // setUploadMessage('테스트용으로 사진 업로드를 완료했어요.');
        // setReturnCountdown(3);
        setIsMissionComplete(false);
        setUploadMessage('AI 확인 중 문제가 발생했어요. 다시 촬영해 주세요.');
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
    setUploadMessage('');
    setReturnCountdown(null);
    setJudgementSessionId(null);
    setJudgeReason(null);
    setJudgeStatus(null);
    setSubmittedSubmissionId(null);
  };

  const ensureCurrentUserCanSubmit = async (uploadSessionId: string) => {
    const currentUserId = getAuthItem('user_id');

    if (!currentUserId) {
      return;
    }

    const currentSession = await getMissionSession(uploadSessionId);
    const activeSubmission = [...currentSession.submissions].reverse().find((submission) => submission.userId === currentUserId && !isRetryableJudgementStatus(submission.judgeStatus));

    if (activeSubmission) {
      throw new Error('이미 수행한 미션이에요. 한 미션은 한 번만 제출할 수 있어요.');
    }
  };

  const resolveUploadSessionId = async () => {
    if (sessionId) {
      try {
        const currentSession = await getMissionSession(sessionId);
        return currentSession.id;
      } catch (error) {
        if (!isMissionSessionNotFoundError(error) || !scheduleId || !scheduleMissionId) {
          throw error;
        }
      }
    }

    if (!scheduleId || !scheduleMissionId) {
      throw new Error('미션 세션 정보가 없습니다.');
    }

    const latestSession = await getLatestMissionSession(scheduleId, scheduleMissionId);
    return latestSession.id;
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
      const uploadSessionId = await resolveUploadSessionId();
      const uploadSession = await getMissionSession(uploadSessionId);
      setSession(uploadSession);
      const deadlineMs = getRemainingMs(uploadSession.photoUploadEndsAt ?? uploadSession.shootingEndsAt, Date.now());
      if (deadlineMs !== null && deadlineMs <= 0) {
        throw new Error('제한 시간이 종료되어 업로드할 수 없어요.');
      }
      setUploadMessage('제출 가능 여부를 확인하는 중이에요.');
      await ensureCurrentUserCanSubmit(uploadSessionId);
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

      if (nextJudgeStatus === 'REJECTED') {
        // TEMP: AI 실패 여부와 관계없이 업로드 이후 플로우를 테스트한다.
        // setIsMissionComplete(true);
        // setUploadMessage('테스트용으로 사진 업로드를 완료했어요.');
        // setReturnCountdown(3);
        setIsMissionComplete(false);
        setUploadMessage('AI 판정에 통과하지 못했어요. 다시 촬영해 주세요.');
        setReturnCountdown(null);
        return;
      }

      if (nextJudgeStatus === 'ERROR') {
        // TEMP: AI 오류 사진도 성공 처리하던 테스트 우회 코드.
        // setIsMissionComplete(true);
        // setUploadMessage('테스트용으로 사진 업로드를 완료했어요.');
        // setReturnCountdown(3);
        setIsMissionComplete(false);
        setUploadMessage('AI 확인 중 문제가 발생했어요. 다시 촬영해 주세요.');
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
    setUploadMessage,
    setReturnCountdown,
    setJudgementSessionId,
    setIsMissionComplete,
    submittedSubmissionId,
    uploadMessage,
  };
}
