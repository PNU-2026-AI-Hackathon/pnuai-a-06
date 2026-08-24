import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export type TripDateParts = {
  day: number;
  month: number;
  year: number;
};

type CalendarDay = TripDateParts & {
  dateValue: string;
  isCurrentMonth: boolean;
  isSelectable: boolean;
};

type TripDatePickerProps = {
  endDate: string | null;
  maxDate?: string;
  minDate?: string;
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
  startDate: string | null;
  visible: boolean;
};

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

export function formatTripDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { day, month, year };
}

function createDateValue({ day, month, year }: TripDateParts) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function compareDateParts(left: TripDateParts, right: TripDateParts) {
  return createDateValue(left).localeCompare(createDateValue(right));
}

function shiftMonth(parts: TripDateParts, offset: number) {
  const date = new Date(parts.year, parts.month - 1 + offset, 1);
  return { day: 1, month: date.getMonth() + 1, year: date.getFullYear() };
}

function getCalendarDays(monthParts: TripDateParts, minDate: TripDateParts, maxDate: TripDateParts) {
  const firstDay = new Date(monthParts.year, monthParts.month - 1, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(monthParts.year, monthParts.month, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const firstCalendarDate = addDays(firstDay, -firstWeekday);

  return Array.from({ length: totalCells }, (_, index): CalendarDay => {
    const date = addDays(firstCalendarDate, index);
    const parts = { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
    const dateValue = createDateValue(parts);

    return {
      ...parts,
      dateValue,
      isCurrentMonth: parts.month === monthParts.month && parts.year === monthParts.year,
      isSelectable: compareDateParts(parts, minDate) >= 0 && compareDateParts(parts, maxDate) <= 0,
    };
  });
}

function isDateInRange(value: string, startDate: string | null, endDate: string | null) {
  return Boolean(startDate && endDate && value >= startDate && value <= endDate);
}

export function TripDatePicker({ endDate, maxDate, minDate, onClose, onConfirm, startDate, visible }: TripDatePickerProps) {
  const { bottomSafeInset, horizontalPadding } = useResponsiveLayout();
  const today = useMemo(() => new Date(), []);
  const resolvedMinDate = minDate ?? formatTripDate(today);
  const resolvedMaxDate = maxDate ?? formatTripDate(addDays(today, 179));
  const [draftStartDate, setDraftStartDate] = useState<string | null>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<string | null>(endDate);
  const [isSelectingEndDate, setIsSelectingEndDate] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<TripDateParts>(() => ({
    ...parseDateValue(startDate ?? resolvedMinDate),
    day: 1,
  }));

  useEffect(() => {
    if (!visible) {
      return;
    }

    const initialDate = startDate ?? resolvedMinDate;
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setIsSelectingEndDate(false);
    setCalendarMonth({ ...parseDateValue(initialDate), day: 1 });
  }, [endDate, resolvedMinDate, startDate, visible]);

  const minDateParts = parseDateValue(resolvedMinDate);
  const maxDateParts = parseDateValue(resolvedMaxDate);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth, parseDateValue(resolvedMinDate), parseDateValue(resolvedMaxDate)), [calendarMonth, resolvedMaxDate, resolvedMinDate]);
  const hasDateChanges = draftStartDate !== startDate || draftEndDate !== endDate;
  const canGoPrevMonth = compareDateParts(shiftMonth(calendarMonth, -1), { ...minDateParts, day: 1 }) >= 0;
  const canGoNextMonth = compareDateParts(shiftMonth(calendarMonth, 1), { ...maxDateParts, day: 1 }) <= 0;

  const handleDateSelect = (day: CalendarDay) => {
    if (!day.isSelectable) {
      return;
    }

    if (!draftStartDate || !isSelectingEndDate || day.dateValue < draftStartDate) {
      setDraftStartDate(day.dateValue);
      setDraftEndDate(day.dateValue);
      setIsSelectingEndDate(true);
      return;
    }

    setDraftEndDate(day.dateValue);
    setIsSelectingEndDate(false);
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="날짜 선택 닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { paddingBottom: bottomSafeInset + 20, paddingHorizontal: horizontalPadding }]}>
          <Text style={styles.sheetTitle}>날짜 선택</Text>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthTitle}>{calendarMonth.year}년 {calendarMonth.month}월</Text>
            <View style={styles.monthButtons}>
              <Pressable accessibilityLabel="이전 달" disabled={!canGoPrevMonth} onPress={() => setCalendarMonth((current) => shiftMonth(current, -1))} style={styles.monthButton}>
                <Text style={[styles.monthButtonText, !canGoPrevMonth && styles.disabledMonthButtonText]}>‹</Text>
              </Pressable>
              <Pressable accessibilityLabel="다음 달" disabled={!canGoNextMonth} onPress={() => setCalendarMonth((current) => shiftMonth(current, 1))} style={styles.monthButton}>
                <Text style={[styles.monthButtonText, !canGoNextMonth && styles.disabledMonthButtonText]}>›</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.weekdayRow}>
            {weekdayLabels.map((day) => <Text key={day} style={styles.weekdayText}>{day}</Text>)}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day) => {
              const isSelected = isDateInRange(day.dateValue, draftStartDate, draftEndDate);
              const isStart = day.dateValue === draftStartDate;
              const isEnd = day.dateValue === draftEndDate;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !day.isSelectable, selected: isSelected }}
                  disabled={!day.isSelectable}
                  key={day.dateValue}
                  onPress={() => handleDateSelect(day)}
                  style={styles.dayCell}>
                  {isSelected ? <View style={[styles.rangeFill, isStart && styles.rangeStart, isEnd && styles.rangeEnd]} /> : null}
                  <Text style={[styles.dayText, !day.isCurrentMonth && styles.outsideMonthText, !day.isSelectable && styles.disabledDayText, isSelected && styles.selectedDayText]}>{day.day}</Text>
                </Pressable>
              );
            })}
          </View>
          <ScalePressable
            accessibilityRole="button"
            disabled={!hasDateChanges}
            onPress={() => hasDateChanges && draftStartDate && draftEndDate && onConfirm(draftStartDate, draftEndDate)}
            pressedScale={0.98}
            style={[styles.confirmButton, hasDateChanges ? styles.activeConfirmButton : styles.disabledConfirmButton]}>
            <Text style={[styles.confirmButtonText, hasDateChanges && styles.activeConfirmButtonText]}>선택</Text>
          </ScalePressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 26,
  },
  sheetTitle: {
    color: '#10161F',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 26,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
  },
  monthButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  monthButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  monthButtonText: {
    color: '#10161F',
    fontSize: 34,
    lineHeight: 28,
  },
  disabledMonthButtonText: {
    color: '#D8E0E4',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  weekdayText: {
    color: '#303940',
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    minHeight: 264,
  },
  dayCell: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: '14.2%',
  },
  rangeFill: {
    backgroundColor: '#C9E4EE',
    bottom: 3,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 3,
  },
  rangeStart: {
    borderBottomLeftRadius: 28,
    borderTopLeftRadius: 28,
    left: 0,
  },
  rangeEnd: {
    borderBottomRightRadius: 28,
    borderTopRightRadius: 28,
    right: 0,
  },
  dayText: {
    color: '#222B31',
    fontSize: 14,
    zIndex: 1,
  },
  outsideMonthText: {
    color: '#D8E0E4',
  },
  disabledDayText: {
    color: '#D8E0E4',
  },
  selectedDayText: {
    color: '#10161F',
    fontWeight: '600',
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: 42,
    height: 63,
    justifyContent: 'center',
    marginTop: 18,
  },
  activeConfirmButton: {
    backgroundColor: '#63B5CD',
  },
  disabledConfirmButton: {
    backgroundColor: '#E3F0F6',
  },
  confirmButtonText: {
    color: '#409CB7',
    fontSize: 16,
    fontWeight: '500',
  },
  activeConfirmButtonText: {
    color: '#FFFFFF',
  },
});
