import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMissions, getCachedMissions, type MissionItem } from '@/lib/mission-api';
import { getLatestMissionSession, isMissionSessionNotFoundError, type MissionSession } from '@/lib/mission-session-api';
import { addMissionToSchedule, getCachedTripSchedules, getTripSchedule, listTripSchedules, type TripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';

type MissionTheme = 'MOUNTAIN' | 'SEA' | 'CITY';

const themeItems: { icon: number; label: string; value: MissionTheme }[] = [
  { icon: require('../../assets/svg/mission_theme/mountain.svg'), label: '산', value: 'MOUNTAIN' },
  { icon: require('../../assets/svg/mission_theme/sea.svg'), label: '바다', value: 'SEA' },
  { icon: require('../../assets/svg/mission_theme/city.svg'), label: '도시', value: 'CITY' },
];
const districtCodeByLabel: Record<string, string> = {
  강서구: 'GANGSEO',
  사하구: 'SAHA',
  사상구: 'SASANG',
  북구: 'BUK',
  금정구: 'GEUMJEONG',
  동래구: 'DONGNAE',
  연제구: 'YEONJE',
  부산진구: 'BUSANJIN',
  서구: 'SEO',
  동구: 'DONG',
  중구: 'JUNG',
  수영구: 'SUYEONG',
  남구: 'NAM',
  영도구: 'YEONGDO',
  해운대구: 'HAEUNDAE',
  기장군: 'GIJANG',
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

function getValidTheme(value: string | string[] | undefined): MissionTheme {
  const theme = normalizeValue(getParamValue(value));

  return theme === 'SEA' || theme === 'CITY' ? theme : 'MOUNTAIN';
}

function getSortedMissions(
  missions: MissionItem[],
  options: { district: string; districtCode: string; missionCode: string; theme: MissionTheme }
) {
  const focusedDistrictCode = normalizeValue(options.districtCode);
  const focusedMissionCode = normalizeValue(options.missionCode);

  return missions
    .map((mission, index) => {
      const missionCode = normalizeValue(mission.code ?? mission.id);
      const missionTheme = normalizeValue(mission.theme);
      const missionDistrictCode = normalizeValue(mission.districtCode);
      const isSameTheme = missionTheme === options.theme;
      const isSameDistrict =
        Boolean(focusedDistrictCode && missionDistrictCode === focusedDistrictCode) || mission.districtLabel === options.district;
      const isSameMission = Boolean(focusedMissionCode && missionCode === focusedMissionCode);
      let priority = 4;

      if (isSameTheme && isSameDistrict) {
        priority = isSameMission ? 0 : 1;
      } else if (isSameTheme) {
        priority = 2;
      } else if (isSameDistrict) {
        priority = 3;
      }

      return { index, mission, priority };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ mission }) => mission);
}

function formatScheduleDate(schedule: TripSchedule) {
  if (schedule.startDate && schedule.endDate) {
    return `${schedule.startDate} - ${schedule.endDate}`;
  }

  return schedule.startDate ?? schedule.endDate ?? '날짜 미정';
}

function parseDateValue(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function getScheduleDateOptions(schedule: TripSchedule) {
  const startDate = parseDateValue(schedule.startDate);
  const endDate = parseDateValue(schedule.endDate ?? schedule.startDate);

  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
    return [];
  }

  const dates: string[] = [];
  let cursor = startDate;

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(formatDateValue(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
}
export default function MissionDetailScreen() {
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const params = useLocalSearchParams<{ district?: string; districtCode?: string; missionCode?: string; scheduleId?: string; theme?: string }>();
  const focusedDistrict = getParamValue(params.district) ?? '금정구';
  const focusedDistrictCode = getParamValue(params.districtCode) || districtCodeByLabel[focusedDistrict] || '';
  const focusedMissionCode = getParamValue(params.missionCode) ?? '';
  const targetScheduleId = getParamValue(params.scheduleId);
  const [selectedTheme, setSelectedTheme] = useState<MissionTheme>(getValidTheme(params.theme));
  const [missions, setMissions] = useState<MissionItem[]>(() => getCachedMissions());
  const [schedules, setSchedules] = useState<TripSchedule[]>([]);
  const [targetSchedule, setTargetSchedule] = useState<TripSchedule | null>(null);
  const [targetSessions, setTargetSessions] = useState<Record<string, MissionSession>>({});
  const [selectedMission, setSelectedMission] = useState<MissionItem | null>(null);
  const [selectedScheduleForDate, setSelectedScheduleForDate] = useState<TripSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(() => getCachedMissions().length === 0);
  const [isSchedulePickerVisible, setIsSchedulePickerVisible] = useState(false);
  const [isAddingMission, setIsAddingMission] = useState(false);
  const [isLoadingTargetSessions, setIsLoadingTargetSessions] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const sortedMissions = useMemo(
    () =>
      getSortedMissions(missions, {
        district: focusedDistrict,
        districtCode: focusedDistrictCode,
        missionCode: focusedMissionCode,
        theme: selectedTheme,
      }),
    [focusedDistrict, focusedDistrictCode, focusedMissionCode, missions, selectedTheme]
  );
  const targetScheduleMissionByMissionId = useMemo(() => {
    const missionMap = new Map<string, TripScheduleMission>();

    targetSchedule?.missions.forEach((mission) => {
      missionMap.set(mission.missionId, mission);
      if (mission.missionCode) {
        missionMap.set(mission.missionCode, mission);
      }
    });

    return missionMap;
  }, [targetSchedule]);

  useEffect(() => {
    let isActive = true;

    async function loadMissions() {
      try {
        const cachedMissions = getCachedMissions();
        if (cachedMissions.length > 0) {
          setMissions(cachedMissions);
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
        setErrorMessage('');
        const missionList = await fetchMissions({});

        if (isActive) {
          setMissions(missionList);
        }
      } catch (error) {
        if (isActive) {
          const cachedMissions = getCachedMissions();
          setMissions(cachedMissions);
          setErrorMessage(cachedMissions.length === 0 ? (error instanceof Error ? error.message : '미션 정보를 불러오지 못했습니다.') : '');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadMissions();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!targetScheduleId) {
      setTargetSchedule(null);
      setTargetSessions({});
      return;
    }

    let isActive = true;

    getTripSchedule(targetScheduleId)
      .then((schedule) => {
        if (isActive) {
          setTargetSchedule(schedule);
        }
      })
      .catch((error) => {
        if (isActive) {
          setActionMessage(error instanceof Error ? error.message : '일정 정보를 불러오지 못했어요.');
        }
      });

    return () => {
      isActive = false;
    };
  }, [targetScheduleId]);
  useEffect(() => {
    if (!targetScheduleId || !targetSchedule) {
      setTargetSessions({});
      setIsLoadingTargetSessions(false);
      return;
    }

    let isActive = true;
    const scheduleId = targetScheduleId;
    const schedule = targetSchedule;

    async function loadTargetSessions() {
      setIsLoadingTargetSessions(true);

      const entries = await Promise.all(
        schedule.missions.map(async (mission) => {
          try {
            const session = await getLatestMissionSession(scheduleId, mission.scheduleMissionId);
            return [mission.scheduleMissionId, session] as const;
          } catch (error) {
            if (isMissionSessionNotFoundError(error)) {
              return null;
            }

            return null;
          }
        })
      );

      if (isActive) {
        setTargetSessions(Object.fromEntries(entries.filter((entry): entry is readonly [string, MissionSession] => Boolean(entry))));
        setIsLoadingTargetSessions(false);
      }
    }

    loadTargetSessions();

    return () => {
      isActive = false;
    };
  }, [targetSchedule, targetScheduleId]);
  const closeSchedulePicker = () => {
    if (isAddingMission) {
      return;
    }

    setIsSchedulePickerVisible(false);
    setSelectedMission(null);
    setSelectedScheduleForDate(null);
  };

  const handleCreateScheduleForMission = (mission: MissionItem) => {
    router.push({
      pathname: '/trip',
      params: { pendingMissionId: mission.id },
    });
  };

  const getAddedScheduleMission = (mission: MissionItem) => {
    return targetScheduleMissionByMissionId.get(String(mission.id)) ?? targetScheduleMissionByMissionId.get(String(mission.code ?? '')) ?? null;
  };

  const getAddedMissionState = (mission: MissionItem) => {
    const addedMission = getAddedScheduleMission(mission);

    if (!addedMission) {
      return { addedMission, isCompleted: false, isInProgress: false };
    }

    const session = targetSessions[addedMission.scheduleMissionId];
    const scheduleStatus = normalizeValue(addedMission.status);
    const sessionStatus = normalizeValue(session?.status);
    const completedStatuses = new Set(['COMPLETED', 'COMPLETE', 'FINISHED', 'DONE']);
    const progressStatuses = new Set(['ACTIVE', 'IN_PROGRESS', 'ONGOING', 'STARTED', 'WAITING', 'READY', 'SHOOTING', 'UPLOADING', 'VOTING', 'REVEALED']);
    const isCompleted = completedStatuses.has(scheduleStatus) || completedStatuses.has(sessionStatus);
    const isInProgress = !isCompleted && (Boolean(session) || progressStatuses.has(scheduleStatus) || progressStatuses.has(sessionStatus));

    return { addedMission, isCompleted, isInProgress };
  };

  const refreshTargetSchedule = async () => {
    if (!targetScheduleId) {
      return null;
    }

    const nextSchedule = await getTripSchedule(targetScheduleId);
    setTargetSchedule(nextSchedule);

    return nextSchedule;
  };

  const handleDirectMissionAdd = (mission: MissionItem) => {
    if (!targetScheduleId) {
      return;
    }

    const addedMission = getAddedScheduleMission(mission);

    if (addedMission) {
      setActionMessage('이미 담긴 미션이에요. 날짜 변경이나 삭제는 일정 화면에서 할 수 있어요.');
      return;
    }

    if (!targetSchedule?.permissions.canAddMission) {
      setActionMessage('미션 추가 권한이 없습니다.');
      return;
    }

    setActionMessage('');
    setSelectedMission(mission);
    setSelectedScheduleForDate(targetSchedule);
    setIsSchedulePickerVisible(true);
  };
  const handleAddPress = async (mission: MissionItem) => {
    if (targetScheduleId) {
      handleDirectMissionAdd(mission);
      return;
    }

    if (isAddingMission) {
      return;
    }

    try {
      setIsAddingMission(true);
      setActionMessage('');
      setSelectedMission(mission);
      const cachedSchedules = getCachedTripSchedules();
      const addableCachedSchedules = cachedSchedules.filter((schedule) => schedule.permissions.canAddMission);
      if (addableCachedSchedules.length > 0) {
        setSchedules(addableCachedSchedules);
        setIsSchedulePickerVisible(true);
      }

      const nextSchedules = await listTripSchedules();
      const addableSchedules = nextSchedules.filter((schedule) => schedule.permissions.canAddMission);
      setSchedules(addableSchedules);

      if (nextSchedules.length === 0) {
        Alert.alert('일정 만들기', '아직 만든 일정이 없어요. 일정을 만드시겠습니까?', [
          { text: '아니요', style: 'cancel' },
          { text: '네', onPress: () => handleCreateScheduleForMission(mission) },
        ]);
        return;
      }

      if (addableSchedules.length === 0) {
        setActionMessage('미션을 추가할 수 있는 일정이 없어요.');
        return;
      }

      setIsSchedulePickerVisible(true);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '일정 목록을 불러오지 못했어요.');
    } finally {
      setIsAddingMission(false);
    }
  };

  const scheduleHasSelectedMission = (schedule: TripSchedule) => {
    if (!selectedMission) {
      return false;
    }

    return schedule.missions.some((mission) => (
      mission.missionId === String(selectedMission.id) || Boolean(selectedMission.code && mission.missionCode === selectedMission.code)
    ));
  };

  const handleSelectSchedule = (schedule: TripSchedule) => {
    if (!schedule.permissions.canAddMission) {
      setActionMessage('미션 추가 권한이 없습니다.');
      return;
    }

    if (!selectedMission || isAddingMission) {
      return;
    }

    if (scheduleHasSelectedMission(schedule)) {
      setActionMessage('이미 담긴 미션이에요. 날짜 변경이나 삭제는 일정 화면에서 할 수 있어요.');
      return;
    }

    setSelectedScheduleForDate(schedule);
  };

  const handleSelectPlannedDate = async (plannedDate: string) => {
    if (!selectedMission || !selectedScheduleForDate || isAddingMission) {
      return;
    }

    try {
      setIsAddingMission(true);
      setActionMessage('');
      await addMissionToSchedule(selectedScheduleForDate.scheduleId, selectedMission.id, plannedDate);
      if (targetScheduleId && selectedScheduleForDate.scheduleId === targetScheduleId) {
        await refreshTargetSchedule();
      }
      setIsSchedulePickerVisible(false);
      setSelectedMission(null);
      setSelectedScheduleForDate(null);
      setActionMessage(`${selectedScheduleForDate.roomName} ${plannedDate}에 미션을 담았어요.`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '미션을 일정에 담지 못했어요.');
    } finally {
      setIsAddingMission(false);
    }
  };
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

          <View style={styles.themeRow}>
            {themeItems.map((item) => {
              const isSelected = item.value === selectedTheme;

              return (
                <ScalePressable
                  accessibilityRole="button"
                  key={item.label}
                  onPress={() => setSelectedTheme(item.value)}
                  pressedScale={0.94}
                  style={[styles.themeCard, isSelected && styles.selectedThemeCard]}>
                  <Image source={item.icon} style={styles.themeIcon} contentFit="contain" />
                  <Text style={[styles.themeLabel, isSelected && styles.selectedThemeLabel]}>{item.label}</Text>
                </ScalePressable>
              );
            })}
          </View>

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
          ) : sortedMissions.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>표시할 미션이 없습니다.</Text>
            </View>
          ) : (
            <View style={styles.missionList}>
              {sortedMissions.map((mission) => {
                const { addedMission, isCompleted, isInProgress } = targetScheduleId ? getAddedMissionState(mission) : { addedMission: null, isCompleted: false, isInProgress: false };
                const isMissionBusy = isAddingMission && selectedMission?.id === mission.id;
                const isScheduleLoading = Boolean(targetScheduleId && !targetSchedule);
                const isCheckingSession = Boolean(addedMission && isLoadingTargetSessions);
                const missionButtonLabel = isCheckingSession ? '확인 중' : isCompleted ? '완료' : isInProgress ? '진행 중' : addedMission ? '담김' : '담기';

                return (
                <View key={mission.id} style={styles.missionCard}>
                  <View style={styles.missionHeaderRow}>
                    <View style={styles.missionTitleGroup}>
                      <Text style={styles.missionTitle}>{mission.title}</Text>
                      <Text style={styles.locationText}>{mission.location}</Text>
                    </View>
                    <ScalePressable
                      accessibilityRole="button"
                      accessibilityLabel={`${mission.title} ${missionButtonLabel}`}
                      disabled={isMissionBusy || isScheduleLoading || Boolean(addedMission)}
                      onPress={() => handleAddPress(mission)}
                      pressedScale={0.94}
                      style={[addedMission ? styles.addedMissionButton : styles.addMissionButton, (isMissionBusy || isScheduleLoading || addedMission) && styles.disabledButton]}>
                      {isMissionBusy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.addMissionButtonText}>{missionButtonLabel}</Text>}
                    </ScalePressable>
                  </View>
                  <Text style={styles.descriptionText}>{mission.description}</Text>
                  {mission.photoUrl ? (
                    <Image source={{ uri: mission.photoUrl }} style={styles.missionPhoto} contentFit="cover" />
                  ) : (
                    <View style={styles.photoPlaceholder} />
                  )}
                </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={isSchedulePickerVisible} onRequestClose={closeSchedulePicker}>
        <Pressable accessibilityLabel="일정 선택 닫기" onPress={closeSchedulePicker} style={styles.modalBackdrop}>
          <Pressable style={styles.schedulePanel}>
            <Text style={styles.schedulePanelTitle}>{selectedScheduleForDate ? '담을 날짜를 선택해 주세요' : '담을 일정을 선택해 주세요'}</Text>
            {selectedScheduleForDate ? (
              <>
                <View style={styles.selectedScheduleBox}>
                  <Text style={styles.scheduleName}>{selectedScheduleForDate.roomName}</Text>
                  <Text style={styles.scheduleDate}>{formatScheduleDate(selectedScheduleForDate)}</Text>
                </View>
                <View style={styles.dateGrid}>
                  {getScheduleDateOptions(selectedScheduleForDate).length === 0 ? (
                    <Text style={styles.dateEmptyText}>선택할 수 있는 날짜가 없어요.</Text>
                  ) : getScheduleDateOptions(selectedScheduleForDate).map((date) => (
                    <ScalePressable
                      accessibilityRole="button"
                      disabled={isAddingMission}
                      key={date}
                      onPress={() => handleSelectPlannedDate(date)}
                      pressedScale={0.96}
                      style={[styles.dateOption, isAddingMission && styles.disabledButton]}>
                      <Text style={styles.dateOptionText}>{date}</Text>
                    </ScalePressable>
                  ))}
                </View>
                <ScalePressable disabled={isAddingMission} onPress={() => setSelectedScheduleForDate(null)} pressedScale={0.96} style={styles.backToScheduleButton}>
                  <Text style={styles.backToScheduleText}>일정 다시 선택</Text>
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
                      onPress={() => handleSelectSchedule(schedule)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#eaf5f9',
    flex: 1,
  },
  content: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
  backButton: {
    alignItems: 'flex-start',
    height: 50,
    justifyContent: 'center',
    marginBottom: 22,
    width: 54,
  },
  backIcon: {
    color: '#111111',
    fontSize: 46,
    lineHeight: 48,
  },
  title: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  themeCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 11,
    height: 98,
    justifyContent: 'center',
    width: 82,
  },
  selectedThemeCard: {
    borderColor: '#2B2F33',
    borderWidth: 1,
  },
  themeIcon: {
    height: 40,
    marginBottom: 8,
    width: 40,
  },
  themeLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
  },
  selectedThemeLabel: {
    fontWeight: '700',
  },
  actionMessage: {
    color: '#409CB7',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 14,
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  stateText: {
    color: '#676D70',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  missionList: {
    gap: 12,
  },
  missionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  missionHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  missionTitleGroup: {
    flex: 1,
  },
  missionTitle: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 7,
  },
  locationText: {
    color: '#AEAEAE',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 10,
  },
  addMissionButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 62,
    paddingHorizontal: 16,
  },
  addedMissionButton: {
    alignItems: 'center',
    backgroundColor: '#8A9194',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 62,
    paddingHorizontal: 16,
  },
  addMissionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  descriptionText: {
    color: '#AEAEAE',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 24,
  },
  missionPhoto: {
    aspectRatio: 1.55,
    backgroundColor: '#eef3f5',
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },
  photoPlaceholder: {
    aspectRatio: 1.55,
    backgroundColor: '#eef3f5',
    borderRadius: 10,
    width: '100%',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.26)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 32,
  },
  schedulePanel: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    maxHeight: '72%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  schedulePanelTitle: {
    color: '#10161F',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  scheduleList: {
    gap: 10,
  },
  selectedScheduleBox: {
    backgroundColor: '#F4F7F8',
    borderRadius: 14,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateOption: {
    alignItems: 'center',
    backgroundColor: '#EAF5F9',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  dateOptionText: {
    color: '#409CB7',
    fontSize: 13,
    fontWeight: '700',
  },
  dateEmptyText: {
    color: '#8A9194',
    fontSize: 13,
    lineHeight: 18,
  },
  backToScheduleButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingVertical: 8,
  },
  backToScheduleText: {
    color: '#626E75',
    fontSize: 13,
    fontWeight: '700',
  },
  scheduleItem: {
    alignItems: 'center',
    backgroundColor: '#F4F7F8',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 70,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabledScheduleItem: {
    opacity: 0.55,
  },
  scheduleTextGroup: {
    flex: 1,
  },
  scheduleName: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
  },
  scheduleDate: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 5,
  },
  scheduleMissionCount: {
    color: '#409CB7',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
  },
  panelLoader: {
    marginTop: 14,
  },
});