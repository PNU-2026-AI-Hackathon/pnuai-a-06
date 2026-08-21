// 미션 상세 목록 화면을 조합하고 화면 이동 및 반응형 레이아웃을 연결합니다.

import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { MissionItem } from '@/lib/mission-api';

import { MissionList } from './components/mission-list';
import { SchedulePickerModal } from './components/schedule-picker-modal';
import { MissionThemeSelector } from './components/mission-theme-selector';
import { getDistrictCode, getParamValue, getValidTheme } from './mission-data';
import { styles } from './styles';
import { useMissionDetail } from './hooks/use-mission-detail';

export default function MissionDetailScreen() {
  const { language } = useLanguage();
  const { bottomActionInset, bottomSafeInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const params = useLocalSearchParams<{ district?: string; districtCode?: string; missionCode?: string; scheduleId?: string; theme?: string }>();
  const focusedDistrict = getParamValue(params.district) ?? '금정구';
  const focusedDistrictCode = getParamValue(params.districtCode) || getDistrictCode(focusedDistrict);
  const focusedMissionCode = getParamValue(params.missionCode) ?? '';
  const targetScheduleId = getParamValue(params.scheduleId);
  const missionDetail = useMissionDetail({
    language,
    focusedDistrict,
    focusedDistrictCode,
    focusedMissionCode,
    initialTheme: getValidTheme(params.theme),
    onCreateScheduleForMission: (mission: MissionItem) => {
      router.push({
        pathname: '/trip',
        params: { pendingMissionId: mission.id },
      });
    },
    targetScheduleId,
  });
  const {
    actionMessage,
    closeSchedulePicker,
    errorMessage,
    getAddedMissionState,
    handleAddPress,
    handleSelectPlannedDate,
    handleSelectSchedule,
    isAddingMission,
    isLoading,
    isLoadingTargetSessions,
    isSchedulePickerVisible,
    missions,
    schedules,
    selectedMission,
    selectedPlannedDate,
    selectedScheduleForDate,
    selectedTheme,
    setSelectedPlannedDate,
    setSelectedTheme,
    scheduleHasSelectedMission,
    targetSchedule,
  } = missionDetail;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: bottomActionInset + 28,
            paddingHorizontal: horizontalPadding,
            paddingTop: topInset,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
          <ScalePressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} pressedScale={0.86} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </ScalePressable>

          <Text style={styles.title}>미션 상세 리스트</Text>

          <MissionThemeSelector selectedTheme={selectedTheme} onSelectTheme={setSelectedTheme} />

          {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#2B2F33" />
              <Text style={styles.stateText}>미션 정보를 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{errorMessage}</Text>
            </View>
          ) : missions.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>표시할 미션이 없습니다.</Text>
            </View>
          ) : (
            <MissionList
              getAddedMissionState={getAddedMissionState}
              isAddingMission={isAddingMission}
              isLoadingTargetSessions={isLoadingTargetSessions}
              missions={missions}
              onAddMission={handleAddPress}
              selectedMission={selectedMission}
              targetSchedule={targetSchedule}
              targetScheduleId={targetScheduleId}
            />
          )}
        </View>
      </ScrollView>

      <SchedulePickerModal
        bottomSafeInset={bottomSafeInset}
        isAddingMission={isAddingMission}
        onClose={closeSchedulePicker}
        onConfirmPlannedDate={handleSelectPlannedDate}
        onSelectPlannedDate={setSelectedPlannedDate}
        onSelectSchedule={handleSelectSchedule}
        schedules={schedules}
        scheduleHasSelectedMission={scheduleHasSelectedMission}
        selectedPlannedDate={selectedPlannedDate}
        selectedScheduleForDate={selectedScheduleForDate}
        visible={isSchedulePickerVisible}
      />
    </View>
  );
}
