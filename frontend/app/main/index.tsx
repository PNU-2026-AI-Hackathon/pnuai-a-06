import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function MainScreen() {
  return (
    <FlowScreen title="M01 메인 화면" subtitle="메인 진입 완료">
      <FlowButton label="프로필 편집" onPress={() => router.push('/main/profile')} />
      <FlowButton label="매거진 상세" onPress={() => router.push('/magazine/detail')} />
      <FlowButton label="부산 지도" onPress={() => router.push('/map')} />
      <FlowButton label="여행 일정 허브" onPress={() => router.push('/trip/hub')} />
    </FlowScreen>
  );
}
