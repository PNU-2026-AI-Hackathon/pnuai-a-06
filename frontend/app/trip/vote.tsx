import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem, setAuthItem } from '@/lib/auth-storage';
import { getMissionSession, getPassedMissionSubmissions, likeMissionSessionSubmission, MissionSessionApiError, type MissionSession } from '@/lib/mission-session-api';

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
    }
  }, [voteStorageKey]);

  useEffect(() => {
    if (!sessionId) {
      setMessage('세션 정보가 없습니다.');
      setIsLoading(false);
      return;
    }

    getMissionSession(sessionId)
      .then((nextSession) => {
        setSession(nextSession);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '투표 사진을 불러오지 못했어요.'))
      .finally(() => setIsLoading(false));
  }, [scheduleId, sessionId]);

  const goWaiting = useCallback(() => {
    if (!sessionId || hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace({
      pathname: '/trip/vote-waiting',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId,
      },
    });
  }, [scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId || !hasVoted || isLoading) {
      return;
    }
    goWaiting();
  }, [goWaiting, hasVoted, isLoading, sessionId]);

  const handleVote = async () => {
    const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId);
    const isOwnSubmission = Boolean(currentUserId && selectedSubmission?.userId === currentUserId);

    if (!sessionId || !selectedSubmissionId || isSubmitting || isOwnSubmission) {
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
      goWaiting();
    } catch (error) {
      if (error instanceof MissionSessionApiError && error.status === 409) {
        if (voteStorageKey) {
          setAuthItem(voteStorageKey, selectedSubmissionId);
        }
        setHasVoted(true);
        goWaiting();
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
              const isOwnSubmission = Boolean(currentUserId && submission.userId === currentUserId);
              const isSelected = !isOwnSubmission && submission.id === selectedSubmissionId;
              const isPhotoDisabled = hasVoted || isOwnSubmission;

              return (
                <ScalePressable accessibilityState={{ disabled: isPhotoDisabled }} disabled={isPhotoDisabled} key={submission.id} onPress={() => setSelectedSubmissionId(submission.id)} pressedScale={0.97} style={[styles.photoCard, isSelected && styles.selectedPhotoCard, isOwnSubmission && styles.ownPhotoCard]}>
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
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.voteButtonText}>다음</Text>}
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
    color: '#2D3C43', 
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
  ownPhotoCard: {
    opacity: 0.48,
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
