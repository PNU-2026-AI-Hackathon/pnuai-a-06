// 미션 상세 화면의 조회, 일정 선택, 미션 담기 상태와 동작을 관리합니다.

import { Image } from 'expo-image';
import { Alert } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { fetchMissions, getCachedMissions, type MissionItem } from '@/lib/mission-api';
import { getLatestMissionSession, isMissionSessionNotFoundError, type MissionSession } from '@/lib/mission-session-api';
import { addMissionToSchedule, getCachedTripSchedules, getTripSchedule, listTripSchedules, type TripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';

import {
  getScheduleDateOptions,
  getSortedMissions,
  isPastDate,
  normalizeValue,
} from '../mission-data';
import type { MissionTheme } from '../types';

type UseMissionDetailOptions = {
  language: string;
  focusedDistrict: string;
  focusedDistrictCode: string;
  focusedMissionCode: string;
  initialTheme: MissionTheme;
  targetScheduleId?: string;
  onCreateScheduleForMission: (mission: MissionItem) => void;
};

export function useMissionDetail({
  language,
  focusedDistrict,
  focusedDistrictCode,
  focusedMissionCode,
  initialTheme,
  targetScheduleId,
  onCreateScheduleForMission,
}: UseMissionDetailOptions) {
  const [selectedTheme, setSelectedTheme] = useState<MissionTheme>(initialTheme);
  const [missions, setMissions] = useState<MissionItem[]>(() => getCachedMissions());
  const [schedules, setSchedules] = useState<TripSchedule[]>([]);
  const [targetSchedule, setTargetSchedule] = useState<TripSchedule | null>(null);
  const [targetSessions, setTargetSessions] = useState<Record<string, MissionSession>>({});
  const [selectedMission, setSelectedMission] = useState<MissionItem | null>(null);
  const [selectedScheduleForDate, setSelectedScheduleForDate] = useState<TripSchedule | null>(null);
  const [selectedPlannedDate, setSelectedPlannedDate] = useState<string | null>(null);
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
      const cachedMissions = getCachedMissions();
      const cachedThemeMissions = cachedMissions.filter((mission) => normalizeValue(mission.theme) === selectedTheme);

      try {
        if (cachedThemeMissions.length > 0) {
          setMissions(cachedThemeMissions);
          setIsLoading(false);
        } else {
          setMissions([]);
          setIsLoading(true);
        }
        setErrorMessage('');
        const missionList = await fetchMissions({ theme: selectedTheme });

        if (isActive) {
          setMissions(missionList);
        }
      } catch (error) {
        if (isActive) {
          setMissions(cachedThemeMissions);
          setErrorMessage(cachedThemeMissions.length === 0 ? (error instanceof Error ? error.message : '미션 정보를 불러오지 못했습니다.') : '');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadMissions();

    return () => {
      isActive = false;
    };
  }, [language, selectedTheme]);

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
  }, [language, targetScheduleId]);

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

    void loadTargetSessions();

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
    setSelectedPlannedDate(null);
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

  const addMissionForDate = async (mission: MissionItem, schedule: TripSchedule, plannedDate: string) => {
    if (isAddingMission) {
      return;
    }

    try {
      setIsAddingMission(true);
      setActionMessage('');
      const addedScheduleMission = await addMissionToSchedule(schedule.scheduleId, mission.id, plannedDate);
      if (addedScheduleMission.emojiUrl) {
        void Image.prefetch(addedScheduleMission.emojiUrl, 'memory-disk').catch(() => undefined);
      }
      if (targetScheduleId && schedule.scheduleId === targetScheduleId) {
        await refreshTargetSchedule();
      }
      setIsSchedulePickerVisible(false);
      setSelectedMission(null);
      setSelectedScheduleForDate(null);
      setSelectedPlannedDate(null);
      setActionMessage(`${schedule.roomName} ${plannedDate}에 미션을 담았어요.`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '미션을 일정에 담지 못했어요.');
    } finally {
      setIsAddingMission(false);
    }
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
    const dateOptions = getScheduleDateOptions(targetSchedule);

    if (dateOptions.length === 1 && !isPastDate(dateOptions[0])) {
      void addMissionForDate(mission, targetSchedule, dateOptions[0]);
      return;
    }

    setSelectedScheduleForDate(targetSchedule);
    setSelectedPlannedDate(null);
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
          { text: '네', onPress: () => onCreateScheduleForMission(mission) },
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

    const dateOptions = getScheduleDateOptions(schedule);

    if (dateOptions.length === 1 && !isPastDate(dateOptions[0])) {
      void addMissionForDate(selectedMission, schedule, dateOptions[0]);
      return;
    }

    setSelectedScheduleForDate(schedule);
    setSelectedPlannedDate(null);
  };

  const handleSelectPlannedDate = async (plannedDate: string) => {
    if (!selectedMission || !selectedScheduleForDate || isAddingMission) {
      return;
    }

    await addMissionForDate(selectedMission, selectedScheduleForDate, plannedDate);
  };

  return {
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
    missions: sortedMissions,
    schedules,
    selectedMission,
    selectedPlannedDate,
    selectedScheduleForDate,
    selectedTheme,
    setSelectedPlannedDate,
    setSelectedTheme,
    scheduleHasSelectedMission,
    targetSchedule,
    targetScheduleId,
  };
}
