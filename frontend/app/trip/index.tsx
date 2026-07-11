import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { TopBar } from '@/components/top-bar';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { shareKakaoInvite } from '@/lib/kakao-share';
import { createDraftSchedule, type TripSchedule } from '@/lib/trip-schedule-api';
import { createKakaoInviteTemplateArgs, createTripInvite, type TripInvite } from '@/lib/trip-invite-api';

type TripStep = 'date' | 'people';

type DateParts = {
  day: number;
  month: number;
  year: number;
};

type CalendarDay = DateParts & {
  dateValue: string;
  isCurrentMonth: boolean;
  isSelectable: boolean;
};

const peopleOptions = Array.from({ length: 10 }, (_, index) => {
  const value = String(index + 1);

  return {
    label: `${value}명`,
    value,
  };
});

const kakaoTalk = require('../../assets/svg/kakaotalk.svg');

const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '여행 일정 생성에 실패했습니다.';
}

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
};

const compareDateParts = (left: DateParts, right: DateParts) => createDateValue(left).localeCompare(createDateValue(right));

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();


const shiftMonth = (parts: DateParts, offset: number): DateParts => {
  const date = new Date(parts.year, parts.month - 1 + offset, 1);

  return { day: 1, month: date.getMonth() + 1, year: date.getFullYear() };
};

const getCalendarDays = (monthParts: DateParts, minDate: DateParts, maxDate: DateParts) => {
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

const isDateInRange = (value: string, startDate: string, endDate: string) => value >= startDate && value <= endDate;

const createFallbackInviteUrl = (inviteToken: string) => {
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
};

const getInviteUrl = (invite: TripInvite | null) => {
  if (!invite) {
    return '';
  }

  return invite.inviteUrl ?? createFallbackInviteUrl(invite.inviteToken);
};

export default function TripCreateScreen() {
  const {
    bottomActionInset,
    horizontalPadding,
    isCompactWidth,
    isTallScreen,
    topInset,
  } = useResponsiveLayout();
  const contentTopGap = isTallScreen ? 36 : 22;
  const nextButtonPadding = isTallScreen ? 18 : 15;
  const bottomButtonInset = Math.max(bottomActionInset - 8, 0);
  const nextButtonOffset = 22;
  const titleSize = isCompactWidth ? 21 : 23;
  const today = useMemo(() => new Date(), []);
  const minStartDate = useMemo(() => parseDateValue(formatDateValue(today)), [today]);
  const maxTripDate = useMemo(() => parseDateValue(formatDateValue(addDays(today, 179))), [today]);
  const [startDate, setStartDate] = useState(formatDateValue(today));
  const [endDate, setEndDate] = useState(formatDateValue(addDays(today, 6)));
  const [peopleCount, setPeopleCount] = useState('4');
  const [scheduleName, setScheduleName] = useState('우정여행');
  const [isPeoplePickerOpen, setIsPeoplePickerOpen] = useState(false);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [draftSchedule, setDraftSchedule] = useState<TripSchedule | null>(null);
  const [inviteData, setInviteData] = useState<TripInvite | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [step, setStep] = useState<TripStep>('date');
  const [isSelectingEndDate, setIsSelectingEndDate] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<DateParts>(() => {
    const parts = parseDateValue(formatDateValue(today));

    return { ...parts, day: 1 };
  });
  const [message, setMessage] = useState('');
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth, minStartDate, maxTripDate), [calendarMonth, maxTripDate, minStartDate]);
  const canGoPrevMonth = compareDateParts(shiftMonth(calendarMonth, -1), { ...minStartDate, day: 1 }) >= 0;
  const canGoNextMonth = compareDateParts(shiftMonth(calendarMonth, 1), { ...maxTripDate, day: 1 }) <= 0;
  const roomName = scheduleName.trim() || `B-Cut ${formatDateLabel(startDate)} 여행`;
  const inviteUrl = getInviteUrl(inviteData);

  const handleDateSelect = (day: CalendarDay) => {
    if (!day.isSelectable) {
      return;
    }

    if (!isSelectingEndDate || day.dateValue < startDate) {
      setStartDate(day.dateValue);
      setEndDate(day.dateValue);
      setIsSelectingEndDate(true);
    } else {
      setEndDate(day.dateValue);
      setIsSelectingEndDate(false);
    }

    setMessage('');
  };

  const handleDateStepNext = () => {
    setStep('people');
    setMessage('');
  };

  const handleBack = () => {
    if (inviteSheetVisible) {
      setInviteSheetVisible(false);
      return;
    }

    if (isPeoplePickerOpen) {
      setIsPeoplePickerOpen(false);
      return;
    }

    if (step === 'people') {
      setStep('date');
      return;
    }

    router.back();
  };

  const createOrGetDraftSchedule = async () => {
    if (draftSchedule) {
      return draftSchedule;
    }

    const schedule = await createDraftSchedule({
      endDate,
      peopleCount,
      roomName,
      startDate,
    });

    setDraftSchedule(schedule);

    return schedule;
  };

  const closeInviteSheet = () => {
    if (isSharingInvite) {
      return;
    }

    setInviteSheetVisible(false);
    setMessage('');
  };

  const handleCreateInvite = async () => {
    if (isCreatingInvite || isCreatingSchedule) {
      return;
    }

    try {
      setIsCreatingInvite(true);
      setMessage('');
      const schedule = await createOrGetDraftSchedule();
      const nextInvite = await createTripInvite({ roomName: schedule.roomName, scheduleId: schedule.scheduleId });
      setInviteData(nextInvite);
      setInviteSheetVisible(true);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteData || !inviteUrl || isSharingInvite) {
      return;
    }

    const templateArgs = createKakaoInviteTemplateArgs({ ...inviteData, inviteUrl });

    try {
      setIsSharingInvite(true);
      setMessage('');
      await shareKakaoInvite(templateArgs);
      setInviteSheetVisible(false);
      setMessage('카카오톡 초대장을 열었어요.');
    } catch (error) {
      setMessage(`카카오 초대 실패: ${getErrorMessage(error)}`);
    } finally {
      setIsSharingInvite(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return;
    }

    await Clipboard.setStringAsync(inviteUrl);
    setMessage('초대 링크를 복사했어요.');
  };

  const handleNext = async () => {
    if (isCreatingSchedule || isCreatingInvite) {
      return;
    }

    try {
      Keyboard.dismiss();
      setIsCreatingSchedule(true);
      setMessage('');
      await createOrGetDraftSchedule();

      router.replace('/trip/hub');
    } catch (error) {
      setIsCreatingSchedule(false);
      setMessage(getErrorMessage(error));
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomButtonInset,
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <TopBar title="여행 시작하기" onBack={handleBack} />

      <View
        style={[
          styles.content,
          {
            paddingTop: contentTopGap,
            paddingBottom: 14,
          },
        ]}>
        {step === 'date' ? (
          <>
            <View>
              <Text style={styles.stepText}>1/2</Text>
              <Text style={[styles.heading, { fontSize: titleSize }]}>여행 기간을 알려주세요</Text>
              <Text style={styles.description}>여행 기간에 맞춰 미션이 부여돼요.</Text>
            </View>

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
                    onPress={() => setCalendarMonth((current) => shiftMonth(current, -1))}
                    style={styles.monthButton}>
                    <Text style={[styles.monthButtonText, !canGoPrevMonth && styles.disabledMonthButtonText]}>‹</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="다음 달"
                    disabled={!canGoNextMonth}
                    onPress={() => setCalendarMonth((current) => shiftMonth(current, 1))}
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
                {calendarDays.map((day, index) => {
                  const isSelected = isDateInRange(day.dateValue, startDate, endDate);
                  const isStart = day.dateValue === startDate;
                  const isEnd = day.dateValue === endDate;
                  const isSegmentStart = isSelected && isStart;
                  const isSegmentEnd = isSelected && isEnd;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !day.isSelectable, selected: isSelected }}
                      disabled={!day.isSelectable}
                      key={day.dateValue}
                      onPress={() => handleDateSelect(day)}
                      style={styles.dayCell}>
                      {isSelected ? (
                        <View
                          style={[
                            styles.rangeFill,
                            isSegmentStart && styles.rangeStart,
                            isSegmentEnd && styles.rangeEnd,
                          ]}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.dayText,
                          !day.isCurrentMonth && styles.outsideMonthText,
                          !day.isSelectable && styles.disabledDayText,
                          isSelected && styles.selectedDayText,
                        ]}>
                        {day.day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <>
            <View>
              <Text style={styles.stepText}>2/2</Text>
              <Text style={[styles.heading, { fontSize: titleSize }]}>어떤 여행인가요?</Text>
              <Text style={styles.description}>카카오톡으로 친구를 추가할 수 있어요</Text>
            </View>

            <View style={styles.tripSetupSection}>
              <View style={styles.inviteRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="친구 추가"
                  disabled={isCreatingInvite || isCreatingSchedule}
                  onPress={handleCreateInvite}
                  style={styles.invitePerson}>
                  <View style={[styles.addCircle, (isCreatingInvite || isCreatingSchedule) && styles.disabledButton]}>
                    {isCreatingInvite ? <ActivityIndicator color="#409CB7" /> : <Text style={styles.addIcon}>+</Text>}
                  </View>
                  <Text style={styles.inviteLabel}>추가</Text>
                </Pressable>

                <View style={styles.invitePerson}>
                  <View style={[styles.avatarCircle, styles.myAvatar]}>
                    <Text style={styles.avatarInitial}>나</Text>
                  </View>
                  <Text style={[styles.inviteLabel, styles.myInviteLabel]}>나</Text>
                </View>

                <View style={styles.invitePerson}>
                  <View style={[styles.avatarCircle, styles.friendAvatar]}>
                    <Text style={styles.avatarInitial}>친</Text>
                  </View>
                  <Text style={styles.inviteLabel}>친구</Text>
                </View>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.formLabel}>일정 이름</Text>
                <View style={styles.inputLine}>
                  <TextInput
                    accessibilityLabel="일정 이름"
                    onChangeText={setScheduleName}
                    placeholder="일정 이름"
                    placeholderTextColor="#A3AAAE"
                    style={styles.scheduleInput}
                    value={scheduleName}
                  />
                  {scheduleName ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="일정 이름 지우기" onPress={() => setScheduleName('')} style={styles.clearButton}>
                      <Text style={styles.clearButtonText}>×</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.formLabel}>인원수</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="인원수 선택"
                  onPress={() => setIsPeoplePickerOpen(true)}
                  style={styles.peopleSelectLine}>
                  <Text style={styles.peopleSelectText}>{peopleCount}명</Text>
                  <Text style={styles.peopleSelectChevron}>⌄</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>

      <Pressable
        disabled={isCreatingSchedule}
        onPress={step === 'date' ? handleDateStepNext : handleNext}
        style={[
          styles.nextButton,
          { paddingVertical: nextButtonPadding, transform: [{ translateY: nextButtonOffset }] },
          step === 'people' && styles.startTripButton,
          isCreatingSchedule && styles.disabledButton,
        ]}>
        {isCreatingSchedule ? <ActivityIndicator color="#ffffff" /> : <Text style={[styles.nextButtonText, step === 'people' && styles.startTripButtonText]}>{step === 'date' ? '다음' : '여행 시작'}</Text>}
      </Pressable>

      <Modal animationType="fade" transparent visible={isPeoplePickerOpen} onRequestClose={() => setIsPeoplePickerOpen(false)}>
        <Pressable accessibilityLabel="인원수 선택 닫기" onPress={() => setIsPeoplePickerOpen(false)} style={styles.modalBackdrop}>
          <Pressable style={styles.peoplePanel}>
            <Text style={styles.peoplePanelTitle}>인원수</Text>
            {peopleOptions.map((item) => {
              const isSelected = item.value === peopleCount;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={item.value}
                  onPress={() => {
                    setPeopleCount(item.value);
                    setIsPeoplePickerOpen(false);
                  }}
                  style={[styles.peoplePanelItem, isSelected && styles.selectedPeoplePanelItem]}>
                  <Text style={[styles.peoplePanelText, isSelected && styles.selectedPeoplePanelText]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={inviteSheetVisible} onRequestClose={closeInviteSheet}>
        <Pressable accessibilityLabel="초대 닫기" onPress={closeInviteSheet} style={styles.inviteModalBackdrop}>
          <Pressable style={styles.invitePanel}>
            <Text style={styles.invitePanelTitle}>동행자 추가하기</Text>
            <View style={styles.inviteTopDivider} />

            <View style={styles.inviteOptionsRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="카카오톡으로 초대하기" onPress={handleShareInvite} style={styles.inviteOption}>
                <View style={[styles.kakaoInviteAvatar, isSharingInvite && styles.disabledButton]}>
                  {isSharingInvite ? <ActivityIndicator color="#3A2D00" /> : <Image source={kakaoTalk} style={styles.kakaoInviteIcon} contentFit="contain" />}
                </View>
                <Text style={styles.inviteOptionText}>카카오톡</Text>
              </Pressable>

              {[
                { label: '연진이', color: '#E9EDF0' },
                { label: '김민지', color: '#E9EDF0' },
              ].map((item) => (
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}에게 카카오톡 초대하기`} key={item.label} onPress={handleShareInvite} style={styles.inviteOption}>
                  <View style={[styles.inviteContactAvatar, { backgroundColor: item.color }]}>
                    <View style={styles.contactKakaoBadge}>
                      <Image source={kakaoTalk} style={styles.contactKakaoIcon} contentFit="contain" />
                    </View>
                  </View>
                  <Text style={styles.inviteOptionText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inviteMiddleDivider} />

            <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 복사하기" onPress={handleCopyInviteLink} style={styles.copyInviteButton}>
              <Text style={styles.copyInviteText}>링크 복사하기</Text>
              <View style={styles.copyIcon}>
                <View style={styles.copyIconBack} />
                <View style={styles.copyIconFront} />
              </View>
            </Pressable>
            {message ? <Text style={styles.inviteMessageText}>{message}</Text> : null}
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

  content: {
    flex: 1,
  },
  stepText: {
    color: '#409CB7',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  heading: {
    color: '#10161F',
    fontWeight: '600',
    lineHeight: 30,
  },
  description: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 2,
  },
  calendarSection: {
    marginTop: 38,
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
    gap: 16,
  },
  monthButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  monthButtonText: {
    color: '#10161F',
    fontSize: 38,
    lineHeight: 28,
  },
  disabledMonthButtonText: {
    color: '#DDE3E6',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: 24,
  },
  weekdayText: {
    color: '#10161F',
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
    minHeight: 264,
  },
  dayCell: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: '14.285714%',
  },
  rangeFill: {
    backgroundColor: '#B3E3F1',
    bottom: 3,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 3,
  },
  rangeStart: {
    borderBottomLeftRadius: 999,
    borderTopLeftRadius: 999,
  },
  rangeEnd: {
    borderBottomRightRadius: 999,
    borderTopRightRadius: 999,
  },
  dayText: {
    color: '#8A9194',
    fontSize: 14,
    fontWeight: '400',
    zIndex: 1,
  },
  outsideMonthText: {
    color: '#DCE3E6',
  },
  disabledDayText: {
    color: '#DCE3E6',
  },
  selectedDayText: {
    color: '#10161F',
    fontWeight: '500',
  },
  tripSetupSection: {
    marginTop: 58,
  },
  inviteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  invitePerson: {
    alignItems: 'center',
    width: 56,
  },
  addCircle: {
    alignItems: 'center',
    backgroundColor: '#E7ECEE',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  addIcon: {
    color: '#409CB7',
    fontSize: 27,
    fontWeight: '300',
    lineHeight: 38,
  },
  avatarCircle: {
    alignItems: 'center',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  myAvatar: {
    backgroundColor: '#E6EEF0',
  },
  friendAvatar: {
    backgroundColor: '#BFD9EF',
  },
  avatarInitial: {
    color: '#10161F',
    fontSize: 12,
    fontWeight: '700',
  },
  inviteLabel: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  myInviteLabel: {
    color: '#409CB7',
  },
  formBlock: {
    marginTop: 38,
  },
  formLabel: {
    color: '#8A9194',
    fontSize: 12,
    marginBottom: 4,
  },
  inputLine: {
    alignItems: 'center',
    borderBottomColor: '#D6D6D6',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 42,
  },
  scheduleInput: {
    color: '#8A9194',
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    padding: 0,
  },
  clearButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  clearButtonText: {
    color: '#CECECE',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 42,
  },
  peopleSelectLine: {
    alignItems: 'center',
    borderBottomColor: '#D6D6D6',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
  },
  peopleSelectText: {
    color: '#10161F',
    fontSize: 24,
    fontWeight: '500',
  },
  peopleSelectChevron: {
    color: '#10161F',
    fontSize: 28,
    lineHeight: 30,
  },
  messageText: {
    color: '#D06958',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    textAlign: 'center',
  },
  nextButton: {
    alignItems: 'center',
    backgroundColor: '#6EA4BF',
    borderRadius: 999,
    justifyContent: 'center',
    shadowColor: '#6EA4BF',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  disabledButton: {
    opacity: 0.65,
  },
  startTripButton: {
    backgroundColor: '#D6EAF5',
    shadowOpacity: 0,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  startTripButtonText: {
    color: '#6EA4BF',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  peoplePanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  peoplePanelTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  inviteModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 63,
    paddingHorizontal: 18,
  },
  invitePanel: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    overflow: 'hidden',
    paddingBottom: 24,
    paddingTop: 28,
    width: '100%',
  },
  invitePanelTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: 32,
  },
  inviteTopDivider: {
    backgroundColor: '#E8ECEF',
    height: 1,
    marginTop: 22,
  },
  inviteMiddleDivider: {
    backgroundColor: '#E8ECEF',
    height: 1,
  },
  inviteOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
    paddingHorizontal: 32,
    paddingTop: 14,
  },
  inviteOption: {
    alignItems: 'center',
    gap: 7,
    width: 66,
  },
  kakaoInviteAvatar: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  kakaoInviteIcon: {
    height: 25,
    width: 25,
  },
  inviteContactAvatar: {
    borderRadius: 999,
    height: 56,
    position: 'relative',
    width: 56,
  },
  contactKakaoBadge: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 4,
    height: 23,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 23,
  },
  contactKakaoIcon: {
    height: 14,
    width: 14,
  },
  inviteOptionText: {
    color: '#54676F',
    fontSize: 12,
    fontWeight: '400',
  },
  copyInviteButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E9EDF0',
    borderRadius: 16,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 34,
    width: '81%',
  },
  copyInviteText: {
    color: '#54676F',
    fontSize: 12,
    fontWeight: '400',
  },
  copyIcon: {
    height: 25,
    position: 'relative',
    width: 25,
  },
  copyIconBack: {
    borderColor: '#54676F',
    borderRadius: 2,
    borderWidth: 2,
    height: 20,
    left: 4,
    position: 'absolute',
    top: 5,
    width: 16,
  },
  copyIconFront: {
    backgroundColor: '#E9EDF0',
    borderColor: '#54676F',
    borderRadius: 2,
    borderWidth: 2,
    height: 20,
    left: 10,
    position: 'absolute',
    top: 0,
    width: 16,
  },
  inviteMessageText: {
    color: '#409CB7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    paddingHorizontal: 32,
  },
  peoplePanelItem: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectedPeoplePanelItem: {
    backgroundColor: '#E8F5F8',
  },
  peoplePanelText: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedPeoplePanelText: {
    color: '#409CB7',
    fontWeight: '700',
  },
});
