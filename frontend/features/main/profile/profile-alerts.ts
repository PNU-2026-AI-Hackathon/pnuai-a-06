// Web과 Native 환경의 프로필 확인창과 오류창을 처리합니다.
import { Alert, Platform } from 'react-native';

import { translateText } from '@/lib/language';

export function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${translateText(title)}\n\n${translateText(message)}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: '확인', style: 'destructive', onPress: onConfirm },
  ]);
}

export function showActionError(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${translateText(title)}\n\n${translateText(message)}`);
    }
    return;
  }

  Alert.alert(title, message);
}
