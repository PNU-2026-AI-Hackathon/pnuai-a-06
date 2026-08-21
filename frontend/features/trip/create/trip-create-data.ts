// 일정 생성 화면의 캘린더와 날짜 계산에 사용하는 순수 데이터 유틸리티입니다.

import type { TripSchedule } from '@/lib/trip-schedule-api';

export type TripStep = 'date' | 'people';

export type DateParts = {
  day: number;
  month: number;
  year: number;
};

export type CalendarDay = DateParts & {
  dateValue: string;
  isCurrentMonth: boolean;
  isSelectable: boolean;
};

export const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

export function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const parseDateValue = (value: string): DateParts => {
  const [year, month, day] = value.split('-').map(Number);

  return { day, month, year };
};

export const createDateValue = ({ day, month, year }: DateParts) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
};

export const compareDateParts = (left: DateParts, right: DateParts) => createDateValue(left).localeCompare(createDateValue(right));

export const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export const shiftMonth = (parts: DateParts, offset: number): DateParts => {
  const date = new Date(parts.year, parts.month - 1 + offset, 1);

  return { day: 1, month: date.getMonth() + 1, year: date.getFullYear() };
};

export const getCalendarDays = (monthParts: DateParts, minDate: DateParts, maxDate: DateParts) => {
  const firstDay = new Date(monthParts.year, monthParts.month - 1, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = getDaysInMonth(monthParts.year, monthParts.month);
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const firstCalendarDate = addDays(firstDay, -firstWeekday);

  return Array.from({ length: totalCells }, (_, index): CalendarDay => {
    const date = addDays(firstCalendarDate, index);
    const parts = {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
    const dateValue = createDateValue(parts);
    const isSelectable = compareDateParts(parts, minDate) >= 0 && compareDateParts(parts, maxDate) <= 0;

    return {
      ...parts,
      dateValue,
      isCurrentMonth: parts.month === monthParts.month && parts.year === monthParts.year,
      isSelectable,
    };
  });
};

export const isDateInRange = (value: string, startDate: string, endDate: string) => value >= startDate && value <= endDate;

export const getOccupiedDateValues = (schedules: TripSchedule[]) => {
  const occupiedDates = new Set<string>();

  schedules.forEach((schedule) => {
    if (!schedule.startDate || !schedule.endDate) {
      return;
    }

    let currentDate = new Date(`${schedule.startDate}T00:00:00`);
    const lastDate = new Date(`${schedule.endDate}T00:00:00`);

    while (currentDate <= lastDate) {
      occupiedDates.add(formatDateValue(currentDate));
      currentDate = addDays(currentDate, 1);
    }
  });

  return occupiedDates;
};
