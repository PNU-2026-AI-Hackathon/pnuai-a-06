import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

const API_BASE_URL = 'http://211.213.193.67:7020';
const loginUrl = `${API_BASE_URL}/auth/kakao/login`;

export default function LoginScreen() {
  const handleKakaoLogin = () => {
    if (Platform.OS === 'web') {
      window.location.href = loginUrl;
      return;
    }

    Linking.openURL(loginUrl);
  };

  return (
    <FlowScreen title="A02 로그인" subtitle="카카오 OAuth">
      <FlowButton label="카카오 로그인" onPress={handleKakaoLogin} />
      <FlowButton label="신규 사용자 튜토리얼 보기" onPress={() => router.push('/tutorial')} />
    </FlowScreen>
  );
}
