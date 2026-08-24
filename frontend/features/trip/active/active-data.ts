// active 화면에서 사용하는 세션 판정, 일정 날짜, 캐시와 표시용 유틸리티입니다.

import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { getAuthItem, setAuthItem } from '@/lib/auth-storage';
import {
  MissionSessionApiError,
  type MissionSession,
} from '@/lib/mission-session-api';
import type { TripInvite } from '@/lib/trip-invite-api';
import type { TripSchedule, TripScheduleMission } from '@/lib/trip-schedule-api';

function createFallbackInviteUrl(inviteToken: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL('/trip/invite', window.location.origin);
    url.searchParams.set('inviteToken', inviteToken);

    return url.toString();
  }

  return Linking.createURL('/trip/invite', {
    isTripleSlashed: true,
    queryParams: { inviteToken },
  });
}

export function getInviteUrl(invite: TripInvite | null) {
  if (!invite) {
    return '';
  }

  return invite.inviteUrl ?? createFallbackInviteUrl(invite.inviteToken);
}

const REVEALED_SESSION_CACHE_PREFIX = 'trip_revealed_sessions:';

function getRevealedSessionCacheKey(scheduleId: string) {
  return `${REVEALED_SESSION_CACHE_PREFIX}${scheduleId}`;
}

export function readCachedRevealedSessions(scheduleId: string) {
  const raw = getAuthItem(getRevealedSessionCacheKey(scheduleId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, MissionSession>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCachedRevealedSessions(scheduleId: string, sessions: Record<string, MissionSession>) {
  setAuthItem(getRevealedSessionCacheKey(scheduleId), JSON.stringify(sessions));
}

export function getCompletedParticipantIds(session: MissionSession) {
  return new Set(
    session.members
      .filter((member) => member.participationStatus === 'COMPLETED')
      .map((member) => member.userId)
      .filter(Boolean),
  );
}

export function isFinishedSession(session: MissionSession | undefined) {
  const soloMember = session?.members.length === 1 ? session.members[0] : undefined;
  const isSoloTimedOut = Boolean(
    soloMember?.participationStatus === 'TIMED_OUT'
      || (
        soloMember
        && session
        && session.status !== 'COMPLETED'
        && session.status !== 'CANCELLED'
        && !session.submissions.some((submission) => (
          submission.userId === soloMember.userId
          && submission.judgeStatus !== 'REJECTED'
          && submission.judgeStatus !== 'ERROR'
        ))
        && (() => {
          const deadline = session.photoUploadEndsAt ?? session.shootingEndsAt;
          const deadlineTime = deadline ? new Date(deadline).getTime() : NaN;
          return Number.isFinite(deadlineTime) && deadlineTime <= Date.now();
        })()
      ),
  );

  return Boolean(session && (session.status === 'COMPLETED' || session.status === 'CANCELLED' || isSoloTimedOut));
}

export function hasAllPassedMemberSubmissions(session: MissionSession, requiredMemberCount: number) {
  const completedParticipantIds = getCompletedParticipantIds(session);
  const expectedMemberCount = completedParticipantIds.size > 0 ? completedParticipantIds.size : Math.max(session.members.length, requiredMemberCount);
  const passedUserIds = new Set(
    session.submissions
      .filter((submission) => submission.judgeStatus === 'PASSED')
      .map((submission) => submission.userId)
      .filter(Boolean),
  );

  return expectedMemberCount > 0 && passedUserIds.size >= expectedMemberCount;
}

export function getFeedSubmissions(session: MissionSession | undefined) {
  if (!session) {
    return [];
  }

  const completedParticipantIds = getCompletedParticipantIds(session);

  return session.submissions.filter((submission) =>
    submission.judgeStatus === 'PASSED'
    && (completedParticipantIds.size === 0 || completedParticipantIds.has(submission.userId))
  );
}

export function isFeedReadySession(session: MissionSession, requiredMemberCount: number) {
  return hasAllPassedMemberSubmissions(session, requiredMemberCount);
}

export function isStartedMissionSession(session: MissionSession) {
  return Boolean(session.startedAt) || (session.status !== 'WAITING' && session.status !== 'READY');
}

export function isParticipatingMissionMember(member: MissionSession['members'][number] | undefined) {
  return member?.participationStatus === 'PARTICIPATING' || member?.participationStatus === 'COMPLETED';
}

export function hasLeftMissionParticipation(member: MissionSession['members'][number] | undefined) {
  return member?.participationStatus === 'SKIPPED'
    || member?.participationStatus === 'LOCKED_OUT'
    || member?.participationStatus === 'TIMED_OUT';
}

export function isCompletedScheduleMission(mission: TripScheduleMission) {
  return mission.status === 'COMPLETED';
}

export function getMissionLocation(mission: TripScheduleMission) {
  if (mission.districtLabel && mission.placeLabel) {
    return `${mission.districtLabel}(${mission.placeLabel})`;
  }

  return mission.placeLabel ?? mission.districtLabel ?? '부산';
}

export function getMissionStartErrorMessage(error: unknown) {
  if (error instanceof MissionSessionApiError) {
    switch (error.code) {
      case 'MISSION_LOCATION_REQUIRED':
        return '위치 권한을 허용하고 현재 위치를 다시 확인해 주세요.';
      case 'MISSION_LOCATION_TIMESTAMP_INVALID':
        return '현재 위치 시간을 확인하지 못했어요. 다시 시도해 주세요.';
      case 'MISSION_LOCATION_STALE':
        return '위치 정보가 오래됐어요. 현재 위치를 다시 측정해 주세요.';
      case 'MISSION_LOCATION_INACCURATE':
        return '현재 위치의 정확도가 낮아요. 야외에서 잠시 후 다시 시도해 주세요.';
      case 'MISSION_LOCATION_OUT_OF_RANGE':
        return '미션 장소 근처에서만 참여할 수 있어요.';
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : '미션을 시작하지 못했어요.';
}

export function prefetchMissionIcons(missions: TripScheduleMission[]) {
  const iconUrls = Array.from(new Set(missions.map((mission) => mission.emojiUrl).filter((url): url is string => Boolean(url))));

  void Promise.all(iconUrls.map((url) => Image.prefetch(url, 'memory-disk'))).catch(() => undefined);
}

export function getParticipantText(schedule: TripSchedule | null) {
  const names = schedule?.participants
    .map((participant) => participant.nickname || participant.email)
    .filter((value): value is string => Boolean(value));

  return names && names.length > 0 ? names.join(' · ') : '동행자 정보 없음';
}

export function parseDateValue(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

export function getScheduleDateOptions(schedule: TripSchedule | null) {
  const startDate = parseDateValue(schedule?.startDate);
  const endDate = parseDateValue(schedule?.endDate ?? schedule?.startDate);

  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    return [];
  }

  const dates: string[] = [];
  let cursor = startDate;

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(formatDateValue(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function getCalendarDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000);
}

export function getTripDayLabel(schedule: TripSchedule | null) {
  const startDate = parseDateValue(schedule?.startDate);
  const endDate = parseDateValue(schedule?.endDate ?? schedule?.startDate);

  if (!startDate) {
    return '여행 날짜 미정';
  }

  const today = new Date();
  const todayDay = getCalendarDayNumber(today);
  const startDay = getCalendarDayNumber(startDate);

  if (todayDay < startDay) {
    return `D-${startDay - todayDay}`;
  }

  if (endDate && todayDay > getCalendarDayNumber(endDate)) {
    return '여행 종료';
  }

  return `오늘 · 여행 ${todayDay - startDay + 1}일차`;
}

export function getMissionDateLabel(date: string) {
  return date === 'UNPLANNED' ? '날짜 미정' : date;
}

export function getScheduleSyncSignature(schedule: TripSchedule) {
  return JSON.stringify({
    endDate: schedule.endDate,
    missions: schedule.missions.map((mission) => ({
      plannedDate: mission.plannedDate,
      scheduleMissionId: mission.scheduleMissionId,
      status: mission.status,
      title: mission.title,
    })),
    participants: schedule.participants.map((participant) => participant.id),
    startDate: schedule.startDate,
  });
}

export function hasSameMissionSessionSnapshot(left: MissionSession | undefined, right: MissionSession) {
  return Boolean(left && JSON.stringify(left) === JSON.stringify(right));
}
