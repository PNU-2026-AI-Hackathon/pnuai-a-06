import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { formatRemainingTime } from '@/features/trip/capture/mission-capture-data';
import { MissionReviewWaitingView } from '@/features/trip/review/components/mission-review-waiting-view';
import { styles } from '@/features/trip/capture/mission-capture-styles';

type MissionCaptureReviewProps = {
  bottomSafeInset: number;
  capturedPhotoUri: string;
  handleComplete: () => Promise<void>;
  handleRetake: () => void | Promise<void>;
  horizontalPadding: number;
  isMissionComplete: boolean;
  isUploadExpired: boolean;
  isUploading: boolean;
  isWaitingForJudgement: boolean;
  isWaitingForReview: boolean;
  judgeReason: string | null;
  judgementDotCount: number;
  missionDescription?: string;
  needsRetakeAfterJudgement: boolean;
  returnCountdown: number | null;
  sessionId?: string;
  topSafeInset: number;
  uploadMessage: string;
  uploadRemainingMs: number | null;
};

// 촬영한 사진 확인·업로드·판정 결과 재촬영 화면입니다.
export function MissionCaptureReview({
  bottomSafeInset,
  capturedPhotoUri,
  handleComplete,
  handleRetake,
  horizontalPadding,
  isMissionComplete,
  isUploadExpired,
  isUploading,
  isWaitingForJudgement,
  isWaitingForReview,
  judgeReason,
  judgementDotCount,
  missionDescription,
  needsRetakeAfterJudgement,
  returnCountdown,
  sessionId,
  topSafeInset,
  uploadMessage,
  uploadRemainingMs,
}: MissionCaptureReviewProps) {
  if (needsRetakeAfterJudgement) {
    return (
      <View style={[styles.failureContainer, { paddingBottom: bottomSafeInset + 20, paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 90 }]}>
        <StatusBar style="dark" />
        <View style={styles.failureHeader}>
          <Text style={styles.failureTitle}>거의 다 왔어요</Text>
          <Text style={styles.failureSubtitle}>미션에 맞게 다시 찍어보세요</Text>
        </View>

        <View style={styles.failurePhotoCard}>
          <Image contentFit="cover" source={{ uri: capturedPhotoUri }} style={styles.failurePhoto} />
          <View style={styles.failurePhotoOverlay} />
          <View style={styles.failureMissionCopy}>
            <Ionicons color="#FFFFFF" name="alert-circle-outline" size={24} />
            <Text style={styles.failureMissionDescription}>{missionDescription ?? '미션 설명을 확인하고 다시 촬영해 주세요.'}</Text>
          </View>
        </View>

        <ScalePressable accessibilityLabel="다시 찍기" onPress={handleRetake} pressedScale={0.97} style={styles.failureRetakeButton}>
          <Text style={styles.failureRetakeButtonText}>다시 찍기</Text>
        </ScalePressable>
      </View>
    );
  }

  if (isMissionComplete && isWaitingForReview) {
    return <MissionReviewWaitingView bottomSafeInset={bottomSafeInset} topSafeInset={topSafeInset} />;
  }

  return (
    <View style={[styles.reviewContainer, { paddingBottom: bottomSafeInset + 25, paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 90 }]}>
      <StatusBar style="dark" />
      <View style={styles.reviewHeader}>
        <Text style={styles.previewTitle}>{isMissionComplete ? '미션 완료!' : isWaitingForJudgement ? `사진을 확인하고 있어요${'.'.repeat(judgementDotCount)}` : '사진을 확인해 주세요'}</Text>
        <Text numberOfLines={2} style={styles.previewDescription}>
          {returnCountdown !== null
            ? `${returnCountdown}초 후 여행 화면으로 돌아가요`
            : uploadMessage || judgeReason || (uploadRemainingMs !== null
              ? `업로드 제한 ${formatRemainingTime(uploadRemainingMs)}`
              : '미션에 맞게 촬영했는지 확인해 보세요')}
        </Text>
      </View>

      <View style={styles.previewWrap}>
        <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} contentFit="cover" />
        {isWaitingForJudgement ? (
          <View style={styles.previewJudgementOverlay}>
            <ActivityIndicator color="#FFFFFF" size="large" style={styles.previewJudgementLoader} />
          </View>
        ) : null}
      </View>

      <View style={styles.reviewActions}>
        <ScalePressable accessibilityLabel="다시 찍기" disabled={isMissionComplete || isUploading || isWaitingForJudgement} onPress={handleRetake} pressedScale={0.96} style={[styles.reviewButton, styles.retakeButton, (isMissionComplete || isUploading || isWaitingForJudgement) && styles.disabledControl]}>
          <Text style={[styles.reviewButtonText, styles.retakeButtonText]}>다시 찍기</Text>
        </ScalePressable>
        <ScalePressable accessibilityLabel="완료하기" disabled={isMissionComplete || isUploading || isUploadExpired || isWaitingForJudgement || needsRetakeAfterJudgement} onPress={handleComplete} pressedScale={0.96} style={[styles.reviewButton, styles.completeButton, (isMissionComplete || isUploading || isUploadExpired || isWaitingForJudgement || needsRetakeAfterJudgement) && styles.disabledControl]}>
          {isUploading ? <ActivityIndicator color="#ffffff" /> : <Text style={[styles.reviewButtonText, styles.completeButtonText]}>{sessionId ? '업로드하기' : '완료하기'}</Text>}
        </ScalePressable>
      </View>
    </View>
  );
}
