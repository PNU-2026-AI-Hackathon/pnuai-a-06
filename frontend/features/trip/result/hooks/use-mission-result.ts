import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getLatestMissionSession, getMissionSession, getPassedMissionSubmissions, type MissionSession } from '@/lib/mission-session-api';
import { getTripSchedule } from '@/lib/trip-schedule-api';

type UseMissionResultOptions = {
  scheduleId?: string;
  sessionId?: string;
};

// 미션 결과 화면의 결과 조회, 여러 결과 순회와 안내 메시지를 담당합니다.
export function useMissionResult({ scheduleId, sessionId }: UseMissionResultOptions) {
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

  return {
    currentResultIndex,
    currentSession,
    isLoading,
    message,
    resultSessions,
    setCurrentResultIndex,
    session,
    winnerSubmission,
  };
}
