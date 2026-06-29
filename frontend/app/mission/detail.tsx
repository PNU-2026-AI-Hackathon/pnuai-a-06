import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function MissionDetailScreen() {
  return (
    <FlowScreen title="MAP04 미션 상세" subtitle="가이드, 보상 미리보기, 장바구니 담기">
      <FlowButton label="장바구니 담고 일정 만들기" onPress={() => router.push('/trip')} />
    </FlowScreen>
  );
}
