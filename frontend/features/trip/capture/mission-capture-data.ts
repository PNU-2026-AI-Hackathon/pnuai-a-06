import type { MissionJudgementStatus, MissionSession } from '@/lib/mission-session-api';

// 미션 촬영 화면에서 사용하는 상수와 순수 판정·시간 계산을 담당합니다.
export const MISSION_CARD_SOURCE_WIDTH = 164;
export const MISSION_CARD_SOURCE_HEIGHT = 209;
export const MISSION_CARD_WIDTH = 350;
export const MISSION_CARD_HEIGHT = Math.round(MISSION_CARD_WIDTH * (MISSION_CARD_SOURCE_HEIGHT / MISSION_CARD_SOURCE_WIDTH));
export const MISSION_CARD_COLLAPSED_VISIBLE_HEIGHT = 66;

export function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatRemainingTime(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getRemainingMs(deadline: string | null | undefined, now: number) {
  if (!deadline) {
    return null;
  }

  const deadlineTime = new Date(deadline).getTime();
  return Number.isFinite(deadlineTime) ? deadlineTime - now : null;
}

export async function runWithNetworkRetry<T>(task: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const isNetworkFailure = error instanceof TypeError || (error instanceof Error && error.message.includes('Network request failed'));

    if (!isNetworkFailure || retries <= 0) {
      throw error;
    }

    await wait(700);
    return runWithNetworkRetry(task, retries - 1);
  }
}

export function isDuplicateSubmissionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return message.includes('이미') || message.includes('already') || message.includes('duplicate') || message.includes('submitted') || message.includes('한 번');
}

export function isWaitingJudgementStatus(status: MissionJudgementStatus | null | undefined) {
  return status === 'PENDING' || status === 'PROCESSING' || status === 'REVIEW';
}

export function isRetryableJudgementStatus(status: MissionJudgementStatus | null | undefined) {
  return status === 'REJECTED' || status === 'ERROR';
}

export function getJudgementWaitingMessage(status: MissionJudgementStatus | null | undefined) {
  return status === 'PROCESSING' ? '사진을 확인하고 있어요.' : 'AI가 미션 사진을 확인하고 있어요.';
}

export function getMyLatestSubmission(session: MissionSession, currentUserId: string | null, submittedSubmissionId: string | null) {
  if (submittedSubmissionId) {
    const submitted = session.submissions.find((submission) => submission.id === submittedSubmissionId);

    if (submitted) {
      return submitted;
    }
  }

  if (!currentUserId) {
    return null;
  }

  return [...session.submissions].reverse().find((submission) => submission.userId === currentUserId) ?? null;
}
