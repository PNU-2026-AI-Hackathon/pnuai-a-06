import { API_BASE_URL } from '@/lib/auth-api';
import { getAuthItem } from '@/lib/auth-storage';

export const DEFAULT_MAGAZINE_TEMPLATE_KEY = 'handwriting-2025-v1';

export type Magazine = {
  id: string;
  scheduleId: string;
  templateKey: string;
  templateVersion: number | null;
  generationNumber: number;
  status: string;
  imageUrls: string[];
  errorMessage: string | null;
  generatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MagazineCandidate = {
  scheduleMissionId: string;
  sessionId: string;
  plannedDate: string | null;
  missionCode: string | null;
  title: string;
  description: string;
  placeLabel: string | null;
  photoUrl: string | null;
  commentCount: number;
};

export type MagazineCandidates = {
  scheduleId: string;
  templateKey: string;
  maxSelectable: number;
  selectionRequired: boolean;
  candidates: MagazineCandidate[];
};

export class MagazineApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'MagazineApiError';
  }
}

type ApiMagazine = {
  id?: string | number;
  schedule_id?: string | number;
  template_key?: string;
  template_version?: number;
  generation_number?: number;
  status?: string;
  image_urls?: string[];
  error_message?: string | null;
  generated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiMagazineCandidate = {
  schedule_mission_id?: string | number;
  session_id?: string | number;
  planned_date?: string | null;
  mission_code?: string | null;
  title?: string;
  description?: string;
  place_label?: string | null;
  photo_url?: string | null;
  comment_count?: number;
};

type ApiMagazineCandidates = {
  schedule_id?: string | number;
  template_key?: string;
  max_selectable?: number;
  selection_required?: boolean;
  candidates?: ApiMagazineCandidate[];
};

function getErrorMessage(data: unknown) {
  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (detail && typeof detail === 'object' && 'message' in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }

  return '매거진을 불러오지 못했어요.';
}

function withCacheVersion(path: string, generationNumber: number) {
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE_URL}${path}`;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(String(generationNumber))}`;
}

function normalizeMagazine(data: ApiMagazine): Magazine {
  const generationNumber = data.generation_number ?? 0;

  return {
    id: String(data.id ?? ''),
    scheduleId: String(data.schedule_id ?? ''),
    templateKey: data.template_key ?? DEFAULT_MAGAZINE_TEMPLATE_KEY,
    templateVersion: data.template_version ?? null,
    generationNumber,
    status: data.status ?? 'READY',
    imageUrls: (data.image_urls ?? []).map((path) => withCacheVersion(path, generationNumber)),
    errorMessage: data.error_message ?? null,
    generatedAt: data.generated_at ?? null,
    createdAt: data.created_at ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

function normalizeMagazineCandidate(data: ApiMagazineCandidate): MagazineCandidate {
  return {
    scheduleMissionId: String(data.schedule_mission_id ?? ''),
    sessionId: String(data.session_id ?? ''),
    plannedDate: data.planned_date ?? null,
    missionCode: data.mission_code ?? null,
    title: data.title ?? '미션',
    description: data.description ?? '',
    placeLabel: data.place_label ?? null,
    photoUrl: data.photo_url ? withCacheVersion(data.photo_url, 0) : null,
    commentCount: data.comment_count ?? 0,
  };
}

function getToken() {
  const token = getAuthItem('access_token');

  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  return token;
}

async function readResponse(response: Response, fallbackMessage: string) {
  const text = await response.text();
  let data: unknown = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new MagazineApiError(getErrorMessage(data) || fallbackMessage, response.status);
  }

  return data;
}

export async function getMagazine(scheduleId: string, templateKey = DEFAULT_MAGAZINE_TEMPLATE_KEY) {
  const token = getToken();

  const query = `?template_key=${encodeURIComponent(templateKey)}`;
  const response = await fetch(`${API_BASE_URL}/schedules/${encodeURIComponent(scheduleId)}/magazine${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  let data: unknown = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new MagazineApiError(getErrorMessage(data), response.status);
  }

  return normalizeMagazine(data as ApiMagazine);
}

export async function getMagazineCandidates(scheduleId: string, templateKey = DEFAULT_MAGAZINE_TEMPLATE_KEY) {
  const query = '?template_key=' + encodeURIComponent(templateKey);
  const response = await fetch(API_BASE_URL + '/schedules/' + encodeURIComponent(scheduleId) + '/magazine/candidates' + query, {
    headers: {
      Authorization: 'Bearer ' + getToken(),
    },
  });
  const data = await readResponse(response, '매거진 후보 미션을 불러오지 못했어요.') as ApiMagazineCandidates;

  return {
    scheduleId: String(data.schedule_id ?? scheduleId),
    templateKey: data.template_key ?? templateKey,
    maxSelectable: data.max_selectable ?? 0,
    selectionRequired: data.selection_required ?? false,
    candidates: (data.candidates ?? []).map(normalizeMagazineCandidate),
  } satisfies MagazineCandidates;
}

export async function createMagazine(
  scheduleId: string,
  input: {
    templateKey?: string;
    force?: boolean;
    scheduleMissionIds?: string[];
  } = {},
) {
  const numericMissionIds = input.scheduleMissionIds?.map((id) => Number(id)).filter((id) => Number.isInteger(id));
  const body = {
    template_key: input.templateKey ?? DEFAULT_MAGAZINE_TEMPLATE_KEY,
    force: input.force ?? false,
    ...(numericMissionIds && numericMissionIds.length > 0 ? { schedule_mission_ids: numericMissionIds } : {}),
  };
  const response = await fetch(API_BASE_URL + '/schedules/' + encodeURIComponent(scheduleId) + '/magazine', {
    body: JSON.stringify(body),
    headers: {
      Authorization: 'Bearer ' + getToken(),
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const data = await readResponse(response, '매거진 생성에 실패했어요.');

  return normalizeMagazine(data as ApiMagazine);
}
