import {
  clearPersistedAuthItem,
  deletePersistentAuthItem,
  getAuthItem,
  setAuthItem,
  setPersistentAuthItem,
} from '@/lib/auth-storage';

import type { AuthTokens } from './auth-types';

export async function clearAuthSession() {
  await Promise.all([
    deletePersistentAuthItem('access_token'),
    deletePersistentAuthItem('refresh_token'),
    deletePersistentAuthItem('auto_login'),
    deletePersistentAuthItem('user_id'),
  ]);
}

export async function saveAuthTokens(data: AuthTokens, persist = false) {
  const accessToken = data.access_token ?? data.token;
  const refreshToken = data.refresh_token ?? getAuthItem('refresh_token');

  if (!accessToken) {
    throw new Error('로그인 응답에 access token이 없습니다.');
  }

  setAuthItem('access_token', accessToken);

  if (refreshToken) {
    setAuthItem('refresh_token', refreshToken);
  }

  if (data.user_id !== undefined) {
    setAuthItem('user_id', String(data.user_id));
  }

  if (persist && refreshToken) {
    await Promise.all([
      setPersistentAuthItem('access_token', accessToken),
      setPersistentAuthItem('refresh_token', refreshToken),
      setPersistentAuthItem('auto_login', 'true'),
      data.user_id === undefined ? Promise.resolve() : setPersistentAuthItem('user_id', String(data.user_id)),
    ]);
    return;
  }

  await Promise.all([
    clearPersistedAuthItem('access_token'),
    clearPersistedAuthItem('refresh_token'),
    clearPersistedAuthItem('auto_login'),
    clearPersistedAuthItem('user_id'),
  ]);
}

/** Keep the web OAuth callback token for the current session without enabling auto login. */
export function saveWebKakaoAuthToken(data: AuthTokens) {
  const accessToken = data.access_token ?? data.token;

  if (!accessToken) {
    throw new Error('카카오 로그인 응답에 access token이 없습니다.');
  }

  setAuthItem('access_token', accessToken);

  if (data.user_id !== undefined) {
    setAuthItem('user_id', String(data.user_id));
  }
}
