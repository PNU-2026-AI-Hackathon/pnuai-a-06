import type { MissionSession, MissionSubmission } from '@/lib/mission-session-api';

// 투표 대기 화면에서 사용하는 라우트 파라미터와 참여자 수를 담당합니다.
export function getEligibleVoterCount(session: MissionSession, submissions: MissionSubmission[] = []) {
  const eligibleVoters = session.members.filter((member) => (
    member.participationStatus === 'PARTICIPATING' ||
    member.participationStatus === 'COMPLETED' ||
    member.participationStatus === 'TIMED_OUT'
  ));

  if (submissions.length === 1) {
    const onlySubmissionOwnerId = submissions[0]?.userId;
    return eligibleVoters.filter((member) => member.userId !== onlySubmissionOwnerId).length;
  }

  return eligibleVoters.length || session.members.length;
}
