import { getAuthItem, setAuthItem } from '@/lib/auth-storage';

const API_BASE_URL = 'http://211.213.193.67:7020';

type MissionApiItem = Record<string, unknown>;

const MISSION_CACHE_KEY = 'mission_list_cache';

export type MissionItem = {
  id: string;
  code: string | null;
  districtCode: string | null;
  districtLabel: string | null;
  title: string;
  location: string;
  description: string;
  emojiUrl: string | null;
  photoUrl: string | null;
  rewardItemIcon: string | null;
  theme: string | null;
  type: string | null;
};

function getString(item: MissionApiItem, keys: string[]) {
  for (const key of keys) {
    const value = item[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return '';
}

function getListPayload(data: unknown): MissionApiItem[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is MissionApiItem => item !== null && typeof item === 'object');
  }

  if (data !== null && typeof data === 'object') {
    const container = data as Record<string, unknown>;
    const list = container.items ?? container.data ?? container.results ?? container.missions;

    if (Array.isArray(list)) {
      return list.filter((item): item is MissionApiItem => item !== null && typeof item === 'object');
    }
  }

  return [];
}

function toMissionItem(item: MissionApiItem, index: number): MissionItem {
  const code = getString(item, ['mission_code', 'code', 'missionCode']);
  const id = getString(item, ['id', 'mission_id', 'missionId']) || code || `mission-${index}`;
  const district = getString(item, ['district_label', 'districtLabel', 'district', 'district_name', 'districtName', 'gu']);
  const districtCode = getString(item, ['district_code', 'districtCode']);
  const place = getString(item, ['place', 'place_name', 'placeName', 'location', 'address']);
  const location = [district ? `부산 · ${district}` : '', place].filter(Boolean).join(' · ');
  const photoUrl = getString(item, ['target_photo_url', 'photo_url', 'photoUrl', 'image_url', 'imageUrl']);
  const emojiUrl = getString(item, ['emoji_url', 'emojiUrl', 'mission_emoji_url', 'missionEmojiUrl']);

  return {
    id,
    code: code || null,
    districtCode: districtCode || null,
    districtLabel: district || null,
    title: getString(item, ['title', 'name', 'mission_name', 'missionName']) || '미션명',
    location: location || '부산',
    description: getString(item, ['description', 'content', 'guide', 'summary']) || '미션 설명이 아직 없습니다.',
    emojiUrl: normalizePhotoUrl(emojiUrl),
    photoUrl: normalizePhotoUrl(photoUrl) || (code ? getMissionPhotoUrl(code) : null),
    rewardItemIcon: getString(item, ['reward_item_icon', 'rewardItemIcon']) || null,
    theme: getString(item, ['theme']) || null,
    type: getString(item, ['type', 'mission_type', 'missionType']) || null,
  };
}

async function readMissionResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message = data?.detail ?? data?.message ?? '미션 정보를 불러오지 못했습니다.';
    throw new Error(Array.isArray(message) ? message.map((item) => item.msg ?? String(item)).join('\n') : message);
  }

  return data;
}

function normalizePhotoUrl(photoUrl: string) {
  if (!photoUrl) {
    return null;
  }

  return photoUrl.startsWith('http') ? photoUrl : `${API_BASE_URL}${photoUrl}`;
}

export function getMissionPhotoUrl(missionCode: string) {
  return `${API_BASE_URL}/missions/${encodeURIComponent(missionCode)}/photo`;
}

export function getCachedMissions() {
  const raw = getAuthItem(MISSION_CACHE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as MissionItem[];
    return Array.isArray(parsed) ? parsed.filter((mission) => mission.id && mission.title) : [];
  } catch {
    return [];
  }
}

function saveMissionCache(missions: MissionItem[]) {
  setAuthItem(MISSION_CACHE_KEY, JSON.stringify(missions));
}

export async function fetchMissions(params: { districtCode?: string; theme?: string }) {
  const query = new URLSearchParams();

  if (params.districtCode) {
    query.set('district_code', params.districtCode);
  }

  if (params.theme) {
    query.set('theme', params.theme);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const data = await readMissionResponse<unknown>(await fetch(`${API_BASE_URL}/missions${suffix}`));

  return getListPayload(data).map(toMissionItem);
}
