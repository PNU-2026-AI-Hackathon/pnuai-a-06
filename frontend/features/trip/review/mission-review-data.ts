import type { MissionSession } from '@/lib/mission-session-api';

// review 화면에서 사용하는 댓글 참여자 판정과 시간 계산을 담당합니다.
export function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getUserLabel(index: number) {
  return `익명 ${index + 1}`;
}

export function getCommentParticipantIds(session: MissionSession | null | undefined) {
  return new Set(
    (session?.members ?? [])
      .filter((member) => member.participationStatus === 'PARTICIPATING' || member.participationStatus === 'COMPLETED' || member.participationStatus === 'TIMED_OUT')
      .map((member) => member.userId)
      .filter(Boolean),
  );
}

export function getRemainingMs(deadline: string | null | undefined, now: number) {
  if (!deadline) {
    return null;
  }

  const deadlineTime = new Date(deadline).getTime();
  return Number.isFinite(deadlineTime) ? deadlineTime - now : null;
}
