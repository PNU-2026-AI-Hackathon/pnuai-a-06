import { API_BASE_URL } from '@/lib/api-config';
import { getLanguageHeaders } from '@/lib/language';

import { fetchWithAuth, patchJson, postJson, readAuthResponse } from './auth-client';
import { clearAuthSession } from './auth-session';
import type { AuthTokens, AuthUser } from './auth-types';

export function registerWithEmail(email: string, password: string, name: string) {
  // 이메일 회원가입 요청
  return postJson('/auth/email/register', { email, name, password });
}

export function verifyEmail(email: string, code: string) {
  // 이메일 인증 코드 확인
  return postJson('/auth/email/verify', { code, email });
}

export function requestPasswordReset(email: string) {
  return postJson('/auth/email/password-reset/request', { email });
}

export function confirmPasswordReset(email: string, code: string, newPassword: string) {
  return postJson('/auth/email/password-reset/confirm', { code, email, new_password: newPassword });
}

export function loginWithEmail(email: string, password: string) {
  // 이메일 로그인 요청
  return postJson<AuthTokens>('/auth/email/login', { email, password });
}

export function refreshAuthToken(refreshToken: string) {
  // refresh token으로 access token 갱신
  return postJson<AuthTokens>('/auth/token/refresh', { refresh_token: refreshToken });
}

export function updateMe(nickname: string) {
  return patchJson<AuthUser>('/auth/me', { nickname });
}

export async function deleteCurrentAccount() {
  const res = await fetchWithAuth(`${API_BASE_URL}/auth/me`, {
    headers: {
      ...getLanguageHeaders(),
    },
    method: 'DELETE',
  });

  await readAuthResponse<Record<string, never>>(res);
  await clearAuthSession();
}
