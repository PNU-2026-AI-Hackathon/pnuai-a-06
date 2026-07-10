import { API_BASE_URL } from '@/lib/auth-api';
import { getAuthItem } from '@/lib/auth-storage';

type CreateScheduleInput = {
  endDate: string;
  peopleCount: string;
  roomName: string;
  startDate: string;
};

type ApiSchedule = {
  id?: string | number;
  room_id?: string | number;
  room_name?: string;
  schedule_id?: string | number;
  schedule_name?: string;
};

export type TripSchedule = {
  roomName: string;
  scheduleId: string;
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

async function postAuthenticatedJson<T>(path: string, body: Record<string, string | number>) {
  const token = getAuthItem('access_token');

  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  return readJson<T>(res, '여행 일정 생성에 실패했습니다.');
}

function normalizeSchedule(data: ApiSchedule, fallbackRoomName: string): TripSchedule {
  const scheduleId = data.schedule_id ?? data.id ?? data.room_id;

  if (scheduleId === undefined || scheduleId === null || scheduleId === '') {
    throw new Error('일정 생성 응답에 schedule_id가 없습니다.');
  }

  return {
    roomName: data.schedule_name ?? data.room_name ?? fallbackRoomName,
    scheduleId: String(scheduleId),
  };
}

export async function createDraftSchedule(input: CreateScheduleInput) {
  const data = await postAuthenticatedJson<ApiSchedule>('/schedules', {
    end_date: input.endDate,
    people_count: Number(input.peopleCount),
    room_name: input.roomName,
    start_date: input.startDate,
    status: 'DRAFT',
  });

  return normalizeSchedule(data, input.roomName);
}
