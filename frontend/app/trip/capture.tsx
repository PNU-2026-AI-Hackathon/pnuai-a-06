import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MissionCaptureCameraView } from '@/features/trip/capture/components/mission-capture-camera-view';
import { MissionCapturePermissionState } from '@/features/trip/capture/components/mission-capture-permission-state';
import { MissionCaptureReview } from '@/features/trip/capture/components/mission-capture-review';
import { getParamValue, getRemainingMs } from '@/features/trip/capture/mission-capture-data';
import { useMissionCaptureCamera } from '@/features/trip/capture/hooks/use-mission-capture-camera';
import { useMissionCaptureSession } from '@/features/trip/capture/hooks/use-mission-capture-session';
import { useMissionCaptureUpload } from '@/features/trip/capture/hooks/use-mission-capture-upload';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import type { MissionSession } from '@/lib/mission-session-api';
import type { TripScheduleMission } from '@/lib/trip-schedule-api';

// 미션 촬영 라우트와 권한·촬영·결과 화면을 조합합니다.
export default function MissionCaptureScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; scheduleMissionId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const scheduleMissionId = getParamValue(params.scheduleMissionId);
  const sessionId = getParamValue(params.sessionId);
  const { bottomSafeInset, height, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const hasNavigatedAway = useRef(false);
  const timeoutRefreshKey = useRef<string | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [session, setSession] = useState<MissionSession | null>(null);
  const [mission, setMission] = useState<TripScheduleMission | null>(null);
  const [isMissionLoading, setIsMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const shootingRemainingMs = getRemainingMs(session?.shootingEndsAt ?? session?.photoUploadEndsAt, now);
  const uploadRemainingMs = getRemainingMs(session?.photoUploadEndsAt ?? session?.shootingEndsAt, now);
  const isShootingExpired = shootingRemainingMs !== null && shootingRemainingMs <= 0;
  const isUploadExpired = uploadRemainingMs !== null && uploadRemainingMs <= 0;
  const myMember = session?.members.find((member) => member.userId === getAuthItem('user_id'));
  const canShoot = Boolean(!session || (['SHOOTING', 'UPLOADING'].includes(session.status) && myMember?.participationStatus === 'PARTICIPATING'));

  const {
    handleComplete,
    handleRetake,
    isMissionComplete,
    isUploading,
    isWaitingForJudgement,
    judgeReason,
    judgementDotCount,
    needsRetakeAfterJudgement,
    returnCountdown,
    setIsMissionComplete,
    setJudgeReason,
    setJudgeStatus,
    setSubmittedSubmissionId,
    uploadMessage,
  } = useMissionCaptureUpload({
    capturedPhotoUri,
    hasNavigatedAwayRef: hasNavigatedAway,
    isUploadExpired,
    scheduleId,
    scheduleMissionId,
    sessionId,
    setCapturedPhotoUri,
    setSession,
  });

  useMissionCaptureSession({
    capturedPhotoUri,
    hasNavigatedAwayRef: hasNavigatedAway,
    isShootingExpired,
    isUploadExpired,
    scheduleId,
    scheduleMissionId,
    session,
    sessionId,
    setMission,
    setMissionError,
    setIsMissionLoading,
    setSession,
    timeoutRefreshKeyRef: timeoutRefreshKey,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePhotoCaptured = useCallback((uri: string) => {
    setCapturedPhotoUri(uri);
    setIsMissionComplete(false);
    setJudgeReason(null);
    setJudgeStatus(null);
    setSubmittedSubmissionId(null);
  }, [setIsMissionComplete, setJudgeReason, setJudgeStatus, setSubmittedSubmissionId]);
  const camera = useMissionCaptureCamera({ bottomSafeInset, height, isShootingExpired, onPhotoCaptured: handlePhotoCaptured });

  if (!camera.permission) {
    return <MissionCapturePermissionState bottomSafeInset={bottomSafeInset} onClose={() => router.back()} topSafeInset={topSafeInset} variant="loading" />;
  }

  if (session && !canShoot) {
    return <MissionCapturePermissionState bottomSafeInset={bottomSafeInset} onClose={() => router.back()} topSafeInset={topSafeInset} variant="notParticipant" />;
  }

  if (!camera.permission.granted) {
    return <MissionCapturePermissionState bottomSafeInset={bottomSafeInset} onClose={() => router.back()} onRequestPermission={camera.requestPermission} topSafeInset={topSafeInset} variant="denied" />;
  }

  if (capturedPhotoUri) {
    return (
      <MissionCaptureReview
        bottomSafeInset={bottomSafeInset}
        capturedPhotoUri={capturedPhotoUri}
        handleComplete={handleComplete}
        handleRetake={handleRetake}
        horizontalPadding={horizontalPadding}
        isMissionComplete={isMissionComplete}
        isUploadExpired={isUploadExpired}
        isUploading={isUploading}
        isWaitingForJudgement={isWaitingForJudgement}
        judgeReason={judgeReason}
        judgementDotCount={judgementDotCount}
        missionDescription={mission?.description}
        needsRetakeAfterJudgement={needsRetakeAfterJudgement}
        returnCountdown={returnCountdown}
        sessionId={sessionId}
        topSafeInset={topSafeInset}
        uploadMessage={uploadMessage}
        uploadRemainingMs={uploadRemainingMs}
      />
    );
  }

  return (
    <MissionCaptureCameraView
      backdropOpacity={camera.backdropOpacity}
      bottomSafeInset={bottomSafeInset}
      cameraRef={camera.cameraRef}
      facing={camera.facing}
      flash={camera.flash}
      handleCapture={camera.handleCapture}
      isCapturing={camera.isCapturing}
      isMissionLoading={isMissionLoading}
      isShootingExpired={isShootingExpired}
      mission={mission}
      missionCardCollapsedBottom={camera.missionCardCollapsedBottom}
      missionCardPanResponder={camera.missionCardPanResponder}
      missionCardTranslateY={camera.missionCardTranslateY}
      missionError={missionError}
      onClose={() => router.back()}
      session={session}
      shootingRemainingMs={shootingRemainingMs}
      toggleFacing={camera.toggleFacing}
      toggleFlash={camera.toggleFlash}
      topSafeInset={topSafeInset}
    />
  );
}
