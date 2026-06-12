import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { FlowButton, FlowScreen } from '@/components/flow-screen';
import { parseAuthCallbackUrl, saveAuthCallback } from '@/lib/auth-callback';

const API_BASE_URL = 'http://211.213.193.67:7020';
const loginUrl = `${API_BASE_URL}/auth/kakao/login`;

WebBrowser.maybeCompleteAuthSession();

function logCallbackUrl(url: string) {
  const callback = parseAuthCallbackUrl(url);

  console.log('auth session url:', url);
  console.log('auth session token:', callback.token);
  console.log('auth session user_id:', callback.userId);
}

export default function LoginScreen() {
  const handleKakaoLogin = async () => {
    if (Platform.OS === 'web') {
      window.location.href = loginUrl;
      return;
    }

    const redirectUri = Linking.createURL('auth/callback');
    const nativeLoginUrl = `${loginUrl}?frontend_redirect_uri=${encodeURIComponent(redirectUri)}`;
    console.log('auth session redirectUri:', redirectUri);

    const result = await WebBrowser.openAuthSessionAsync(nativeLoginUrl, redirectUri);
    console.log('auth session result:', result);

    if (result.type !== 'success') {
      return;
    }

    logCallbackUrl(result.url);

    const callback = saveAuthCallback(result.url);

    if (!callback.token) {
      console.log('auth session token is null');
      return;
    }

    router.replace('/main');
  };

  const handleDeepLinkTest = async () => {
    const expoUrl = Linking.createURL('auth/callback?token=test-token&user_id=1');
    const appSchemeUrl = 'bcut://auth/callback?token=test-token&user_id=1';

    console.log('deep link test expoUrl:', expoUrl);
    console.log('deep link test appSchemeUrl:', appSchemeUrl);

    await Linking.openURL(expoUrl);
  };

  return (
    <FlowScreen title="A02 로그인" subtitle="카카오 OAuth">
      <FlowButton label="카카오 로그인" onPress={handleKakaoLogin} />
      <FlowButton label="딥링크 테스트" onPress={handleDeepLinkTest} />
      <FlowButton label="신규 사용자 튜토리얼 보기" onPress={() => router.push('/tutorial')} />
    </FlowScreen>
  );
}
