// 일정 생성 화면에서 여행 날짜를 선택하는 캘린더 UI입니다.

import { View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';

import { createDateValue, weekdayLabels, type CalendarDay, type DateParts } from '../trip-create-data';
import { styles } from '../trip-create-styles';

type TripCreateCalendarProps = {
  calendarMonth: DateParts;
  calendarDays: CalendarDay[];
  startDate: string | null;
  endDate: string | null;
  occupiedDateValues: Set<string>;
  canGoPrevMonth: boolean;
  canGoNextMonth: boolean;
  onChangeMonth: (offset: number) => void;
  onSelectDate: (day: CalendarDay) => void;
};

export function TripCreateCalendar({
  calendarMonth,
  calendarDays,
  startDate,
  endDate,
  occupiedDateValues,
  canGoPrevMonth,
  canGoNextMonth,
  onChangeMonth,
  onSelectDate,
}: TripCreateCalendarProps) {
  return (
    <View style={styles.calendarSection}>
      <View style={styles.calendarHeader}>
        <Text style={styles.monthTitle}>
          {calendarMonth.year}년 {calendarMonth.month}월
        </Text>
        <View style={styles.monthButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 달"
            disabled={!canGoPrevMonth}
            onPress={() => onChangeMonth(-1)}
            style={styles.monthButton}>
            <Text style={[styles.monthButtonText, !canGoPrevMonth && styles.disabledMonthButtonText]}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 달"
            disabled={!canGoNextMonth}
            onPress={() => onChangeMonth(1)}
            style={styles.monthButton}>
            <Text style={[styles.monthButtonText, !canGoNextMonth && styles.disabledMonthButtonText]}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((day) => (
          <Text key={day} style={styles.weekdayText}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {calendarDays.map((day) => {
          const isSelected = startDate && endDate ? day.dateValue >= startDate && day.dateValue <= endDate : false;
          const isOccupied = occupiedDateValues.has(day.dateValue);
          const isDayDisabled = !day.isSelectable || isOccupied;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isDayDisabled, selected: isSelected }}
              disabled={isDayDisabled}
              key={createDateValue(day)}
              onPress={() => onSelectDate(day)}
              style={styles.dayCell}>
              {isSelected ? <View style={styles.rangeFill} /> : null}
              <Text
                style={[
                  styles.dayText,
                  !day.isCurrentMonth && styles.outsideMonthText,
                  isDayDisabled && styles.disabledDayText,
                  isSelected && styles.selectedDayText,
                ]}>
                {day.day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
