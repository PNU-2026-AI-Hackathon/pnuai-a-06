import { API_BASE_URL, fetchWithAuth } from '@/lib/auth-api';
import { getLanguageHeaders } from '@/lib/language';

function getErrorMessage(data: unknown) {
  if (data && typeof data === 'object') {
    const value = data as { detail?: unknown; message?: unknown };
    if (typeof value.detail === 'string') return value.detail;
    if (typeof value.message === 'string') return value.message;
  }
  return '동행자 삭제에 실패했습니다.';
}

export async function removeTripCompanion(scheduleId: string, userId: string) {
  const response = await fetchWithAuth(`${API_BASE_URL}/schedules/${encodeURIComponent(scheduleId)}/members/${encodeURIComponent(userId)}`, {
    headers: { ...getLanguageHeaders() },
    method: 'DELETE',
  });
  const text = await response.text();
  if (!response.ok) {
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    throw new Error(getErrorMessage(data));
  }
}
