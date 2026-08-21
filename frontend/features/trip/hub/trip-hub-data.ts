// 일정 목록 화면의 상태 분류, 날짜 표시, 드래그 정렬에 사용하는 순수 유틸리티입니다.

import type { TripSchedule } from '@/lib/trip-schedule-api';

export const CARD_DRAG_STEP = 82;
export const CARD_SHIFT_DISTANCE = 100;

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

export function isInProgressSchedule(schedule: TripSchedule) {
  const startDate = getDateKey(schedule.startDate);
  const endDate = getDateKey(schedule.endDate ?? schedule.startDate);
  if (!startDate || !endDate) {
    return false;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return startDate <= todayKey && todayKey <= endDate;
}

export function pinInProgressSchedules(items: TripSchedule[]) {
  return [...items.filter(isInProgressSchedule), ...items.filter((item) => !isInProgressSchedule(item))];
}

export function getPinnedScheduleCount(items: TripSchedule[]) {
  return items.filter(isInProgressSchedule).length;
}

export function formatDateRange(schedule: TripSchedule) {
  if (!schedule.startDate && !schedule.endDate) {
    return '날짜 미정';
  }

  if (schedule.startDate && schedule.endDate) {
    if (schedule.startDate === schedule.endDate) {
      return schedule.startDate;
    }

    return `${schedule.startDate} - ${schedule.endDate}`;
  }

  return schedule.startDate ?? schedule.endDate ?? '날짜 미정';
}

export function moveScheduleItem(items: TripSchedule[], scheduleId: string, offset: number, pinnedScheduleCount: number) {
  const fromIndex = items.findIndex((item) => item.scheduleId === scheduleId);

  if (fromIndex < pinnedScheduleCount) {
    return items;
  }

  const toIndex = Math.max(pinnedScheduleCount, Math.min(items.length - 1, fromIndex + offset));

  if (fromIndex === toIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);

  return nextItems;
}
