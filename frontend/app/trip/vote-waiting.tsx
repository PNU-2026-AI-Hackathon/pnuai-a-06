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
  const hasNavigated = useRef(false);
  const isCompleting = useRef(false);

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
    if (!sessionId || requiredVoterCount <= 0) return;
    const goResult = () => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      router.replace({ pathname: '/trip/result', params: { ...(scheduleId ? { scheduleId } : {}), sessionId } });
    };
    const refresh = async () => {
      try {
        const session = await getMissionSession(sessionId);
        const votes = getPassedMissionSubmissions(session).reduce((sum, submission) => sum + submission.likeCount, 0);
        if (session.status === 'COMPLETED') return goResult();
        if (votes < requiredVoterCount || isCompleting.current) return;
        isCompleting.current = true;
        try { await completeMissionSession(sessionId); goResult(); }
        finally { isCompleting.current = false; }
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
      <Text style={styles.description}>친구들의 선택이 모였어요.</Text>
      <Text style={styles.description}>가장 많은 선택을 받은 사진을 공개할게요.</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', flex: 1, overflow: 'hidden' },
  title: { color: '#252C30', fontSize: 28, fontWeight: '700', marginTop: 78, textAlign: 'center' },
  effects: { ...StyleSheet.absoluteFillObject },
  pinkEffect: { height: 375, left: -8, position: 'absolute', top: 165, width: 270 },
  yellowEffect: { height: 492, position: 'absolute', right: -28, top: 245, width: 351 },
  blueEffect: { bottom: 72, height: 386, left: -20, position: 'absolute', width: 303 },
  copy: { bottom: 118, left: 24, position: 'absolute', right: 24 },
  description: { color: '#8A9194', fontSize: 16, lineHeight: 21, textAlign: 'center' },
});
