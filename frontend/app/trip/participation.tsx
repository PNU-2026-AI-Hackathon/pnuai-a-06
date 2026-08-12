import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

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

export default function MissionParticipationScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const currentUserId = getAuthItem('user_id');
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [session, setSession] = useState<MissionSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const hasNavigated = useRef(false);
  const leaderParticipationRequested = useRef(false);

  const myMember = useMemo(
    () => session?.members.find((member) => member.userId === currentUserId) ?? null,
    [currentUserId, session?.members],
  );
  const isMissionLeader = Boolean(session?.createdByUserId && currentUserId && session.createdByUserId === currentUserId);
  const participatingCount = session?.members.filter((member) => isParticipating(member.participationStatus)).length ?? 0;
  const canChangeParticipation = Boolean(!isMissionLeader && session && ['WAITING', 'READY'].includes(session.status) && myMember && myMember.participationStatus !== 'LOCKED_OUT');

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
      || !['WAITING', 'READY'].includes(session?.status ?? '')
      || isParticipating(myMember.participationStatus)
      || leaderParticipationRequested.current
    ) {
      return;
    }

    leaderParticipationRequested.current = true;
    setIsSubmitting(true);
    setMessage('');

    void chooseMissionParticipation(sessionId, 'PARTICIPATE')
      .then((nextSession) => {
        applySession(nextSession);
      })
      .catch((error) => {
        setMessage(error instanceof MissionSessionApiError ? error.message : '미션장 자동 참여 처리에 실패했어요.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [applySession, isMissionLeader, myMember, session?.status, sessionId]);

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
      const nextSession = await chooseMissionParticipation(sessionId, decision);
      applySession(nextSession);
    } catch (error) {
      setMessage(error instanceof MissionSessionApiError ? error.message : '참여 상태를 바꾸지 못했어요.');
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

      {isLoading ? (
        <View style={styles.centerState}><ActivityIndicator color="#409CB7" /></View>
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