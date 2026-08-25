import { postJson } from './auth-client';
import type { AuthTokens } from './auth-types';

export function loginWithKakaoAccessToken(kakaoAccessToken: string) {
  // 카카오 SDK 토큰을 서비스 access/refresh token으로 교환
  return postJson<AuthTokens>('/auth/kakao/token', { kakao_access_token: kakaoAccessToken });
}
