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

type ApiMissionComment = {
  content?: string;
  created_at?: string;
  id?: number | string;
  user?: ApiMissionSessionUser;
  user_id?: number | string;
};

type ApiMissionSubmission = {
  captured_at?: string | null;
  comments?: ApiMissionComment[];
  id?: number | string;
  judge_reason?: string | null;
  judge_status?: MissionJudgementStatus | null;
  like_count?: number;
  likes_count?: number;
  photo_url?: string;
  similarity_score?: number | string | null;
  uploaded_at?: string;
  user?: ApiMissionSessionUser;
  user_id?: number | string;
};

type ApiMissionSession = {
  comment_deadline_at?: string | null;
  comment_ends_at?: string | null;
  commenting_ends_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  created_by_user_id?: number | string;
  id?: number | string;
  session_id?: number | string;
  members?: ApiMissionSessionMember[];
  mission?: ApiMission;
  photo_deadline_at?: string | null;
  photo_upload_deadline_at?: string | null;
  revealed_at?: string | null;
  schedule_mission_id?: number | string;
  shooting_deadline_at?: string | null;
  shooting_ends_at?: string | null;
  shooting_expires_at?: string | null;
  started_at?: string | null;
  status?: MissionSessionStatus;
  submissions?: ApiMissionSubmission[];
  winner_user_id?: number | string | null;
};

export type MissionSessionStatus = 'WAITING' | 'READY' | 'SHOOTING' | 'UPLOADING' | 'VOTING' | 'REVEALED' | 'COMPLETED';
export type MissionJudgementStatus = 'PENDING' | 'PROCESSING' | 'PASSED' | 'REJECTED' | 'REVIEW' | 'ERROR';
export type MissionSubmission = {
  comments: {
    content: string;
    createdAt?: string;
    id: string;
    userId: string;
    nickname?: string | null;
  }[];
  id: string;
  imageUrl: string;
  judgeReason?: string | null;
  judgeStatus?: MissionJudgementStatus | null;
  likeCount: number;
  photoUrl: string;
  similarityScore?: number | null;
  uploadedAt?: string;
  userId: string;
  nickname?: string | null;
};

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
  commentEndsAt?: string | null;
  missionTitle: string;
  photoUploadEndsAt?: string | null;
  revealedAt?: string | null;
  scheduleMissionId: string;
  shootingEndsAt?: string | null;
  startedAt?: string | null;
  status: MissionSessionStatus;
  submissions: MissionSubmission[];
  winnerUserId?: string | null;
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

function createRequestTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, ms);

  return { controller, timer };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
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

async function requestJson<T>(path: string, method: 'GET' | 'POST', body?: Record<string, string | number>) {
  const token = getAccessToken();
  const { controller, timer } = createRequestTimeout(15000);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      method,
      signal: controller.signal,
    });

    return readJson<T>(res, '미션 세션 요청에 실패했습니다.');
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('서버 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.');
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function pickFirstDateValue(...values: (string | null | undefined)[]) {
  return values.find((value) => typeof value === 'string' && value.trim()) ?? null;
}

function normalizeSimilarityScore(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function normalizeSubmission(submission: ApiMissionSubmission): MissionSubmission {
  return {
    comments: (submission.comments ?? []).map((comment) => ({
      content: comment.content ?? '',
      createdAt: comment.created_at,
      id: String(comment.id ?? ''),
      nickname: comment.user?.nickname,
      userId: String(comment.user_id ?? comment.user?.id ?? ''),
    })).filter((comment) => comment.content),
    id: String(submission.id ?? ''),
    imageUrl: normalizePhotoUrl(submission.photo_url ?? ''),
    judgeReason: submission.judge_reason ?? null,
    judgeStatus: submission.judge_status ?? null,
    likeCount: Number(submission.like_count ?? submission.likes_count ?? 0),
    nickname: submission.user?.nickname,
    photoUrl: submission.photo_url ?? '',
    similarityScore: normalizeSimilarityScore(submission.similarity_score),
    uploadedAt: submission.uploaded_at,
    userId: String(submission.user_id ?? submission.user?.id ?? ''),
  };
}

export function getPassedMissionSubmissions(session: MissionSession | null | undefined) {
  // TEMP: AI 판정 실패 사진도 댓글/결과 플로우를 테스트할 수 있도록 노출한다.
  // AI 판정 연동 테스트가 끝나면 false로 되돌린다.
  // const allowFailedJudgementsForTesting = true;
  const allowFailedJudgementsForTesting = false;

  return session?.submissions.filter((submission) => submission.judgeStatus === 'PASSED' || (allowFailedJudgementsForTesting && (submission.judgeStatus === 'REJECTED' || submission.judgeStatus === 'ERROR'))) ?? [];
}

export function getReviewMissionSubmissions(session: MissionSession | null | undefined) {
  return session?.submissions.filter((submission) => Boolean(submission.imageUrl) && submission.judgeStatus !== 'REJECTED' && submission.judgeStatus !== 'ERROR') ?? [];
}

function mergeSubmissionSnapshots(current: MissionSubmission, next: MissionSubmission) {
  const comments = new Map<string, MissionSubmission['comments'][number]>();

  current.comments.forEach((comment, index) => {
    comments.set(comment.id || `${comment.userId}:${comment.content}:${index}`, comment);
  });
  next.comments.forEach((comment, index) => {
    comments.set(comment.id || `${comment.userId}:${comment.content}:${index}`, comment);
  });

  return {
    ...current,
    ...next,
    comments: Array.from(comments.values()),
  };
}

export function mergeMissionSessions(current: MissionSession | null | undefined, next: MissionSession) {
  if (!current || current.id !== next.id) {
    return next;
  }

  const submissions = new Map<string, MissionSubmission>();
  current.submissions.forEach((submission) => submissions.set(submission.id, submission));
  next.submissions.forEach((submission) => {
    const previous = submissions.get(submission.id);
    submissions.set(submission.id, previous ? mergeSubmissionSnapshots(previous, submission) : submission);
  });

  return {
    ...current,
    ...next,
    submissions: Array.from(submissions.values()),
  };
}

function normalizeSession(data: ApiMissionSession): MissionSession {
  const sessionId = data.id ?? data.session_id;

  if (sessionId === undefined || sessionId === null) {
    throw new Error('미션 세션 응답에 id가 없습니다.');
  }

  return {
    commentEndsAt: pickFirstDateValue(data.comment_ends_at, data.comment_deadline_at, data.commenting_ends_at),
    completedAt: data.completed_at,
    createdAt: data.created_at,
    createdByUserId: String(data.created_by_user_id ?? ''),
    id: String(sessionId),
    members: (data.members ?? []).map((member) => ({
      joinedAt: member.joined_at,
      nickname: member.user?.nickname,
      readyAt: member.ready_at,
      userId: String(member.user_id ?? member.user?.id ?? ''),
    })),
    missionTitle: data.mission?.title ?? '미션',
    photoUploadEndsAt: pickFirstDateValue(data.photo_upload_deadline_at, data.photo_deadline_at),
    revealedAt: data.revealed_at,
    scheduleMissionId: String(data.schedule_mission_id ?? ''),
    shootingEndsAt: pickFirstDateValue(data.shooting_ends_at, data.shooting_deadline_at, data.shooting_expires_at),
    startedAt: data.started_at,
    status: data.status ?? 'WAITING',
    submissions: (data.submissions ?? []).map(normalizeSubmission).filter((submission) => submission.photoUrl),
    winnerUserId: data.winner_user_id === null || data.winner_user_id === undefined ? null : String(data.winner_user_id),
  };
}

function getWebSocketUrl(sessionId: string) {
  const token = getAccessToken();
  const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws');

  return `${wsBaseUrl}/mission-sessions/${encodeURIComponent(sessionId)}/ws?token=${encodeURIComponent(token)}`;
}

export function connectMissionSessionSocket(
  sessionId: string,
  handlers: {
    onError?: () => void;
    onMessage: (message: { session?: MissionSession; type?: string }) => void;
  }
) {
  const socket = new WebSocket(getWebSocketUrl(sessionId));

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(String(event.data)) as { payload?: { session?: ApiMissionSession }; type?: string };
      handlers.onMessage({
        session: message.payload?.session ? normalizeSession(message.payload.session) : undefined,
        type: message.type,
      });
    } catch {
      // Ignore malformed socket payloads and recover through GET refresh.
    }
  };

  socket.onerror = () => {
    handlers.onError?.();
  };

  return socket;
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

export async function getActiveMissionSession(scheduleId: string) {
  const data = await requestJson<ApiMissionSession | null>(`/schedules/${encodeURIComponent(scheduleId)}/active-mission-session`, 'GET');

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

export async function postMissionSessionComment(sessionId: string, submissionId: string, content: string) {
  await requestJson<ApiMissionComment>(`/mission-sessions/${encodeURIComponent(sessionId)}/submissions/${encodeURIComponent(submissionId)}/comments`, 'POST', {
    content,
  });
}

export async function likeMissionSessionSubmission(sessionId: string, submissionId: string) {
  const data = await requestJson<ApiMissionSubmission>(`/mission-sessions/${encodeURIComponent(sessionId)}/submissions/${encodeURIComponent(submissionId)}/like`, 'POST');
  return normalizeSubmission(data);
}

export async function uploadMissionSessionPhoto(sessionId: string, photoUri: string) {
  const token = getAccessToken();
  const formData = new FormData();

  formData.append('photo', {
    name: `mission-${sessionId}.jpg`,
    type: 'image/jpeg',
    uri: photoUri,
  } as unknown as Blob);

  const { controller, timer } = createRequestTimeout(30000);

  try {
    const res = await fetch(`${API_BASE_URL}/mission-sessions/${encodeURIComponent(sessionId)}/photo`, {
      body: formData,
      headers: { Authorization: `Bearer ${token}` },
      method: 'POST',
      signal: controller.signal,
    });

    const data = await readJson<ApiMissionSubmission>(res, '사진 업로드에 실패했습니다.');
    return normalizeSubmission(data);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('사진 업로드 응답이 지연되고 있어요. 네트워크를 확인하고 다시 시도해 주세요.');
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}
