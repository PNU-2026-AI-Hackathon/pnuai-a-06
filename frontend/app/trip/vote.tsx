import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem, setAuthItem } from '@/lib/auth-storage';
import { completeMissionSession, getMissionSession, getPassedMissionSubmissions, likeMissionSessionSubmission, MissionSessionApiError, type MissionSession } from '@/lib/mission-session-api';
import { getTripSchedule } from '@/lib/trip-schedule-api';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function MissionVoteScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const currentUserId = getAuthItem('user_id');
  const voteStorageKey = sessionId ? `mission_session_vote:${sessionId}:${currentUserId ?? 'anonymous'}` : null;
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [session, setSession] = useState<MissionSession | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [requiredVoterCount, setRequiredVoterCount] = useState(0);
  const [message, setMessage] = useState('');
  const hasNavigated = useRef(false);
  const submissions = useMemo(() => getPassedMissionSubmissions(session), [session]);

  useEffect(() => {
    if (!voteStorageKey) {
      return;
    }

    const savedSubmissionId = getAuthItem(voteStorageKey);

    if (savedSubmissionId) {
      setSelectedSubmissionId(savedSubmissionId);
      setHasVoted(true);
      setMessage('이미 투표했어요. 다른 참여자의 투표를 기다리고 있어요.');
    }
  }, [voteStorageKey]);

  useEffect(() => {
    if (!sessionId) {
      setMessage('세션 정보가 없습니다.');
      setIsLoading(false);
      return;
    }

    getMissionSession(sessionId)
      .then(async (nextSession) => {
        setSession(nextSession);
        let nextRequiredVoterCount = nextSession.members.length;

        if (scheduleId) {
          try {
            const schedule = await getTripSchedule(scheduleId);
            const scheduledPeopleCount = Number(schedule.peopleCount);
            nextRequiredVoterCount = Math.max(
              nextRequiredVoterCount,
              schedule.participants.length,
              Number.isFinite(scheduledPeopleCount) ? scheduledPeopleCount : 0
            );
          } catch {
            // 세션 멤버 수를 투표 인원 fallback으로 사용한다.
          }
        }

        setRequiredVoterCount(nextRequiredVoterCount);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '투표 사진을 불러오지 못했어요.'))
      .finally(() => setIsLoading(false));
  }, [scheduleId, sessionId]);

  const goResult = useCallback(() => {
    if (!sessionId || hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace({
      pathname: '/trip/result',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId,
      },
    });
  }, [scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId || !hasVoted) {
      return;
    }

    const refreshResult = async () => {
      try {
        const nextSession = await getMissionSession(sessionId);
        setSession(nextSession);
        const totalVoteCount = getPassedMissionSubmissions(nextSession).reduce((count, submission) => count + submission.likeCount, 0);

        if (requiredVoterCount <= 0 || totalVoteCount < requiredVoterCount) {
          setMessage(`다른 참여자의 투표를 기다리고 있어요. (${totalVoteCount}/${requiredVoterCount || '-'})`);
          return;
        }

        if (nextSession.status === 'COMPLETED') {
          goResult();
          return;
        }

        try {
          const completedSession = await completeMissionSession(sessionId);
          setSession(completedSession);
          goResult();
        } catch {
          setMessage('다른 참여자의 투표를 기다리고 있어요.');
        }
      } catch {
        // 다음 주기에서 서버 상태를 다시 확인한다.
      }
    };

    void refreshResult();
    const timer = setInterval(refreshResult, 1500);

    return () => clearInterval(timer);
  }, [goResult, hasVoted, requiredVoterCount, sessionId]);

  const handleVote = async () => {
    if (!sessionId || !selectedSubmissionId || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      await likeMissionSessionSubmission(sessionId, selectedSubmissionId);
      if (voteStorageKey) {
        setAuthItem(voteStorageKey, selectedSubmissionId);
      }
      setHasVoted(true);
      setMessage('투표를 완료했어요. 다른 참여자의 투표를 기다리고 있어요.');
    } catch (error) {
      if (error instanceof MissionSessionApiError && error.status === 409) {
        if (voteStorageKey) {
          setAuthItem(voteStorageKey, selectedSubmissionId);
        }
        setHasVoted(true);
        setMessage('이미 투표했어요. 다른 참여자의 투표를 기다리고 있어요.');
        return;
      }

      setMessage(error instanceof Error ? error.message : '투표하지 못했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>

      {isLoading ? (
        <View style={styles.centerState}><ActivityIndicator color="#63B5CD" /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSafeInset + 118, paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 90 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>당신의 선택은?</Text>
          <Text style={styles.description}>이번 미션을 대표할 사진을 골라주세요.</Text>
          <View style={styles.photoGrid}>
            {submissions.map((submission) => {
              const isSelected = submission.id === selectedSubmissionId;

              return (
                <ScalePressable disabled={hasVoted} key={submission.id} onPress={() => setSelectedSubmissionId(submission.id)} pressedScale={0.97} style={[styles.photoCard, isSelected && styles.selectedPhotoCard]}>
                  <Image contentFit="cover" source={{ uri: submission.imageUrl }} style={styles.photo} />
                  {isSelected ? <View style={styles.selectedBadge}><Ionicons color="#FFFFFF" name="checkmark" size={18} /></View> : null}
                </ScalePressable>
              );
            })}
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: bottomSafeInset + 14, paddingHorizontal: horizontalPadding }]}>
        <ScalePressable disabled={!selectedSubmissionId || isSubmitting || hasVoted} onPress={handleVote} pressedScale={0.97} style={[styles.voteButton, (!selectedSubmissionId || isSubmitting || hasVoted) && styles.disabledButton]}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.voteButtonText}>투표하기</Text>}
        </ScalePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    backgroundColor: '#FFFFFF', 
    flex: 1 
  },
  centerState: { 
    alignItems: 'center', 
    flex: 1, 
    justifyContent: 'center' 
  },
  content: { 
    paddingTop: 16 
  },
  title: { 
    color: '#111820', 
    fontSize: 24, 
    fontWeight: '600', 
    textAlign: 'center' 
  },
  description: { 
    color: '#8A9194', 
    fontSize: 12,
    fontWeight: '500',  
    marginTop: 8, 
    textAlign: 'center' 
  },
  photoGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    marginTop: 52 
  },
  photoCard: { 
    borderColor: 'transparent', 
    borderRadius: 16, 
    borderWidth: 4, 
    overflow: 'hidden', 
    position: 'relative',
    width: '48%' 
  },
  selectedPhotoCard: { 
    borderColor: '#63B5CD' 
  },
  photo: { 
    aspectRatio: 3 / 4, 
    width: '100%' 
  },
  selectedBadge: { 
    alignItems: 'center', 
    backgroundColor: '#63B5CD', 
    borderRadius: 999, 
    height: 32, 
    justifyContent: 'center', 
    position: 'absolute', 
    right: 9, 
    top: 9, 
    width: 32 
  },
  message: { 
    color: '#D06958', 
    fontSize: 13, 
    marginTop: 18, 
    textAlign: 'center' 
  },
  footer: { 
    backgroundColor: '#FFFFFF', 
    bottom: 0, 
    left: 0, 
    paddingTop: 10, 
    position: 'absolute', 
    right: 0 
  },
  voteButton: { 
    alignItems: 'center', 
    backgroundColor: '#63B5CD', 
    borderRadius: 100, 
    height: 63, 
    justifyContent: 'center' 
  },
  voteButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '500' 
  },
  disabledButton: { 
    opacity: 0.42 
  },
});
