// 매거진 대상 일정과 대표 사진을 계산하는 순수 함수 모음입니다.
import { getPassedMissionSubmissions, type MissionSession } from '@/lib/mission-session-api';
import type { TripSchedule } from '@/lib/trip-schedule-api';

export function getDateKey(date: string | undefined) {
  if (!date) {
    return null;
  }

  const match = date.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

export function isClosedSchedule(schedule: TripSchedule) {
  const lastDate = getDateKey(schedule.endDate ?? schedule.startDate);
  if (!lastDate) {
    return false;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return lastDate < todayKey;
}

export function getScheduleEndTime(schedule: TripSchedule) {
  const lastDate = getDateKey(schedule.endDate ?? schedule.startDate);
  return lastDate ? new Date(`${lastDate}T00:00:00`).getTime() : 0;
}

export function getResultPhotoUrl(session: MissionSession) {
  if (session.status !== 'REVEALED' && session.status !== 'COMPLETED') {
    return null;
  }

  const passedSubmissions = getPassedMissionSubmissions(session);
  const savedWinner = session.winnerUserId ? passedSubmissions.find((submission) => submission.userId === session.winnerUserId) : null;
  const winnerSubmission = savedWinner ?? [...passedSubmissions].sort((left, right) => right.likeCount - left.likeCount)[0];

  return winnerSubmission?.imageUrl ?? null;
}
