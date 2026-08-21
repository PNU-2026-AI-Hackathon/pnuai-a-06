import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { Rect, Svg } from 'react-native-svg';

import { getMissionCardLevel } from '@/components/mission-card';
import { ScalePressable } from '@/components/scale-pressable';
import { TripInviteSheet } from '@/components/trip-invite-sheet';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem, setAuthItem } from '@/lib/auth-storage';
import { shareKakaoInvite } from '@/lib/kakao-share';
import {
  connectMissionSessionSocket,
  connectScheduleMissionSessionSocket,
  createMissionSession,
  getActiveMissionSession,
  getLatestMissionSession,
  getMissionSession,
  chooseMissionParticipation,
  MissionSessionApiError,

  mergeMissionSessions,
  isMissionSessionNotFoundError,
  type MissionSession,
  type MissionParticipationLocation,
} from '@/lib/mission-session-api';
import { getCurrentParticipationLocation } from '@/lib/mission-location';
import { getTripSchedule, removeMissionFromSchedule, updateScheduleMissionDate, type TripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';
import { createKakaoInviteTemplateArgs, createTripInvite, type TripInvite } from '@/lib/trip-invite-api';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function createFallbackInviteUrl(inviteToken: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL('/trip/invite', window.location.origin);
    url.searchParams.set('inviteToken', inviteToken);

    return url.toString();
  }

  return Linking.createURL('/trip/invite', {
    isTripleSlashed: true,
    queryParams: { inviteToken },
  });
}

function getInviteUrl(invite: TripInvite | null) {
  if (!invite) {
    return '';
  }

  return invite.inviteUrl ?? createFallbackInviteUrl(invite.inviteToken);
}

const activeAddIcon = require('@/assets/svg/active/add.svg');
const activeAddPeopleIcon = require('@/assets/svg/active/add_people.svg');
const activeSettingIcon = require('@/assets/svg/active/setting.svg');
const crownIcon = require('@/assets/svg/active/crown.svg');
const REVEALED_SESSION_CACHE_PREFIX = 'trip_revealed_sessions:';

function getRevealedSessionCacheKey(scheduleId: string) {
  return `${REVEALED_SESSION_CACHE_PREFIX}${scheduleId}`;
}

function readCachedRevealedSessions(scheduleId: string) {
  const raw = getAuthItem(getRevealedSessionCacheKey(scheduleId));

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, MissionSession>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveCachedRevealedSessions(scheduleId: string, sessions: Record<string, MissionSession>) {
  setAuthItem(getRevealedSessionCacheKey(scheduleId), JSON.stringify(sessions));
}


function getCompletedParticipantIds(session: MissionSession) {
  return new Set(
    session.members
      .filter((member) => member.participationStatus === 'COMPLETED')
      .map((member) => member.userId)
      .filter(Boolean),
  );
}

function isFinishedSession(session: MissionSession | undefined) {
  const soloMember = session?.members.length === 1 ? session.members[0] : undefined;
  const isSoloTimedOut = Boolean(
    soloMember?.participationStatus === 'TIMED_OUT'
      || (
        soloMember
        && session
        && session.status !== 'COMPLETED'
        && session.status !== 'CANCELLED'
        && !session.submissions.some((submission) => (
          submission.userId === soloMember.userId
          && submission.judgeStatus !== 'REJECTED'
          && submission.judgeStatus !== 'ERROR'
        ))
        && (() => {
          const deadline = session.photoUploadEndsAt ?? session.shootingEndsAt;
          const deadlineTime = deadline ? new Date(deadline).getTime() : NaN;
          return Number.isFinite(deadlineTime) && deadlineTime <= Date.now();
        })()
      ),
  );

  return Boolean(session && (session.status === 'COMPLETED' || session.status === 'CANCELLED' || isSoloTimedOut));
}

function hasAllPassedMemberSubmissions(session: MissionSession, requiredMemberCount: number) {
  const completedParticipantIds = getCompletedParticipantIds(session);
  const expectedMemberCount = completedParticipantIds.size > 0 ? completedParticipantIds.size : Math.max(session.members.length, requiredMemberCount);
  const passedUserIds = new Set(
    session.submissions
      .filter((submission) => submission.judgeStatus === 'PASSED')
      .map((submission) => submission.userId)
      .filter(Boolean),
  );

  return expectedMemberCount > 0 && passedUserIds.size >= expectedMemberCount;
}

function getFeedSubmissions(session: MissionSession | undefined) {
  if (!session) {
    return [];
  }

  const completedParticipantIds = getCompletedParticipantIds(session);

  return session.submissions.filter((submission) =>
    submission.judgeStatus === 'PASSED'
    && (completedParticipantIds.size === 0 || completedParticipantIds.has(submission.userId))
  );
}

function isFeedReadySession(session: MissionSession, requiredMemberCount: number) {
  return hasAllPassedMemberSubmissions(session, requiredMemberCount);
}

function isStartedMissionSession(session: MissionSession) {
  return Boolean(session.startedAt) || (session.status !== 'WAITING' && session.status !== 'READY');
}

function isParticipatingMissionMember(member: MissionSession['members'][number] | undefined) {
  return member?.participationStatus === 'PARTICIPATING' || member?.participationStatus === 'COMPLETED';
}

function hasLeftMissionParticipation(member: MissionSession['members'][number] | undefined) {
  return member?.participationStatus === 'SKIPPED'
    || member?.participationStatus === 'LOCKED_OUT'
    || member?.participationStatus === 'TIMED_OUT';
}


function isCompletedScheduleMission(mission: TripScheduleMission) {
  return mission.status === 'COMPLETED';
}

function getMissionLocation(mission: TripScheduleMission) {
  if (mission.districtLabel && mission.placeLabel) {
    return `${mission.districtLabel}(${mission.placeLabel})`;
  }

  return mission.placeLabel ?? mission.districtLabel ?? '부산';
}

function getMissionStartErrorMessage(error: unknown) {
  if (error instanceof MissionSessionApiError) {
    switch (error.code) {
      case 'MISSION_LOCATION_REQUIRED':
        return '위치 권한을 허용하고 현재 위치를 다시 확인해 주세요.';
      case 'MISSION_LOCATION_TIMESTAMP_INVALID':
        return '현재 위치 시간을 확인하지 못했어요. 다시 시도해 주세요.';
      case 'MISSION_LOCATION_STALE':
        return '위치 정보가 오래됐어요. 현재 위치를 다시 측정해 주세요.';
      case 'MISSION_LOCATION_INACCURATE':
        return '현재 위치의 정확도가 낮아요. 야외에서 잠시 후 다시 시도해 주세요.';
      case 'MISSION_LOCATION_OUT_OF_RANGE':
        return '미션 장소 근처에서만 참여할 수 있어요.';
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : '미션을 시작하지 못했어요.';
}

function prefetchMissionIcons(missions: TripScheduleMission[]) {
  const iconUrls = Array.from(new Set(missions.map((mission) => mission.emojiUrl).filter((url): url is string => Boolean(url))));

  void Promise.all(iconUrls.map((url) => Image.prefetch(url, 'memory-disk'))).catch(() => undefined);
}

function getParticipantText(schedule: TripSchedule | null) {
  const names = schedule?.participants
    .map((participant) => participant.nickname || participant.email)
    .filter((value): value is string => Boolean(value));

  return names && names.length > 0 ? names.join(' · ') : '동행자 정보 없음';
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

function getScheduleDateOptions(schedule: TripSchedule | null) {
  const startDate = parseDateValue(schedule?.startDate);
  const endDate = parseDateValue(schedule?.endDate ?? schedule?.startDate);

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

function getCalendarDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000);
}

function getTripDayLabel(schedule: TripSchedule | null) {
  const startDate = parseDateValue(schedule?.startDate);
  const endDate = parseDateValue(schedule?.endDate ?? schedule?.startDate);

  if (!startDate) {
    return '여행 날짜 미정';
  }

  const today = new Date();
  const todayDay = getCalendarDayNumber(today);
  const startDay = getCalendarDayNumber(startDate);

  if (todayDay < startDay) {
    return `D-${startDay - todayDay}`;
  }

  if (endDate && todayDay > getCalendarDayNumber(endDate)) {
    return '여행 종료';
  }

  return `오늘 · 여행 ${todayDay - startDay + 1}일차`;
}

function getMissionDateLabel(date: string) {
  return date === 'UNPLANNED' ? '날짜 미정' : date;
}

function getScheduleSyncSignature(schedule: TripSchedule) {
  return JSON.stringify({
    endDate: schedule.endDate,
    missions: schedule.missions.map((mission) => ({
      plannedDate: mission.plannedDate,
      scheduleMissionId: mission.scheduleMissionId,
      status: mission.status,
      title: mission.title,
    })),
    participants: schedule.participants.map((participant) => participant.id),
    startDate: schedule.startDate,
  });
}

function hasSameMissionSessionSnapshot(left: MissionSession | undefined, right: MissionSession) {
  return Boolean(left && JSON.stringify(left) === JSON.stringify(right));
}

export default function ActiveTripScreen() {
  const params = useLocalSearchParams<{
    scheduleId?: string | string[];
    sessionId?: string | string[];
    suppressedParticipationSessionId?: string | string[];
  }>();
  const scheduleId = getParamValue(params.scheduleId);
  const initialSessionId = getParamValue(params.sessionId);
  const suppressedParticipationSessionId = getParamValue(params.suppressedParticipationSessionId);
  const currentUserId = getAuthItem('user_id');
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const isFocused = useIsFocused();
  const [schedule, setSchedule] = useState<TripSchedule | null>(null);
  const [revealedSessions, setRevealedSessions] = useState<Record<string, MissionSession>>({});
  const [missionSessions, setMissionSessions] = useState<Record<string, MissionSession>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionBusy, setIsSessionBusy] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [message, setMessage] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [missionListVisible, setMissionListVisible] = useState(false);
  const [pendingMission, setPendingMission] = useState<TripScheduleMission | null>(null);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [inviteData, setInviteData] = useState<TripInvite | null>(null);
  const [dateEditorMissionId, setDateEditorMissionId] = useState<string | null>(null);
  const [busyScheduleMissionId, setBusyScheduleMissionId] = useState<string | null>(null);
  const [missionListMessage, setMissionListMessage] = useState('');

  const missionSessionsRef = useRef<Record<string, MissionSession>>({});
  const revealedSessionsRef = useRef<Record<string, MissionSession>>({});
  const pendingMissionLocationRef = useRef<MissionParticipationLocation | null>(null);
  const leaderStartingMissionRef = useRef(false);
  const openingParticipationSessionIdRef = useRef<string | null>(null);
  const suppressedLeaderSessionIdsRef = useRef(new Set<string>());
  const missions = useMemo(() => schedule?.missions ?? [], [schedule]);
  const [todayDay, setTodayDay] = useState(() => getCalendarDayNumber(new Date()));
  const visibleMissions = missions.filter((mission) => {
    const session = missionSessions[mission.scheduleMissionId] ?? revealedSessions[mission.scheduleMissionId];

    return !isCompletedScheduleMission(mission) && !isFinishedSession(session);
  });
  const activeMissions = visibleMissions.filter((mission) => {
    const plannedDay = parseDateValue(mission.plannedDate);

    return !plannedDay || getCalendarDayNumber(plannedDay) >= todayDay;
  });
  useEffect(() => {
    const timer = setInterval(() => {
      const nextTodayDay = getCalendarDayNumber(new Date());
      setTodayDay((currentTodayDay) => currentTodayDay === nextTodayDay ? currentTodayDay : nextTodayDay);
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  const scheduleDateOptions = useMemo(() => getScheduleDateOptions(schedule), [schedule]);
  const tripDayLabel = useMemo(() => getTripDayLabel(schedule), [schedule]);
  const missionDateGroups = useMemo(() => {
    const groups = scheduleDateOptions.map((date) => ({
      date,
      missions: visibleMissions.filter((mission) => mission.plannedDate === date),
    }));
    const unplannedMissions = visibleMissions.filter((mission) => !mission.plannedDate || !scheduleDateOptions.includes(mission.plannedDate));

    if (unplannedMissions.length > 0) {
      groups.push({ date: 'UNPLANNED', missions: unplannedMissions });
    }

    return groups;
  }, [scheduleDateOptions, visibleMissions]);
  const canAddMission = schedule?.permissions.canAddMission ?? false;
  const isScheduleCreator = Boolean(schedule?.creatorId && currentUserId && schedule.creatorId === currentUserId);
  const requiredScheduleMemberCount = schedule?.participants.length ?? 0;
  const activeBlockingSession = Object.values(missionSessions).find((nextSession) => (
    !isFinishedSession(nextSession)
    && isParticipatingMissionMember(nextSession.members.find((member) => member.userId === currentUserId))
  )) ?? null;
  const hasStartedMissionSession = Object.values(missionSessions).some(isStartedMissionSession);
  const canInviteCompanion = (schedule?.permissions.canInviteCompanion ?? false) && !hasStartedMissionSession;
  const inviteUrl = getInviteUrl(inviteData);
  const pendingMissionLevel = getMissionCardLevel(pendingMission);
  const isMissionBlockedForPlay = useCallback((mission: TripScheduleMission) => {
    return Boolean(activeBlockingSession?.scheduleMissionId && activeBlockingSession.scheduleMissionId !== mission.scheduleMissionId);
  }, [activeBlockingSession]);

  const rememberFeedSession = useCallback((nextSession: MissionSession, fallbackScheduleMissionId?: string) => {
    const scheduleMissionId = nextSession.scheduleMissionId || fallbackScheduleMissionId;

    if (!scheduleMissionId) {
      return;
    }

    if (nextSession.status === 'CANCELLED') {
      if (!missionSessionsRef.current[scheduleMissionId] && !revealedSessionsRef.current[scheduleMissionId]) {
        return;
      }

      delete missionSessionsRef.current[scheduleMissionId];
      setMissionSessions((currentSessions) => {
        const nextSessions = { ...currentSessions };
        delete nextSessions[scheduleMissionId];
        return nextSessions;
      });
      delete revealedSessionsRef.current[scheduleMissionId];
      setRevealedSessions((currentSessions) => {
        const nextSessions = { ...currentSessions };
        delete nextSessions[scheduleMissionId];
        if (scheduleId) {
          saveCachedRevealedSessions(scheduleId, nextSessions);
        }
        return nextSessions;
      });
      return;
    }

    const normalizedIncomingSession = {
      ...nextSession,
      scheduleMissionId,
    };
    const mergedMissionSession = mergeMissionSessions(missionSessionsRef.current[scheduleMissionId], normalizedIncomingSession);
    const hasMissionSessionChanged = !hasSameMissionSessionSnapshot(missionSessionsRef.current[scheduleMissionId], mergedMissionSession);

    if (hasMissionSessionChanged) {
      missionSessionsRef.current = {
        ...missionSessionsRef.current,
        [scheduleMissionId]: mergedMissionSession,
      };
      setMissionSessions((currentSessions) => {
        const currentSession = currentSessions[scheduleMissionId];
        const nextSessions = mergeMissionSessions(currentSession, mergedMissionSession);

        if (hasSameMissionSessionSnapshot(currentSession, nextSessions)) {
          return currentSessions;
        }

        return {
          ...currentSessions,
          [scheduleMissionId]: nextSessions,
        };
      });
    }


    const shouldShowInFeed = isFeedReadySession(mergedMissionSession, requiredScheduleMemberCount) && getFeedSubmissions(mergedMissionSession).length > 0;

    if (!shouldShowInFeed) {
      return;
    }

    const normalizedSession = mergeMissionSessions(revealedSessionsRef.current[scheduleMissionId], mergedMissionSession);
    if (hasSameMissionSessionSnapshot(revealedSessionsRef.current[scheduleMissionId], normalizedSession)) {
      return;
    }

    const nextRevealedSessions = {
      ...revealedSessionsRef.current,
      [scheduleMissionId]: normalizedSession,
    };

    revealedSessionsRef.current = nextRevealedSessions;
    setRevealedSessions(() => {
      if (scheduleId) {
        saveCachedRevealedSessions(scheduleId, nextRevealedSessions);
      }

      return nextRevealedSessions;
    });
  }, [requiredScheduleMemberCount, scheduleId]);

  useEffect(() => {
    if (!activeBlockingSession?.id || !isFocused) {
      return;
    }

    const activeSessionId = activeBlockingSession.id;
    const socket = connectMissionSessionSocket(activeSessionId, {
      onError: () => {
        void getMissionSession(activeSessionId).then((nextSession) => rememberFeedSession(nextSession)).catch(() => undefined);
      },
      onMessage: ({ session: nextSession }) => {
        if (nextSession) {
          rememberFeedSession(nextSession);
        }
      },
    });

    return () => {
      socket.close();
    };
  }, [activeBlockingSession?.id, isFocused, rememberFeedSession]);



  const refreshSession = useCallback(async (sessionId: string) => {
    const nextSession = await getMissionSession(sessionId);
    rememberFeedSession(nextSession);
    return nextSession;
  }, [rememberFeedSession]);

  const refreshSchedule = useCallback(() => {
    if (!scheduleId) {
      setSchedule(null);
      setRevealedSessions({});
      setMissionSessions({});
      revealedSessionsRef.current = {};
      missionSessionsRef.current = {};
      setMessage('일정 정보가 없습니다.');
      return;
    }

    const cachedRevealedSessions = readCachedRevealedSessions(scheduleId);
    revealedSessionsRef.current = cachedRevealedSessions;
    missionSessionsRef.current = cachedRevealedSessions;
    setRevealedSessions(cachedRevealedSessions);
    setMissionSessions(cachedRevealedSessions);

    let isActive = true;

    setIsLoading(true);
    setMessage('');

    getTripSchedule(scheduleId)
      .then(async (nextSchedule) => {
        if (!isActive) {
          return;
        }

        prefetchMissionIcons(nextSchedule.missions);
        setSchedule(nextSchedule);

        void Promise.all(Object.values(cachedRevealedSessions).map(async (cachedSession) => {
          try {
            const latestSession = await getMissionSession(cachedSession.id);
            if (isActive) {
              rememberFeedSession(latestSession, cachedSession.scheduleMissionId);
            }
          } catch {
            // Cached feed sessions are best-effort and can disappear server-side.
          }
        }));

        void Promise.all(nextSchedule.missions.map(async (mission) => {
          try {
            const latestSession = await getLatestMissionSession(nextSchedule.scheduleId, mission.scheduleMissionId);
            if (isActive) {
              rememberFeedSession(latestSession, mission.scheduleMissionId);
            }
          } catch (error) {
            if (!isMissionSessionNotFoundError(error)) {
              throw error;
            }
          }
        })).catch(() => {
          // Schedule rendering should not fail just because one session refresh failed.
        });

        void getActiveMissionSession(nextSchedule.scheduleId)
          .then((activeSession) => {
            if (isActive) {
              rememberFeedSession(activeSession);
            }
          })
          .catch(() => {
            // A schedule can legitimately have no active mission session yet.
          });

        if (initialSessionId) {
          try {
            await refreshSession(initialSessionId);
          } catch (error) {
            if (isActive) {
              setMessage(error instanceof Error ? error.message : '세션을 불러오지 못했어요.');
            }
          }
        }
      })
      .catch((error) => {
        if (isActive) {
          setSchedule(null);
          setMessage(error instanceof Error ? error.message : '일정을 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [initialSessionId, refreshSession, rememberFeedSession, scheduleId]);

  useFocusEffect(refreshSchedule);

  useEffect(() => {
    if (!scheduleId || !isFocused) {
      return;
    }

    const openParticipation = (nextSession: MissionSession) => {
      const myMember = nextSession.members.find((member) => member.userId === currentUserId);

      if (
        !nextSession.id
        || leaderStartingMissionRef.current
        || suppressedLeaderSessionIdsRef.current.has(nextSession.id)
        || nextSession.id === suppressedParticipationSessionId
        || !['WAITING', 'READY'].includes(nextSession.status)
        || hasLeftMissionParticipation(myMember)
        || openingParticipationSessionIdRef.current === nextSession.id
      ) {
        return;
      }

      openingParticipationSessionIdRef.current = nextSession.id;
      rememberFeedSession(nextSession);
      const scheduleMission = schedule?.missions.find((mission) => mission.scheduleMissionId === nextSession.scheduleMissionId);
      router.replace({
        pathname: '/trip/participation',
        params: {
          scheduleId,
          scheduleMissionId: nextSession.scheduleMissionId,
          sessionId: nextSession.id,
          ...(nextSession.verificationType || scheduleMission?.verificationType
            ? { verificationType: nextSession.verificationType ?? scheduleMission?.verificationType ?? '' }
            : {}),
        },
      });
    };

    const socket = connectScheduleMissionSessionSocket(scheduleId, {
      onError: () => {
        void getActiveMissionSession(scheduleId).then((nextSession) => {
          rememberFeedSession(nextSession);
          if (nextSession.status === 'WAITING' || nextSession.status === 'READY') {
            openParticipation(nextSession);
          }
        }).catch(() => undefined);
      },
      onMessage: ({ session: nextSession, type }) => {
        if (nextSession) {
          rememberFeedSession(nextSession);
        }

        if (nextSession && (type === 'mission_session_created' || type === 'schedule_mission_snapshot')) {
          openParticipation(nextSession);
        }
      },
    });

    return () => {
      socket.close();
    };
  }, [currentUserId, isFocused, rememberFeedSession, schedule, scheduleId, suppressedParticipationSessionId]);

  useFocusEffect(
    useCallback(() => {
      if (!scheduleId) {
        return undefined;
      }

      let isActive = true;
      let isScheduleRequestInFlight = false;
      let isActiveSessionRequestInFlight = false;

      const syncSchedule = async () => {
        if (isScheduleRequestInFlight) {
          return;
        }

        isScheduleRequestInFlight = true;

        try {
          const nextSchedule = await getTripSchedule(scheduleId);

          if (!isActive) {
            return;
          }

          setSchedule((currentSchedule) => {
            if (currentSchedule && getScheduleSyncSignature(currentSchedule) === getScheduleSyncSignature(nextSchedule)) {
              return currentSchedule;
            }

            return nextSchedule;
          });
        } catch {
          // Keep the last rendered schedule when a background sync temporarily fails.
        } finally {
          isScheduleRequestInFlight = false;
        }
      };

      const syncActiveMissionSession = async () => {
        if (isActiveSessionRequestInFlight) {
          return;
        }

        isActiveSessionRequestInFlight = true;

        try {
          const activeSession = await getActiveMissionSession(scheduleId);

          if (isActive) {
            rememberFeedSession(activeSession);
          }
        } catch {
          // No active mission session is a valid state while the trip is idle.
        } finally {
          isActiveSessionRequestInFlight = false;
        }
      };

      void syncSchedule();
      void syncActiveMissionSession();

      return () => {
        isActive = false;
      };
    }, [rememberFeedSession, scheduleId])
  );

  const closeInviteSheet = () => {
    if (isSharingInvite) {
      return;
    }

    setInviteSheetVisible(false);
    setInviteMessage('');
  };

  const handleCreateInvite = async () => {
    if (!schedule?.permissions.canInviteCompanion) {
      setInviteMessage('동행자 추가 권한이 없습니다.');
      return;
    }

    if (hasStartedMissionSession) {
      setInviteMessage('이미 시작한 미션이 있어 동행자를 추가할 수 없어요.');
      return;
    }

    if (!schedule || isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);
      setInviteMessage('');
      const nextInvite = await createTripInvite({ roomName: schedule.roomName, scheduleId: schedule.scheduleId });
      setInviteData(nextInvite);
      setInviteSheetVisible(true);
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : '초대장을 만들지 못했어요.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteData || !inviteUrl || isSharingInvite) {
      return;
    }

    try {
      setIsSharingInvite(true);
      setInviteMessage('');
      await shareKakaoInvite(createKakaoInviteTemplateArgs({ ...inviteData, inviteUrl }));
      setInviteSheetVisible(false);
      setInviteMessage('카카오톡 초대장을 열었어요.');
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : '카카오 초대에 실패했어요.');
    } finally {
      setIsSharingInvite(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return;
    }

    await Clipboard.setStringAsync(inviteUrl);
    setInviteMessage('초대 링크를 복사했어요.');
  };


  const reloadCurrentSchedule = async () => {
    if (!scheduleId) {
      return null;
    }

    const nextSchedule = await getTripSchedule(scheduleId);
    setSchedule(nextSchedule);

    return nextSchedule;
  };

  const isMissionLockedForEdit = (mission: TripScheduleMission) => {
    return isCompletedScheduleMission(mission) || Boolean(missionSessions[mission.scheduleMissionId]) || isFinishedSession(revealedSessions[mission.scheduleMissionId]);
  };

  const isTemporaryMission = (mission: TripScheduleMission) => {
    const session = missionSessions[mission.scheduleMissionId];

    return Boolean(session && !isCompletedScheduleMission(mission) && !isFinishedSession(session));
  };

  const handleChangeMissionDate = async (mission: TripScheduleMission, plannedDate: string) => {
    if (!schedule?.scheduleId || busyScheduleMissionId || plannedDate === mission.plannedDate) {
      return;
    }

    if (isMissionLockedForEdit(mission)) {
      setMissionListMessage('진행 중이거나 완료된 미션은 날짜를 바꿀 수 없어요.');
      return;
    }

    try {
      setBusyScheduleMissionId(mission.scheduleMissionId);
      setMissionListMessage('');
      await updateScheduleMissionDate(schedule.scheduleId, mission.scheduleMissionId, plannedDate);
      await reloadCurrentSchedule();
      setDateEditorMissionId(null);
      setMissionListMessage(`${mission.title} 미션 날짜를 ${plannedDate}로 바꿨어요.`);
    } catch (error) {
      setMissionListMessage(error instanceof Error ? error.message : '미션 날짜를 바꾸지 못했어요.');
    } finally {
      setBusyScheduleMissionId(null);
    }
  };

  const removeScheduledMission = async (mission: TripScheduleMission) => {
    if (!schedule?.scheduleId || busyScheduleMissionId) {
      return;
    }

    if (!schedule.permissions.canRemoveMission) {
      setMissionListMessage('미션 삭제 권한이 없습니다.');
      return;
    }

    if (isMissionLockedForEdit(mission) && !isTemporaryMission(mission)) {
      setMissionListMessage('진행 중이거나 완료된 미션은 삭제할 수 없어요.');
      return;
    }

    try {
      setBusyScheduleMissionId(mission.scheduleMissionId);
      setMissionListMessage('');
      await removeMissionFromSchedule(schedule.scheduleId, mission.scheduleMissionId);
      await reloadCurrentSchedule();
      setDateEditorMissionId(null);
      setMissionSessions((currentSessions) => {
        const nextSessions = { ...currentSessions };
        delete nextSessions[mission.scheduleMissionId];
        return nextSessions;
      });
      delete missionSessionsRef.current[mission.scheduleMissionId];
      setRevealedSessions((currentSessions) => {
        const nextSessions = { ...currentSessions };
        delete nextSessions[mission.scheduleMissionId];
        if (scheduleId) {
          saveCachedRevealedSessions(scheduleId, nextSessions);
        }
        return nextSessions;
      });
      delete revealedSessionsRef.current[mission.scheduleMissionId];
      setMissionListMessage(`${mission.title} 미션을 삭제했어요.`);
    } catch (error) {
      setMissionListMessage(error instanceof Error ? error.message : '미션을 삭제하지 못했어요.');
    } finally {
      setBusyScheduleMissionId(null);
    }
  };

  const handleRemoveScheduledMission = (mission: TripScheduleMission) => {
    Alert.alert('미션 삭제', `${mission.title} 미션을 일정에서 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void removeScheduledMission(mission) },
    ]);
  };
  const openMissionDetail = () => {
    if (!schedule?.scheduleId) {
      setMessage('일정 정보가 없습니다.');
      return;
    }

    router.push({
      pathname: '/mission/detail',
      params: { scheduleId: schedule.scheduleId },
    });
  };

  const openMissionSession = (mission: TripScheduleMission) => {
    if (!schedule?.scheduleId || isSessionBusy) {
      return;
    }

    if (isMissionBlockedForPlay(mission)) {
      setMessage('진행 중인 미션을 먼저 완료해주세요.');
      return;
    }

    setMessage('');
    setMissionListVisible(false);

    if (isScheduleCreator && mission.verificationType?.toUpperCase() === 'GPS_PHOTO') {
      setIsSessionBusy(true);
      void getCurrentParticipationLocation()
        .then((location) => {
          pendingMissionLocationRef.current = location;
          setPendingMission(mission);
        })
        .catch((error) => {
          setMessage(getMissionStartErrorMessage(error));
        })
        .finally(() => {
          setIsSessionBusy(false);
        });
      return;
    }

    setPendingMission(mission);
  };

  const startPendingMission = async () => {
    if (!schedule?.scheduleId || !pendingMission || isSessionBusy) {
      return;
    }

    const mission = pendingMission;
    const requiresGps = isScheduleCreator && mission.verificationType?.toUpperCase() === 'GPS_PHOTO';
    let createdSessionId: string | null = null;

    try {
      setIsSessionBusy(true);
      setMessage('');
      leaderStartingMissionRef.current = true;
      const createdSession = await createMissionSession(schedule.scheduleId, mission.scheduleMissionId);
      createdSessionId = createdSession.id;
      const nextSession = requiresGps
        ? await chooseMissionParticipation(
          createdSession.id,
          'PARTICIPATE',
          pendingMissionLocationRef.current ?? await getCurrentParticipationLocation(),
        )
        : createdSession;

      rememberFeedSession(nextSession, mission.scheduleMissionId);
      pendingMissionLocationRef.current = null;
      setPendingMission(null);
      router.push({
        pathname: '/trip/participation',
        params: {
          scheduleId: schedule.scheduleId,
          scheduleMissionId: mission.scheduleMissionId,
          sessionId: nextSession.id,
          ...(nextSession.verificationType || mission.verificationType
            ? { verificationType: nextSession.verificationType ?? mission.verificationType ?? '' }
            : {}),
        },
      });
    } catch (error) {
      if (createdSessionId) {
        suppressedLeaderSessionIdsRef.current.add(createdSessionId);
      }
      pendingMissionLocationRef.current = null;
      setPendingMission(null);
      setMessage(getMissionStartErrorMessage(error));
    } finally {
      leaderStartingMissionRef.current = false;
      setIsSessionBusy(false);
    }
  };

  const getMissionPhotos = (mission: TripScheduleMission) => {
    const feedSession = missionSessions[mission.scheduleMissionId] ?? revealedSessions[mission.scheduleMissionId];
    const isMissionResultComplete = feedSession?.status === 'COMPLETED';

    return getFeedSubmissions(feedSession).map((submission) => ({
      id: submission.id,
      imageUrl: submission.imageUrl,
      isBlurred: !isMissionResultComplete && submission.userId !== currentUserId,
    }));
  };

  const openFeedSession = (targetSession: MissionSession | undefined) => {
    if (!targetSession?.id || !isFeedReadySession(targetSession, requiredScheduleMemberCount)) {
      return;
    }

    if (targetSession.status === 'VOTING') {
      router.push({
        pathname: '/trip/vote',
        params: {
          ...(scheduleId ? { scheduleId } : {}),
          sessionId: targetSession.id,
        },
      });
      return;
    }

    if (targetSession.status === 'COMPLETED') {
      router.push({
        pathname: '/trip/result',
        params: {
          ...(scheduleId ? { scheduleId } : {}),
          sessionId: targetSession.id,
        },
      });
      return;
    }

    router.push({
      pathname: '/trip/review',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId: targetSession.id,
      },
    });
  };

  const completedMissionFeeds = missions
    .map((mission) => {
      const session = missionSessions[mission.scheduleMissionId] ?? revealedSessions[mission.scheduleMissionId];

      return { mission, photos: getMissionPhotos(mission), session };
    })
    .filter((item) => item.photos.length > 0);
  const hasSavedMissions = missions.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: hasSavedMissions ? 24 : 0,
            paddingHorizontal: horizontalPadding,
            paddingTop: topSafeInset + 28,
          },
        ]}
        scrollEnabled={hasSavedMissions || isLoading || Boolean(message)}
        showsVerticalScrollIndicator={false}>
        <View style={styles.tripHeader}>
          <View style={styles.tripTitleBlock}>
            <View style={styles.tripTitleRow}>
              <Text numberOfLines={2} style={styles.tripTitle}>{schedule?.roomName ?? '여행 일정'}</Text>
              {isScheduleCreator ? <Image contentFit="contain" source={crownIcon} style={styles.creatorCrown} /> : null}
            </View>
            <Text style={styles.companionsText}>{getParticipantText(schedule)}</Text>
          </View>
          <View style={styles.headerActions}>
            {canInviteCompanion ? (
              <ScalePressable accessibilityLabel="동행자 추가" disabled={!schedule || isCreatingInvite} onPress={handleCreateInvite} pressedScale={0.9} style={styles.settingsButton}>
                {isCreatingInvite ? <ActivityIndicator color="#8A9194" /> : <Image source={activeAddPeopleIcon} style={styles.headerIcon} contentFit="contain" />}
              </ScalePressable>
            ) : null}
            <ScalePressable accessibilityLabel="여행 설정" onPress={() => schedule?.scheduleId && router.push({ pathname: '/trip/edit' as never, params: { scheduleId: schedule.scheduleId } })} pressedScale={0.9} style={styles.settingsButton}>
              <Image source={activeSettingIcon} style={styles.headerIcon} contentFit="contain" />
            </ScalePressable>
          </View>
        </View>
        <Text style={styles.sectionLabel}>미션 리스트</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -horizontalPadding }}
          contentContainerStyle={[styles.photoStrip, { paddingHorizontal: horizontalPadding }]}>
          {canAddMission ? (
            <ScalePressable accessibilityRole="button" accessibilityLabel="미션 상세 리스트 열기" disabled={!schedule} onPress={openMissionDetail} pressedScale={0.96} style={styles.inviteTile}>
              <Image source={activeAddIcon} style={styles.addTileIcon} contentFit="contain" />
              <Text style={styles.addTileText}>미션추가</Text>
            </ScalePressable>
          ) : null}
          {activeMissions.map((mission) => {
            const isPlayBlocked = isMissionBlockedForPlay(mission);
            const isTodayMission = mission.plannedDate === formatDateValue(new Date());

            return (
            <ScalePressable disabled={!isTodayMission || isPlayBlocked} key={mission.scheduleMissionId} onPress={() => openMissionSession(mission)} pressedScale={0.96} style={[styles.photoTile, isPlayBlocked && styles.blockedMissionTile]}>
              <Svg height="100%" pointerEvents="none" style={styles.photoTileGradient} viewBox="0 0 82 96" width="100%">
                <Rect fill={isTodayMission ? '#AFD8E5' : '#C3D2D7'} height="96" rx="28" width="82" x="0" y="0" />
              </Svg>
              <View style={styles.photoTileInner}>
                <View style={[styles.missionTileContent, isTodayMission ? styles.todayMissionTileInner : styles.futureMissionTileInner]}>
                  {isTodayMission && mission.emojiUrl ? <Image source={{ uri: mission.emojiUrl }} style={styles.missionTileIcon} contentFit="contain" /> : null}
                </View>
              </View>
            </ScalePressable>
            );
          })}
        </ScrollView>
        {inviteMessage && !inviteSheetVisible ? <Text style={styles.inlineMessage}>{inviteMessage}</Text> : null}

        <View style={[styles.feedPanel, !hasSavedMissions && styles.emptyFeedPanel]}>
          <Text style={styles.dayLabel}>{tripDayLabel}</Text>
          {isLoading && !schedule ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#409CB7" />
              <Text style={styles.stateText}>담긴 미션을 불러오는 중이에요.</Text>
            </View>
          ) : message ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{message}</Text>
            </View>
          ) : missions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>아직 담긴 미션이 없어요</Text>
              <Text style={styles.emptyText}>미션 상세 리스트에서 원하는 미션을 담아보세요.</Text>
            </View>
          ) : completedMissionFeeds.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>아직 찍은 사진이 없어요</Text>
              <Text style={styles.emptyText}>카메라로 미션 사진을 찍으면 여기에 보여요.</Text>
            </View>
          ) : (
            completedMissionFeeds.map(({ mission, photos, session: feedSession }) => {
              const canOpenFeed = Boolean(feedSession && isFeedReadySession(feedSession, requiredScheduleMemberCount));

              return (
              <ScalePressable disabled={!canOpenFeed} key={mission.scheduleMissionId} onPress={() => openFeedSession(feedSession)} pressedScale={0.99} style={styles.feedMissionItem}>
                <View style={styles.feedIcon}>
                  <Image source={activeAddIcon} style={styles.feedCameraIcon} contentFit="contain" />
                </View>
                <View style={styles.feedCopy}>
                  <Text style={styles.feedTitle}>{mission.title}</Text>
                  <Text style={styles.feedLocation}>{getMissionLocation(mission)}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedPhotoRow}>
                    {photos.map((photo) => (
                      <Image blurRadius={photo.isBlurred ? 18 : 0} key={`${mission.scheduleMissionId}-${photo.id}`} source={{ uri: photo.imageUrl }} style={styles.feedPhoto} contentFit="cover" />
                    ))}
                  </ScrollView>
                </View>
              </ScalePressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={missionListVisible} onRequestClose={() => setMissionListVisible(false)}>
        <Pressable accessibilityLabel="담긴 미션 닫기" onPress={() => setMissionListVisible(false)} style={styles.modalBackdrop}>
          <Pressable style={styles.missionPanel}>
            <Text style={styles.panelTitle}>날짜별 담긴 미션</Text>
            {missionListMessage ? <Text style={styles.missionListMessage}>{missionListMessage}</Text> : null}
            <ScrollView contentContainerStyle={styles.panelMissionList} showsVerticalScrollIndicator={false}>
              {visibleMissions.length === 0 ? (
                <View style={styles.panelEmptyBox}>
                  <Text style={styles.emptyTitle}>담긴 미션이 없어요</Text>
                  <Text style={styles.emptyText}>미션 상세 리스트에서 원하는 미션을 담아보세요.</Text>
                </View>
              ) : missionDateGroups.map((group) => (
                <View key={group.date} style={styles.missionDateGroup}>
                  <Text style={styles.missionDateTitle}>{getMissionDateLabel(group.date)}</Text>
                  {group.missions.length === 0 ? (
                    <View style={styles.emptyDateBox}>
                      <Text style={styles.emptyDateText}>담긴 미션 없음</Text>
                    </View>
                  ) : group.missions.map((mission) => {
                    const isBusy = busyScheduleMissionId === mission.scheduleMissionId;
                    const isLocked = isMissionLockedForEdit(mission);
                    const isTemporary = isTemporaryMission(mission);
                    const isPlayBlocked = isMissionBlockedForPlay(mission);
                    const canEditMission = !isLocked && !isBusy;
                    const canDeleteMission = !isBusy && !isCompletedScheduleMission(mission) && (!isLocked || isTemporary);

                    return (
                      <View key={mission.scheduleMissionId} style={styles.panelMissionItem}>
                        <ScalePressable accessibilityRole="button" disabled={isBusy || isPlayBlocked} onPress={() => openMissionSession(mission)} pressedScale={0.98} style={[styles.panelMissionOpenArea, isPlayBlocked && styles.blockedMissionOpenArea]}>
                          {mission.photoUrl ? <Image source={{ uri: mission.photoUrl }} style={styles.panelMissionPhoto} contentFit="cover" /> : <View style={styles.panelMissionPhotoPlaceholder} />}
                          <View style={styles.panelMissionCopy}>
                            <Text numberOfLines={1} style={styles.panelMissionTitle}>{mission.title}</Text>
                            <Text numberOfLines={2} style={styles.panelMissionDescription}>{mission.description}</Text>
                            <Text style={styles.panelMissionStatus}>{mission.status ?? 'ADDED'}</Text>
                          </View>
                        </ScalePressable>
                        <View style={styles.panelMissionActions}>
                          <ScalePressable accessibilityLabel="미션 날짜 변경" disabled={!canEditMission} onPress={() => setDateEditorMissionId((currentId) => currentId === mission.scheduleMissionId ? null : mission.scheduleMissionId)} pressedScale={0.9} style={[styles.iconActionButton, !canEditMission && styles.disabledButton]}>
                            {isBusy ? <ActivityIndicator color="#626E75" /> : <Ionicons color="#626E75" name="calendar-outline" size={18} />}
                          </ScalePressable>
                          <ScalePressable accessibilityLabel="미션 삭제" disabled={!canDeleteMission || !schedule?.permissions.canRemoveMission} onPress={() => handleRemoveScheduledMission(mission)} pressedScale={0.9} style={[styles.iconActionButton, (!canDeleteMission || !schedule?.permissions.canRemoveMission) && styles.disabledButton]}>
                            <Ionicons color="#D06958" name="trash-outline" size={18} />
                          </ScalePressable>
                        </View>
                        {dateEditorMissionId === mission.scheduleMissionId ? (
                          <View style={styles.dateEditorGrid}>
                            {scheduleDateOptions.map((date) => {
                              const isSelectedDate = mission.plannedDate === date;

                              return (
                                <ScalePressable
                                  accessibilityRole="button"
                                  disabled={isSelectedDate || isBusy}
                                  key={date}
                                  onPress={() => handleChangeMissionDate(mission, date)}
                                  pressedScale={0.96}
                                  style={[styles.dateEditorOption, isSelectedDate && styles.selectedDateEditorOption, isBusy && styles.disabledButton]}>
                                  <Text style={[styles.dateEditorText, isSelectedDate && styles.selectedDateEditorText]}>{date}</Text>
                                </ScalePressable>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <TripInviteSheet
        bottomSafeInset={bottomSafeInset}
        invite={inviteData}
        isSharing={isSharingInvite}
        message={inviteMessage}
        onClose={closeInviteSheet}
        onCopy={() => void handleCopyInviteLink()}
        onShare={() => void handleShareInvite()}
        visible={inviteSheetVisible}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (!isSessionBusy) {
            pendingMissionLocationRef.current = null;
            setPendingMission(null);
          }
        }}
        transparent
        visible={Boolean(pendingMission)}>
        <Pressable
          accessibilityLabel="미션 시작 팝업 닫기"
          disabled={isSessionBusy}
          onPress={() => {
            pendingMissionLocationRef.current = null;
            setPendingMission(null);
          }}
          style={styles.missionStartOverlay}>
          <Pressable style={[styles.missionStartDialog, { paddingBottom: bottomSafeInset + 22 }]}>
            <Image contentFit="fill" source={pendingMissionLevel.frame} style={styles.missionStartFrame} />
            <View style={styles.missionStartContent}>
              <Text numberOfLines={2} style={[styles.missionStartQuestion, { color: pendingMissionLevel.titleColor }]}>{pendingMission?.title ?? '미션'}</Text>
              {pendingMission?.emojiUrl ? <Image contentFit="contain" source={{ uri: pendingMission.emojiUrl }} style={styles.missionStartCardIcon} /> : <Ionicons color={pendingMissionLevel.titleColor} name="camera-outline" size={72} />}

              <Text numberOfLines={3} style={[styles.missionStartDescription, { color: pendingMissionLevel.accentColor }]}>{pendingMission?.description ?? '미션 설명이 아직 없습니다.'}</Text>
              <ScalePressable
                disabled={isSessionBusy}
                onPress={startPendingMission}
                pressedScale={0.97}
                style={[styles.missionStartButton, { backgroundColor: '#63B5CD' }]}>
                {isSessionBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.missionStartButtonText}>미션 시작하기</Text>}
              </ScalePressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  scrollContent: {
    backgroundColor: '#ffffff',
    paddingTop: 28,
  },
  tripHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    marginBottom: 38,
    marginTop: 12,
  },
  tripTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  tripTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  tripTitle: {
    color: '#2D3C43',
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 37,
  },
  creatorCrown: {
    height: 20,
    width: 20,
  },
  companionsText: {
    color: '#8A9194',
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  settingsButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerIcon: {
    height: 20,
    width: 20,
  },
  sectionLabel: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  photoStrip: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 24,
  },
  inviteTile: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E7EAEB',
    height: 98,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 80,
  },
  addTileIcon: {
    height: 20,
    width: 20,
  },
  addTileText: {
    color: '#8A9194',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 8,
  },
  photoTile: {
    alignItems: 'center',
    height: 96,
    justifyContent: 'center',
    overflow: 'visible',
    transform: [{ rotate: '4deg' }],
    width: 82,
  },
  blockedMissionTile: {
    opacity: 0.35,
  },
  photoTileGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  photoTileInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 86,
    overflow: 'hidden',
    padding: 4,
    width: 72,
  },
  missionTileContent: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  todayMissionTileInner: {
    backgroundColor: '#AFD8E5',
  },
  futureMissionTileInner: {
    backgroundColor: '#C3D2D7',
  },
  missionTileIcon: {
    height: 58,
    width: 58,
  },
  photoTileImage: {
    borderRadius: 19,
    height: '100%',
    width: '100%',
  },
  photoTilePlaceholder: {
    backgroundColor: '#D7E2E8',
    borderRadius: 19,
    height: '100%',
    width: '100%',
  },
  inlineMessage: {
    color: '#409CB7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  feedPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginHorizontal: -24,
    marginTop: 28,
    minHeight: 520,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  emptyFeedPanel: {
    minHeight: 0,
    paddingBottom: 30,
  },
  dayLabel: {
    borderBottomColor: '#E7EAEB',
    borderBottomWidth: 1,
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: -24,
    marginBottom: 28,
    paddingBottom: 14,
    paddingHorizontal: 24,
  },
  feedMissionItem: {
    flexDirection: 'row',
    gap: 15,
    paddingBottom: 38,
  },
  feedIcon: {
    alignItems: 'center',
    backgroundColor: '#6EA6BF',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  feedCameraIcon: {
    height: 18,
    width: 18,
  },
  feedCopy: {
    flex: 1,
  },
  feedTitle: {
    color: '#10161F',
    fontSize: 14,
    fontWeight: '600',
  },
  feedLocation: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  feedPhotoRow: {
    gap: 14,
    paddingRight: 24,
    paddingTop: 22,
  },
  feedPhoto: {
    backgroundColor: '#E3E9EC',
    borderRadius: 14,
    height: 170,
    width: 128,
  },
  feedPhotoPlaceholder: {
    backgroundColor: '#E3E9EC',
    borderRadius: 14,
    height: 170,
    width: 128,
  },
  stateBox: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  stateText: {
    color: '#8A9194',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 34,
  },
  emptyTitle: {
    color: '#2D3C43',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyButton: {
    alignItems: 'center',
    backgroundColor: '#6EA6BF',
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 22,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 34,
  },
  missionStartOverlay: {
    backgroundColor: 'rgba(16, 22, 31, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  missionStartDialog: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 450,
    overflow: 'hidden',
    paddingBottom: 22,
    paddingHorizontal: 20,
    paddingTop: 30,
    position: 'relative',
    width: '100%',
  },
  missionStartFrame: {
    bottom: -20,
    left: -20,
    position: 'absolute',
    right: -20,
    top: -20,
    transform: [{ scale: 1.5 }],
    zIndex: 0,
  },
  missionStartContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  missionStartCardIcon: {
    height: 150,
    marginVertical: 12,
    width: 150,
  },

  missionStartQuestion: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 36,
    textAlign: 'center',
  },
  missionStartDescription: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  missionStartButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 55,
    justifyContent: 'center',
    marginTop: 28,
    width: '100%',
  },
  missionCompletedButton: {
    backgroundColor: '#C3D2D7',
  },
  missionStartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  missionPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    maxHeight: '72%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  panelTitle: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  missionListMessage: {
    color: '#409CB7',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 12,
  },
  panelMissionList: {
    gap: 12,
  },
  panelEmptyBox: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  missionDateGroup: {
    gap: 8,
  },
  missionDateTitle: {
    color: '#53626A',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptyDateBox: {
    backgroundColor: '#F4F7F8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyDateText: {
    color: '#9AA3A8',
    fontSize: 12,
    fontWeight: '600',
  },
  panelMissionItem: {
    backgroundColor: '#F4F7F8',
    borderRadius: 16,
    gap: 10,
    padding: 12,
  },
  panelMissionOpenArea: {
    flexDirection: 'row',
    gap: 12,
  },
  blockedMissionOpenArea: {
    opacity: 0.45,
  },
  panelMissionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  iconActionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  dateEditorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateEditorOption: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  selectedDateEditorOption: {
    backgroundColor: '#409CB7',
  },
  dateEditorText: {
    color: '#53626A',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedDateEditorText: {
    color: '#FFFFFF',
  },
  panelMissionPhoto: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionPhotoPlaceholder: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionCopy: {
    flex: 1,
  },
  panelMissionTitle: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
  },
  panelMissionDescription: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  panelMissionStatus: {
    color: '#409CB7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  inviteModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
  },
  invitePanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingTop: 23,
    width: '100%',
  },
  invitePanelTitle: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 32,
  },
  inviteOptionsRow: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 32,
    paddingTop: 27,
  },
  inviteOption: {
    alignItems: 'center',
    gap: 7,
    width: 72,
  },
  kakaoInviteAvatar: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderRadius: 999,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  kakaoTalkText: {
    color: '#3A2D00',
    fontSize: 10,
    fontWeight: '800',
  },
  inviteContactAvatar: {
    backgroundColor: '#E9EDF0',
    borderRadius: 999,
    height: 62,
    position: 'relative',
    width: 62,
  },
  contactKakaoBadge: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 21,
  },
  contactKakaoText: {
    color: '#3A2D00',
    fontSize: 5,
    fontWeight: '800',
  },
  inviteOptionText: {
    color: '#72787D',
    fontSize: 12,
    fontWeight: '500',
  },
  inviteDivider: {
    backgroundColor: '#E8ECEF',
    height: 1,
    marginTop: 20,
  },
  copyInviteButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E9EDF0',
    borderRadius: 16,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 28,
    width: '77%',
  },
  copyInviteText: {
    color: '#626E75',
    fontSize: 13,
    fontWeight: '600',
  },
  inviteMessageText: {
    color: '#409CB7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    paddingHorizontal: 32,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
