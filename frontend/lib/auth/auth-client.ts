import { getAuthItem } from '@/lib/auth-storage';
import { getLanguageHeaders } from '@/lib/language';

import { API_BASE_URL } from '@/lib/api-config';

import { clearAuthSession, saveAuthTokens } from './auth-session';
import type { AuthTokens } from './auth-types';

export async function readAuthResponse<T>(res: Response): Promise<T> {
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

export async function postJson<T>(path: string, body: Record<string, string>): Promise<T> {
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

export async function patchJson<T>(path: string, body: Record<string, string>): Promise<T> {
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

export async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    body: formData,
    headers: {
      ...getLanguageHeaders(),
    },
    method: 'POST',
  });

  return readAuthResponse<T>(res);
}

let refreshPromise: Promise<AuthTokens> | null = null;

async function refreshCurrentSession() {
  const refreshToken = getAuthItem('refresh_token');

  if (!refreshToken) {
    throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
  }

  if (!refreshPromise) {
    refreshPromise = postJson<AuthTokens>('/auth/token/refresh', { refresh_token: refreshToken })
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
    await clearAuthSession();
    return response;
  }

  return request();
}
