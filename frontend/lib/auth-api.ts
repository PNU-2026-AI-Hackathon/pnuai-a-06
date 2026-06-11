const API_BASE_URL = 'http://211.213.193.67:7020';

export async function fetchMe() {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('access_token이 없습니다.');
  }

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('내 정보 조회에 실패했습니다.');
  }

  return res.json();
}
