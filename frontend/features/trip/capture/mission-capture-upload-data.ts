import { getLatestMissionSession, getMissionSession, isMissionSessionNotFoundError } from '@/lib/mission-session-api';

import { isRetryableJudgementStatus } from './mission-capture-data';

type ResolveMissionUploadSessionIdOptions = {
  scheduleId?: string;
  scheduleMissionId?: string;
  sessionId?: string;
};

// 업로드 전 현재 사용자의 제출 가능 여부를 확인합니다.
export async function ensureCurrentUserCanSubmit(uploadSessionId: string, currentUserId: string | null) {
  if (!currentUserId) {
    return;
  }

  const currentSession = await getMissionSession(uploadSessionId);
  const activeSubmission = [...currentSession.submissions].reverse().find((submission) => (
    submission.userId === currentUserId && !isRetryableJudgementStatus(submission.judgeStatus)
  ));

  if (activeSubmission) {
    throw new Error('이미 수행한 미션이에요. 한 미션은 한 번만 제출할 수 있어요.');
  }
}

// 기존 세션을 우선 사용하고, 없으면 일정의 최신 미션 세션을 찾습니다.
export async function resolveMissionUploadSessionId({ scheduleId, scheduleMissionId, sessionId }: ResolveMissionUploadSessionIdOptions) {
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
}
