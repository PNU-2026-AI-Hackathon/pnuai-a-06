import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import {
  chooseMissionParticipation,
  connectMissionSessionSocket,
  getMissionSession,
  MissionSessionApiError,
  startMissionSession,
  type MissionParticipationLocation,
  type MissionParticipationStatus,
  type MissionSession,
} from '@/lib/mission-session-api';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getParticipationLabel(status: MissionParticipationStatus | null | undefined) {
  switch (status) {
    case 'PARTICIPATING':
      return '참여';
    case 'COMPLETED':
      return '완료';
    case 'SKIPPED':
      return '패스';
    case 'LOCKED_OUT':
      return '미선택';
    case 'TIMED_OUT':
      return '시간 초과';
    default:
      return '선택 대기';
  }
}

function isParticipating(status: MissionParticipationStatus | null | undefined) {
  return status === 'PARTICIPATING' || status === 'COMPLETED';
}

function getParticipationErrorMessage(error: unknown) {
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

  return error instanceof Error ? error.message : '참여 상태를 바꾸지 못했어요.';
}

async function getCurrentParticipationLocation(): Promise<MissionParticipationLocation> {
  let Location: typeof import('expo-location');
  try {
    Location = await import('expo-location');
  } catch {
    throw new Error('위치 기능을 사용할 수 없어요. 앱을 최신 개발 빌드로 다시 설치해 주세요.');
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('미션 참여를 위해 위치 권한이 필요해요.');
  }

  let location: import('expo-location').LocationObject;
  try {
    location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    throw new Error('현재 위치를 가져오지 못했어요. 위치 서비스를 켜고 다시 시도해 주세요.');
  }
  const { accuracy, latitude, longitude } = location.coords;
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || typeof accuracy !== 'number'
    || !Number.isFinite(accuracy)
  ) {
    throw new Error('현재 위치의 정확도를 확인하지 못했어요. 다시 시도해 주세요.');
  }

  return {
    accuracy_m: accuracy,
    latitude,
    longitude,
    measured_at: new Date(location.timestamp).toISOString(),
  };
}

export default function MissionParticipationScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[]; verificationType?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const routeVerificationType = getParamValue(params.verificationType);
  const currentUserId = getAuthItem('user_id');
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [session, setSession] = useState<MissionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const hasNavigated = useRef(false);
  const leaderParticipationRequested = useRef(false);
  const soloStartRequested = useRef(false);

  const myMember = useMemo(
    () => session?.members.find((member) => member.userId === currentUserId) ?? null,
    [currentUserId, session?.members],
  );
  const isMissionLeader = Boolean(session?.createdByUserId && currentUserId && session.createdByUserId === currentUserId);
  const participatingCount = session?.members.filter((member) => isParticipating(member.participationStatus)).length ?? 0;
  const canChangeParticipation = Boolean(!isMissionLeader && session && ['WAITING', 'READY'].includes(session.status) && myMember && myMember.participationStatus !== 'LOCKED_OUT');
  const requiresGps = (session?.verificationType ?? routeVerificationType)?.toUpperCase() === 'GPS_PHOTO';

  const navigateToCapture = useCallback((nextSession: MissionSession) => {
    const nextMember = nextSession.members.find((member) => member.userId === currentUserId);
    if (!scheduleId || !nextSession.id || !nextMember || !isParticipating(nextMember.participationStatus) || hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace({
      pathname: '/trip/capture',
      params: {
        scheduleId,
        scheduleMissionId: nextSession.scheduleMissionId,
        sessionId: nextSession.id,
      },
    });
  }, [currentUserId, scheduleId]);

  const applySession = useCallback((nextSession: MissionSession) => {
    setSession(nextSession);
    if (nextSession.status === 'COMPLETED' || nextSession.status === 'CANCELLED') {
      if (scheduleId) {
        router.replace({ pathname: '/trip/active', params: { scheduleId } });
      }
      return;
    }
    if (nextSession.status === 'SHOOTING' || nextSession.status === 'UPLOADING') {
      navigateToCapture(nextSession);
    }
  }, [navigateToCapture, scheduleId]);

  useEffect(() => {
    if (
      !sessionId
      || !isMissionLeader
      || !myMember
      || !session
      || !['WAITING', 'READY'].includes(session.status)
    ) {
      return;
    }

    const isSoloMission = session.members.length === 1;

    if (isSoloMission) {
      if (soloStartRequested.current) {
        return;
      }

      soloStartRequested.current = true;
      setIsSubmitting(true);
      setMessage('');

      void (async () => {
        try {
          let nextSession = session;

          if (!isParticipating(myMember.participationStatus)) {
            const location = requiresGps ? await getCurrentParticipationLocation() : undefined;
            nextSession = await chooseMissionParticipation(sessionId, 'PARTICIPATE', location);
            applySession(nextSession);
          }

          if (['WAITING', 'READY'].includes(nextSession.status)) {
            nextSession = await startMissionSession(sessionId);
            applySession(nextSession);
          }

          navigateToCapture(nextSession);
        } catch (error) {
          soloStartRequested.current = false;
          setMessage(getParticipationErrorMessage(error));
        } finally {
          setIsSubmitting(false);
        }
      })();

      return;
    }

    if (isParticipating(myMember.participationStatus) || leaderParticipationRequested.current) {
      return;
    }

    leaderParticipationRequested.current = true;
    setIsSubmitting(true);
    setMessage('');

    void (async () => {
      const location = requiresGps ? await getCurrentParticipationLocation() : undefined;
      return chooseMissionParticipation(sessionId, 'PARTICIPATE', location);
    })()
      .then((nextSession) => {
        applySession(nextSession);
      })
      .catch((error) => {
        leaderParticipationRequested.current = false;
        setMessage(getParticipationErrorMessage(error));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [applySession, isMissionLeader, myMember, navigateToCapture, requiresGps, session, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setMessage('미션 세션 정보가 없습니다.');
      setIsLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const nextSession = await getMissionSession(sessionId);
        if (active) {
          applySession(nextSession);
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : '미션 정보를 불러오지 못했어요.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [applySession, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const socket = connectMissionSessionSocket(sessionId, {
      onError: () => {
        void getMissionSession(sessionId).then(applySession).catch(() => undefined);
      },
      onMessage: ({ session: nextSession }) => {
        if (nextSession) {
          applySession(nextSession);
        }
      },
    });
    const timer = setInterval(() => {
      void getMissionSession(sessionId).then(applySession).catch(() => undefined);
    }, 1500);

    return () => {
      clearInterval(timer);
      socket.close();
    };
  }, [applySession, sessionId]);

  const handleParticipation = async (decision: 'PARTICIPATE' | 'PASS') => {
    if (!sessionId || !canChangeParticipation || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const location = decision === 'PARTICIPATE' && requiresGps
        ? await getCurrentParticipationLocation()
        : undefined;
      const nextSession = await chooseMissionParticipation(sessionId, decision, location);
      applySession(nextSession);
    } catch (error) {
      setMessage(getParticipationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!sessionId || !isMissionLeader || participatingCount === 0 || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const nextSession = await startMissionSession(sessionId);
      applySession(nextSession);
      navigateToCapture(nextSession);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '미션을 시작하지 못했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (scheduleId) {
      router.replace({ pathname: '/trip/active', params: { scheduleId } });
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topSafeInset + 24, paddingHorizontal: horizontalPadding }]}>
        <ScalePressable accessibilityLabel="돌아가기" onPress={goBack} pressedScale={0.86} style={styles.backButton}>
          <Ionicons color="#26363D" name="chevron-back" size={26} />
        </ScalePressable>
        <Text numberOfLines={1} style={styles.headerTitle}>미션 참여</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading || (session?.members.length === 1 && !message) ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          {session?.members.length === 1 ? <Text style={styles.stateText}>촬영 화면을 준비하고 있어요.</Text> : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSafeInset + 32, paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{session?.missionTitle ?? '미션'}</Text>
          <Text style={styles.description}>이번 미션에 참여할 사람을 확인하고 있어요.</Text>

          <View style={styles.countCard}>
            <Text style={styles.countLabel}>현재 참여자</Text>
            <Text style={styles.countValue}>{participatingCount}명</Text>
          </View>

          <View style={styles.memberCard}>
            {session?.members.map((member, index) => {
              const mine = member.userId === currentUserId;
              return (
                <View key={member.userId || String(index)} style={styles.memberRow}>
                  <ProfileAvatar profileEmoji={member.profileEmoji} profileImageUrl={member.profileImageUrl} size={48} />
                  <View style={styles.memberCopy}>
                    <Text style={styles.memberName}>{member.nickname?.trim() || `멤버 ${index + 1}`}{mine ? ' (나)' : ''}</Text>
                    <Text style={[styles.memberStatus, member.participationStatus === 'PARTICIPATING' && styles.participatingStatus]}>
                      {getParticipationLabel(member.participationStatus)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {isMissionLeader ? (
            <Text style={styles.leaderParticipationText}>미션장은 자동으로 참여돼요.</Text>
          ) : canChangeParticipation ? (
            <View style={styles.choiceRow}>
              <ScalePressable
                disabled={isSubmitting}
                onPress={() => void handleParticipation('PARTICIPATE')}
                pressedScale={0.97}
                style={[styles.choiceButton, myMember?.participationStatus === 'PARTICIPATING' && styles.selectedChoice]}>
                <Text style={styles.choiceText}>참여할게요</Text>
              </ScalePressable>
              <ScalePressable
                disabled={isSubmitting}
                onPress={() => void handleParticipation('PASS')}
                pressedScale={0.97}
                style={[styles.choiceButton, myMember?.participationStatus === 'SKIPPED' && styles.selectedPassChoice]}>
                <Text style={styles.choiceText}>패스할게요</Text>
              </ScalePressable>
            </View>
          ) : null}

          {isMissionLeader ? (
            <ScalePressable
              disabled={isSubmitting || participatingCount === 0 || !['WAITING', 'READY'].includes(session?.status ?? '')}
              onPress={() => void handleStart()}
              pressedScale={0.97}
              style={[styles.startButton, (isSubmitting || participatingCount === 0) && styles.disabledButton]}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.startButtonText}>참여자와 미션 시작하기</Text>}
            </ScalePressable>
          ) : (
            <Text style={styles.waitingText}>미션장이 참여자를 확인한 뒤 시작해요.</Text>
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row' },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerSpacer: { width: 42 },
  headerTitle: { color: '#26363D', flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  centerState: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  stateText: { color: '#8A9194', fontSize: 13, marginTop: 12 },
  content: { paddingTop: 48 },
  title: { color: '#26363D', fontSize: 27, fontWeight: '600', textAlign: 'center' },
  description: { color: '#8A9194', fontSize: 13, marginTop: 9, textAlign: 'center' },
  countCard: { alignItems: 'center', backgroundColor: '#F2F8FA', borderRadius: 18, flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, paddingHorizontal: 20, paddingVertical: 17 },
  countLabel: { color: '#617078', fontSize: 14 },
  countValue: { color: '#409CB7', fontSize: 17, fontWeight: '700' },
  memberCard: { backgroundColor: '#FFFFFF', borderColor: '#E8EFF1', borderRadius: 20, borderWidth: 1, marginTop: 14, paddingHorizontal: 17, paddingVertical: 8 },
  memberRow: { alignItems: 'center', borderBottomColor: '#EEF2F3', borderBottomWidth: 1, flexDirection: 'row', gap: 13, paddingVertical: 13 },
  memberCopy: { flex: 1 },
  memberName: { color: '#26363D', fontSize: 15, fontWeight: '600' },
  memberStatus: { color: '#A2ADB1', fontSize: 12, marginTop: 5 },
  participatingStatus: { color: '#409CB7', fontWeight: '600' },
  choiceRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  leaderParticipationText: { color: '#409CB7', fontSize: 13, fontWeight: '600', marginTop: 18, textAlign: 'center' },
  choiceButton: { alignItems: 'center', borderColor: '#C9D6DA', borderRadius: 999, borderWidth: 1, flex: 1, height: 55, justifyContent: 'center' },
  selectedChoice: { backgroundColor: '#63B5CD', borderColor: '#63B5CD' },
  selectedPassChoice: { backgroundColor: '#E7EEF0', borderColor: '#E7EEF0' },
  choiceText: { color: '#26363D', fontSize: 14, fontWeight: '600' },
  startButton: { alignItems: 'center', backgroundColor: '#63B5CD', borderRadius: 999, height: 62, justifyContent: 'center', marginTop: 18 },
  startButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  disabledButton: { opacity: 0.42 },
  waitingText: { color: '#8A9194', fontSize: 13, marginTop: 22, textAlign: 'center' },
  message: { color: '#D06958', fontSize: 13, marginTop: 18, textAlign: 'center' },
});
