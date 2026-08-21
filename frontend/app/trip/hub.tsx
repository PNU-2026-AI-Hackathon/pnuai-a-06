import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import { deleteTripSchedule, getCachedTripSchedules, listTripSchedules, updateTripScheduleOrder, type TripSchedule } from '@/lib/trip-schedule-api';
import { ScheduleCard } from '@/features/trip/hub/components/schedule-card';
import { styles } from '@/features/trip/hub/trip-hub-styles';
import {
  CARD_DRAG_STEP,
  CARD_SHIFT_DISTANCE,
  getPinnedScheduleCount,
  isClosedSchedule,
  isInProgressSchedule,
  moveScheduleItem,
  pinInProgressSchedules,
} from '@/features/trip/hub/trip-hub-data';

const birdIcon = require('@/assets/svg/active/3d_bird.svg');
function isCreatorSchedule(schedule: TripSchedule) {
  const currentUserId = getAuthItem('user_id');

  if (currentUserId && schedule.creatorId) {
    return currentUserId === schedule.creatorId;
  }

  return schedule.permissions.canDeleteSchedule;
}

export default function TripHubScreen() {
  const { bottomActionInset, horizontalPadding, topInset } = useResponsiveLayout();
  const { language } = useLanguage();
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
        if (!isActive) {
          return;
        }

        setSchedules(pinInProgressSchedules(nextSchedules));
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const cachedSchedules = getCachedTripSchedules();
        setSchedules(pinInProgressSchedules(cachedSchedules));
        setMessage(cachedSchedules.length === 0 ? (error instanceof Error ? error.message : '여행 일정을 불러오지 못했어요.') : '');
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
    // Re-fetch localized schedule fields whenever the app language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useFocusEffect(refreshSchedules);

  const openSchedule = (schedule: TripSchedule) => {
    if (isClosedSchedule(schedule)) {
      router.push({
        pathname: '/trip/result',
        params: { scheduleId: schedule.scheduleId, returnTo: 'hub' },
      });
      return;
    }

    router.push({
      pathname: '/trip/active',
      params: { scheduleId: schedule.scheduleId },
    });
  };

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
      { text: '삭제', onPress: () => deleteSchedule(schedule), style: 'destructive' },
    ]);
  };

  const getDragIndexOffset = (dragY: number) => {
    const roundedOffset = Math.round(dragY / CARD_DRAG_STEP);
    return roundedOffset === 0 && Math.abs(dragY) > 28 ? Math.sign(dragY) : roundedOffset;
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
      const savedSchedules = await updateTripScheduleOrder(nextSchedules.map((schedule) => schedule.scheduleId));
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

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding, paddingTop: topInset }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>일정 관리</Text>
        <View style={styles.topSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomActionInset + 28 }]} keyboardShouldPersistTaps="handled" removeClippedSubviews={false} scrollEnabled={!isEditing} showsVerticalScrollIndicator={false} style={styles.scrollArea}>
        <View style={styles.createCard}>
          <View style={styles.createTopRow}>
            <Image source={birdIcon} style={styles.birdIcon} contentFit="contain" />
            <View style={styles.createCopy}>
              <Text style={styles.createTitle}>여행을 떠나볼까요?</Text>
              <Text style={styles.createSubtitle}>여행 날짜와 동행자를 설정해요</Text>
            </View>
          </View>
          <ScalePressable accessibilityRole="button" onPress={() => router.push('/trip')} pressedScale={0.98} style={styles.createButton}>
            <Text style={styles.createButtonText}>새 일정 만들기</Text>
          </ScalePressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>여행 목록</Text>
          <View style={styles.sectionActions}>
            {isLoading || isSavingOrder ? <ActivityIndicator color="#6EA4BF" /> : null}
            <Pressable accessibilityLabel={isEditing ? '여행 목록 편집 완료' : '여행 목록 편집'} onPress={() => { setActiveDrag(null); setIsEditing((value) => !value); }} style={styles.moreButton}>
              <Text style={[styles.moreIcon, isEditing && styles.doneText]}>{isEditing ? '완료' : '•••'}</Text>
            </Pressable>
          </View>
        </View>

        {schedules.length > 0 ? (
          <View style={styles.scheduleList}>
            {schedules.map((schedule, index) => (
              <ScheduleCard
                deletingScheduleId={deletingScheduleId}
                dragPreviewOffset={getSchedulePreviewOffset(schedule.scheduleId, index)}
                isCreator={isCreatorSchedule(schedule)}
                isDragging={activeDrag?.scheduleId === schedule.scheduleId}
                isEditing={isEditing}
                isPinned={isInProgressSchedule(schedule)}
                key={schedule.scheduleId}
                onDelete={confirmDeleteSchedule}
                onDragCancel={() => setActiveDrag(null)}
                onDragEnd={handleDragEnd}
                onDragMove={handleDragMove}
                onDragStart={(scheduleId) => setActiveDrag({ dragY: 0, scheduleId })}
                onOpen={openSchedule}
                schedule={schedule}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>아직 만든 일정이 없어요</Text>
            <Text style={styles.emptyDescription}>새 일정 만들기로 여행을 시작해보세요.</Text>
          </View>
        )}

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </ScrollView>
    </View>
  );
}
