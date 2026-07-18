import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import {
  connectMissionSessionSocket,
  getMissionSession,
  getPassedMissionSubmissions,
  MissionSessionApiError,
  postMissionSessionComment,
  readyMissionSession,
  type MissionSession,
} from '@/lib/mission-session-api';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getUserLabel(index: number) {
  return `익명 ${index + 1}`;
}

function formatRemainingTime(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getRemainingMs(deadline: string | null | undefined, now: number) {
  if (!deadline) {
    return null;
  }

  const deadlineTime = new Date(deadline).getTime();
  return Number.isFinite(deadlineTime) ? deadlineTime - now : null;
}

export default function MissionReviewScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const currentUserId = getAuthItem('user_id');
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [session, setSession] = useState<MissionSession | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewReadyFallback, setIsReviewReadyFallback] = useState(false);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const hasNavigatedToResult = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      setMessage('세션 정보가 없습니다.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const nextSession = await getMissionSession(sessionId);
      setSession(nextSession);
      if (nextSession.status !== 'REVEALED') {
        setIsReviewReadyFallback(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '세션을 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession])
  );

  const navigateToResult = useCallback(() => {
    if (!sessionId || hasNavigatedToResult.current) {
      return;
    }

    hasNavigatedToResult.current = true;
    router.replace({
      pathname: '/trip/result',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId,
      },
    });
  }, [scheduleId, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const socket = connectMissionSessionSocket(sessionId, {
      onMessage: ({ session: nextSession, type }) => {
        if (nextSession) {
          setSession(nextSession);
        }

        if (type === 'voting_started' || nextSession?.status === 'VOTING' || nextSession?.status === 'COMPLETED') {
          setTimeout(() => {
            navigateToResult();
          }, 700);
        }
      },
    });

    return () => {
      socket.close();
    };
  }, [navigateToResult, sessionId]);

  const myMember = useMemo(() => {
    return session?.members.find((member) => member.userId === currentUserId) ?? null;
  }, [currentUserId, session?.members]);

  const allMembersReady = useMemo(() => {
    const members = session?.members ?? [];
    return members.length > 0 && members.every((member) => Boolean(member.readyAt));
  }, [session?.members]);

  const passedSubmissions = useMemo(() => getPassedMissionSubmissions(session), [session]);
  const requiredCommentsPerPhoto = Math.max(1, session?.members.length ?? 0);
  const currentSubmissionIndex = useMemo(() => {
    const nextIndex = passedSubmissions.findIndex((submission) => submission.comments.length < requiredCommentsPerPhoto);

    return nextIndex >= 0 ? nextIndex : Math.max(0, passedSubmissions.length - 1);
  }, [passedSubmissions, requiredCommentsPerPhoto]);

  const currentSubmission = passedSubmissions[currentSubmissionIndex] ?? null;
  const commentRemainingMs = getRemainingMs(session?.commentEndsAt, now);
  const isCommentExpired = commentRemainingMs !== null && commentRemainingMs <= 0;
  const hasCommentedCurrentPhoto = Boolean(currentUserId && currentSubmission?.comments.some((comment) => comment.userId === currentUserId));
  const currentPhotoCommentCount = currentSubmission?.comments.length ?? 0;
  const isCurrentPhotoComplete = Boolean(currentSubmission && currentPhotoCommentCount >= requiredCommentsPerPhoto);
  const isWaitingForOthers = hasCommentedCurrentPhoto && !isCurrentPhotoComplete;
  const commentProgress = passedSubmissions.reduce((count, submission) => count + submission.comments.length, 0);
  const requiredCommentCount = passedSubmissions.length * requiredCommentsPerPhoto;
  const isAllCommentsComplete = Boolean(session && passedSubmissions.length > 0 && session.members.length > 0 && requiredCommentCount > 0 && commentProgress >= requiredCommentCount);

  useEffect(() => {
    if (!isAllCommentsComplete) {
      return;
    }

    const timer = setTimeout(() => {
      navigateToResult();
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [isAllCommentsComplete, navigateToResult]);

  const handleReady = async () => {
    if (!sessionId || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const nextSession = await readyMissionSession(sessionId);
      setSession(nextSession);
    } catch (error) {
      if (error instanceof MissionSessionApiError && [400, 409, 422].includes(error.status)) {
        setIsReviewReadyFallback(true);
        setMessage('댓글 단계로 이동했어요. 서버 상태는 계속 다시 확인합니다.');
        await refreshSession();
        return;
      }

      setMessage(error instanceof Error ? error.message : '레디 처리에 실패했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitComment = async () => {
    const content = commentText.trim();

    if (!sessionId || !currentSubmission || !content || isSubmitting || hasCommentedCurrentPhoto || isCommentExpired) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      await postMissionSessionComment(sessionId, currentSubmission.id, content);
      setCommentText('');
      await refreshSession();
    } catch (error) {
      if (error instanceof MissionSessionApiError && error.status === 409) {
        await refreshSession();
        return;
      }

      setMessage(error instanceof Error ? error.message : '댓글 등록에 실패했어요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goResult = () => {
    navigateToResult();
  };

  const goBackToTrip = () => {
    if (scheduleId) {
      router.replace({ pathname: '/trip/active', params: { scheduleId } });
      return;
    }

    router.back();
  };

  const showReadyScreen = !isReviewReadyFallback && !allMembersReady && session?.status === 'REVEALED';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 18 }]}>
        <ScalePressable accessibilityLabel="돌아가기" onPress={goBackToTrip} pressedScale={0.86} style={styles.backButton}>
          <Ionicons color="#121820" name="chevron-back" size={28} />
        </ScalePressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>댓글 준비</Text>
          <Text style={styles.subtitle}>{session?.missionTitle ?? '미션'} · {session?.status ?? '-'}</Text>
        </View>
      </View>

      {isLoading && !session ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          <Text style={styles.stateText}>서버에서 세션을 불러오는 중이에요.</Text>
        </View>
      ) : showReadyScreen ? (
        <View style={[styles.readyWrap, { paddingBottom: bottomSafeInset + 28, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>댓글 달 준비가 됐나요?</Text>
            <Text style={styles.readyText}>참여자 전원이 레디를 누르면 익명 사진 댓글 화면으로 넘어가요.</Text>
            <View style={styles.memberList}>
              {session?.members.map((member, index) => (
                <View key={`${member.userId}-${index}`} style={styles.memberRow}>
                  <Text style={styles.memberName}>{getUserLabel(index)}</Text>
                  <Text style={[styles.memberStatus, member.readyAt && styles.memberReady]}>{member.readyAt ? 'READY' : 'WAITING'}</Text>
                </View>
              ))}
            </View>
            <ScalePressable disabled={Boolean(myMember?.readyAt) || isSubmitting} onPress={handleReady} pressedScale={0.96} style={[styles.primaryButton, (myMember?.readyAt || isSubmitting) && styles.disabledButton]}>
              {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{myMember?.readyAt ? '레디 완료' : '레디'}</Text>}
            </ScalePressable>
            <ScalePressable onPress={refreshSession} pressedScale={0.96} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>서버 상태 새로고침</Text>
            </ScalePressable>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSafeInset + 28, paddingHorizontal: horizontalPadding }]} keyboardShouldPersistTaps="handled">
          <View style={[styles.progressBox, isCommentExpired && styles.progressDangerBox]}>
            <Text style={styles.progressTitle}>댓글 진행</Text>
            {commentRemainingMs !== null ? <Text style={[styles.timerText, isCommentExpired && styles.timerDangerText]}>댓글 제한 {formatRemainingTime(commentRemainingMs)}</Text> : null}
            <Text style={styles.progressText}>전체 {commentProgress}/{requiredCommentCount} · 현재 사진 {currentPhotoCommentCount}/{requiredCommentsPerPhoto}</Text>
          </View>

          {currentSubmission ? (
            <View style={styles.photoCard}>
              <Text style={styles.photoCounter}>{currentSubmissionIndex + 1}/{passedSubmissions.length}</Text>
              <Image source={{ uri: currentSubmission.imageUrl }} style={styles.photo} contentFit="cover" />
              <Text style={styles.anonymousLabel}>{isCurrentPhotoComplete ? '모든 댓글 완료 · 다음 사진으로 이동 중' : '촬영자 비공개'}</Text>
            </View>
          ) : (
            <View style={styles.centerState}>
              <Text style={styles.stateText}>아직 공개된 사진이 없어요.</Text>
            </View>
          )}

          <View style={styles.commentPanel}>
            <Text style={styles.sectionTitle}>익명 댓글</Text>
            {isWaitingForOthers ? <Text style={styles.waitingText}>내 댓글은 등록됐어요. 다른 참여자의 댓글을 기다리는 중이에요.</Text> : null}
            {currentSubmission?.comments.length ? currentSubmission.comments.map((comment, index) => (
              <View key={`${comment.id}-${index}`} style={styles.commentBubble}>
                <Text style={styles.commentAuthor}>{getUserLabel(index)}</Text>
                <Text style={styles.commentText}>{comment.content}</Text>
              </View>
            )) : <Text style={styles.emptyText}>아직 댓글이 없어요.</Text>}
          </View>

          <View style={styles.inputPanel}>
            <TextInput
              editable={!hasCommentedCurrentPhoto && !isSubmitting && !isCommentExpired && Boolean(currentSubmission)}
              multiline
              onChangeText={setCommentText}
              placeholder={isCommentExpired ? '댓글 제한 시간이 종료됐어요.' : hasCommentedCurrentPhoto ? '다른 참여자의 댓글을 기다리는 중이에요.' : '익명 댓글을 남겨보세요.'}
              placeholderTextColor="#9AA3A8"
              style={styles.input}
              value={commentText}
            />
            <ScalePressable disabled={!commentText.trim() || hasCommentedCurrentPhoto || isSubmitting || isCommentExpired || !currentSubmission} onPress={handleSubmitComment} pressedScale={0.96} style={[styles.primaryButton, (!commentText.trim() || hasCommentedCurrentPhoto || isSubmitting || isCommentExpired || !currentSubmission) && styles.disabledButton]}>
              {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>댓글 등록</Text>}
            </ScalePressable>
            <ScalePressable onPress={goResult} pressedScale={0.96} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>결과 화면으로 확인</Text>
            </ScalePressable>
          </View>
        </ScrollView>
      )}

      {message ? <Text style={[styles.message, { bottom: bottomSafeInset + 12 }]}>{message}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F4F7FA',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#111820',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#7D868C',
    fontSize: 14,
    marginTop: 4,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  stateText: {
    color: '#7D868C',
    fontSize: 14,
  },
  readyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  readyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
  },
  readyTitle: {
    color: '#111820',
    fontSize: 24,
    fontWeight: '800',
  },
  readyText: {
    color: '#7D868C',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  memberList: {
    gap: 10,
    marginVertical: 22,
  },
  memberRow: {
    alignItems: 'center',
    borderBottomColor: '#EEF1F3',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  memberName: {
    color: '#111820',
    fontSize: 15,
    fontWeight: '700',
  },
  memberStatus: {
    color: '#A1A9AE',
    fontSize: 12,
    fontWeight: '800',
  },
  memberReady: {
    color: '#409CB7',
  },
  content: {
    gap: 16,
    paddingTop: 10,
  },
  progressBox: {
    backgroundColor: '#EAF5F8',
    borderRadius: 14,
    padding: 14,
  },
  progressTitle: {
    color: '#111820',
    fontSize: 16,
    fontWeight: '800',
  },
  timerText: {
    color: '#D86C59',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  timerDangerText: {
    color: '#C94435',
  },
  progressDangerBox: {
    backgroundColor: '#FDEBE8',
  },
  progressText: {
    color: '#5C737D',
    fontSize: 13,
    marginTop: 4,
  },
  photoCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
  },
  photoCounter: {
    alignSelf: 'flex-start',
    color: '#409CB7',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  photo: {
    aspectRatio: 1,
    borderRadius: 16,
    width: '100%',
  },
  anonymousLabel: {
    color: '#7D868C',
    fontSize: 14,
    marginTop: 10,
  },
  commentPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    gap: 10,
    padding: 16,
  },
  sectionTitle: {
    color: '#111820',
    fontSize: 18,
    fontWeight: '800',
  },
  commentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F4F6',
    borderRadius: 14,
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentAuthor: {
    color: '#409CB7',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  commentText: {
    color: '#111820',
    fontSize: 15,
    lineHeight: 21,
  },
  waitingText: {
    color: '#5C737D',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  emptyText: {
    color: '#8A9399',
    fontSize: 14,
  },
  inputPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    gap: 12,
    padding: 16,
  },
  input: {
    backgroundColor: '#F4F7FA',
    borderRadius: 12,
    color: '#111820',
    fontSize: 15,
    minHeight: 92,
    padding: 12,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#6EA8BE',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#EEF3F5',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#526168',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  message: {
    alignSelf: 'center',
    backgroundColor: '#111820',
    borderRadius: 999,
    color: '#ffffff',
    fontSize: 13,
    maxWidth: '90%',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 9,
    position: 'absolute',
  },
});