import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { useTutorialTarget, type TutorialTargetId } from '@/components/tutorial-provider';
import { getAuthItem } from '@/lib/auth-storage';
import { getActiveMissionSession, type MissionSession } from '@/lib/mission-session-api';
import { getCachedTripSchedules, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';

const hiddenPathnames = ['/', '/login', '/terms', '/terms-detail', '/welcome', '/onboarding/step1', '/auth/callback', '/main/waiting', '/trip/participation', '/trip/capture', '/trip/review', '/trip/vote', '/trip/vote-waiting', '/trip/result', '/trip/edit'];

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const navItems: {
  accessibilityLabel: string;
  href: Href;
  icon: FeatherIconName;
  match: string[];
  tutorialId?: TutorialTargetId;
  type: 'standard' | 'camera';
}[] = [
  {
    accessibilityLabel: '홈',
    href: '/main',
    icon: 'home',
    match: ['/main'],
    tutorialId: 'home-nav',
    type: 'standard',
  },
  {
    accessibilityLabel: '미션',
    href: '/map',
    icon: 'flag',
    match: ['/mission/detail', '/mission/locked', '/map', '/map/district'],
    tutorialId: 'mission-nav',
    type: 'standard',
  },
  {
    accessibilityLabel: '카메라',
    href: '/trip/capture',
    icon: 'camera',
    match: ['/trip/capture'],
    type: 'camera',
  },
  {
    accessibilityLabel: '일정',
    href: '/trip/hub',
    icon: 'calendar',
    match: ['/trip', '/trip/hub', '/trip/invite', '/trip/active', '/trip/after', '/trip/result'],
    type: 'standard',
  },
  {
    accessibilityLabel: '프로필',
    href: '/main/profile',
    icon: 'user',
    match: ['/main/profile', '/main/profile-edit'],
    tutorialId: 'profile-nav',
    type: 'standard',
  },
];

function isActivePath(pathname: string, matchers: string[]) {
  return matchers.includes(pathname);
}

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isScheduleInProgress(schedule: TripSchedule) {
  const getDateKey = (date: string | undefined) => {
    if (!date) {
      return null;
    }

    const match = date.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    return match ? [match[1], match[2].padStart(2, '0'), match[3].padStart(2, '0')].join('-') : null;
  };
  const startDate = getDateKey(schedule.startDate);
  const endDate = getDateKey(schedule.endDate ?? schedule.startDate);

  if (!startDate || !endDate) {
    return false;
  }

  const today = new Date();
  const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  return startDate <= todayKey && todayKey <= endDate;
}

type ActiveMissionTarget = {
  scheduleId: string;
  scheduleMissionId: string;
  sessionId: string;
};

function toActiveMissionTarget(scheduleId: string, session: MissionSession): ActiveMissionTarget | null {
  const currentUserId = getAuthItem('user_id');
  const myMember = session.members.find((member) => member.userId === currentUserId);
  const isFinished = session.completedAt || ['VOTING', 'REVEALED', 'COMPLETED', 'CANCELLED'].includes(session.status);
  const canShoot = ['SHOOTING', 'UPLOADING'].includes(session.status) && myMember?.participationStatus === 'PARTICIPATING';

  if (!session.scheduleMissionId || !session.id || isFinished || !canShoot) {
    return null;
  }

  return {
    scheduleId,
    scheduleMissionId: session.scheduleMissionId,
    sessionId: session.id,
  };
}

function areActiveMissionTargetsEqual(left: ActiveMissionTarget | null, right: ActiveMissionTarget | null) {
  return left?.scheduleId === right?.scheduleId
    && left?.scheduleMissionId === right?.scheduleMissionId
    && left?.sessionId === right?.sessionId;
}

export function BottomNavigationBar() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ scheduleId?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const [activeMission, setActiveMission] = useState<ActiveMissionTarget | null>(null);
  const [isCheckingMission, setIsCheckingMission] = useState(true);
  const homeTarget = useTutorialTarget('home-nav', { height: 44, offsetY: 26, width: 44 });
  const missionTarget = useTutorialTarget('mission-nav', { height: 44, offsetY: 26, width: 44 });
  const profileTarget = useTutorialTarget('profile-nav', { height: 44, offsetY: 26, width: 44 });

  const refreshActiveMission = useCallback(async () => {
    if (!getAuthItem('access_token')) {
      setActiveMission(null);
      setIsCheckingMission(false);
      return;
    }

    setIsCheckingMission(true);

    try {
      const currentScheduleId = pathname === '/trip/active' ? getParamValue(params.scheduleId) : undefined;

      if (currentScheduleId) {
        try {
          const session = await getActiveMissionSession(currentScheduleId);
          const nextActiveMission = toActiveMissionTarget(currentScheduleId, session);
          setActiveMission((currentActiveMission) => areActiveMissionTargetsEqual(currentActiveMission, nextActiveMission) ? currentActiveMission : nextActiveMission);
          return;
        } catch {
          setActiveMission(null);
          return;
        }
      }

      let schedules = getCachedTripSchedules();
      try {
        schedules = await listTripSchedules();
      } catch {
        // Cached schedules still allow the active-session check to recover on a temporary network failure.
      }

      const activeTargets = await Promise.all(
        schedules.filter(isScheduleInProgress).map(async (schedule) => {
          try {
            const session = await getActiveMissionSession(schedule.scheduleId);
            return toActiveMissionTarget(schedule.scheduleId, session);
          } catch {
            return null;
          }
        })
      );

      const nextActiveMission = activeTargets.find((target): target is ActiveMissionTarget => target !== null) ?? null;
      setActiveMission((currentActiveMission) => areActiveMissionTargetsEqual(currentActiveMission, nextActiveMission) ? currentActiveMission : nextActiveMission);
    } finally {
      setIsCheckingMission(false);
    }
  }, [params.scheduleId, pathname]);

  useEffect(() => {
    let isActive = true;

    const refresh = async () => {
      if (isActive) {
        await refreshActiveMission();
      }
    };

    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, [refreshActiveMission]);

  if (hiddenPathnames.includes(pathname)) {
    return null;
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomInset }]}>
      <View style={styles.bar}>
        {navItems.map((item) => {
          const isActive = isActivePath(pathname, item.match);
          const isCamera = item.type === 'camera';
          const isCameraEnabled = Boolean(activeMission) && !isCheckingMission;
          const color = isCamera ? isCameraEnabled ? '#ffffff' : '#E4E9EB' : isActive ? '#6EA4BF' : '#8A9194';
          const tutorialTarget = item.tutorialId === 'home-nav'
            ? homeTarget
            : item.tutorialId === 'mission-nav'
              ? missionTarget
              : item.tutorialId === 'profile-nav'
                ? profileTarget
                : null;

          const handlePress = () => {
            if (isCamera) {
              if (!activeMission || !isCameraEnabled) {
                return;
              }

              router.push({
                pathname: '/trip/capture',
                params: activeMission,
              });
              return;
            }

            router.push(item.href);
          };

          return (
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: isCamera && !isCameraEnabled, selected: isActive }}
              disabled={isCamera && !isCameraEnabled}
              hitSlop={10}
              key={item.accessibilityLabel}
              onPress={handlePress}
              onLayout={tutorialTarget?.onLayout}
              ref={tutorialTarget?.ref}
              style={[styles.item, isCamera && styles.cameraItem]}>
              <View style={[isCamera ? styles.cameraButton : styles.iconSlot, isCamera && !isCameraEnabled && styles.cameraButtonDisabled]}>
                <Feather name={item.icon} size={isCamera ? 23 : 22} color={color} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const BOTTOM_NAVIGATION_RESERVED_HEIGHT = 52;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: BOTTOM_NAVIGATION_RESERVED_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  item: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 48,
  },
  cameraItem: {
    transform: [{ translateY: -12 }],
    width: 58,
  },
  iconSlot: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  cameraButton: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  cameraButtonDisabled: {
    backgroundColor: '#B8C5C9',
  },
});
