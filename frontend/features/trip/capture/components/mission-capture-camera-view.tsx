import { CameraView, type CameraType, type FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Animated, PanResponderInstance, StyleSheet, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { MissionCard } from '@/components/mission-card';
import { ScalePressable } from '@/components/scale-pressable';
import { formatRemainingTime } from '@/features/trip/capture/mission-capture-data';
import { styles } from '@/features/trip/capture/mission-capture-styles';
import type { MissionSession } from '@/lib/mission-session-api';
import type { TripScheduleMission } from '@/lib/trip-schedule-api';

const cameraBackIcon = require('@/assets/svg/camera/back.svg');
const cameraFlashOffIcon = require('@/assets/svg/camera/flash_off.svg');
const cameraFlashOnIcon = require('@/assets/svg/camera/flash_on.svg');
const cameraSwitchIcon = require('@/assets/svg/camera/autorenew.svg');
const cameraTimerIcon = require('@/assets/svg/camera/time_stamp.svg');

type MissionCaptureCameraViewProps = {
  backdropOpacity: Animated.AnimatedInterpolation<number>;
  bottomSafeInset: number;
  cameraRef: React.MutableRefObject<CameraView | null>;
  facing: CameraType;
  flash: FlashMode;
  handleCapture: () => Promise<void>;
  isCapturing: boolean;
  isShootingExpired: boolean;
  mission: TripScheduleMission | null;
  missionCardCollapsedBottom: number;
  missionCardPanResponder: PanResponderInstance;
  missionCardTranslateY: Animated.Value;
  missionError: string;
  isMissionLoading: boolean;
  onClose: () => void;
  session: MissionSession | null;
  shootingRemainingMs: number | null;
  toggleFacing: () => void;
  toggleFlash: () => void;
  topSafeInset: number;
};

// 카메라 미리보기와 미션 카드·촬영 컨트롤을 담당합니다.
export function MissionCaptureCameraView({
  backdropOpacity,
  bottomSafeInset,
  cameraRef,
  facing,
  flash,
  handleCapture,
  isCapturing,
  isMissionLoading,
  isShootingExpired,
  mission,
  missionCardCollapsedBottom,
  missionCardPanResponder,
  missionCardTranslateY,
  missionError,
  onClose,
  session,
  shootingRemainingMs,
  toggleFacing,
  toggleFlash,
  topSafeInset,
}: MissionCaptureCameraViewProps) {
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView
        animateShutter
        enableTorch={flash === 'on'}
        facing={facing}
        flash={flash}
        mode="picture"
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="box-none" style={[styles.topControls, { paddingTop: topSafeInset + 24 }]}>
        <ScalePressable accessibilityLabel="닫기" onPress={onClose} pressedScale={0.86} style={styles.iconButton}>
          <Image contentFit="contain" source={cameraBackIcon} style={styles.closeIcon} />
        </ScalePressable>
        <ScalePressable accessibilityLabel="플래시" onPress={toggleFlash} pressedScale={0.86} style={styles.iconButton}>
          <Image contentFit="contain" source={flash === 'off' ? cameraFlashOffIcon : cameraFlashOnIcon} style={styles.flashIcon} />
        </ScalePressable>
        <View style={styles.timerControl}>
          <Image contentFit="contain" source={cameraTimerIcon} style={styles.timerIcon} />
          {shootingRemainingMs !== null ? <Text style={[styles.cameraTimerText, isShootingExpired && styles.cameraTimerDanger]}>{formatRemainingTime(shootingRemainingMs)}</Text> : null}
        </View>
      </View>

      <View pointerEvents="none" style={styles.cameraGuide}>
        <View style={[styles.guideCorner, styles.guideTopLeft]} />
        <View style={[styles.guideCorner, styles.guideTopRight]} />
        <View style={[styles.guideCorner, styles.guideBottomLeft]} />
        <View style={[styles.guideCorner, styles.guideBottomRight]} />
      </View>

      <View pointerEvents="box-none" style={styles.bottomOverlay}>
        <Animated.View pointerEvents="none" style={[styles.backdropOverlay, { opacity: backdropOpacity }]} />

        <Animated.View
          {...missionCardPanResponder.panHandlers}
          style={[styles.missionCard, { bottom: missionCardCollapsedBottom, transform: [{ translateY: missionCardTranslateY }] }]}>
          <MissionCard
            errorMessage={missionError}
            isLoading={isMissionLoading}
            mission={mission ? {
              description: mission.description,
              iconText: mission.rewardItemIcon,
              iconUrl: mission.emojiUrl ?? mission.photoUrl,
              title: mission.title,
              type: mission.type,
            } : session ? {
              title: session.missionTitle,
            } : null}
          />
        </Animated.View>

        <View pointerEvents="box-none" style={[styles.captureControls, { bottom: bottomSafeInset + 52 }]}>
          <ScalePressable accessibilityLabel="사진 촬영" disabled={isCapturing || isShootingExpired} onPress={handleCapture} pressedScale={0.92} style={[styles.shutterOuter, (isCapturing || isShootingExpired) && styles.disabledControl]}>
            <View style={styles.shutterInner} />
          </ScalePressable>

          <ScalePressable accessibilityLabel="카메라 전환" onPress={toggleFacing} pressedScale={0.86} style={styles.switchButton}>
            <Image contentFit="contain" source={cameraSwitchIcon} style={styles.switchIcon} />
          </ScalePressable>
        </View>
      </View>
    </View>
  );
}
