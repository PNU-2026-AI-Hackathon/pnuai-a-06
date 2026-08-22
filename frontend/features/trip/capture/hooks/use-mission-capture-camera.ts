import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

import { MISSION_CARD_COLLAPSED_VISIBLE_HEIGHT, MISSION_CARD_HEIGHT } from '@/features/trip/capture/mission-capture-data';

type UseMissionCaptureCameraOptions = {
  bottomSafeInset: number;
  height: number;
  isShootingExpired: boolean;
  onPhotoCaptured: (uri: string) => void;
};

// 카메라 권한·촬영 설정·사진 촬영과 미션 카드 드래그 상태를 담당합니다.
export function useMissionCaptureCamera({ bottomSafeInset, height, isShootingExpired, onPhotoCaptured }: UseMissionCaptureCameraOptions) {
  const cameraRef = useRef<CameraView | null>(null);
  const missionCardTranslateY = useRef(new Animated.Value(0)).current;
  const missionCardOffsetY = useRef(0);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const missionCardCollapsedBottom = bottomSafeInset - (MISSION_CARD_HEIGHT - MISSION_CARD_COLLAPSED_VISIBLE_HEIGHT);
  const missionCardExpandedY = missionCardCollapsedBottom - height / 2 + MISSION_CARD_HEIGHT / 2;
  const backdropOpacity = missionCardTranslateY.interpolate({
    extrapolate: 'clamp',
    inputRange: [missionCardExpandedY, 0],
    outputRange: [0.56, 0],
  });

  const animateMissionCard = useCallback((toValue: number) => {
    missionCardOffsetY.current = toValue;
    Animated.spring(missionCardTranslateY, {
      damping: 22,
      mass: 0.9,
      stiffness: 180,
      toValue,
      useNativeDriver: true,
    }).start();
  }, [missionCardTranslateY]);

  const missionCardPanResponder = useMemo(
    () => PanResponder.create({
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
    setFacing((current) => current === 'back' ? 'front' : 'back');
  };

  const toggleFlash = () => {
    setFlash((current) => current === 'off' ? 'on' : 'off');
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing || isShootingExpired) {
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        onPhotoCaptured(photo.uri);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  return {
    backdropOpacity,
    cameraRef,
    facing,
    flash,
    handleCapture,
    isCapturing,
    missionCardCollapsedBottom,
    missionCardPanResponder,
    missionCardTranslateY,
    permission,
    requestPermission,
    toggleFacing,
    toggleFlash,
  };
}
