import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { FlowButton, FlowScreen } from '@/components/flow-screen';
import { fetchMe } from '@/lib/auth-api';

export default function MainScreen() {
  const [me, setMe] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState('로그인 정보 확인 중');

  useEffect(() => {
    fetchMe()
      .then((user) => {
        setMe(user);
        setAuthStatus(`${user.nickname ?? '사용자'}님 로그인됨`);
      })
      .catch((err) => {
        console.log('fetchMe failed:', err);
        setAuthStatus('토큰은 저장됐지만 내 정보 조회에 실패했습니다.');
      });
    }, []);

  return (
    <FlowScreen
      title="M01 메인 화면"
      subtitle={me?.nickname ? `${me.nickname}님 로그인됨` : authStatus}>
      <FlowButton label="프로필 편집" onPress={() => router.push('/main/profile')} />
      <FlowButton label="매거진 상세" onPress={() => router.push('/magazine/detail')} />
      <FlowButton label="부산 지도" onPress={() => router.push('/map')} />
      <FlowButton label="여행 일정 허브" onPress={() => router.push('/trip/hub')} />
    </FlowScreen>
  );
}
