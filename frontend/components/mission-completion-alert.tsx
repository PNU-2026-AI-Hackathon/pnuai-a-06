import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { getAuthItem, MISSION_COMPLETION_PENDING_KEY, setAuthItem } from '@/lib/auth-storage';
import { getLatestMissionSession, getMissionSession, type MissionSession } from '@/lib/mission-session-api';
import { getCachedTripSchedules, listTripSchedules, type TripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';

type CompletionAlert = {
  mission: TripScheduleMission;
  scheduleId: string;
  session: MissionSession;
};

function hasAllMemberSubmissions(session: MissionSession, memberCount: number) {
  const expectedMemberCount = Math.max(session.members.length, memberCount);

  if (expectedMemberCount <= 1) {
    return false;
  }

  const passedUserIds = new Set(session.submissions.filter((submission) => submission.judgeStatus === 'PASSED').map((submission) => submission.userId).filter(Boolean));
  return passedUserIds.size >= expectedMemberCount;
}

export function MissionCompletionAlert() {
  const pathname = usePathname();
  const [alert, setAlert] = useState<CompletionAlert | null>(null);
  const alertRef = useRef<CompletionAlert | null>(null);
  const queuedAlertsRef = useRef<CompletionAlert[]>([]);
  const notifiedSessionIdsRef = useRef(new Set<string>());
  const schedulesRef = useRef<TripSchedule[]>([]);
  const lastScheduleRefreshAtRef = useRef(0);
  const isCheckingRef = useRef(false);

  const showNextAlert = useCallback(() => {
    if (alertRef.current || queuedAlertsRef.current.length === 0) {
      return;
    }

    const nextAlert = queuedAlertsRef.current.shift() ?? null;
    alertRef.current = nextAlert;
    setAlert(nextAlert);
  }, []);

  const checkMissionCompletions = useCallback(async () => {
    if (isCheckingRef.current || !getAuthItem('access_token')) {
      return;
    }

    isCheckingRef.current = true;

    try {
      const now = Date.now();
      if (schedulesRef.current.length === 0 || now - lastScheduleRefreshAtRef.current >= 15000) {
        try {
          schedulesRef.current = await listTripSchedules();
          lastScheduleRefreshAtRef.current = now;
        } catch {
          schedulesRef.current = getCachedTripSchedules();
        }
      }

      const pendingCompletion = getAuthItem(MISSION_COMPLETION_PENDING_KEY);
      let pendingSessionId: string | null = null;

      if (pendingCompletion) {
        try {
          pendingSessionId = (JSON.parse(pendingCompletion) as { sessionId?: string }).sessionId ?? null;
        } catch {
          pendingSessionId = null;
        }
      }

      const completionAlerts = (await Promise.all(schedulesRef.current.flatMap((schedule) => schedule.missions.map(async (mission) => {
        try {
          const latestSession = await getLatestMissionSession(schedule.scheduleId, mission.scheduleMissionId);
          const session = pendingSessionId === latestSession.id ? await getMissionSession(latestSession.id) : latestSession;

          if (pendingSessionId === session.id && pathname !== '/trip/active') {
            return null;
          }

          if (pendingSessionId !== session.id && (session.status === 'VOTING' || session.status === 'COMPLETED')) {
            return null;
          }

          if (!hasAllMemberSubmissions(session, schedule.participants.length)) {
            return null;
          }

          return {
            mission,
            scheduleId: schedule.scheduleId,
            session,
          } satisfies CompletionAlert;
        } catch {
          return null;
        }
      })))).filter((nextAlert): nextAlert is CompletionAlert => Boolean(nextAlert));

      completionAlerts.forEach((nextAlert) => {
        const sessionKey = `${nextAlert.scheduleId}:${nextAlert.session.id}`;
        if (notifiedSessionIdsRef.current.has(sessionKey)) {
          return;
        }

        notifiedSessionIdsRef.current.add(sessionKey);
        queuedAlertsRef.current.push(nextAlert);

        if (pendingSessionId === nextAlert.session.id) {
          setAuthItem(MISSION_COMPLETION_PENDING_KEY, '');
        }
      });

      showNextAlert();
    } finally {
      isCheckingRef.current = false;
    }
  }, [pathname, showNextAlert]);

  useEffect(() => {
    void checkMissionCompletions();
    const timer = setInterval(() => {
      void checkMissionCompletions();
    }, 4000);

    return () => clearInterval(timer);
  }, [checkMissionCompletions]);

  const closeAlert = () => {
    alertRef.current = null;
    setAlert(null);
    setTimeout(showNextAlert, 250);
  };

  const openReview = () => {
    if (!alert) {
      return;
    }

    const target = alert;
    closeAlert();
    router.push({
      pathname: '/trip/review',
      params: {
        scheduleId: target.scheduleId,
        sessionId: target.session.id,
      },
    });
  };

  return (
    <Modal animationType="fade" transparent visible={Boolean(alert)} onRequestClose={closeAlert}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Pressable accessibilityLabel="미션 완료 알림 닫기" onPress={closeAlert} style={styles.closeButton}>
            <Ionicons color="#829198" name="close" size={20} />
          </Pressable>
          <View style={styles.badge}>
            <Ionicons color="#FFFFFF" name="checkmark" size={22} />
          </View>
          <Text style={styles.title}>사진 찍기 미션 완료!</Text>
          <Text style={styles.description}>이제 서로의 사진을 감상하고 댓글을 남겨보세요.</Text>
          <View style={styles.missionCard}>
            {alert?.mission.emojiUrl ? <Image source={{ uri: alert.mission.emojiUrl }} style={styles.missionIcon} contentFit="contain" /> : <Ionicons color="#6EA6BF" name="camera-outline" size={38} />}
            <View style={styles.missionCopy}>
              <Text numberOfLines={1} style={styles.missionTitle}>{alert?.mission.title ?? alert?.session.missionTitle ?? '미션'}</Text>
              <Text style={styles.missionMeta}>사진 {alert?.session.submissions.length ?? 0}장 제출 완료</Text>
            </View>
          </View>
          <ScalePressable onPress={openReview} pressedScale={0.97} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>확인하러 가기</Text>
            <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
          </ScalePressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 21, 29, 0.76)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    elevation: 18,
    maxWidth: 420,
    paddingBottom: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    shadowColor: '#10212A',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 14,
    width: 34,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  title: {
    color: '#20292E',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 28,
    marginTop: 18,
    textAlign: 'center',
  },
  description: {
    color: '#7D878C',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  missionCard: {
    alignItems: 'center',
    backgroundColor: '#F1F8FA',
    borderColor: '#D8ECF2',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  missionIcon: {
    height: 52,
    marginRight: 12,
    width: 52,
  },
  missionCopy: {
    flex: 1,
    minWidth: 0,
  },
  missionTitle: {
    color: '#26343A',
    fontSize: 15,
    fontWeight: '700',
  },
  missionMeta: {
    color: '#7D9BA7',
    fontSize: 12,
    marginTop: 5,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
    marginTop: 18,
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
