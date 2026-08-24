import type { MissionSession, MissionSubmission } from '@/lib/mission-session-api';

// review 화면에서 사용하는 댓글 참여자 판정과 시간 계산을 담당합니다.
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

export function shouldSkipMissionVote(session: MissionSession | null | undefined, submissions: MissionSubmission[]) {
  if (submissions.length !== 1) {
    return false;
  }

  const commentParticipantIds = getCommentParticipantIds(session);
  const onlySubmissionOwnerId = submissions[0]?.userId;

  return !Array.from(commentParticipantIds).some((userId) => userId !== onlySubmissionOwnerId);
}
