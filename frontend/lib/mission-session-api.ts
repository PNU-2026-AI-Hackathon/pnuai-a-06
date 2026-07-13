import { API_BASE_URL } from '@/lib/auth-api';
import { getAuthItem } from '@/lib/auth-storage';

type ApiMission = {
  code?: string;
  description?: string;
  id?: number | string;
  target_photo_url?: string | null;
  title?: string;
};

type ApiMissionSessionUser = {
  id?: number | string;
  nickname?: string | null;
  profile_image_url?: string | null;
  profile_emoji?: string | null;
};

type ApiMissionSessionMember = {
  joined_at?: string;
  ready_at?: string | null;
  user?: ApiMissionSessionUser;
  user_id?: number | string;
};

type ApiMissionSubmission = {
  captured_at?: string | null;
  id?: number | string;
  photo_url?: string;
  uploaded_at?: string;
  user?: ApiMissionSessionUser;
  user_id?: number | string;
};

type ApiMissionSession = {
  completed_at?: string | null;
  created_at?: string;
  created_by_user_id?: number | string;
  id?: number | string;
  members?: ApiMissionSessionMember[];
  mission?: ApiMission;
  revealed_at?: string | null;
  schedule_mission_id?: number | string;
  started_at?: string | null;
  status?: MissionSessionStatus;
  submissions?: ApiMissionSubmission[];
};

export type MissionSessionStatus = 'WAITING' | 'READY' | 'SHOOTING' | 'UPLOADING' | 'VOTING' | 'REVEALED' | 'COMPLETED';

export type MissionSession = {
  completedAt?: string | null;
  createdAt?: string;
  createdByUserId: string;
  id: string;
  members: {
    joinedAt?: string;
    readyAt?: string | null;
    userId: string;
    nickname?: string | null;
  }[];
  missionTitle: string;
  revealedAt?: string | null;
  scheduleMissionId: string;
  startedAt?: string | null;
  status: MissionSessionStatus;
  submissions: {
    id: string;
    imageUrl: string;
    photoUrl: string;
    uploadedAt?: string;
    userId: string;
    nickname?: string | null;
  }[];
};

export class MissionSessionApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MissionSessionApiError';
    this.status = status;
  }
}

export function isMissionSessionNotFoundError(error: unknown) {
  return error instanceof MissionSessionApiError && error.status === 404;
}

function parseJsonOrText(text: string) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'string') {
    return data.trim() || fallback;
  }

  if (data !== null && typeof data === 'object') {
    const container = data as Record<string, unknown>;
    const message = container.detail ?? container.message;

    if (Array.isArray(message)) {
      return message.map((item) => (typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : String(item))).join('\n');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}

function getAccessToken() {
  const token = getAuthItem('access_token');

  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  return token;
}

function normalizePhotoUrl(photoUrl: string) {
  return photoUrl.startsWith('http') ? photoUrl : `${API_BASE_URL}${photoUrl}`;
}

async function readJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  const data = parseJsonOrText(text);

  if (!res.ok) {
    throw new MissionSessionApiError(getErrorMessage(data, fallbackMessage), res.status);
  }

  if (typeof data === 'string') {
    throw new MissionSessionApiError(fallbackMessage, res.status);
  }

  return data;
}

async function requestJson<T>(path: string, method: 'GET' | 'POST') {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    method,
  });

  return readJson<T>(res, '미션 세션 요청에 실패했습니다.');
}

function normalizeSession(data: ApiMissionSession): MissionSession {
  if (data.id === undefined || data.id === null) {
    throw new Error('미션 세션 응답에 id가 없습니다.');
  }

  return {
    completedAt: data.completed_at,
    createdAt: data.created_at,
    createdByUserId: String(data.created_by_user_id ?? ''),
    id: String(data.id),
    members: (data.members ?? []).map((member) => ({
      joinedAt: member.joined_at,
      nickname: member.user?.nickname,
      readyAt: member.ready_at,
      userId: String(member.user_id ?? member.user?.id ?? ''),
    })),
    missionTitle: data.mission?.title ?? '미션',
    revealedAt: data.revealed_at,
    scheduleMissionId: String(data.schedule_mission_id ?? ''),
    startedAt: data.started_at,
    status: data.status ?? 'WAITING',
    submissions: (data.submissions ?? []).map((submission) => ({
      id: String(submission.id ?? ''),
      imageUrl: normalizePhotoUrl(submission.photo_url ?? ''),
      nickname: submission.user?.nickname,
      photoUrl: submission.photo_url ?? '',
      uploadedAt: submission.uploaded_at,
      userId: String(submission.user_id ?? submission.user?.id ?? ''),
    })).filter((submission) => submission.photoUrl),
  };
}

export async function createMissionSession(scheduleId: string, scheduleMissionId: string) {
  const data = await requestJson<ApiMissionSession>(`/schedules/${encodeURIComponent(scheduleId)}/missions/${encodeURIComponent(scheduleMissionId)}/sessions`, 'POST');
  return normalizeSession(data);
}

export async function getMissionSession(sessionId: string) {
  const data = await requestJson<ApiMissionSession>(`/mission-sessions/${encodeURIComponent(sessionId)}`, 'GET');
  return normalizeSession(data);
}

export async function getLatestMissionSession(scheduleId: string, scheduleMissionId: string) {
  const data = await requestJson<ApiMissionSession | null>(`/schedules/${encodeURIComponent(scheduleId)}/missions/${encodeURIComponent(scheduleMissionId)}/session`, 'GET');

  if (!data || data.id === undefined || data.id === null) {
    throw new MissionSessionApiError('진행 중인 미션 세션이 없습니다.', 404);
  }

  return normalizeSession(data);
}

export async function joinMissionSession(sessionId: string) {
  const data = await requestJson<ApiMissionSession>(`/mission-sessions/${encodeURIComponent(sessionId)}/join`, 'POST');
  return normalizeSession(data);
}

export async function readyMissionSession(sessionId: string) {
  const data = await requestJson<ApiMissionSession>(`/mission-sessions/${encodeURIComponent(sessionId)}/ready`, 'POST');
  return normalizeSession(data);
}

export async function startMissionSession(sessionId: string) {
  const data = await requestJson<ApiMissionSession>(`/mission-sessions/${encodeURIComponent(sessionId)}/start`, 'POST');
  return normalizeSession(data);
}

export async function revealMissionSession(sessionId: string) {
  const data = await requestJson<ApiMissionSession>(`/mission-sessions/${encodeURIComponent(sessionId)}/reveal`, 'POST');
  return normalizeSession(data);
}

export async function completeMissionSession(sessionId: string) {
  const data = await requestJson<ApiMissionSession>(`/mission-sessions/${encodeURIComponent(sessionId)}/complete`, 'POST');
  return normalizeSession(data);
}

export async function uploadMissionSessionPhoto(sessionId: string, photoUri: string) {
  const token = getAccessToken();
  const formData = new FormData();

  formData.append('photo', {
    name: `mission-${sessionId}.jpg`,
    type: 'image/jpeg',
    uri: photoUri,
  } as unknown as Blob);

  const res = await fetch(`${API_BASE_URL}/mission-sessions/${encodeURIComponent(sessionId)}/photo`, {
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
    method: 'POST',
  });

  return readJson<ApiMissionSubmission>(res, '사진 업로드에 실패했습니다.');
}