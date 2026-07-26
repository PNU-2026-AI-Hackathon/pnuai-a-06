import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { completeMissionSession, getMissionSession, getPassedMissionSubmissions } from '@/lib/mission-session-api';
import { getTripSchedule } from '@/lib/trip-schedule-api';

const pinkEffect = require('../../assets/svg/effect/pink_llipse.svg');
const yellowEffect = require('../../assets/svg/effect/yellow_ellipse.svg');
const blueEffect = require('../../assets/svg/effect/blue_ellipse.svg');
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function VoteWaitingScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = param(params.scheduleId);
  const sessionId = param(params.sessionId);
  const { topSafeInset } = useResponsiveLayout();
  const [requiredVoterCount, setRequiredVoterCount] = useState(0);
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);
  const hasNavigated = useRef(false);
  const isCompleting = useRef(false);
  const hasStartedResultCountdown = useRef(false);

  const startResultCountdown = () => {
    if (hasNavigated.current || hasStartedResultCountdown.current) {
      return;
    }

    hasStartedResultCountdown.current = true;
    setResultCountdown(3);
  };

  useEffect(() => {
    if (resultCountdown === null) {
      return;
    }

    if (resultCountdown <= 0) {
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace({ pathname: '/trip/result', params: { ...(scheduleId ? { scheduleId } : {}), sessionId: sessionId ?? '' } });
      }
      return;
    }

    const timer = setTimeout(() => {
      setResultCountdown((currentCountdown) => currentCountdown === null ? null : currentCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resultCountdown, scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void (async () => {
      try {
        const session = await getMissionSession(sessionId);
        let count = session.members.length;
        if (scheduleId) {
          try {
            const schedule = await getTripSchedule(scheduleId);
            const peopleCount = Number(schedule.peopleCount);
            count = Math.max(count, schedule.participants.length, Number.isFinite(peopleCount) ? peopleCount : 0);
          } catch { /* 세션 멤버 수를 fallback으로 사용한다. */ }
        }
        if (active) setRequiredVoterCount(count);
      } catch { /* 폴링에서 다시 확인한다. */ }
    })();
    return () => { active = false; };
  }, [scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const refresh = async () => {
      try {
        const session = await getMissionSession(sessionId);
        let voterCount = Math.max(requiredVoterCount, session.members.length);

        if (scheduleId && voterCount <= session.members.length) {
          try {
            const schedule = await getTripSchedule(scheduleId);
            const peopleCount = Number(schedule.peopleCount);
            voterCount = Math.max(voterCount, schedule.participants.length, Number.isFinite(peopleCount) ? peopleCount : 0);
            if (voterCount !== requiredVoterCount) {
              setRequiredVoterCount(voterCount);
            }
          } catch {
            // 세션 멤버 수로 계속 투표 완료 여부를 확인한다.
          }
        }

        const votes = getPassedMissionSubmissions(session).reduce((sum, submission) => sum + submission.likeCount, 0);
        if (session.status === 'COMPLETED') return startResultCountdown();
        if (voterCount <= 0 || votes < voterCount || isCompleting.current) return;
        isCompleting.current = true;
        startResultCountdown();
        void completeMissionSession(sessionId).catch(() => undefined).finally(() => {
          isCompleting.current = false;
        });
      } catch { /* 다음 주기에 다시 확인한다. */ }
    };
    void refresh();
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, [requiredVoterCount, scheduleId, sessionId]);

  return <View style={[styles.container, { paddingTop: topSafeInset }]}>
    <Text style={styles.title}>이번 미션의 주인공은?</Text>
    <View pointerEvents="none" style={styles.effects}>
      <Image contentFit="contain" source={pinkEffect} style={styles.pinkEffect} />
      <Image contentFit="contain" source={yellowEffect} style={styles.yellowEffect} />
      <Image contentFit="contain" source={blueEffect} style={styles.blueEffect} />
    </View>
    <View style={styles.copy}>
      {resultCountdown === null ? <>
        <Text style={styles.description}>친구들의 선택이 모였어요.</Text>
        <Text style={styles.description}>가장 많은 선택을 받은 사진을 공개할게요.</Text>
      </> : <Text style={styles.description}>{resultCountdown}초 뒤 결과를 보여드릴게요.</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { 
    backgroundColor: '#FFFFFF', 
    flex: 1, 
    overflow: 'hidden' 
  },
  title: { 
    color: '#2D3C43', 
    fontSize: 24, 
    fontWeight: '600', 
    marginTop: 100, 
    textAlign: 'center' 
  },
  effects: { 
    ...StyleSheet.absoluteFillObject 
  },
  pinkEffect: { 
    height: 375, 
    left: -8, 
    position: 'absolute', 
    top: 165, 
    width: 270 
  },
  yellowEffect: { 
    height: 650, 
    position: 'absolute', 
    right: -90, 
    top: 120, 
    width: 550 
  },
  blueEffect: { 
    bottom: 72, 
    height: 386, 
    left: -20, 
    position: 'absolute', 
    width: 303 
  },
  copy: { 
    bottom: 118, 
    left: 24, 
    position: 'absolute', 
    right: 24 
  },
  description: { 
    color: '#8A9194', 
    fontSize: 14,
    fontWeight: '500', 
    lineHeight: 21, 
    textAlign: 'center' 
  },
});
