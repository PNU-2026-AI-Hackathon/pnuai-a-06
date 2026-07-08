import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const companions = [
  { label: '나', color: '#b9d7ee' },
  { label: '선우', color: '#c9d1d7' },
];

type SelectKey = 'startDate' | 'endDate' | 'people';


type DatePart = 'year' | 'month' | 'day';

type DateParts = {
  day: number;
  month: number;
  year: number;
};

const peopleOptions = Array.from({ length: 10 }, (_, index) => {
  const value = String(index + 1);

  return {
    label: `${value}명`,
    value,
  };
});

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const formatDateLabel = (value: string) => {
  const [year, month, day] = value.split('-');

  return `${Number(year)}.${Number(month)}.${Number(day)}`;
};

const parseDateValue = (value: string): DateParts => {
  const [year, month, day] = value.split('-').map(Number);

  return { day, month, year };
};

const createDateValue = ({ day, month, year }: DateParts) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const compareDateParts = (left: DateParts, right: DateParts) => createDateValue(left).localeCompare(createDateValue(right));

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const createNumberRange = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const getMonthOptions = (year: number, minDate: DateParts, maxDate: DateParts) => {
  const minMonth = year === minDate.year ? minDate.month : 1;
  const maxMonth = year === maxDate.year ? maxDate.month : 12;

  return createNumberRange(minMonth, maxMonth);
};

const getDayOptions = (year: number, month: number, minDate: DateParts, maxDate: DateParts) => {
  const lastDay = getDaysInMonth(year, month);
  const minDay = year === minDate.year && month === minDate.month ? minDate.day : 1;
  const maxDay = year === maxDate.year && month === maxDate.month ? maxDate.day : lastDay;

  return createNumberRange(minDay, maxDay);
};

const clampDateParts = (parts: DateParts, minDate: DateParts, maxDate: DateParts): DateParts => {
  let nextParts = { ...parts };

  if (compareDateParts(nextParts, minDate) < 0) {
    nextParts = { ...minDate };
  }

  if (compareDateParts(nextParts, maxDate) > 0) {
    nextParts = { ...maxDate };
  }

  const monthOptions = getMonthOptions(nextParts.year, minDate, maxDate);
  const month = clamp(nextParts.month, monthOptions[0], monthOptions[monthOptions.length - 1]);
  const dayOptions = getDayOptions(nextParts.year, month, minDate, maxDate);
  const day = clamp(nextParts.day, dayOptions[0], dayOptions[dayOptions.length - 1]);

  return { day, month, year: nextParts.year };
};

const updateDatePart = (value: string, part: DatePart, nextValue: number, minDate: DateParts, maxDate: DateParts) => {
  const currentParts = parseDateValue(value);
  const nextParts = clampDateParts({ ...currentParts, [part]: nextValue }, minDate, maxDate);

  return createDateValue(nextParts);
};

export default function TripCreateScreen() {
  const {
    bottomActionInset,
    horizontalPadding,
    isCompactWidth,
    isTallScreen,
    topInset,
  } = useResponsiveLayout();
  const avatarSize = isCompactWidth ? 54 : 60;
  const contentTopGap = isTallScreen ? 38 : 22;
  const companionsTopGap = isTallScreen ? 26 : 18;
  const formTopGap = isTallScreen ? 42 : 28;
  const peopleTopGap = isTallScreen ? 30 : 22;
  const startButtonPadding = isTallScreen ? 18 : 15;
  const titleSize = isCompactWidth ? 23 : 25;
  const valueSize = isCompactWidth ? 16 : 20;
  const today = useMemo(() => new Date(), []);
  const minStartDate = useMemo(() => parseDateValue(formatDateValue(today)), [today]);
  const maxTripDate = useMemo(() => parseDateValue(formatDateValue(addDays(today, 179))), [today]);
  const [startDate, setStartDate] = useState(formatDateValue(today));
  const [endDate, setEndDate] = useState(formatDateValue(addDays(today, 6)));
  const [peopleCount, setPeopleCount] = useState('4');
  const [openSelect, setOpenSelect] = useState<SelectKey | null>(null);

  const startDateParts = parseDateValue(startDate);
  const endDateParts = parseDateValue(endDate);
  const isDateSelectOpen = openSelect === 'startDate' || openSelect === 'endDate';
  const selectedDateParts = openSelect === 'endDate' ? endDateParts : startDateParts;
  const minDateParts = openSelect === 'endDate' ? startDateParts : minStartDate;
  const yearOptions = createNumberRange(minDateParts.year, maxTripDate.year);
  const monthOptions = getMonthOptions(selectedDateParts.year, minDateParts, maxTripDate);
  const dayOptions = getDayOptions(selectedDateParts.year, selectedDateParts.month, minDateParts, maxTripDate);
  const selectTitle = openSelect === 'people' ? '인원수' : openSelect === 'endDate' ? '종료일' : '시작일';

  const closeSelect = () => setOpenSelect(null);

  const handlePeopleSelect = (value: string) => {
    setPeopleCount(value);
    closeSelect();
  };

  const handleDatePartSelect = (part: DatePart, value: number) => {
    if (openSelect === 'startDate') {
      const nextStartDate = updateDatePart(startDate, part, value, minStartDate, maxTripDate);
      setStartDate(nextStartDate);

      if (endDate < nextStartDate) {
        setEndDate(nextStartDate);
      }
    }

    if (openSelect === 'endDate') {
      setEndDate(updateDatePart(endDate, part, value, startDateParts, maxTripDate));
    }
  };

  const renderDateWheel = (title: string, part: DatePart, options: number[], selectedValue: number, suffix: string) => (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelLabel}>{title}</Text>
      <ScrollView style={styles.wheelList} contentContainerStyle={styles.wheelListContent} showsVerticalScrollIndicator={false}>
        {options.map((item) => {
          const isSelected = item === selectedValue;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={item}
              onPress={() => handleDatePartSelect(part, item)}
              style={[styles.wheelItem, isSelected && styles.selectedWheelItem]}>
              <Text style={[styles.wheelText, isSelected && styles.selectedWheelText]}>
                {item}
                {suffix}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomActionInset,
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>여행 시작하기</Text>
        <View style={styles.topSpacer} />
      </View>

      <View
        style={[
          styles.content,
          {
            paddingTop: contentTopGap,
            paddingBottom: 14,
          },
        ]}>
        <View>
          <Text style={[styles.heading, { fontSize: titleSize }]}>동행자를{`\n`}추가해 주세요</Text>
          <Text style={styles.description}>카톡으로 여행갈 친구들을 모아보세요!</Text>
        </View>

        <View style={[styles.companions, { marginTop: companionsTopGap }]}>
          <Pressable onPress={() => router.push('/trip/invite')} style={styles.companionItem}>
            <View style={[styles.addAvatar, { height: avatarSize, width: avatarSize }]}>
              <Text style={styles.addIcon}>+</Text>
            </View>
            <Text style={styles.mutedLabel}>추가</Text>
          </Pressable>
          {companions.map((item) => (
            <View key={item.label} style={styles.companionItem}>
              <View style={[styles.avatar, { backgroundColor: item.color, height: avatarSize, width: avatarSize }]} />
              <Text style={item.label === '나' ? styles.activeLabel : styles.mutedLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: formTopGap }}>
          <Text style={styles.sectionLabel}>여행 기간</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>시작일</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="시작일 선택"
                onPress={() => setOpenSelect('startDate')}
                style={styles.selectLine}>
                <Text style={[styles.fieldValue, { fontSize: valueSize }]}>{formatDateLabel(startDate)}</Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>종료일</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="종료일 선택"
                onPress={() => setOpenSelect('endDate')}
                style={styles.selectLine}>
                <Text style={[styles.fieldValue, { fontSize: valueSize }]}>{formatDateLabel(endDate)}</Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.noticeRow}>
            <View style={styles.noticeIcon}>
              <Text style={styles.noticeIconText}>!</Text>
            </View>
            <Text style={styles.noticeText}>여행 기간에 맞춰 미션이 부여돼요.</Text>
          </View>

          <View style={{ marginTop: peopleTopGap }}>
            <Text style={styles.fieldLabel}>인원수</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="인원수 선택"
              onPress={() => setOpenSelect('people')}
              style={styles.selectLine}>
              <Text style={[styles.fieldValue, { fontSize: valueSize }]}>{peopleCount}명</Text>
              <Text style={styles.chevron}>⌄</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/trip/active')}
        style={[styles.startButton, { paddingVertical: startButtonPadding }]}>
        <Text style={styles.startButtonText}>여행 시작</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={openSelect !== null} onRequestClose={closeSelect}>
        <Pressable accessibilityLabel="선택 닫기" onPress={closeSelect} style={styles.modalBackdrop}>
          <Pressable style={styles.selectPanel}>
            <View style={styles.selectPanelHeader}>
              <Text style={styles.selectPanelTitle}>{selectTitle}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="선택 닫기" onPress={closeSelect}>
                <Text style={styles.closeButton}>×</Text>
              </Pressable>
            </View>

            {isDateSelectOpen ? (
              <View style={styles.wheelRow}>
                {renderDateWheel('년도', 'year', yearOptions, selectedDateParts.year, '년')}
                {renderDateWheel('월', 'month', monthOptions, selectedDateParts.month, '월')}
                {renderDateWheel('일', 'day', dayOptions, selectedDateParts.day, '일')}
              </View>
            ) : (
              <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
                {peopleOptions.map((item) => {
                  const isSelected = item.value === peopleCount;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={item.value}
                      onPress={() => handlePeopleSelect(item.value)}
                      style={[styles.optionItem, isSelected && styles.selectedOptionItem]}>
                      <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 48,
  },
  backIcon: {
    color: '#202124',
    fontSize: 44,
    lineHeight: 44,
  },
  topTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
  },
  topSpacer: {
    width: 48,
  },
  content: {
    flexGrow: 1,
  },
  heading: {
    color: '#000000',
    fontWeight: '600',
    lineHeight: 30,
  },
  description: {
    color: '#AEAEAE',
    fontSize: 12,
    marginTop: 8,
  },
  companions: {
    flexDirection: 'row',
    gap: 14,
  },
  companionItem: {
    alignItems: 'center',
    gap: 8,
  },
  addAvatar: {
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    borderRadius: 999,
    justifyContent: 'center',
  },
  addIcon: {
    color: '#409CB7',
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 40,
  },
  avatar: {
    borderRadius: 999,
  },
  activeLabel: {
    color: '#409CB7',
    fontSize: 12,
  },
  mutedLabel: {
    color: '#b2b2b2',
    fontSize: 12,
  },
  sectionLabel: {
    color: '#8A9194',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 24,
  },
  dateField: {
    flex: 1,
  },
  fieldLabel: {
    color: '#8A9194',
    fontSize: 12,
    marginBottom: 10,
  },
  selectLine: {
    alignItems: 'center',
    borderBottomColor: '#8A9194',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  fieldValue: {
    color: '#000000',
    fontWeight: '500',
  },
  chevron: {
    color: '#1f1f1f',
    fontSize: 22,
  },
  noticeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  noticeIcon: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  noticeIconText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  noticeText: {
    color: '#409CB7',
    fontSize: 12,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    justifyContent: 'center',
    shadowColor: '#409CB7',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  selectPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  selectPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectPanelTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    color: '#1f1f1f',
    fontSize: 28,
    lineHeight: 30,
  },
  wheelRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  wheelColumn: {
    flex: 1,
  },
  wheelLabel: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  wheelList: {
    maxHeight: 230,
  },
  wheelListContent: {
    gap: 6,
    paddingVertical: 4,
  },
  wheelItem: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  selectedWheelItem: {
    backgroundColor: '#E8F5F8',
  },
  wheelText: {
    color: '#1f1f1f',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedWheelText: {
    color: '#409CB7',
    fontWeight: '700',
  },
  optionList: {
    maxHeight: 330,
  },
  optionListContent: {
    paddingVertical: 4,
  },
  optionItem: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectedOptionItem: {
    backgroundColor: '#E8F5F8',
  },
  optionText: {
    color: '#1f1f1f',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#409CB7',
    fontWeight: '700',
  },
});
