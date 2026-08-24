import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type { TripSchedule } from '@/lib/trip-schedule-api';
import type { TripInvite } from '@/lib/trip-invite-api';

// 여행 초대 화면에서 사용하는 데이터 변환·검증 유틸입니다.

export const INVITE_COMPANIONS = [
  { label: '나', color: '#b9d7ee' },
  { label: '선우', color: '#c9d1d7' },
];

export type TripInviteStatus = 'idle' | 'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'acceptError';

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '초대 확인에 실패했습니다.';
}

function getDateKey(value: string | undefined) {
  return value?.slice(0, 10);
}

export function getDateRangeLabel(startDate: string | undefined, endDate: string | undefined) {
  const start = getDateKey(startDate);
  const end = getDateKey(endDate) ?? start;

  if (!start) {
    return '해당 날짜';
  }

  return start === end ? start : `${start} ~ ${end}`;
}

export function findConflictingSchedule(invite: TripInvite, schedules: TripSchedule[]) {
  const inviteStartDate = getDateKey(invite.startDate ?? invite.endDate);
  const inviteEndDate = getDateKey(invite.endDate ?? invite.startDate);

  if (!inviteStartDate || !inviteEndDate) {
    return null;
  }

  return schedules.find((schedule) => {
    const scheduleStartDate = getDateKey(schedule.startDate ?? schedule.endDate);
    const scheduleEndDate = getDateKey(schedule.endDate ?? schedule.startDate);

    return Boolean(
      scheduleStartDate &&
      scheduleEndDate &&
      scheduleStartDate <= inviteEndDate &&
      inviteStartDate <= scheduleEndDate
    );
  }) ?? null;
}

export function isScheduleConflictError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    (message.includes('일정') && (message.includes('이미') || message.includes('날짜') || message.includes('기간') || message.includes('겹') || message.includes('충돌'))) ||
    (message.includes('schedule') && (message.includes('date') || message.includes('overlap') || message.includes('conflict')))
  );
}

export function isAccessibleTripError(error: unknown) {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  return (
    message.includes('이미') ||
    message.includes('참여') ||
    message.includes('입장') ||
    normalizedMessage.includes('already') ||
    normalizedMessage.includes('joined') ||
    normalizedMessage.includes('member')
  );
}

export function isJoinedInviteStatus(status: string | undefined) {
  if (!status) {
    return false;
  }

  const normalizedStatus = status.toUpperCase();

  return ['ACCEPTED', 'JOINED', 'APPROVED', 'ACTIVE', 'MEMBER', 'OWNER', 'CREATOR', 'HOST', 'INVITER'].includes(normalizedStatus);
}

function createFallbackInviteUrl(inviteToken: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL('/trip/invite', window.location.origin);
    url.searchParams.set('inviteToken', inviteToken);

    return url.toString();
  }

  return Linking.createURL('/trip/invite', {
    isTripleSlashed: true,
    queryParams: {
      inviteToken,
    },
  });
}

export function getInviteUrl(invite: TripInvite | null) {
  if (!invite) {
    return '';
  }

  return invite.inviteUrl ?? createFallbackInviteUrl(invite.inviteToken);
}
