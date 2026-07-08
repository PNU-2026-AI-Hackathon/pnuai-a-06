import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const missionFrame = require('../../assets/svg/mission_level/standard_frame.svg');
const MISSION_CARD_SOURCE_WIDTH = 164;
const MISSION_CARD_SOURCE_HEIGHT = 209;
const MISSION_CARD_WIDTH = 350;
const MISSION_CARD_HEIGHT = Math.round(MISSION_CARD_WIDTH * (MISSION_CARD_SOURCE_HEIGHT / MISSION_CARD_SOURCE_WIDTH));
const MISSION_CARD_COLLAPSED_VISIBLE_HEIGHT = 66;

export default function MissionCaptureScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const missionCardTranslateY = useRef(new Animated.Value(0)).current;
  const missionCardOffsetY = useRef(0);
  const { bottomSafeInset, height, topSafeInset } = useResponsiveLayout();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [isMissionComplete, setIsMissionComplete] = useState(false);
  const missionCardCollapsedBottom = bottomSafeInset - (MISSION_CARD_HEIGHT - MISSION_CARD_COLLAPSED_VISIBLE_HEIGHT);
  const missionCardExpandedY = missionCardCollapsedBottom - height / 2 + MISSION_CARD_HEIGHT / 2;
  const backdropOpacity = missionCardTranslateY.interpolate({
    extrapolate: 'clamp',
    inputRange: [missionCardExpandedY, 0],
    outputRange: [0.56, 0],
  });

  const hasPermission = permission?.granted;

  const animateMissionCard = useCallback(
    (toValue: number) => {
      missionCardOffsetY.current = toValue;
      Animated.spring(missionCardTranslateY, {
        damping: 22,
        mass: 0.9,
        stiffness: 180,
        toValue,
        useNativeDriver: true,
      }).start();
    },
    [missionCardTranslateY]
  );

  const missionCardPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
        onPanResponderGrant: () => {
          missionCardTranslateY.stopAnimation((value) => {
            missionCardOffsetY.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.min(0, Math.max(missionCardExpandedY, missionCardOffsetY.current + gestureState.dy));
          missionCardTranslateY.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const projectedValue = missionCardOffsetY.current + gestureState.dy + gestureState.vy * 70;
          const midpoint = missionCardExpandedY / 2;
          animateMissionCard(projectedValue < midpoint ? missionCardExpandedY : 0);
        },
        onPanResponderTerminate: () => {
          animateMissionCard(0);
        },
      }),
    [animateMissionCard, missionCardExpandedY, missionCardTranslateY]
  );

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        setCapturedPhotoUri(photo.uri);
        setIsMissionComplete(false);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhotoUri(null);
    setIsMissionComplete(false);
  };

  const handleComplete = () => {
    setIsMissionComplete(true);
  };

  if (!permission) {
    return (
      <View style={styles.stateScreen}>
        <StatusBar hidden />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.stateScreen, { paddingBottom: bottomSafeInset + 32, paddingTop: topSafeInset + 24 }]}>
        <StatusBar hidden />
        <ScalePressable accessibilityLabel="닫기" onPress={() => router.back()} pressedScale={0.86} style={styles.permissionCloseButton}>
          <Ionicons color="#ffffff" name="close" size={34} />
        </ScalePressable>
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text>
          <Text style={styles.permissionText}>미션 인증 사진을 촬영하려면 카메라 접근을 허용해 주세요.</Text>
          <ScalePressable onPress={requestPermission} pressedScale={0.96} style={styles.permissionButton}>
            <Text style={styles.permissionButtonText}>권한 허용</Text>
          </ScalePressable>
        </View>
      </View>
    );
  }

  if (capturedPhotoUri) {
    return (
      <View style={[styles.reviewContainer, { paddingBottom: bottomSafeInset + 25, paddingTop: topSafeInset + 70 }]}>
        <StatusBar style="dark" />
        <View style={styles.reviewHeader}>
          {isMissionComplete ? <Text style={styles.completeTitle}>미션 완료!</Text> : null}
        </View>

        <View style={styles.previewWrap}>
          <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} contentFit="cover" />
        </View>

        <View style={styles.reviewActions}>
          <ScalePressable accessibilityLabel="다시 찍기" onPress={handleRetake} pressedScale={0.96} style={[styles.reviewButton, styles.retakeButton]}>
            <Text style={[styles.reviewButtonText, styles.retakeButtonText]}>다시 찍기</Text>
          </ScalePressable>
          <ScalePressable accessibilityLabel="완료하기" onPress={handleComplete} pressedScale={0.96} style={[styles.reviewButton, styles.completeButton]}>
            <Text style={[styles.reviewButtonText, styles.completeButtonText]}>완료하기</Text>
          </ScalePressable>
        </View>
      </View>
    );
  }

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
        <ScalePressable accessibilityLabel="닫기" onPress={() => router.back()} pressedScale={0.86} style={styles.iconButton}>
          <Ionicons color="#ffffff" name="close" size={30} />
        </ScalePressable>
        <ScalePressable accessibilityLabel="플래시" onPress={toggleFlash} pressedScale={0.86} style={styles.iconButton}>
          <Ionicons color="#ffffff" name={flash === 'off' ? 'flash-off' : 'flash'} size={25} />
        </ScalePressable>
      </View>

      <View pointerEvents="box-none" style={styles.bottomOverlay}>
        <Animated.View pointerEvents="none" style={[styles.backdropOverlay, { opacity: backdropOpacity }]} />

        <Animated.View
          {...missionCardPanResponder.panHandlers}
          style={[
            styles.missionCard,
            {
              bottom: missionCardCollapsedBottom,
              transform: [{ translateY: missionCardTranslateY }],
            },
          ]}>
          <Image source={missionFrame} style={styles.missionFrame} contentFit="contain" />
        </Animated.View>

        <View pointerEvents="box-none" style={[styles.captureControls, { bottom: bottomSafeInset + 52 }]}>
          <ScalePressable
            accessibilityLabel="사진 촬영"
            disabled={isCapturing}
            onPress={handleCapture}
            pressedScale={0.92}
            style={[styles.shutterOuter, isCapturing && styles.disabledControl]}>
            <View style={styles.shutterInner} />
          </ScalePressable>

          <ScalePressable accessibilityLabel="카메라 전환" onPress={toggleFacing} pressedScale={0.86} style={styles.switchButton}>
            <Ionicons color="#ffffff" name="sync" size={27} />
          </ScalePressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    flex: 1,
  },
  reviewContainer: {
    backgroundColor: '#F4F7FA',
    flex: 1,
    paddingHorizontal: 36,
  },
  reviewHeader: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginBottom: 24,
  },
  completeTitle: {
    color: '#2D3C43',
    fontSize: 24,
    fontWeight: '600',
  },
  previewWrap: {
    alignSelf: 'center',
    backgroundColor: '#E5EEF3',
    borderRadius: 18,
    flex: 1,
    maxHeight: 520,
    minHeight: 300,
    overflow: 'hidden',
    width: '100%',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 30,
  },
  reviewButton: {
    alignItems: 'center',
    borderRadius: 19,
    flex: 1,
    height: 58,
    justifyContent: 'center',
  },
  retakeButton: {
    backgroundColor: '#C9E4EE',
  },
  completeButton: {
    backgroundColor: '#409CB7',
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  retakeButtonText: {
    color: '#409CB7',
  },
  completeButtonText: {
    color: '#FFFFFF',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 22,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  bottomOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backdropOverlay: {
    backgroundColor: '#000000',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  missionCard: {
    alignSelf: 'center',
    height: MISSION_CARD_HEIGHT,
    position: 'absolute',
    width: MISSION_CARD_WIDTH,
    zIndex: 3,
  },
  missionFrame: {
    height: MISSION_CARD_HEIGHT,
    width: MISSION_CARD_WIDTH,
  },
  captureControls: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  shutterOuter: {
    alignItems: 'center',
    backgroundColor: '#E3F0F6',
    borderColor: '#eef3fb',
    borderRadius: 999,
    borderWidth: 5,
    height: 72,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    width: 72,
    zIndex: 2,
  },
  shutterInner: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    height: 62,
    width: 62,
  },
  disabledControl: {
    opacity: 0.62,
  },
  switchButton: {
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    position: 'absolute',
    right: 31,
    width: 50,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: '#0c1115',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  permissionCloseButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    left: 22,
    position: 'absolute',
    top: 22,
    width: 48,
  },
  permissionContent: {
    alignItems: 'center',
    width: '100%',
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 10,
  },
  permissionText: {
    color: '#b9c2c9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 26,
    textAlign: 'center',
  },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: '#c9edf7',
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  permissionButtonText: {
    color: '#10161f',
    fontSize: 15,
    fontWeight: '700',
  },
});






