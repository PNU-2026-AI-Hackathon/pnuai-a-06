import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getLatestMissionSession, getMissionSession, getPassedMissionSubmissions, type MissionSession } from '@/lib/mission-session-api';
import { getTripSchedule } from '@/lib/trip-schedule-api';

const pinkEffect = require('../../assets/svg/effect/pink_llipse.svg');
const yellowEffect = require('../../assets/svg/effect/yellow_ellipse.svg');
const blueEffect = require('../../assets/svg/effect/blue_ellipse.svg');

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function MissionResultScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [session, setSession] = useState<MissionSession | null>(null);
  const [resultSessions, setResultSessions] = useState<MissionSession[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const currentSession = resultSessions[currentResultIndex] ?? session;
  const passedSubmissions = useMemo(() => getPassedMissionSubmissions(currentSession), [currentSession]);
  const winnerSubmission = useMemo(() => {
    if (!passedSubmissions.length) {
      return null;
    }

    const savedWinner = currentSession?.winnerUserId ? passedSubmissions.find((submission) => submission.userId === currentSession.winnerUserId) : null;

    return savedWinner ?? [...passedSubmissions].sort((left, right) => right.likeCount - left.likeCount)[0];
  }, [currentSession?.winnerUserId, passedSubmissions]);

  const refreshResults = useCallback(async () => {
    setIsLoading(true);
    setMessage('');

    try {
      if (scheduleId && !sessionId) {
        const schedule = await getTripSchedule(scheduleId);
        const nextSessions = (await Promise.all(schedule.missions.map(async (mission) => {
          try {
            const nextSession = await getLatestMissionSession(schedule.scheduleId, mission.scheduleMissionId);
            return nextSession.status === 'REVEALED' || nextSession.status === 'COMPLETED' ? nextSession : null;
          } catch {
            return null;
          }
        }))).filter((nextSession): nextSession is MissionSession => Boolean(nextSession) && getPassedMissionSubmissions(nextSession).length > 0);

        setResultSessions(nextSessions);
        setCurrentResultIndex(0);
        setSession(nextSessions[0] ?? null);

        if (nextSessions.length === 0) {
          setMessage('표시할 결과가 없어요.');
        }
        return;
      }

      if (!sessionId) {
        setMessage('세션 정보가 없습니다.');
        return;
      }

      const nextSession = await getMissionSession(sessionId);
      setResultSessions([nextSession]);
      setCurrentResultIndex(0);
      setSession(nextSession);

      if (getPassedMissionSubmissions(nextSession).length === 0) {
        setMessage('표시할 사진이 없어요.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '결과를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [scheduleId, sessionId]);

  useFocusEffect(
    useCallback(() => {
      refreshResults();
    }, [refreshResults])
  );

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => setMessage(''), 2600);
    return () => clearTimeout(timer);
  }, [message]);

  const goTrip = () => {
    if (currentResultIndex < resultSessions.length - 1) {
      setCurrentResultIndex((index) => index + 1);
      return;
    }

    router.replace('/trip/hub');
  };

  return (
    <View style={styles.container}>
      {isLoading && !session ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
        </View>
      ) : winnerSubmission ? (
        <View style={[styles.resultContent, { paddingBottom: bottomSafeInset + 20, paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 90 }]}>
          <View style={styles.resultHeading}>
            <Text style={styles.title}>친구들이{`\n`}가장 많이 선택한 사진</Text>
            <View pointerEvents="none" style={styles.effects}>
              <Image contentFit="contain" source={pinkEffect} style={styles.pinkEffect} />
              <Image contentFit="contain" source={yellowEffect} style={styles.yellowEffect} />
              <Image contentFit="contain" source={blueEffect} style={styles.blueEffect} />
            </View>
            <Text style={styles.subtitle}>{winnerSubmission.nickname ? `${winnerSubmission.nickname}님이 담았어요` : '친구가 담은 사진이에요'}</Text>
          </View>

          <Image source={{ uri: winnerSubmission.imageUrl }} style={styles.photo} contentFit="cover" />

          <View style={styles.footer}>
            <Text style={styles.savedText}>이 사진이 매거진에 담겨요</Text>
            <ScalePressable onPress={goTrip} pressedScale={0.97} style={styles.tripButton}>
              <Text style={styles.tripButtonText}>{currentResultIndex < resultSessions.length - 1 ? '다음' : '목록으로 돌아가기'}</Text>
            </ScalePressable>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContent} />
      )}
      {message ? <Text style={[styles.toast, { bottom: bottomSafeInset + 24 }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  title: {
    color: '#252B30',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 7,
    textAlign: 'center',
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyContent: {
    flex: 1
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(24, 31, 35, 0.9)',
    borderRadius: 999,
    color: '#FFFFFF',
    fontSize: 13,
    left: 24,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 11,
    position: 'absolute',
    right: 24,
    textAlign: 'center',
  },
  resultContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start'
  },
  resultHeading: {
    alignItems: 'center',
    overflow: 'visible',
    width: '100%',
    zIndex: 0,
  },
  effects: { 
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  pinkEffect: { 
    height: 375, 
    left: -8, 
    position: 'absolute', 
    top: 165, 
    width: 270 
  },
  yellowEffect: { 
    height: 600, 
    position: 'absolute', 
    right: -80, 
    top: 50, 
    width: 500 
  },
  blueEffect: { 
    bottom: 72, 
    height: 386, 
    left: -20, 
    position: 'absolute', 
    width: 303 
  },
  photo: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    marginTop: 32,
    width: '78%',
    zIndex: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    width: '100%',
    zIndex: 2,
  },
  savedText: {
    color: '#8A9194',
    fontSize: 12,
    marginBottom: 17
  },
  tripButton: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 63,
    justifyContent: 'center',
    width: '100%'
  },
  tripButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500'
  },
});
