// 일정 생성 화면의 입력 상태, 캘린더 상태, 일정 생성 및 초대 동작을 관리합니다.

import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { shareKakaoInvite } from '@/lib/kakao-share';
import { addMissionToSchedule, createDraftSchedule, getCachedTripSchedules, listTripSchedules, updateDraftSchedule, type TripSchedule } from '@/lib/trip-schedule-api';
import { createKakaoInviteTemplateArgs, type TripInvite } from '@/lib/trip-invite-api';

import {
  addDays,
  compareDateParts,
  formatDateValue,
  getCalendarDays,
  getOccupiedDateValues,
  isDateInRange,
  parseDateValue,
  shiftMonth,
  type CalendarDay,
  type DateParts,
  type TripStep,
} from '../trip-create-data';

type UseTripCreateOptions = {
  pendingMissionId?: string;
  onBack: () => void;
  onCreated: (scheduleId: string, pendingMissionId?: string) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '여행 일정 생성에 실패했습니다.';
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

function getInviteUrl(invite: TripInvite | null) {
  if (!invite) {
    return '';
  }

  return invite.inviteUrl ?? createFallbackInviteUrl(invite.inviteToken);
}

export function useTripCreate({ pendingMissionId, onBack, onCreated }: UseTripCreateOptions) {
  const today = useMemo(() => new Date(), []);
  const minStartDate = useMemo(() => parseDateValue(formatDateValue(today)), [today]);
  const maxTripDate = useMemo(() => parseDateValue(formatDateValue(addDays(today, 179))), [today]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [draftSchedule, setDraftSchedule] = useState<TripSchedule | null>(null);
  const [inviteData] = useState<TripInvite | null>(null);
  const [isCreatingInvite] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [step, setStep] = useState<TripStep>('date');
  const [isSelectingEndDate, setIsSelectingEndDate] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<DateParts>(() => {
    const parts = parseDateValue(formatDateValue(today));

    return { ...parts, day: 1 };
  });
  const [message, setMessage] = useState('');
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [occupiedDateValues, setOccupiedDateValues] = useState<Set<string>>(() => getOccupiedDateValues(getCachedTripSchedules()));

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth, minStartDate, maxTripDate), [calendarMonth, maxTripDate, minStartDate]);
  const canGoPrevMonth = compareDateParts(shiftMonth(calendarMonth, -1), { ...minStartDate, day: 1 }) >= 0;
  const canGoNextMonth = compareDateParts(shiftMonth(calendarMonth, 1), { ...maxTripDate, day: 1 }) <= 0;
  const roomName = scheduleName.trim();
  const canProceedFromDate = Boolean(startDate);
  const canStartTrip = roomName.length > 0;
  const isBottomButtonDisabled = isCreatingSchedule || isCreatingInvite || (step === 'date' ? !canProceedFromDate : !canStartTrip);
  const inviteUrl = getInviteUrl(inviteData);

  useEffect(() => {
    let isActive = true;

    listTripSchedules()
      .then((schedules) => {
        if (isActive) {
          setOccupiedDateValues(getOccupiedDateValues(schedules));
        }
      })
      .catch(() => {
        // 캐시에 저장된 일정 날짜를 그대로 사용한다.
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleScheduleNameChange = (value: string) => {
    setScheduleName(value);
    setMessage('');
  };

  const handleDateSelect = (day: CalendarDay) => {
    if (!day.isSelectable || occupiedDateValues.has(day.dateValue)) {
      return;
    }

    if (!startDate || !isSelectingEndDate || day.dateValue < startDate) {
      setStartDate(day.dateValue);
      setEndDate(day.dateValue);
      setIsSelectingEndDate(true);
    } else {
      const includesOccupiedDate = [...occupiedDateValues].some((dateValue) => isDateInRange(dateValue, startDate, day.dateValue));

      if (includesOccupiedDate) {
        setMessage('이미 등록된 일정과 겹치지 않는 날짜를 선택해 주세요.');
        return;
      }

      setEndDate(day.dateValue);
      setIsSelectingEndDate(false);
    }

    setMessage('');
  };

  const handleDateStepNext = () => {
    if (!startDate) {
      return;
    }

    setStep('people');
    setMessage('');
  };

  const handleBack = () => {
    if (inviteSheetVisible) {
      setInviteSheetVisible(false);
      return;
    }

    if (step === 'people') {
      setMessage('');
      setStep('date');
      return;
    }

    onBack();
  };

  const createOrSyncDraftSchedule = async () => {
    if (!startDate || !endDate) {
      throw new Error('여행 날짜를 선택해 주세요.');
    }

    if (!roomName) {
      throw new Error('일정 이름을 입력해 주세요.');
    }

    const input = {
      endDate,
      peopleCount: '1',
      roomName,
      startDate,
    };

    const schedule = draftSchedule
      ? await updateDraftSchedule({ ...input, scheduleId: draftSchedule.scheduleId })
      : await createDraftSchedule(input);

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
    if (isCreatingSchedule || isCreatingInvite || !canStartTrip) {
      return;
    }

    try {
      Keyboard.dismiss();
      setIsCreatingSchedule(true);
      setMessage('');
      const schedule = await createOrSyncDraftSchedule();

      if (pendingMissionId) {
        await addMissionToSchedule(schedule.scheduleId, pendingMissionId, schedule.startDate ?? startDate);
        onCreated(schedule.scheduleId, pendingMissionId);
        return;
      }

      onCreated(schedule.scheduleId);
    } catch (error) {
      setIsCreatingSchedule(false);
      setMessage(getErrorMessage(error));
    }
  };

  return {
    calendarDays,
    calendarMonth,
    canGoNextMonth,
    canGoPrevMonth,
    closeInviteSheet,
    endDate,
    handleBack,
    handleCopyInviteLink,
    handleDateSelect,
    handleDateStepNext,
    handleNext,
    handleScheduleNameChange,
    handleShareInvite,
    inviteSheetVisible,
    isBottomButtonDisabled,
    isCreatingInvite,
    isCreatingSchedule,
    isSelectingEndDate,
    isSharingInvite,
    message,
    occupiedDateValues,
    setCalendarMonth,
    setScheduleName,
    scheduleName,
    startDate,
    step,
  };
}
