import { API_BASE_URL } from '@/lib/auth-api';
import { getAuthItem, setAuthItem } from '@/lib/auth-storage';

type ScheduleInput = {
  endDate: string;
  peopleCount: string;
  roomName: string;
  startDate: string;
};

type CreateScheduleInput = ScheduleInput;

type UpdateScheduleInput = ScheduleInput & {
  scheduleId: string;
};

type ApiSchedule = {
  companion_count?: string | number;
  companions?: unknown[];
  created_at?: string;
  createdAt?: string;
  endDate?: string;
  end_date?: string;
  id?: string | number;
  member_count?: string | number;
  participant_count?: string | number;
  peopleCount?: string | number;
  people_count?: string | number;
  room_id?: string | number;
  room_name?: string;
  schedule_id?: string | number;
  schedule_name?: string;
  startDate?: string;
  start_date?: string;
  status?: string;
  title?: string;
};

type ApiScheduleList = ApiSchedule[] | {
  data?: ApiSchedule[];
  items?: ApiSchedule[];
  results?: ApiSchedule[];
  schedules?: ApiSchedule[];
};

export type TripSchedule = {
  createdAt?: string;
  endDate?: string;
  peopleCount?: string;
  roomName: string;
  scheduleId: string;
  startDate?: string;
  status?: string;
};

const SCHEDULE_CACHE_KEY = 'trip_schedules_cache';

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

function getAccessToken() {
  const token = getAuthItem('access_token');

  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  return token;
}

async function requestAuthenticatedJson<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Record<string, string | number>) {
  const token = getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    method,
  });

  const fallbackMessage = method === 'GET' ? '여행 일정을 불러오지 못했습니다.' : method === 'DELETE' ? '여행 일정 삭제에 실패했습니다.' : method === 'PATCH' ? '여행 일정 수정에 실패했습니다.' : '여행 일정 생성에 실패했습니다.';

  return readJson<T>(res, fallbackMessage);
}

function normalizeSchedule(data: ApiSchedule, fallbackRoomName: string): TripSchedule {
  const scheduleId = data.schedule_id ?? data.id ?? data.room_id;

  if (scheduleId === undefined || scheduleId === null || scheduleId === '') {
    throw new Error('일정 응답에 schedule_id가 없습니다.');
  }

  const companionBasedCount = Array.isArray(data.companions) ? data.companions.length + 1 : undefined;
  const peopleCount = data.people_count ?? data.peopleCount ?? data.member_count ?? data.participant_count ?? data.companion_count ?? companionBasedCount;

  return {
    createdAt: data.created_at ?? data.createdAt,
    endDate: data.end_date ?? data.endDate,
    peopleCount: peopleCount === undefined || peopleCount === null ? undefined : String(peopleCount),
    roomName: data.schedule_name ?? data.room_name ?? data.title ?? fallbackRoomName,
    scheduleId: String(scheduleId),
    startDate: data.start_date ?? data.startDate,
    status: data.status,
  };
}

function normalizeScheduleList(data: ApiScheduleList) {
  const schedules = Array.isArray(data) ? data : data.schedules ?? data.items ?? data.results ?? data.data ?? [];

  return sortTripSchedules(schedules.map((item) => normalizeSchedule(item, '이름 없는 여행')));
}

function getScheduleSortValue(schedule: TripSchedule) {
  const createdTime = schedule.createdAt ? new Date(schedule.createdAt).getTime() : Number.NaN;

  if (Number.isFinite(createdTime)) {
    return createdTime;
  }

  const numericId = Number(schedule.scheduleId);
  return Number.isFinite(numericId) ? numericId : 0;
}

function sortTripSchedules(schedules: TripSchedule[]) {
  return [...schedules].sort((a, b) => getScheduleSortValue(b) - getScheduleSortValue(a));
}

export function getCachedTripSchedules() {
  const raw = getAuthItem(SCHEDULE_CACHE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TripSchedule[];
    return Array.isArray(parsed) ? sortTripSchedules(parsed.filter((item) => item.scheduleId && item.roomName)) : [];
  } catch {
    return [];
  }
}

function saveScheduleCache(schedules: TripSchedule[]) {
  setAuthItem(SCHEDULE_CACHE_KEY, JSON.stringify(sortTripSchedules(schedules)));
}

export function cacheTripSchedule(schedule: TripSchedule) {
  const nextSchedules = sortTripSchedules([schedule, ...getCachedTripSchedules().filter((item) => item.scheduleId !== schedule.scheduleId)]);
  saveScheduleCache(nextSchedules);
}

export function removeCachedTripSchedule(scheduleId: string) {
  saveScheduleCache(getCachedTripSchedules().filter((item) => item.scheduleId !== scheduleId));
}

export async function listTripSchedules() {
  const data = await requestAuthenticatedJson<ApiScheduleList>('/schedules', 'GET');
  const schedules = normalizeScheduleList(data);
  saveScheduleCache(schedules);

  return schedules;
}

export async function createDraftSchedule(input: CreateScheduleInput) {
  const data = await requestAuthenticatedJson<ApiSchedule>('/schedules', 'POST', {
    end_date: input.endDate,
    start_date: input.startDate,
    title: input.roomName,
  });
  const normalizedSchedule = normalizeSchedule(data, input.roomName);
  const schedule: TripSchedule = {
    ...normalizedSchedule,
    endDate: normalizedSchedule.endDate ?? input.endDate,
    peopleCount: normalizedSchedule.peopleCount ?? input.peopleCount,
    startDate: normalizedSchedule.startDate ?? input.startDate,
  };

  cacheTripSchedule(schedule);

  return schedule;
}

export async function updateDraftSchedule(input: UpdateScheduleInput) {
  const data = await requestAuthenticatedJson<ApiSchedule>(`/schedules/${encodeURIComponent(input.scheduleId)}`, 'PATCH', {
    end_date: input.endDate,
    start_date: input.startDate,
    title: input.roomName,
  });
  const normalizedSchedule = normalizeSchedule(data, input.roomName);
  const schedule: TripSchedule = {
    ...normalizedSchedule,
    endDate: normalizedSchedule.endDate ?? input.endDate,
    peopleCount: normalizedSchedule.peopleCount ?? input.peopleCount,
    startDate: normalizedSchedule.startDate ?? input.startDate,
  };

  cacheTripSchedule(schedule);

  return schedule;
}
export async function deleteTripSchedule(scheduleId: string) {
  await requestAuthenticatedJson<Record<string, never>>(`/schedules/${encodeURIComponent(scheduleId)}`, 'DELETE');
  removeCachedTripSchedule(scheduleId);
}
