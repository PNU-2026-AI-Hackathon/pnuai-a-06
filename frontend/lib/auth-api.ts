import {
  deletePersistentAuthItem,
  getAuthItem,
  setAuthItem,
  setPersistentAuthItem,
} from '@/lib/auth-storage';
import { getLanguageHeaders } from '@/lib/language';

export const API_BASE_URL = 'http://211.213.193.67:7020';


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
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message = data?.detail ?? data?.message ?? '인증 요청에 실패했습니다.';
    throw new Error(
      Array.isArray(message)
        ? message.map((item) => `${item.loc?.join('.') ?? 'field'}: ${item.msg}`).join('\n')
        : message,
    );
  }

  return data;
}

async function postJson<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...getLanguageHeaders(),
    },
    method: 'POST',
  });

  return readAuthResponse<T>(res);
}

async function patchJson<T>(path: string, body: Record<string, string>): Promise<T> {
  const token = getAuthItem('access_token');

  if (!token) {
    throw new Error('access_token이 없습니다.');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...getLanguageHeaders(),
    },
    method: 'PATCH',
  });

  return readAuthResponse<T>(res);
}

async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const token = getAuthItem('access_token');

  if (!token) {
    throw new Error('access_token이 없습니다.');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
      ...getLanguageHeaders(),
    },
    method: 'POST',
  });

  return readAuthResponse<T>(res);
}

export async function saveAuthTokens(data: AuthTokens, persist = false) {
  const accessToken = data.access_token ?? data.token;

  if (!accessToken) {
    throw new Error('로그인 응답에 access token이 없습니다.');
  }

  setAuthItem('access_token', accessToken);

  if (data.refresh_token) {
    setAuthItem('refresh_token', data.refresh_token);
  }

  if (data.user_id !== undefined) {
    setAuthItem('user_id', String(data.user_id));
  }

  if (persist && data.refresh_token) {
    await Promise.all([
      setPersistentAuthItem('access_token', accessToken),
      setPersistentAuthItem('refresh_token', data.refresh_token),
      setPersistentAuthItem('auto_login', 'true'),
      data.user_id === undefined ? Promise.resolve() : setPersistentAuthItem('user_id', String(data.user_id)),
    ]);
    return;
  }

  await Promise.all([
    deletePersistentAuthItem('access_token'),
    deletePersistentAuthItem('refresh_token'),
    deletePersistentAuthItem('auto_login'),
    deletePersistentAuthItem('user_id'),
  ]);
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

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...getLanguageHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error('내 정보 조회에 실패했습니다.');
  }

  return res.json();
}
