import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { completeMissionSession, getMissionSession, type MissionSession } from '@/lib/mission-session-api';

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCommentLabel(index: number) {
  return `익명 댓글 ${index + 1}`;
}

export default function MissionResultScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const [session, setSession] = useState<MissionSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      setMessage('세션 정보가 없습니다.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const nextSession = await getMissionSession(sessionId);

      if (nextSession.status === 'VOTING') {
        try {
          const completedSession = await completeMissionSession(sessionId);
          setSession(completedSession);
          return;
        } catch {
          // Some users may not be allowed to complete the session. The saved result can still be shown.
        }
      }

      setSession(nextSession);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '결과를 불러오지 못했어요.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      refreshSession();
    }, [refreshSession])
  );

  const goTrip = () => {
    if (scheduleId) {
      router.replace({ pathname: '/trip/active', params: { scheduleId } });
      return;
    }

    router.replace('/trip/hub');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 18 }]}>
        <ScalePressable accessibilityLabel="돌아가기" onPress={goTrip} pressedScale={0.86} style={styles.backButton}>
          <Ionicons color="#121820" name="chevron-back" size={28} />
        </ScalePressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>미션 결과</Text>
          <Text style={styles.subtitle}>{session?.missionTitle ?? '서버에 저장된 사진과 댓글 확인'}</Text>
        </View>
        <ScalePressable accessibilityLabel="새로고침" onPress={refreshSession} pressedScale={0.9} style={styles.refreshButton}>
          <Ionicons color="#409CB7" name="refresh" size={22} />
        </ScalePressable>
      </View>

      {isLoading && !session ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          <Text style={styles.stateText}>서버 결과를 불러오는 중이에요.</Text>
        </View>
      ) : message ? (
        <View style={styles.centerState}>
          <Text style={styles.stateText}>{message}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSafeInset + 96, paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>상태: {session?.status ?? '-'}</Text>
            <Text style={styles.summaryText}>사진 {session?.submissions.length ?? 0}장 · 댓글 {session?.submissions.reduce((count, submission) => count + submission.comments.length, 0) ?? 0}개</Text>
          </View>

          {session?.submissions.length ? session.submissions.map((submission, submissionIndex) => (
            <View key={submission.id} style={styles.resultCard}>
              <Text style={styles.photoTitle}>사진 {submissionIndex + 1}</Text>
              <Image source={{ uri: submission.imageUrl }} style={styles.photo} contentFit="cover" />
              <View style={styles.commentList}>
                <Text style={styles.commentListTitle}>익명 댓글</Text>
                {submission.comments.length ? submission.comments.map((comment, index) => (
                  <View key={`${comment.id}-${index}`} style={styles.commentRow}>
                    <Text style={styles.commentAuthor}>{getCommentLabel(index)}</Text>
                    <Text style={styles.commentText}>{comment.content}</Text>
                  </View>
                )) : <Text style={styles.emptyText}>댓글이 아직 없어요.</Text>}
              </View>
            </View>
          )) : (
            <View style={styles.centerState}>
              <Text style={styles.stateText}>표시할 사진이 없어요.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
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
  refreshButton: {
    alignItems: 'center',
    backgroundColor: '#E7F3F6',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateText: {
    color: '#7D868C',
    fontSize: 15,
    textAlign: 'center',
  },
  content: {
    gap: 16,
    paddingTop: 8,
  },
  summaryCard: {
    backgroundColor: '#EAF5F8',
    borderRadius: 16,
    padding: 16,
  },
  summaryTitle: {
    color: '#111820',
    fontSize: 17,
    fontWeight: '800',
  },
  summaryText: {
    color: '#5C737D',
    fontSize: 14,
    marginTop: 5,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    gap: 14,
    padding: 16,
  },
  photoTitle: {
    color: '#111820',
    fontSize: 18,
    fontWeight: '800',
  },
  photo: {
    aspectRatio: 1,
    borderRadius: 16,
    width: '100%',
  },
  commentList: {
    gap: 10,
  },
  commentListTitle: {
    color: '#111820',
    fontSize: 16,
    fontWeight: '800',
  },
  commentRow: {
    backgroundColor: '#F0F4F6',
    borderRadius: 14,
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
  emptyText: {
    color: '#8A9399',
    fontSize: 14,
  },
});