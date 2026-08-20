import {
  clearPersistedAuthItem,
  deletePersistentAuthItem,
  getAuthItem,
  setAuthItem,
  setPersistentAuthItem,
} from '@/lib/auth-storage';
import { getLanguageHeaders } from '@/lib/language';

import { API_BASE_URL } from '@/lib/api-config';

export { API_BASE_URL } from '@/lib/api-config';


type ProfileImageUploadInput = {
  name: string;
  type: string;
  uri: string;
};
export type AuthTokens = {
  access_token?: string;
  refresh_token?: string;
  token?: string;
  user_id?: number | string;
};

export type AuthUser = {
  id: number;
  provider: string;
  provider_user_id: string;
  email: string | null;
  nickname: string | null;
  profile_image_url: string | null;
  profile_emoji: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

let refreshPromise: Promise<AuthTokens> | null = null;

export function getProfileImageUrl(profileImageUrl: string | null | undefined) {
  if (!profileImageUrl) {
    return null;
  }

  if (profileImageUrl.startsWith('http://') || profileImageUrl.startsWith('https://')) {
    return profileImageUrl;
  }

  return `${API_BASE_URL}${profileImageUrl}`;
}

async function readAuthResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // A proxy or upstream server can return an HTML error page instead of
      // the JSON response expected from the API. Do not expose JSON.parse's
      // low-level error to the user in that case.
      const statusMessage = ` (HTTP ${res.status})`;
      throw new Error(
        res.ok
          ? `서버 응답을 처리할 수 없습니다${statusMessage}. 잠시 후 다시 시도해주세요.`
          : `서버 오류가 발생했습니다${statusMessage}. 잠시 후 다시 시도해주세요.`,
      );
    }
  }

  if (!res.ok) {
    const responseData = data as { detail?: unknown; message?: unknown } | null;
    const message = responseData?.detail ?? responseData?.message ?? '인증 요청에 실패했습니다.';
    throw new Error(
      Array.isArray(message)
        ? message.map((item) => `${item.loc?.join('.') ?? 'field'}: ${item.msg}`).join('\n')
        : typeof message === 'string'
          ? message
          : '인증 요청에 실패했습니다.',
    );
  }

  return data as T;
}

async function postJson<T>(path: string, body: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...getLanguageHeaders(),
      },
      method: 'POST',
      signal: controller.signal,
    });

    return readAuthResponse<T>(res);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function patchJson<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...getLanguageHeaders(),
    },
    method: 'PATCH',
  });

  return readAuthResponse<T>(res);
}

async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    body: formData,
    headers: {
      ...getLanguageHeaders(),
    },
    method: 'POST',
  });

  return readAuthResponse<T>(res);
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

async function refreshCurrentSession() {
  const refreshToken = getAuthItem('refresh_token');

  if (!refreshToken) {
    throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
  }

  if (!refreshPromise) {
    refreshPromise = refreshAuthToken(refreshToken)
      .then((tokens) => saveAuthTokens(tokens, getAuthItem('auto_login') === 'true').then(() => tokens))
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const request = async () => {
    const token = getAuthItem('access_token');

    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(input, { ...init, headers });
  };

  const response = await request();

  if (response.status !== 401 || !getAuthItem('refresh_token')) {
    return response;
  }

  try {
    await refreshCurrentSession();
  } catch {
    await Promise.all([
      deletePersistentAuthItem('access_token'),
      deletePersistentAuthItem('refresh_token'),
      deletePersistentAuthItem('auto_login'),
      deletePersistentAuthItem('user_id'),
    ]);
    return response;
  }

  return request();
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

export function registerWithEmail(email: string, password: string, name: string) {
  // 이메일 회원가입 요청
  return postJson('/auth/email/register', { email, name, password });
}

export function verifyEmail(email: string, code: string) {
  // 이메일 인증 코드 확인
  return postJson('/auth/email/verify', { code, email });
}

export function loginWithEmail(email: string, password: string) {
  // 이메일 로그인 요청
  return postJson<AuthTokens>('/auth/email/login', { email, password });
}

export function loginWithKakaoAccessToken(kakaoAccessToken: string) {
  // 카카오 SDK 토큰을 서비스 access/refresh token으로 교환
  return postJson<AuthTokens>('/auth/kakao/token', { kakao_access_token: kakaoAccessToken });
}

export function refreshAuthToken(refreshToken: string) {
  // refresh token으로 access token 갱신
  return postJson<AuthTokens>('/auth/token/refresh', { refresh_token: refreshToken });
}

export function updateMe(nickname: string) {
  return patchJson<AuthUser>('/auth/me', { nickname });
}

export function updateProfileEmoji(profileEmoji: string) {
  return patchJson<AuthUser>('/auth/me/profile-emoji', { profile_emoji: profileEmoji });
}

export function uploadProfileImage(image: ProfileImageUploadInput) {
  const formData = new FormData();
  formData.append('image', image as unknown as Blob);

  return postMultipart<AuthUser>('/auth/me/profile-image', formData);
}

export async function fetchMe(): Promise<AuthUser> {
  const token = getAuthItem('access_token');

  if (!token) {
    throw new Error('access_token이 없습니다.');
  }

  const res = await fetchWithAuth(`${API_BASE_URL}/auth/me`, {
    headers: {
      ...getLanguageHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error('내 정보 조회에 실패했습니다.');
  }

  return res.json();
}
