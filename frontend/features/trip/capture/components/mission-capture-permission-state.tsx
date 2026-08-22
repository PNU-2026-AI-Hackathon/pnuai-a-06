import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { styles } from '@/features/trip/capture/mission-capture-styles';

type MissionCapturePermissionStateProps = {
  bottomSafeInset: number;
  onClose: () => void;
  onRequestPermission?: () => void;
  topSafeInset: number;
  variant: 'loading' | 'notParticipant' | 'denied';
};

// 카메라 권한과 촬영 참여 가능 여부에 따른 상태 화면입니다.
export function MissionCapturePermissionState({ bottomSafeInset, onClose, onRequestPermission, topSafeInset, variant }: MissionCapturePermissionStateProps) {
  if (variant === 'loading') {
    return (
      <View style={styles.stateScreen}>
        <StatusBar hidden />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (variant === 'notParticipant') {
    return (
      <View style={styles.stateScreen}>
        <StatusBar hidden />
        <Text style={styles.permissionTitle}>이번 미션의 촬영 참여자가 아니에요.</Text>
        <ScalePressable accessibilityLabel="돌아가기" onPress={onClose} pressedScale={0.96} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>돌아가기</Text>
        </ScalePressable>
      </View>
    );
  }

  return (
    <View style={[styles.stateScreen, { paddingBottom: bottomSafeInset + 32, paddingTop: topSafeInset + 24 }]}>
      <StatusBar hidden />
      <ScalePressable accessibilityLabel="닫기" onPress={onClose} pressedScale={0.86} style={styles.permissionCloseButton}>
        <Ionicons color="#ffffff" name="close" size={34} />
      </ScalePressable>
      <View style={styles.permissionContent}>
        <Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text>
        <Text style={styles.permissionText}>미션 인증 사진을 촬영하려면 카메라 접근을 허용해 주세요.</Text>
        <ScalePressable onPress={onRequestPermission} pressedScale={0.96} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>권한 허용</Text>
        </ScalePressable>
      </View>
    </View>
  );
}
