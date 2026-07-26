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

type JsonBodyValue = JsonBodyValue[] | number | string | null;

type ApiMission = {
  code?: string;
  description?: string;
  district_code?: string;
  district_label?: string;
  emoji_url?: string | null;
  id?: string | number;
  mission_emoji_url?: string | null;
  place_label?: string | null;
  reward_item_icon?: string | null;
  target_photo_url?: string | null;
  theme?: string;
  title?: string;
  type?: string;
};

type ApiScheduleMission = {
  created_at?: string;
  id?: string | number;
  mission?: ApiMission;
  mission_id?: string | number;
  planned_date?: string | null;
  status?: string;
  updated_at?: string;
};

type ApiScheduleUser = {
  email?: string | null;
  id?: string | number;
  nickname?: string | null;
};

type ApiScheduleMember = {
  invite_email?: string | null;
  status?: string;
  user?: ApiScheduleUser | null;
  user_id?: string | number;
};

type ApiSchedule = {
  can_add_mission?: boolean;
  can_delete_schedule?: boolean;
  can_invite_companion?: boolean;
  can_invite_member?: boolean;
  can_remove_companion?: boolean;
  can_remove_member?: boolean;
  can_remove_mission?: boolean;
  can_update_schedule?: boolean;
  companion_count?: string | number;
  companions?: ApiScheduleMember[];
  created_at?: string;
  createdAt?: string;
  creator?: ApiScheduleUser | null;
  creator_id?: string | number;
  endDate?: string;
  end_date?: string;
  id?: string | number;
  member_count?: string | number;
  missions?: ApiScheduleMission[];
  participant_count?: string | number;
  participants?: ApiScheduleUser[];
  peopleCount?: string | number;
  people_count?: string | number;
  permissions?: ApiSchedulePermissions;
  room_id?: string | number;
  room_name?: string;
  schedule_id?: string | number;
  schedule_name?: string;
  startDate?: string;
  start_date?: string;
  status?: string;
  title?: string;
};

type ApiSchedulePermissions = {
  add_mission?: boolean;
  canAddMission?: boolean;
  canDeleteSchedule?: boolean;
  canInviteCompanion?: boolean;
  canInviteMember?: boolean;
  canRemoveCompanion?: boolean;
  canRemoveMember?: boolean;
  canRemoveMission?: boolean;
  canUpdateSchedule?: boolean;
  delete_schedule?: boolean;
  invite_companion?: boolean;
  invite_member?: boolean;
  remove_companion?: boolean;
  remove_member?: boolean;
  remove_mission?: boolean;
  update_schedule?: boolean;
};

type ApiScheduleList = ApiSchedule[] | {
  data?: ApiSchedule[];
  items?: ApiSchedule[];
  results?: ApiSchedule[];
  schedules?: ApiSchedule[];
};

export type TripScheduleMission = {
  description: string;
  districtLabel?: string | null;
  emojiUrl?: string | null;
  missionCode?: string | null;
  missionId: string;
  photoUrl?: string | null;
  placeLabel?: string | null;
  plannedDate?: string | null;
  rewardItemIcon?: string | null;
  scheduleMissionId: string;
  status?: string;
  theme?: string | null;
  title: string;
  type?: string | null;
};

export type TripScheduleUser = {
  email?: string | null;
  id?: string;
  nickname?: string | null;
};

export type TripSchedulePermissions = {
  canAddMission: boolean;
  canDeleteSchedule: boolean;
  canInviteCompanion: boolean;
  canRemoveCompanion: boolean;
  canRemoveMission: boolean;
  canUpdateSchedule: boolean;
};

export type TripSchedule = {
  createdAt?: string;
  creatorId?: string;
  endDate?: string;
  missions: TripScheduleMission[];
  participants: TripScheduleUser[];
  permissions: TripSchedulePermissions;
  peopleCount?: string;
  roomName: string;
  scheduleId: string;
  startDate?: string;
  status?: string;
};

const SCHEDULE_CACHE_KEY = 'trip_schedules_cache';

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

async function readJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  const data = parseJsonOrText(text);

  if (!res.ok) {
    throw new Error(getErrorMessage(data, fallbackMessage));
  }

  if (typeof data === 'string') {
    throw new Error(fallbackMessage);
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

async function requestAuthenticatedJson<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: Record<string, JsonBodyValue>) {
  const token = getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    method,
  });

  const fallbackMessage = method === 'GET' ? '여행 일정을 불러오지 못했습니다.' : method === 'DELETE' ? '여행 일정 삭제에 실패했습니다.' : method === 'PUT' ? '여행 일정 순서 저장에 실패했습니다.' : method === 'PATCH' ? '여행 일정 수정에 실패했습니다.' : '여행 일정 생성에 실패했습니다.';

  return readJson<T>(res, fallbackMessage);
}

function normalizePhotoUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) {
    return null;
  }

  return photoUrl.startsWith('http') ? photoUrl : `${API_BASE_URL}${photoUrl}`;
}

function normalizeScheduleMission(data: ApiScheduleMission): TripScheduleMission {
  const scheduleMissionId = data.id;
  const missionId = data.mission_id ?? data.mission?.id;

  if (scheduleMissionId === undefined || scheduleMissionId === null || scheduleMissionId === '') {
    throw new Error('스케줄 미션 응답에 id가 없습니다.');
  }

  if (missionId === undefined || missionId === null || missionId === '') {
    throw new Error('스케줄 미션 응답에 mission_id가 없습니다.');
  }

  return {
    description: data.mission?.description ?? '미션 설명이 아직 없습니다.',
    districtLabel: data.mission?.district_label,
    emojiUrl: normalizePhotoUrl(data.mission?.emoji_url ?? data.mission?.mission_emoji_url),
    missionCode: data.mission?.code ?? null,
    missionId: String(missionId),
    photoUrl: normalizePhotoUrl(data.mission?.target_photo_url),
    placeLabel: data.mission?.place_label,
    plannedDate: data.planned_date ?? null,
    rewardItemIcon: data.mission?.reward_item_icon ?? null,
    scheduleMissionId: String(scheduleMissionId),
    status: data.status,
    theme: data.mission?.theme ?? null,
    title: data.mission?.title ?? '미션명',
    type: data.mission?.type ?? null,
  };
}

const DEFAULT_MEMBER_PERMISSIONS: TripSchedulePermissions = {
  canAddMission: true,
  canDeleteSchedule: false,
  canInviteCompanion: true,
  canRemoveCompanion: false,
  canRemoveMission: false,
  canUpdateSchedule: false,
};

const DEFAULT_CREATOR_PERMISSIONS: TripSchedulePermissions = {
  canAddMission: true,
  canDeleteSchedule: true,
  canInviteCompanion: true,
  canRemoveCompanion: true,
  canRemoveMission: true,
  canUpdateSchedule: true,
};

function readPermission(value: boolean | undefined, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeSchedulePermissions(data: ApiSchedule, creatorId: string | undefined): TripSchedulePermissions {
  const currentUserId = getAuthItem('user_id');
  const inferredDefaults = currentUserId && creatorId && currentUserId === creatorId ? DEFAULT_CREATOR_PERMISSIONS : DEFAULT_MEMBER_PERMISSIONS;
  const permissions = data.permissions;

  return {
    canAddMission: readPermission(
      permissions?.canAddMission ?? permissions?.add_mission ?? data.can_add_mission,
      inferredDefaults.canAddMission
    ),
    canDeleteSchedule: readPermission(
      permissions?.canDeleteSchedule ?? permissions?.delete_schedule ?? data.can_delete_schedule,
      inferredDefaults.canDeleteSchedule
    ),
    canInviteCompanion: readPermission(
      permissions?.canInviteCompanion ?? permissions?.canInviteMember ?? permissions?.invite_companion ?? permissions?.invite_member ?? data.can_invite_companion ?? data.can_invite_member,
      inferredDefaults.canInviteCompanion
    ),
    canRemoveCompanion: readPermission(
      permissions?.canRemoveCompanion ?? permissions?.canRemoveMember ?? permissions?.remove_companion ?? permissions?.remove_member ?? data.can_remove_companion ?? data.can_remove_member,
      inferredDefaults.canRemoveCompanion
    ),
    canRemoveMission: readPermission(
      permissions?.canRemoveMission ?? permissions?.remove_mission ?? data.can_remove_mission,
      inferredDefaults.canRemoveMission
    ),
    canUpdateSchedule: readPermission(
      permissions?.canUpdateSchedule ?? permissions?.update_schedule ?? data.can_update_schedule,
      inferredDefaults.canUpdateSchedule
    ),
  };
}

function normalizeScheduleUser(data: ApiScheduleUser | null | undefined): TripScheduleUser | null {
  if (!data) {
    return null;
  }

  const id = data.id === undefined || data.id === null ? undefined : String(data.id);
  const nickname = data.nickname ?? null;
  const email = data.email ?? null;

  if (!id && !nickname && !email) {
    return null;
  }

  return { email, id, nickname };
}

function normalizeScheduleParticipants(data: ApiSchedule) {
  const participants = Array.isArray(data.participants) ? data.participants.map(normalizeScheduleUser).filter((user): user is TripScheduleUser => Boolean(user)) : [];
  const participantIds = new Set(participants.map((user) => user.id).filter(Boolean));
  const creator = normalizeScheduleUser(data.creator);

  if (creator?.id && !participantIds.has(creator.id)) {
    participants.unshift(creator);
    participantIds.add(creator.id);
  } else if (creator && !creator.id && participants.length === 0) {
    participants.unshift(creator);
  }

  if (Array.isArray(data.companions)) {
    data.companions.forEach((companion) => {
      if (companion.status && companion.status !== 'ACCEPTED') {
        return;
      }

      const user = normalizeScheduleUser(companion.user ?? (companion.user_id === undefined ? null : { id: companion.user_id, email: companion.invite_email }));
      if (!user) {
        return;
      }

      if (user.id && participantIds.has(user.id)) {
        return;
      }

      participants.push(user);
      if (user.id) {
        participantIds.add(user.id);
      }
    });
  }

  return participants;
}
function normalizeSchedule(data: ApiSchedule, fallbackRoomName: string): TripSchedule {
  const scheduleId = data.schedule_id ?? data.id ?? data.room_id;

  if (scheduleId === undefined || scheduleId === null || scheduleId === '') {
    throw new Error('일정 응답에 schedule_id가 없습니다.');
  }

  const companionBasedCount = Array.isArray(data.companions) ? data.companions.length + 1 : undefined;
  const peopleCount = data.people_count ?? data.peopleCount ?? data.member_count ?? data.participant_count ?? data.companion_count ?? companionBasedCount;
  const creatorId = data.creator_id === undefined || data.creator_id === null ? undefined : String(data.creator_id);

  return {
    createdAt: data.created_at ?? data.createdAt,
    creatorId,
    endDate: data.end_date ?? data.endDate,
    missions: Array.isArray(data.missions) ? data.missions.map(normalizeScheduleMission) : [],
    participants: normalizeScheduleParticipants(data),
    peopleCount: peopleCount === undefined || peopleCount === null ? undefined : String(peopleCount),
    permissions: normalizeSchedulePermissions(data, creatorId),
    roomName: data.schedule_name ?? data.room_name ?? data.title ?? fallbackRoomName,
    scheduleId: String(scheduleId),
    startDate: data.start_date ?? data.startDate,
    status: data.status,
  };
}

function normalizeScheduleList(data: ApiScheduleList) {
  const schedules = Array.isArray(data) ? data : data.schedules ?? data.items ?? data.results ?? data.data ?? [];

  return schedules.map((item) => normalizeSchedule(item, '이름 없는 여행'));
}

export function getCachedTripSchedules() {
  const raw = getAuthItem(SCHEDULE_CACHE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TripSchedule[];
    return Array.isArray(parsed) ? parsed.filter((item) => item.scheduleId && item.roomName).map((item) => ({ ...item, missions: item.missions ?? [], participants: item.participants ?? [], permissions: item.permissions ?? DEFAULT_MEMBER_PERMISSIONS })) : [];
  } catch {
    return [];
  }
}

function saveScheduleCache(schedules: TripSchedule[]) {
  setAuthItem(SCHEDULE_CACHE_KEY, JSON.stringify(schedules));
}

export function cacheTripSchedule(schedule: TripSchedule) {
  const cachedSchedules = getCachedTripSchedules();
  const existingIndex = cachedSchedules.findIndex((item) => item.scheduleId === schedule.scheduleId);
  const nextSchedules = [...cachedSchedules];

  if (existingIndex >= 0) {
    nextSchedules[existingIndex] = schedule;
  } else {
    nextSchedules.unshift(schedule);
  }

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

export async function updateTripScheduleOrder(scheduleIds: string[]) {
  const data = await requestAuthenticatedJson<ApiScheduleList>('/schedules/order', 'PUT', {
    schedule_ids: scheduleIds.map((scheduleId) => {
      const numericScheduleId = Number(scheduleId);
      return Number.isFinite(numericScheduleId) ? numericScheduleId : scheduleId;
    }),
  });
  const schedules = normalizeScheduleList(data);
  const orderIndexById = new Map(scheduleIds.map((scheduleId, index) => [scheduleId, index]));
  const orderedSchedules = [...schedules].sort((a, b) => {
    const aIndex = orderIndexById.get(a.scheduleId) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndexById.get(b.scheduleId) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
  saveScheduleCache(orderedSchedules);

  return orderedSchedules;
}

export async function getTripSchedule(scheduleId: string) {
  const data = await requestAuthenticatedJson<ApiSchedule>(`/schedules/${encodeURIComponent(scheduleId)}`, 'GET');
  const schedule = normalizeSchedule(data, '이름 없는 여행');
  cacheTripSchedule(schedule);

  return schedule;
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

export async function addMissionToSchedule(scheduleId: string, missionId: string, plannedDate?: string | null) {
  const numericMissionId = Number(missionId);
  const body: Record<string, string | number> = {
    mission_id: Number.isFinite(numericMissionId) ? numericMissionId : missionId,
  };

  if (plannedDate) {
    body.planned_date = plannedDate;
  }

  const data = await requestAuthenticatedJson<ApiScheduleMission>(`/schedules/${encodeURIComponent(scheduleId)}/missions`, 'POST', body);

  const scheduleMission = normalizeScheduleMission(data);

  try {
    await getTripSchedule(scheduleId);
  } catch {
    const cachedSchedule = getCachedTripSchedules().find((schedule) => schedule.scheduleId === scheduleId);

    if (cachedSchedule) {
      cacheTripSchedule({
        ...cachedSchedule,
        missions: [scheduleMission, ...cachedSchedule.missions.filter((mission) => mission.scheduleMissionId !== scheduleMission.scheduleMissionId)],
      });
    }
  }

  return scheduleMission;
}

export async function updateScheduleMissionDate(scheduleId: string, scheduleMissionId: string, plannedDate: string | null) {
  const body: Record<string, string | number> = {};

  if (plannedDate) {
    body.planned_date = plannedDate;
  }

  const data = await requestAuthenticatedJson<ApiScheduleMission>(
    `/schedules/${encodeURIComponent(scheduleId)}/missions/${encodeURIComponent(scheduleMissionId)}`,
    'PATCH',
    body
  );
  const scheduleMission = normalizeScheduleMission(data);

  try {
    await getTripSchedule(scheduleId);
  } catch {
    const cachedSchedule = getCachedTripSchedules().find((schedule) => schedule.scheduleId === scheduleId);

    if (cachedSchedule) {
      cacheTripSchedule({
        ...cachedSchedule,
        missions: cachedSchedule.missions.map((mission) => (
          mission.scheduleMissionId === scheduleMission.scheduleMissionId ? scheduleMission : mission
        )),
      });
    }
  }

  return scheduleMission;
}
export async function removeMissionFromSchedule(scheduleId: string, scheduleMissionId: string) {
  await requestAuthenticatedJson<Record<string, never>>(`/schedules/${encodeURIComponent(scheduleId)}/missions/${encodeURIComponent(scheduleMissionId)}`, 'DELETE');

  try {
    await getTripSchedule(scheduleId);
  } catch {
    const cachedSchedule = getCachedTripSchedules().find((schedule) => schedule.scheduleId === scheduleId);

    if (cachedSchedule) {
      cacheTripSchedule({
        ...cachedSchedule,
        missions: cachedSchedule.missions.filter((mission) => mission.scheduleMissionId !== scheduleMissionId),
      });
    }
  }
}
export async function deleteTripSchedule(scheduleId: string) {
  await requestAuthenticatedJson<Record<string, never>>(`/schedules/${encodeURIComponent(scheduleId)}`, 'DELETE');
  removeCachedTripSchedule(scheduleId);
}
