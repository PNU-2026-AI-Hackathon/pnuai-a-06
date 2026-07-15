import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import { deleteTripSchedule, getCachedTripSchedules, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';

const birdIcon = require('../../assets/svg/active/3d_bird.svg');
const crownIcon = require('../../assets/svg/active/crown.svg');
const CARD_DRAG_STEP = 82;
const CARD_SHIFT_DISTANCE = 100;

function formatDateRange(schedule: TripSchedule) {
  if (!schedule.startDate && !schedule.endDate) {
    return '날짜 미정';
  }

  if (schedule.startDate && schedule.endDate) {
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

function moveScheduleItem(items: TripSchedule[], scheduleId: string, offset: number) {
  const fromIndex = items.findIndex((item) => item.scheduleId === scheduleId);

  if (fromIndex < 0) {
    return items;
  }

  const toIndex = Math.max(0, Math.min(items.length - 1, fromIndex + offset));

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

function ScheduleCard({ dragPreviewOffset, isDragging, deletingScheduleId, isEditing, onDelete, onDragCancel, onDragEnd, onDragMove, onDragStart, onOpen, schedule }: ScheduleCardProps) {
  const dragY = useRef(new Animated.Value(0)).current;
  const previewY = useRef(new Animated.Value(0)).current;
  const isDeleting = deletingScheduleId === schedule.scheduleId;
  const canDelete = schedule.permissions.canDeleteSchedule;
  const isCreator = isCreatorSchedule(schedule);
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;
  useEffect(() => {
    previewY.setValue(dragPreviewOffset);
  }, [dragPreviewOffset, previewY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isEditingRef.current,
      onStartShouldSetPanResponderCapture: () => isEditingRef.current,
      onMoveShouldSetPanResponder: (_, gestureState) => isEditingRef.current && Math.abs(gestureState.dy) > 2 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onMoveShouldSetPanResponderCapture: (_, gestureState) => isEditingRef.current && Math.abs(gestureState.dy) > 2 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
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
          <View style={styles.dragHandleBox} {...panResponder.panHandlers}>
            <Text style={styles.dragHandle}>≡</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </>
  );

  return (
    <Animated.View style={[styles.scheduleCardWrap, isDragging && styles.draggingScheduleCardWrap, { transform: [{ translateY: Animated.add(dragY, previewY) }] }]}>
      {isEditing ? (
        <View style={[styles.scheduleCard, isCreator && styles.creatorScheduleCard, styles.editingScheduleCard]}>
          {cardContent}
        </View>
      ) : (
        <ScalePressable accessibilityRole="button" onPress={() => onOpen(schedule)} pressedScale={0.985} style={[styles.scheduleCard, isCreator && styles.creatorScheduleCard]}>
          {cardContent}
        </ScalePressable>
      )}
    </Animated.View>
  );
}

export default function TripHubScreen() {
  const { bottomActionInset, horizontalPadding, topInset } = useResponsiveLayout();
  const [schedules, setSchedules] = useState<TripSchedule[]>(() => getCachedTripSchedules());
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ dragY: number; scheduleId: string } | null>(null);
  const [message, setMessage] = useState('');

  const refreshSchedules = useCallback(() => {
    let isActive = true;

    const cachedSchedules = getCachedTripSchedules();
    if (cachedSchedules.length > 0) {
      setSchedules(cachedSchedules);
    }
    setIsLoading(true);
    setMessage('');

    listTripSchedules()
      .then((nextSchedules) => {
        if (!isActive) {
          return;
        }

        setSchedules(nextSchedules);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const cachedSchedules = getCachedTripSchedules();
        setSchedules(cachedSchedules);
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
  }, []);

  useFocusEffect(refreshSchedules);

  const openSchedule = (schedule: TripSchedule) => {
    router.push({
      pathname: '/trip/active',
      params: { scheduleId: schedule.scheduleId },
    });
  };

  const deleteSchedule = async (schedule: TripSchedule) => {
    if (!schedule.permissions.canDeleteSchedule) {
      setMessage('일정 삭제 권한이 없습니다.');
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
    if (!schedule.permissions.canDeleteSchedule) {
      setMessage('일정 삭제 권한이 없습니다.');
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

  const handleDragEnd = (scheduleId: string, dragY: number) => {
    const offset = getDragIndexOffset(dragY);
    setActiveDrag(null);

    if (offset === 0) {
      return;
    }

    setSchedules((currentSchedules) => moveScheduleItem(currentSchedules, scheduleId, offset));
    setMessage('변경한 순서는 이 화면에서만 적용돼요. 서버 저장 API가 생기면 영구 저장할 수 있어요.');
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

    const targetIndex = Math.max(0, Math.min(schedules.length - 1, activeIndex + getDragIndexOffset(activeDrag.dragY)));

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
            {isLoading ? <ActivityIndicator color="#6EA4BF" /> : null}
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
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#D1E1EB',
    borderRadius: 18,
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 38,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyDescription: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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











