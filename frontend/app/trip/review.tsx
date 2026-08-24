import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { MissionFailureView } from '@/features/trip/review/components/mission-failure-view';
import { useMissionReview } from '@/features/trip/review/hooks/use-mission-review';
import { getUserLabel } from '@/features/trip/review/mission-review-data';
import { styles } from '@/features/trip/review/mission-review-styles';
import { getParamValue } from '@/features/trip/trip-data';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';

const nextArrowIcon = require('@/assets/svg/active/next_arrow.svg');

// 미션 review 화면의 댓글 UI와 결과 이동 화면을 담당합니다.
export default function MissionReviewScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[]; scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const mode = getParamValue(params.mode);
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const isMissionTimeout = mode === 'mission-timeout';
  const currentUserId = getAuthItem('user_id');
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const {
    commentText,
    currentSubmission,
    currentSubmissionIndex,
    goBackToTrip,
    goNext,
    handleSubmitComment,
    hasCommentedCurrentPhoto,
    isCommentExpired,
    isLoading,
    isSubmitting,
    isWaitingForReveal,
    keyboardHeight,
    message,
    passedSubmissions,
    session,
    setCommentText,
    transitionCountdown,
    transitionSubmissionId,
  } = useMissionReview({ currentUserId, isMissionTimeout, scheduleId, sessionId });

  if (isMissionTimeout) {
    return <MissionFailureView onGoBack={goBackToTrip} />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 26 }]}>
        <ScalePressable accessibilityLabel="돌아가기" onPress={goBackToTrip} pressedScale={0.86} style={styles.backButton}>
          <Ionicons color="#121820" name="chevron-back" size={25} />
        </ScalePressable>
        <Text numberOfLines={1} style={styles.title}>{session?.missionTitle ?? '미션'}</Text>
        <ScalePressable accessibilityLabel="다음" onPress={goNext} pressedScale={0.9} style={styles.doneButton}>
          <Image source={nextArrowIcon} style={styles.nextArrowIcon} contentFit="contain" />
        </ScalePressable>
      </View>

      {isLoading && !session ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          <Text style={styles.stateText}>서버에서 세션을 불러오는 중이에요.</Text>
        </View>
      ) : isWaitingForReveal ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          <Text style={styles.stateText}>참여자들의 촬영이 끝나면 댓글 화면이 열려요.</Text>
        </View>      ) : (
        <View style={styles.reviewStage}>
          <View style={styles.pageDots}>
            {passedSubmissions.map((submission, index) => <View key={submission.id} style={[styles.pageDot, index === currentSubmissionIndex && styles.pageDotActive]} />)}
          </View>
          <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]} keyboardShouldPersistTaps="handled">

          {currentSubmission ? (
            <View style={[styles.photoCard, keyboardHeight > 0 && styles.keyboardPhotoCard]}>
              <Image source={{ uri: currentSubmission.imageUrl }} style={styles.photo} contentFit="cover" />
              {transitionSubmissionId === currentSubmission.id && transitionCountdown !== null ? (
                <View style={styles.photoTransitionOverlay}>
                  <View style={styles.transitionCheck}><Ionicons color="#FFFFFF" name="checkmark" size={18} /></View>
                  <Text style={styles.transitionTitle}>모두 댓글 작성을 완료했어요!</Text>
                  <Text style={styles.transitionDescription}>{transitionCountdown}초 뒤 다음 사진으로 넘어가요!</Text>
                </View>
              ) : null}
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
