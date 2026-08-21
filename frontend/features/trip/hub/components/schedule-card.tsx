// 일정 목록에서 개별 일정의 정보, 삭제, 드래그, 열기 동작을 표시하는 카드입니다.

import { Image } from 'expo-image';
import { ActivityIndicator, Animated, PanResponder, Pressable, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import type { TripSchedule } from '@/lib/trip-schedule-api';

import { formatDateRange, isClosedSchedule } from '../trip-hub-data';
import { styles } from '../trip-hub-styles';

const crownIcon = require('@/assets/svg/active/crown.svg');
const galleryIcon = require('@/assets/svg/active/gallery.svg');

type ScheduleCardProps = {
  deletingScheduleId: string | null;
  isCreator: boolean;
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

export function ScheduleCard({
  deletingScheduleId,
  dragPreviewOffset,
  isCreator,
  isDragging,
  isEditing,
  isPinned,
  onDelete,
  onDragCancel,
  onDragEnd,
  onDragMove,
  onDragStart,
  onOpen,
  schedule,
}: ScheduleCardProps) {
  const dragY = useRef(new Animated.Value(0)).current;
  const previewY = useRef(new Animated.Value(0)).current;
  const isDeleting = deletingScheduleId === schedule.scheduleId;
  const canDelete = schedule.permissions.canDeleteSchedule && !isClosedSchedule(schedule);
  const isClosed = isClosedSchedule(schedule);
  const isEditingRef = useRef(isEditing);
  const isPinnedRef = useRef(isPinned);
  isEditingRef.current = isEditing;
  isPinnedRef.current = isPinned;

  useEffect(() => {
    previewY.setValue(dragPreviewOffset);
  }, [dragPreviewOffset, previewY]);

  const panResponder = useRef(PanResponder.create({
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
  })).current;

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
          {isPinned ? <Text style={styles.pinnedLabel}>진행 중</Text> : <View style={styles.dragHandleBox} {...panResponder.panHandlers}><Text style={styles.dragHandle}>≡</Text></View>}
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
