import { Image } from 'expo-image';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { ScheduleCard } from '@/features/trip/hub/components/schedule-card';
import { styles } from '@/features/trip/hub/trip-hub-styles';
import type { TripSchedule } from '@/lib/trip-schedule-api';

const birdIcon = require('@/assets/svg/active/3d_bird.svg');

type TripHubContentProps = {
  activeDrag: { dragY: number; scheduleId: string } | null;
  bottomActionInset: number;
  confirmDeleteSchedule: (schedule: TripSchedule) => void;
  deletingScheduleId: string | null;
  getSchedulePreviewOffset: (scheduleId: string, index: number) => number;
  handleDragEnd: (scheduleId: string, dragY: number) => Promise<void>;
  handleDragMove: (scheduleId: string, dragY: number) => void;
  horizontalPadding: number;
  isCreatorSchedule: (schedule: TripSchedule) => boolean;
  isEditing: boolean;
  isInProgressSchedule: (schedule: TripSchedule) => boolean;
  isLoading: boolean;
  isSavingOrder: boolean;
  message: string;
  onCreateTrip: () => void;
  onOpenSchedule: (schedule: TripSchedule) => void;
  onGoBack: () => void;
  schedules: TripSchedule[];
  setActiveDrag: (drag: { dragY: number; scheduleId: string } | null) => void;
  setIsEditing: (editing: boolean) => void;
  topInset: number;
};

// 여행 일정 목록과 일정 관리 액션을 보여주는 화면입니다.
export function TripHubContent({
  activeDrag,
  bottomActionInset,
  confirmDeleteSchedule,
  deletingScheduleId,
  getSchedulePreviewOffset,
  handleDragEnd,
  handleDragMove,
  horizontalPadding,
  isCreatorSchedule,
  isEditing,
  isInProgressSchedule,
  isLoading,
  isSavingOrder,
  message,
  onCreateTrip,
  onOpenSchedule,
  onGoBack,
  schedules,
  setActiveDrag,
  setIsEditing,
  topInset,
}: TripHubContentProps) {
  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding, paddingTop: topInset }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={onGoBack} style={styles.backButton}>
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
          <ScalePressable accessibilityRole="button" onPress={onCreateTrip} pressedScale={0.98} style={styles.createButton}>
            <Text style={styles.createButtonText}>새 일정 만들기</Text>
          </ScalePressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>여행 목록</Text>
          <View style={styles.sectionActions}>
            {isLoading || isSavingOrder ? <ActivityIndicator color="#6EA4BF" /> : null}
            <Pressable accessibilityLabel={isEditing ? '여행 목록 편집 완료' : '여행 목록 편집'} onPress={() => { setActiveDrag(null); setIsEditing(!isEditing); }} style={styles.moreButton}>
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
                onOpen={onOpenSchedule}
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
