// 미션을 담을 일정과 여행 날짜를 선택하는 모달 UI입니다.

import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import type { TripSchedule } from '@/lib/trip-schedule-api';

import { formatScheduleDate, getScheduleDateOptions, isPastDate } from '../mission-data';
import { styles } from '../styles';

type SchedulePickerModalProps = {
  visible: boolean;
  bottomSafeInset: number;
  schedules: TripSchedule[];
  selectedScheduleForDate: TripSchedule | null;
  selectedPlannedDate: string | null;
  isAddingMission: boolean;
  onClose: () => void;
  onSelectSchedule: (schedule: TripSchedule) => void;
  onSelectPlannedDate: (date: string) => void;
  onConfirmPlannedDate: (date: string) => void;
  scheduleHasSelectedMission: (schedule: TripSchedule) => boolean;
};

export function SchedulePickerModal({
  visible,
  bottomSafeInset,
  schedules,
  selectedScheduleForDate,
  selectedPlannedDate,
  isAddingMission,
  onClose,
  onSelectSchedule,
  onSelectPlannedDate,
  onConfirmPlannedDate,
  scheduleHasSelectedMission,
}: SchedulePickerModalProps) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="일정 선택 닫기" onPress={onClose} style={[styles.modalBackdrop, styles.dateModalBackdrop]}>
        <Pressable style={[styles.schedulePanel, styles.dateSchedulePanel, { paddingBottom: bottomSafeInset + 22 }]}>
          <Text style={[styles.schedulePanelTitle, styles.dateSchedulePanelTitle]}>{selectedScheduleForDate ? '담을 날짜를 선택해 주세요' : '담을 일정을 선택해 주세요'}</Text>
          {selectedScheduleForDate ? (
            <>
              <View style={styles.selectedScheduleBox}>
                <Text style={[styles.scheduleName, styles.selectedScheduleName]}>{selectedScheduleForDate.roomName}</Text>
                <Text style={[styles.scheduleDate, styles.selectedScheduleDate]}>{formatScheduleDate(selectedScheduleForDate)}</Text>
              </View>
              <ScrollView contentContainerStyle={styles.dateGrid} showsVerticalScrollIndicator={false} style={styles.dateGridScroll}>
                {getScheduleDateOptions(selectedScheduleForDate).length === 0 ? (
                  <Text style={styles.dateEmptyText}>선택할 수 있는 날짜가 없어요.</Text>
                ) : getScheduleDateOptions(selectedScheduleForDate).map((date, index) => {
                  const isSelectedDate = selectedPlannedDate === date;
                  const isDateDisabled = isPastDate(date);

                  return (
                    <ScalePressable
                      accessibilityRole="button"
                      disabled={isAddingMission || isDateDisabled}
                      key={date}
                      onPress={() => onSelectPlannedDate(date)}
                      pressedScale={0.96}
                      style={[styles.dateOption, isSelectedDate && styles.selectedDateOption, (isAddingMission || isDateDisabled) && styles.disabledButton]}>
                      <Text style={[styles.dateOptionText, isSelectedDate && styles.selectedDateOptionText]}>{index + 1}</Text>
                    </ScalePressable>
                  );
                })}
              </ScrollView>
              <ScalePressable
                disabled={!selectedPlannedDate || isAddingMission}
                onPress={() => selectedPlannedDate && onConfirmPlannedDate(selectedPlannedDate)}
                pressedScale={0.97}
                style={[styles.confirmDateButton, (!selectedPlannedDate || isAddingMission) && styles.disabledButton]}>
                {isAddingMission ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDateButtonText}>
                    {selectedPlannedDate ? `${getScheduleDateOptions(selectedScheduleForDate).indexOf(selectedPlannedDate) + 1}일차에 하기` : '일차를 선택해 주세요'}
                  </Text>
                )}
              </ScalePressable>
            </>
          ) : (
            <View style={styles.scheduleList}>
              {schedules.map((schedule) => {
                const isAlreadyAdded = scheduleHasSelectedMission(schedule);

                return (
                  <ScalePressable
                    accessibilityRole="button"
                    disabled={isAlreadyAdded || isAddingMission}
                    key={schedule.scheduleId}
                    onPress={() => onSelectSchedule(schedule)}
                    pressedScale={0.97}
                    style={[styles.scheduleItem, isAlreadyAdded && styles.disabledScheduleItem]}>
                    <View style={styles.scheduleTextGroup}>
                      <Text style={styles.scheduleName}>{schedule.roomName}</Text>
                      <Text style={styles.scheduleDate}>{formatScheduleDate(schedule)}</Text>
                    </View>
                    <Text style={styles.scheduleMissionCount}>{isAlreadyAdded ? '담김' : `${schedule.missions.length}개`}</Text>
                  </ScalePressable>
                );
              })}
            </View>
          )}
          {isAddingMission ? <ActivityIndicator color="#409CB7" style={styles.panelLoader} /> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
