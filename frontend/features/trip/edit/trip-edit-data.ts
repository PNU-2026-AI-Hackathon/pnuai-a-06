// 일정 편집 화면의 날짜 계산과 초대 링크 표시를 담당하는 유틸리티입니다.

import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { TripInvite } from '@/lib/trip-invite-api';

export function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(year, month - 1, day) : null;
}

export function getDateCount(startDate: string | null | undefined, endDate: string | null | undefined) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1;
}

export function isTripStartedDate(startDate: string | null | undefined) {
  const start = parseDate(startDate);
  if (!start) return false;

  const today = new Date();
  const todayValue = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const startValue = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());

  return todayValue >= startValue;
}

export function formatDateLabel(value: string | null | undefined, withYear = true) {
  const date = parseDate(value);
  if (!date) return '날짜 선택';
  return withYear ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일` : `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function createFallbackInviteUrl(invite: TripInvite) {
  if (invite.inviteUrl) return invite.inviteUrl;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL('/trip/invite', window.location.origin);
    url.searchParams.set('inviteToken', invite.inviteToken);
    return url.toString();
  }
  return Linking.createURL('/trip/invite', { isTripleSlashed: true, queryParams: { inviteToken: invite.inviteToken } });
}
