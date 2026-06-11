import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { FlowButton, FlowScreen } from '@/components/flow-screen';
import { fetchMe } from '@/lib/auth-api';

export default function MainScreen() {
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch((err) => {
        console.error(err);
      });
    }, []);

  return (
    <FlowScreen
      title="M01 메인 화면"
      subtitle={me?.nickname ? `${me.nickname}님 로그인됨` : '매거진 전시대 + 지도 카드 + 일정 카드 + 프로필'}>
      <FlowButton label="프로필 편집" onPress={() => router.push('/main/profile')} />
      <FlowButton label="매거진 상세" onPress={() => router.push('/magazine/detail')} />
      <FlowButton label="부산 지도" onPress={() => router.push('/map')} />
      <FlowButton label="여행 일정 허브" onPress={() => router.push('/trip/hub')} />
    </FlowScreen>
  );
}
