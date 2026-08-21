import { login as loginWithKakao } from '@react-native-seoul/kakao-login';
import { Platform } from 'react-native';

import {
  API_BASE_URL,
  loginWithKakaoAccessToken,
  saveAuthTokens,
} from '@/lib/auth-api';

export async function continueWithKakao() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const frontendRedirectUri = `${window.location.origin}/`;
    window.location.assign(
      `${API_BASE_URL}/auth/kakao/login?frontend_redirect_uri=${encodeURIComponent(frontendRedirectUri)}`,
    );

    return { redirected: true };
  }

  const kakaoToken = await loginWithKakao();
  const serviceTokens = await loginWithKakaoAccessToken(kakaoToken.accessToken);
  await saveAuthTokens(serviceTokens, true);

  return { redirected: false };
}
