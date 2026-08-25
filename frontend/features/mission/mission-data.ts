// 미션 화면의 표시 데이터와 날짜 계산에 사용하는 순수 유틸리티입니다.

import type { MissionItem } from '@/lib/mission-api';
import type { TripSchedule } from '@/lib/trip-schedule-api';

import type { MissionTheme, MissionThemeItem } from './types';

export const themeItems: MissionThemeItem[] = [
  { icon: require('@/assets/svg/mission_theme/mountain.svg'), label: '산', value: 'MOUNTAIN' },
  { icon: require('@/assets/svg/mission_theme/sea.svg'), label: '바다', value: 'SEA' },
  { icon: require('@/assets/svg/mission_theme/city.svg'), label: '도시', value: 'CITY' },
  { icon: require('@/assets/svg/theme_icon/flag.svg'), label: '데모', value: 'DEMO' },
];

const districtCodeByLabel: Record<string, string> = {
  강서구: 'GANGSEO',
  사하구: 'SAHA',
  사상구: 'SASANG',
  북구: 'BUK',
  금정구: 'GEUMJEONG',
  동래구: 'DONGNAE',
  연제구: 'YEONJE',
  부산진구: 'BUSANJIN',
  서구: 'SEO',
  동구: 'DONG',
  중구: 'JUNG',
  수영구: 'SUYEONG',
  남구: 'NAM',
  영도구: 'YEONGDO',
  해운대구: 'HAEUNDAE',
  기장군: 'GIJANG',
};

export function getDistrictCode(district: string) {
  return districtCodeByLabel[district] || '';
}

export function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeValue(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

export function getValidTheme(value: string | string[] | undefined): MissionTheme {
  const theme = normalizeValue(getParamValue(value));

  return theme === 'SEA' || theme === 'CITY' || theme === 'DEMO' ? theme : 'MOUNTAIN';
}

export function getSortedMissions(
  missions: MissionItem[],
  options: { district: string; districtCode: string; missionCode: string; theme: MissionTheme }
) {
  const focusedDistrictCode = normalizeValue(options.districtCode);
  const focusedMissionCode = normalizeValue(options.missionCode);
  const seenMissionKeys = new Set<string>();
  const themedMissions = missions.filter((mission) => normalizeValue(mission.theme) === options.theme);
  const uniqueThemedMissions = themedMissions.filter((mission) => {
    const missionKey = normalizeValue(mission.code ?? mission.id);

    if (seenMissionKeys.has(missionKey)) {
      return false;
    }

    seenMissionKeys.add(missionKey);
    return true;
  });

  return uniqueThemedMissions
    .map((mission, index) => {
      const missionCode = normalizeValue(mission.code ?? mission.id);
      const missionDistrictCode = normalizeValue(mission.districtCode);
      const isSameDistrict =
        Boolean(focusedDistrictCode && missionDistrictCode === focusedDistrictCode) || mission.districtLabel === options.district;
      const isSameMission = Boolean(focusedMissionCode && missionCode === focusedMissionCode);
      const priority = isSameMission ? 0 : isSameDistrict ? 1 : 2;

      return { index, mission, priority };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ mission }) => mission);
}

export function formatScheduleDate(schedule: TripSchedule) {
  if (schedule.startDate && schedule.endDate) {
    if (schedule.startDate === schedule.endDate) {
      return schedule.startDate;
    }

    return `${schedule.startDate} - ${schedule.endDate}`;
  }

  return schedule.startDate ?? schedule.endDate ?? '날짜 미정';
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

export function isPastDate(value: string) {
  const date = parseDateValue(value);

  if (!date) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

export function getScheduleDateOptions(schedule: TripSchedule) {
  const startDate = parseDateValue(schedule.startDate);
  const endDate = parseDateValue(schedule.endDate ?? schedule.startDate);

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
