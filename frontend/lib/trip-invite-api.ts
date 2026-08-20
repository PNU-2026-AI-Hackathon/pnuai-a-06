import { API_BASE_URL, fetchWithAuth } from '@/lib/auth-api';
import { getLanguageHeaders } from '@/lib/language';

export type TripInvite = {
  endDate?: string;
  roomId: string;
  roomName: string;
  inviterName: string;
  inviteToken: string;
  inviteUrl?: string;
  expiresAt?: string;
  startDate?: string;
  status?: string;
};

type ApiTripInvite = {
  creator?: {
    nickname?: string | null;
  };
  endDate?: string;
  end_date?: string;
  expiresAt?: string;
  expires_at?: string;
  inviteToken?: string;
  invite_token?: string;
  inviteUrl?: string;
  invite_url?: string;
  inviterName?: string;
  inviter_name?: string;
  roomId?: string | number;
  room_id?: string | number;
  roomName?: string;
  room_name?: string;
  status?: string;
  schedule_id?: string | number;
  schedule_end_date?: string;
  schedule_start_date?: string;
  schedule_name?: string;
  schedule_title?: string;
  startDate?: string;
  start_date?: string;
};

type CreateTripInviteInput = {
  roomName: string;
  scheduleId: string;
};

export type KakaoInviteTemplateArgs = {
  roomId: string;
  roomName: string;
  inviterName: string;
  inviteToken: string;
  inviteUrl: string;
};

type InviteActionInput = {
  inviteToken: string;
};

function getErrorMessage(data: unknown, fallback: string) {
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

async function readJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(getErrorMessage(data, fallbackMessage));
  }

  return data;
}

async function requestJson<T>(path: string, method: 'GET' | 'POST' | 'PATCH', body?: Record<string, string>) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: { ...getLanguageHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    method,
  });

  return readJson<T>(res, '초대 요청에 실패했습니다.');
}

async function requestAuthenticatedJson<T>(path: string, method: 'GET' | 'POST' | 'PATCH', body?: Record<string, string>) {
  const res = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...getLanguageHeaders(),
    },
    method,
  });

  return readJson<T>(res, '초대 요청에 실패했습니다.');
}

function normalizeTripInvite(data: ApiTripInvite, fallbackRoomName: string): TripInvite {
  const inviteToken = data.inviteToken ?? data.invite_token;

  if (!inviteToken) {
    throw new Error('초대 응답에 inviteToken이 없습니다.');
  }

  return {
    endDate: data.endDate ?? data.end_date ?? data.schedule_end_date,
    expiresAt: data.expiresAt ?? data.expires_at,
    inviteToken,
    inviteUrl: data.inviteUrl ?? data.invite_url,
    inviterName: data.inviterName ?? data.inviter_name ?? data.creator?.nickname ?? '친구',
    roomId: String(data.roomId ?? data.room_id ?? data.schedule_id ?? ''),
    roomName: data.roomName ?? data.room_name ?? data.schedule_name ?? data.schedule_title ?? fallbackRoomName,
    startDate: data.startDate ?? data.start_date ?? data.schedule_start_date,
    status: data.status,
  };
}

export async function createTripInvite(input: CreateTripInviteInput) {
  const data = await requestAuthenticatedJson<ApiTripInvite>(
    `/schedules/${encodeURIComponent(input.scheduleId)}/share-invitations`,
    'POST'
  );
  return normalizeTripInvite(data, input.roomName);
}

export function createKakaoInviteTemplateArgs(invite: TripInvite): KakaoInviteTemplateArgs {
  if (!invite.inviteUrl) {
    throw new Error('초대 응답에 inviteUrl이 없습니다.');
  }

  return {
    inviteToken: invite.inviteToken,
    inviteUrl: invite.inviteUrl,
    inviterName: invite.inviterName,
    roomId: String(invite.roomId),
    roomName: invite.roomName,
  };
}

export async function previewTripInvite(inviteToken: string) {
  const data = await requestJson<ApiTripInvite>(`/invitations/${encodeURIComponent(inviteToken)}`, 'GET');

  return normalizeTripInvite({ ...data, inviteToken }, '초대된 여행');
}

export function acceptTripInvite(input: InviteActionInput) {
  return requestAuthenticatedJson<{ ok?: boolean }>(`/invitations/${encodeURIComponent(input.inviteToken)}/accept`, 'POST');
}

export function declineTripInvite(input: InviteActionInput) {
  return requestAuthenticatedJson<{ ok?: boolean }>(`/invitations/${encodeURIComponent(input.inviteToken)}/decline`, 'POST');
}
