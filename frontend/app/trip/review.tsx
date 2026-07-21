import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const [message, setMessage] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const hasNavigatedForward = useRef(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
    if (!sessionId || hasNavigatedForward.current) {
      return;
    }

    hasNavigatedForward.current = true;
    router.replace({
      pathname: '/trip/result',
      params: {
        ...(scheduleId ? { scheduleId } : {}),
        sessionId,
      },
    });
  }, [scheduleId, sessionId]);

  const navigateToVote = useCallback(() => {
    if (!sessionId || hasNavigatedForward.current) {
      return;
    }

    hasNavigatedForward.current = true;
    router.replace({
      pathname: '/trip/vote',
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

        if (nextSession?.status === 'COMPLETED') {
          setTimeout(() => {
            navigateToResult();
          }, 700);
        } else if (type === 'voting_started' || nextSession?.status === 'VOTING') {
          setTimeout(() => {
            navigateToVote();
          }, 700);
        }
      },
    });

    return () => {
      socket.close();
    };
  }, [navigateToResult, navigateToVote, sessionId]);

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
  const commentProgress = passedSubmissions.reduce((count, submission) => count + submission.comments.length, 0);
  const requiredCommentCount = passedSubmissions.length * requiredCommentsPerPhoto;
  const isAllCommentsComplete = Boolean(session && passedSubmissions.length > 0 && session.members.length > 0 && requiredCommentCount > 0 && commentProgress >= requiredCommentCount);

  useEffect(() => {
    if (!isAllCommentsComplete) {
      return;
    }

    const timer = setTimeout(() => {
      navigateToVote();
    }, 700);

    return () => {
      clearTimeout(timer);
    };
  }, [isAllCommentsComplete, navigateToVote]);

  const handleReady = async () => {
    if (!sessionId || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      const currentSession = await getMissionSession(sessionId);
      setSession(currentSession);
      const nextSession = await readyMissionSession(sessionId);
      setSession(nextSession);
    } catch (error) {
      if (error instanceof MissionSessionApiError && [400, 409, 422].includes(error.status)) {
        setMessage('READY 상태를 확인하고 있어요. 잠시 후 다시 눌러주세요.');
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

  const goNext = () => {
    navigateToVote();
  };

  const goBackToTrip = () => {
    if (scheduleId) {
      router.replace({ pathname: '/trip/active', params: { scheduleId } });
      return;
    }

    router.back();
  };

  const showReadyScreen = Boolean(session && !allMembersReady && session.status !== 'VOTING' && session.status !== 'COMPLETED');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 26 }]}>
        <ScalePressable accessibilityLabel="돌아가기" onPress={goBackToTrip} pressedScale={0.86} style={styles.backButton}>
          <Ionicons color="#121820" name="chevron-back" size={25} />
        </ScalePressable>
        <Text numberOfLines={1} style={styles.title}>{session?.missionTitle ?? '미션'}</Text>
        <ScalePressable accessibilityLabel="댓글 완료" onPress={goNext} pressedScale={0.9} style={styles.doneButton}>
          <Ionicons color="#CBD0D3" name="checkmark" size={27} />
        </ScalePressable>
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
        <View style={styles.reviewStage}>
          <View style={styles.pageDots}>
            {passedSubmissions.map((submission, index) => <View key={submission.id} style={[styles.pageDot, index === currentSubmissionIndex && styles.pageDotActive]} />)}
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]} keyboardShouldPersistTaps="handled">

          {currentSubmission ? (
            <View style={[styles.photoCard, keyboardHeight > 0 && styles.keyboardPhotoCard]}>
              <Image source={{ uri: currentSubmission.imageUrl }} style={styles.photo} contentFit="cover" />
            </View>
          ) : (
            <View style={styles.centerState}>
              <Text style={styles.stateText}>아직 공개된 사진이 없어요.</Text>
            </View>
          )}

          <View style={styles.commentPanel}>
            {currentSubmission?.comments.length ? currentSubmission.comments.map((comment, index) => (
              <View key={`${comment.id}-${index}`} style={styles.commentBubble}>
                <View style={styles.avatar}><Ionicons color="#FFFFFF" name="person" size={20} /></View>
                <View style={styles.commentCopy}>
                  <Text style={styles.commentAuthor}>{getUserLabel(index)}</Text>
                  <Text style={styles.commentText}>{comment.content}</Text>
                </View>
              </View>
            )) : <View style={styles.emptyComments}><Text style={styles.emptyTitle}>아직 댓글이 없어요</Text><Text style={styles.emptyText}>익명으로 한마디 남겨보세요.</Text></View>}
          </View>
          </ScrollView>
          <View style={[styles.inputPanel, { paddingBottom: Math.max(14, bottomSafeInset + 8), transform: [{ translateY: keyboardHeight > 0 ? -(keyboardHeight) : -8 }] }]}>
            <TextInput
              editable={!hasCommentedCurrentPhoto && !isSubmitting && !isCommentExpired && Boolean(currentSubmission)}
              onChangeText={setCommentText}
              onSubmitEditing={handleSubmitComment}
              placeholder={isCommentExpired ? '댓글 시간이 종료됐어요.' : hasCommentedCurrentPhoto ? '다른 댓글을 기다리는 중이에요.' : '댓글을 남겨주세요...'}
              placeholderTextColor="#9AA3A8"
              style={styles.input}
              value={commentText}
            />
            <ScalePressable accessibilityLabel="댓글 보내기" disabled={!commentText.trim() || hasCommentedCurrentPhoto || isSubmitting || isCommentExpired || !currentSubmission} onPress={handleSubmitComment} pressedScale={0.9} style={[styles.sendButton, (!commentText.trim() || hasCommentedCurrentPhoto || isSubmitting || isCommentExpired || !currentSubmission) && styles.sendButtonDisabled]}>
              {isSubmitting ? <ActivityIndicator color="#ffffff" size="small" /> : <Ionicons color="#ffffff" name="paper-plane" size={20} />}
            </ScalePressable>
          </View>
        </View>
      )}

      {message ? <Text style={[styles.message, { bottom: bottomSafeInset + 12 }]}>{message}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  title: {
    color: '#111111',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  doneButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42
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
    flexGrow: 1,
    paddingBottom: 14,
  },
  reviewStage: {
    flex: 1
  },
  pageDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: 27,
    justifyContent: 'center',
    paddingTop: 4
  },
  pageDot: {
    backgroundColor: '#D0D3D5',
    borderRadius: 999,
    height: 8,
    width: 8
  },
  pageDotActive: {
    backgroundColor: '#A9D4E3'
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
    overflow: 'hidden',
    alignItems: 'center',
  },
  keyboardPhotoCard: {
    alignSelf: 'center',
    width: '78%',
  },
  photo: {
    aspectRatio: 3 / 4,
    borderRadius: 20,
    width: '90%',
  },
  anonymousLabel: {
    color: '#7D868C',
    fontSize: 14,
    marginTop: 10,
  },
  commentPanel: {
    gap: 9,
    paddingTop: 10,
  },
  sectionTitle: {
    color: '#111820',
    fontSize: 18,
    fontWeight: '800',
  },
  commentBubble: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F6F9FB',
    borderRadius: 20,
    flexDirection: 'row',
    maxWidth: '96%',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#D7DADD',
    borderRadius: 999,
    height: 35,
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    width: 35
  },
  commentCopy: {
    flexShrink: 1,
    paddingRight: 5
  },
  commentAuthor: {
    color: '#30363A',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentText: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  emptyText: {
    color: '#8A9194',
    fontSize: 12,
  },
  emptyComments: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center', minHeight: 140
  },
  emptyTitle: {
    color: '#10161F', fontSize: 14,
    fontWeight: '600', marginBottom: 8
  },
  inputPanel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingBottom: 14,
    paddingHorizontal: 30,
    paddingTop: 8,
  },
  input: {
    backgroundColor: '#F5F7F8',
    borderRadius: 999,
    color: '#111820',
    flex: 1,
    fontSize: 14,
    height: 58,
    paddingLeft: 22,
    paddingRight: 58,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#ADD8E7',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: 42,
    top: 18,
    width: 38,
  },
  sendButtonDisabled: {
    backgroundColor: '#E1EAEE',
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
