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
  cancelMissionSession,
  connectMissionSessionSocket,
  getMissionSession,
  MissionSessionApiError,
  startMissionSession,
  type MissionParticipationStatus,
  type MissionSession,
} from '@/lib/mission-session-api';
import { getCurrentParticipationLocation } from '@/lib/mission-location';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isParticipating(status: MissionParticipationStatus | null | undefined) {
  return status === 'PARTICIPATING' || status === 'COMPLETED';
}

function hasLeftParticipation(status: MissionParticipationStatus | null | undefined) {
  return status === 'SKIPPED' || status === 'LOCKED_OUT' || status === 'TIMED_OUT';
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
  const missionLeader = session?.members.find((member) => member.userId === session.createdByUserId) ?? null;
  const participatingMembers = session?.members.filter((member) => isParticipating(member.participationStatus)) ?? [];
  const participantCount = session?.members.filter((member) => (
    member.userId !== session.createdByUserId && isParticipating(member.participationStatus)
  )).length ?? 0;
  const isMyParticipationActive = isParticipating(myMember?.participationStatus);
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
    const nextMember = nextSession.members.find((member) => member.userId === currentUserId);
    if (scheduleId && hasLeftParticipation(nextMember?.participationStatus)) {
      router.replace({
        pathname: '/trip/active',
        params: { scheduleId, suppressedParticipationSessionId: nextSession.id },
      });
      return;
    }
    if (nextSession.status === 'SHOOTING' || nextSession.status === 'UPLOADING') {
      navigateToCapture(nextSession);
    }
  }, [currentUserId, navigateToCapture, scheduleId]);

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

  const handleClose = async () => {
    if (!sessionId || isSubmitting) {
      return;
    }

    if (!isMissionLeader || !['WAITING', 'READY'].includes(session?.status ?? '')) {
      goBack();
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const nextSession = await cancelMissionSession(sessionId);
      applySession(nextSession);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '미션을 취소하지 못했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = async () => {
    if (!sessionId || !isMissionLeader || participantCount === 0 || isSubmitting) {
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
      router.replace({
        pathname: '/trip/active',
        params: {
          scheduleId,
          ...(sessionId ? { suppressedParticipationSessionId: sessionId } : {}),
        },
      });
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.closeHeader, { paddingTop: topSafeInset + 14, paddingHorizontal: horizontalPadding }]}>
        {isMissionLeader || participantCount === 0 ? (
          <ScalePressable accessibilityLabel={isMissionLeader ? '미션 취소' : '미션 참여 닫기'} disabled={isSubmitting} onPress={() => void handleClose()} pressedScale={0.86} style={styles.closeButton}>
            <Ionicons color="#1D252B" name="close" size={32} />
          </ScalePressable>
        ) : null}
      </View>

      {isLoading || (session?.members.length === 1 && !message) ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          {session?.members.length === 1 ? <Text style={styles.stateText}>촬영 화면을 준비하고 있어요.</Text> : null}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{session?.missionTitle ?? '미션'}</Text>
            <Text style={styles.description}>시작 버튼을 누르면 모두 동시에 미션이 시작돼요</Text>

            {missionLeader ? (
              <View style={styles.leaderCard}>
                <ProfileAvatar profileEmoji={missionLeader.profileEmoji} profileImageUrl={missionLeader.profileImageUrl} size={35} />
                <Text numberOfLines={1} style={styles.leaderName}>{missionLeader.nickname?.trim() || '미션장'}</Text>
                <View style={styles.leaderBadge}>
                  <Text style={styles.leaderBadgeText}>방장</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.participantCard}>
              <Text style={styles.participantLabel}>참가자</Text>
              {participatingMembers.map((member, index) => {
                const mine = member.userId === currentUserId;
                return (
                  <View key={member.userId || String(index)} style={[styles.memberRow, index === participatingMembers.length - 1 && styles.lastMemberRow]}>
                    <ProfileAvatar profileEmoji={member.profileEmoji} profileImageUrl={member.profileImageUrl} size={35} />
                    <Text numberOfLines={1} style={styles.memberName}>{member.nickname?.trim() || `멤버 ${index + 1}`}{mine ? ' (나)' : ''}</Text>
                  </View>
                );
              })}
            </View>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ScrollView>

          {isMissionLeader ? (
            <View style={[styles.bottomAction, { paddingBottom: bottomSafeInset + 22, paddingHorizontal: horizontalPadding }]}>
              <ScalePressable
                disabled={isSubmitting || participantCount === 0 || !['WAITING', 'READY'].includes(session?.status ?? '')}
                onPress={() => void handleStart()}
                pressedScale={0.97}
                style={[styles.startButton, participantCount > 0 ? styles.enabledStartButton : styles.disabledStartButton]}>
                {isSubmitting ? <ActivityIndicator color={participantCount > 0 ? '#FFFFFF' : '#409CB7'} /> : <Text style={[styles.startButtonText, participantCount === 0 && styles.disabledStartButtonText]}>미션 시작</Text>}
              </ScalePressable>
            </View>
          ) : canChangeParticipation ? (
            <View style={[styles.bottomAction, { paddingBottom: bottomSafeInset + 22, paddingHorizontal: horizontalPadding }]}>
              <ScalePressable
                disabled={isSubmitting}
                onPress={() => void handleParticipation(isMyParticipationActive ? 'PASS' : 'PARTICIPATE')}
                pressedScale={0.97}
                style={[styles.participationButton, isMyParticipationActive ? styles.passButton : styles.participateButton]}>
                {isSubmitting ? (
                  <ActivityIndicator color={isMyParticipationActive ? '#409CB7' : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.participationButtonText, isMyParticipationActive && styles.passButtonText]}>
                    {isMyParticipationActive ? '패스하기' : '참여하기'}
                  </Text>
                )}
              </ScalePressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  closeHeader: {
    height: 60,
  },
  closeButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  stateText: {
    color: '#8A9194',
    fontSize: 13,
    marginTop: 12,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 28,
    paddingTop: 47,
  },
  title: {
    color: '#10161F',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  leaderCard: {
    alignItems: 'center',
    backgroundColor: '#E9F8FF',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 13,
    marginTop: 99,
    minHeight: 59,
    paddingHorizontal: 16,
  },
  leaderName: {
    color: '#10161F',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  leaderBadge: {
    backgroundColor: '#C9EBFA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  leaderBadgeText: {
    color: '#63B5CD',
    fontSize: 12,
    fontWeight: '600',
  },
  participantCard: {
    backgroundColor: '#F6F9FB',
    borderRadius: 20,
    marginTop: 22,
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 17,
  },
  participantLabel: {
    color: '#8A9194',
    fontSize: 14,
    marginBottom: 8,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    minHeight: 68,
  },
  lastMemberRow: {
    marginBottom: 0,
  },
  memberName: {
    color: '#10161F',
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomAction: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
  },
  startButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 63,
    justifyContent: 'center',
  },
  enabledStartButton: {
    backgroundColor: '#63B5CD',
  },
  disabledStartButton: {
    backgroundColor: '#E3F0F6',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledStartButtonText: {
    color: '#409CB7',
  },
  participationButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 63,
    justifyContent: 'center',
  },
  participateButton: {
    backgroundColor: '#63B5CD',
  },
  passButton: {
    backgroundColor: '#E3F0F6',
  },
  participationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  passButtonText: {
    color: '#409CB7',
  },
  message: {
    color: '#D06958',
    fontSize: 13,
    marginTop: 18,
    textAlign: 'center',
  },
});
