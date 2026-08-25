import { API_BASE_URL } from '@/lib/api-config';
import { getLanguageHeaders } from '@/lib/language';
import { getAuthItem } from '@/lib/auth-storage';

import { fetchWithAuth, patchJson, postMultipart } from './auth-client';
import type { AuthUser, ProfileImageUploadInput } from './auth-types';

export function getProfileImageUrl(profileImageUrl: string | null | undefined) {
  if (!profileImageUrl) {
    return null;
  }

  if (profileImageUrl.startsWith('http://') || profileImageUrl.startsWith('https://')) {
    return profileImageUrl;
  }

  return `${API_BASE_URL}${profileImageUrl}`;
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
