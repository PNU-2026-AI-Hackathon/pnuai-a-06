import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

// 여행 완료 후 매거진 저장·공유와 메인 이동을 제공하는 화면입니다.
export default function AfterTripScreen() {
  return (
    <FlowScreen title="T06 여행 후" subtitle="매거진 자동 편집, 저장, 공유">
      <FlowButton label="매거진 저장/공유" onPress={() => router.push('/magazine/detail')} />
      <FlowButton label="메인 전시대로 자동 게시" onPress={() => router.replace('/main')} />
    </FlowScreen>
  );
}
