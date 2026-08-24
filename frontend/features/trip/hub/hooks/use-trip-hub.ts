import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { getAuthItem } from '@/lib/auth-storage';
import { deleteTripSchedule, getCachedTripSchedules, listTripSchedules, updateTripScheduleOrder, type TripSchedule } from '@/lib/trip-schedule-api';
import {
  CARD_SHIFT_DISTANCE,
  getDragIndexOffset,
  getPinnedScheduleCount,
  isClosedSchedule,
  isCreatorSchedule as checkCreatorSchedule,
  isInProgressSchedule,
  moveScheduleItem,
  pinInProgressSchedules,
} from '@/features/trip/hub/trip-hub-data';

type UseTripHubOptions = {
  language: string;
};

// 일정 목록 조회·삭제·편집 모드와 드래그 순서 저장을 담당합니다.
export function useTripHub({ language }: UseTripHubOptions) {
  const currentUserId = getAuthItem('user_id');
  const [schedules, setSchedules] = useState<TripSchedule[]>(() => pinInProgressSchedules(getCachedTripSchedules()));
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ dragY: number; scheduleId: string } | null>(null);
  const [message, setMessage] = useState('');
  const schedulesRef = useRef(schedules);
  const isSavingOrderRef = useRef(isSavingOrder);

  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  useEffect(() => {
    isSavingOrderRef.current = isSavingOrder;
  }, [isSavingOrder]);

  const refreshSchedules = useCallback(() => {
    let isActive = true;

    const cachedSchedules = getCachedTripSchedules();
    if (cachedSchedules.length > 0) {
      setSchedules(pinInProgressSchedules(cachedSchedules));
    }
    setIsLoading(true);
    setMessage('');

    listTripSchedules()
      .then((nextSchedules) => {
        if (isActive) {
          setSchedules(pinInProgressSchedules(nextSchedules));
        }
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const fallbackSchedules = getCachedTripSchedules();
        setSchedules(pinInProgressSchedules(fallbackSchedules));
        setMessage(fallbackSchedules.length === 0 ? (error instanceof Error ? error.message : '여행 일정을 불러오지 못했어요.') : '');
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
    // 언어가 바뀌면 현지화된 일정 필드를 다시 조회한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useFocusEffect(refreshSchedules);

  const deleteSchedule = async (schedule: TripSchedule) => {
    if (!schedule.permissions.canDeleteSchedule || isClosedSchedule(schedule)) {
      setMessage('종료된 일정은 삭제할 수 없습니다.');
      return;
    }

    if (deletingScheduleId) {
      return;
    }

    try {
      setDeletingScheduleId(schedule.scheduleId);
      setMessage('');
      await deleteTripSchedule(schedule.scheduleId);
      setSchedules((currentSchedules) => currentSchedules.filter((item) => item.scheduleId !== schedule.scheduleId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '여행 일정 삭제에 실패했어요.');
    } finally {
      setDeletingScheduleId(null);
    }
  };

  const confirmDeleteSchedule = (schedule: TripSchedule) => {
    if (!schedule.permissions.canDeleteSchedule || isClosedSchedule(schedule)) {
      setMessage('종료된 일정은 삭제할 수 없습니다.');
      return;
    }

    Alert.alert('일정 삭제', `${schedule.roomName} 일정을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', onPress: () => void deleteSchedule(schedule), style: 'destructive' },
    ]);
  };

  const handleDragEnd = async (scheduleId: string, dragY: number) => {
    const offset = getDragIndexOffset(dragY);
    setActiveDrag(null);

    if (offset === 0 || isSavingOrderRef.current) {
      return;
    }

    const previousSchedules = schedulesRef.current;
    const nextSchedules = moveScheduleItem(previousSchedules, scheduleId, offset, getPinnedScheduleCount(previousSchedules));

    if (nextSchedules === previousSchedules) {
      return;
    }

    schedulesRef.current = nextSchedules;
    setSchedules(nextSchedules);
    isSavingOrderRef.current = true;
    setIsSavingOrder(true);
    setMessage('');

    try {
      const savedSchedules = await updateTripScheduleOrder(nextSchedules.map((scheduleItem) => scheduleItem.scheduleId));
      schedulesRef.current = savedSchedules;
      setSchedules(pinInProgressSchedules(savedSchedules));
    } catch (error) {
      schedulesRef.current = previousSchedules;
      setSchedules(previousSchedules);
      setMessage(error instanceof Error ? error.message : '여행 목록 순서 저장에 실패했어요.');
    } finally {
      isSavingOrderRef.current = false;
      setIsSavingOrder(false);
    }
  };

  const handleDragMove = (scheduleId: string, dragY: number) => {
    setActiveDrag({ dragY, scheduleId });
  };

  const getSchedulePreviewOffset = (scheduleId: string, index: number) => {
    if (!activeDrag || activeDrag.scheduleId === scheduleId) {
      return 0;
    }

    const activeIndex = schedules.findIndex((schedule) => schedule.scheduleId === activeDrag.scheduleId);
    if (activeIndex < 0) {
      return 0;
    }

    const targetIndex = Math.max(getPinnedScheduleCount(schedules), Math.min(schedules.length - 1, activeIndex + getDragIndexOffset(activeDrag.dragY)));

    if (activeIndex < targetIndex && index > activeIndex && index <= targetIndex) {
      return -CARD_SHIFT_DISTANCE;
    }

    if (activeIndex > targetIndex && index >= targetIndex && index < activeIndex) {
      return CARD_SHIFT_DISTANCE;
    }

    return 0;
  };

  return {
    activeDrag,
    confirmDeleteSchedule,
    deletingScheduleId,
    getSchedulePreviewOffset,
    handleDragEnd,
    handleDragMove,
    isCreatorSchedule: (schedule: TripSchedule) => checkCreatorSchedule(schedule, currentUserId),
    isEditing,
    isInProgressSchedule,
    isLoading,
    isSavingOrder,
    message,
    schedules,
    setActiveDrag,
    setIsEditing,
  };
}
