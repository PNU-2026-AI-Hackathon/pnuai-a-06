import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import { deleteTripSchedule, getCachedTripSchedules, listTripSchedules, updateTripScheduleOrder, type TripSchedule } from '@/lib/trip-schedule-api';

const birdIcon = require('../../assets/svg/active/3d_bird.svg');
const crownIcon = require('../../assets/svg/active/crown.svg');
const galleryIcon = require('../../assets/svg/active/gallery.svg');
const CARD_DRAG_STEP = 82;
const CARD_SHIFT_DISTANCE = 100;

function getDateKey(date: string | undefined) {
  if (!date) {
    return null;
  }

  const match = date.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function isClosedSchedule(schedule: TripSchedule) {
  const lastDate = getDateKey(schedule.endDate ?? schedule.startDate);
  if (!lastDate) {
    return false;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return lastDate < todayKey;
}

function isInProgressSchedule(schedule: TripSchedule) {
  const startDate = getDateKey(schedule.startDate);
  const endDate = getDateKey(schedule.endDate ?? schedule.startDate);
  if (!startDate || !endDate) {
    return false;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return startDate <= todayKey && todayKey <= endDate;
}

function pinInProgressSchedules(items: TripSchedule[]) {
  return [...items.filter(isInProgressSchedule), ...items.filter((item) => !isInProgressSchedule(item))];
}

function getPinnedScheduleCount(items: TripSchedule[]) {
  return items.filter(isInProgressSchedule).length;
}

function formatDateRange(schedule: TripSchedule) {
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

function isCreatorSchedule(schedule: TripSchedule) {
  const currentUserId = getAuthItem('user_id');

  if (currentUserId && schedule.creatorId) {
    return currentUserId === schedule.creatorId;
  }

  return schedule.permissions.canDeleteSchedule;
}

function moveScheduleItem(items: TripSchedule[], scheduleId: string, offset: number, pinnedScheduleCount: number) {
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

type ScheduleCardProps = {
  deletingScheduleId: string | null;
  isEditing: boolean;
  isPinned: boolean;
  dragPreviewOffset: number;
  isDragging: boolean;
  onDelete: (schedule: TripSchedule) => void;
  onDragCancel: () => void;
  onDragEnd: (scheduleId: string, dragY: number) => void;
  onDragMove: (scheduleId: string, dragY: number) => void;
  onDragStart: (scheduleId: string) => void;
  onOpen: (schedule: TripSchedule) => void;
  schedule: TripSchedule;
};

function ScheduleCard({ dragPreviewOffset, isDragging, deletingScheduleId, isEditing, isPinned, onDelete, onDragCancel, onDragEnd, onDragMove, onDragStart, onOpen, schedule }: ScheduleCardProps) {
  const dragY = useRef(new Animated.Value(0)).current;
  const previewY = useRef(new Animated.Value(0)).current;
  const isDeleting = deletingScheduleId === schedule.scheduleId;
  const canDelete = schedule.permissions.canDeleteSchedule && !isClosedSchedule(schedule);
  const isCreator = isCreatorSchedule(schedule);
  const isClosed = isClosedSchedule(schedule);
  const isEditingRef = useRef(isEditing);
  const isPinnedRef = useRef(isPinned);
  isEditingRef.current = isEditing;
  isPinnedRef.current = isPinned;
  useEffect(() => {
    previewY.setValue(dragPreviewOffset);
  }, [dragPreviewOffset, previewY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isEditingRef.current && !isPinnedRef.current,
      onStartShouldSetPanResponderCapture: () => isEditingRef.current && !isPinnedRef.current,
      onMoveShouldSetPanResponder: (_, gestureState) => isEditingRef.current && !isPinnedRef.current && Math.abs(gestureState.dy) > 2 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponderCapture: (_, gestureState) => isEditingRef.current && !isPinnedRef.current && Math.abs(gestureState.dy) > 2 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderGrant: () => {
        dragY.setValue(0);
        onDragStart(schedule.scheduleId);
      },
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(gestureState.dy);
        onDragMove(schedule.scheduleId, gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        dragY.setValue(0);
        onDragEnd(schedule.scheduleId, gestureState.dy);
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        onDragCancel();
      },
    })
  ).current;

  const cardContent = (
    <>
      <View style={styles.scheduleBody}>
        <View style={styles.scheduleThumb}>
          <Text style={styles.scheduleThumbText}>{schedule.roomName.slice(0, 1)}</Text>
        </View>
        <View style={styles.scheduleInfo}>
          <View style={styles.scheduleTitleRow}>
            <Text numberOfLines={1} style={styles.scheduleTitle}>{schedule.roomName}</Text>
            {isCreator ? <Image source={crownIcon} style={styles.crownBadge} contentFit="contain" /> : null}
          </View>
          <Text numberOfLines={1} style={styles.scheduleDate}>{formatDateRange(schedule)}</Text>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.editActions}>
          {canDelete ? (
            <Pressable accessibilityLabel={`${schedule.roomName} 삭제`} disabled={isDeleting} onPress={() => onDelete(schedule)} style={styles.deletePill}>
              {isDeleting ? <ActivityIndicator color="#D06958" /> : <Text style={styles.deletePillText}>삭제</Text>}
            </Pressable>
          ) : null}
          {isPinned ? <Text style={styles.pinnedLabel}>진행 중</Text> : (
            <View style={styles.dragHandleBox} {...panResponder.panHandlers}>
              <Text style={styles.dragHandle}>≡</Text>
            </View>
          )}
        </View>
      ) : (
        isClosed ? <Image accessibilityLabel="결과 보기" source={galleryIcon} style={styles.galleryIcon} contentFit="contain" /> : <Text style={styles.chevron}>›</Text>
      )}
    </>
  );

  return (
    <Animated.View style={[styles.scheduleCardWrap, isDragging && styles.draggingScheduleCardWrap, { transform: [{ translateY: Animated.add(dragY, previewY) }] }]}>
      {isEditing ? (
        <View style={[styles.scheduleCard, isCreator && styles.creatorScheduleCard, isClosed && styles.closedScheduleCard, styles.editingScheduleCard]}>
          {cardContent}
        </View>
      ) : (
        <ScalePressable accessibilityRole="button" accessibilityLabel={isClosed ? `${schedule.roomName} 결과 보기` : `${schedule.roomName} 일정 열기`} onPress={() => onOpen(schedule)} pressedScale={0.985} style={[styles.scheduleCard, isCreator && styles.creatorScheduleCard, isClosed && styles.closedScheduleCard]}>
          {cardContent}
        </ScalePressable>
      )}
    </Animated.View>
  );
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingTop: 34,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'flex-start',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  backIcon: {
    color: '#10161F',
    fontSize: 42,
    lineHeight: 42,
  },
  topTitle: {
    color: '#10161F',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  topSpacer: {
    width: 48,
  },
  createCard: {
    backgroundColor: '#E9F8FF',
    borderRadius: 32,
    minHeight: 174,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  createTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    marginBottom: 18,
  },
  birdIcon: {
    height: 88,
    width: 88,
  },
  createCopy: {
    flex: 1,
    minWidth: 0,
  },
  createTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18,
  },
  createSubtitle: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 10,
  },
  createButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 48,
    minHeight: 34,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 30,
  },
  sectionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  moreButton: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 30,
    justifyContent: 'center',
    minWidth: 26,
    paddingTop: 0,
  },
  moreIcon: {
    color: '#8A9194',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 13,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  doneText: {
    color: '#6EA4BF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  scheduleList: {
    gap: 12,
    marginTop: 18,
  },
  scheduleCardWrap: {
    position: 'relative',
    zIndex: 1,
  },
  draggingScheduleCardWrap: {
    elevation: 8,
    zIndex: 10,
  },
  crownBadge: {
    height: 15,
    marginLeft: 8,
    width: 15,
  },
  scheduleCard: {
    alignItems: 'center',
    backgroundColor: '#E9F8FF',
    borderRadius: 20,
    flexDirection: 'row',
    minHeight: 88,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  creatorScheduleCard: {
    backgroundColor: '#EAF6FB',
  },
  closedScheduleCard: {
    backgroundColor: '#F6F9FB',
  },
  editingScheduleCard: {
    borderColor: '#DAE5EA',
    borderWidth: 1,
  },
  scheduleBody: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  scheduleThumb: {
    alignItems: 'center',
    backgroundColor: '#D8EEF7',
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  scheduleThumbText: {
    color: '#4D8DA9',
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleInfo: {
    flex: 1,
    marginLeft: 18,
    minWidth: 0,
  },
  scheduleTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 0,
  },
  scheduleTitle: {
    color: '#000000',
    flexShrink: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  scheduleDate: {
    color: '#7A909A',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 4,
  },
  chevron: {
    color: '#8A9194',
    fontSize: 44,
    fontWeight: '300',
    lineHeight: 44,
    marginLeft: 16,
  },
  galleryIcon: {
    height: 22,
    marginLeft: 16,
    width: 22,
  },
  editActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginLeft: 12,
  },
  deletePill: {
    alignItems: 'center',
    backgroundColor: '#FFF0EC',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 58,
    paddingHorizontal: 12,
  },
  deletePillText: {
    color: '#D06958',
    fontSize: 13,
    fontWeight: '800',
  },
  dragHandleBox: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 34,
  },
  dragHandle: {
    color: '#9AA1A5',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 26,
  },
  pinnedLabel: {
    color: '#6EA4BF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 12,
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#F6F9FB',
    borderRadius: 18,
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: '#10161F',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyDescription: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
    textAlign: 'center',
  },
  messageText: {
    color: '#D06958',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 14,
  },
});
