import * as Linking from 'expo-linking';

import { setAuthItem } from '@/lib/auth-storage';

type AuthCallbackResult = {
  isCallback: boolean;
  token: string | null;
  userId: string | null;
};

function appendParams(target: URLSearchParams, source: string) {
  const normalized = source.replace(/^[?#]/, '');

  if (!normalized || !normalized.includes('=')) {
    return;
  }

  const params = new URLSearchParams(normalized);

  params.forEach((value, key) => {
    if (!target.has(key)) {
      target.set(key, value);
    }
  });
}

function getUrlParams(url: string) {
  const params = new URLSearchParams();
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const hash = url.split('#')[1] ?? '';
  const hashQuery = hash.includes('?') ? hash.split('?')[1] : hash;

  appendParams(params, query);
  appendParams(params, hash);
  appendParams(params, hashQuery);

  return params;
}

function getParsedParam(parsed: Linking.ParsedURL, key: string) {
  const value = parsed.queryParams?.[key];

  return Array.isArray(value) ? value[0] : value;
}

export function parseAuthCallbackUrl(url: string): AuthCallbackResult {
  const parsed = Linking.parse(url);
  const params = getUrlParams(url);
  const token =
    params.get('token') ??
    params.get('access_token') ??
    getParsedParam(parsed, 'token') ??
    getParsedParam(parsed, 'access_token') ??
    null;
  const userId =
    params.get('user_id') ??
    params.get('user') ??
    getParsedParam(parsed, 'user_id') ??
    getParsedParam(parsed, 'user') ??
    null;

  return {
    isCallback: url.includes('auth/callback') || parsed.path === 'auth/callback',
    token,
    userId,
  };
}

export function saveAuthCallback(url: string) {
  const result = parseAuthCallbackUrl(url);

  if (!result.isCallback || !result.token) {
    return result;
  }

  setAuthItem('access_token', result.token);

  if (result.userId) {
    setAuthItem('user_id', result.userId);
  }

  return result;
}
