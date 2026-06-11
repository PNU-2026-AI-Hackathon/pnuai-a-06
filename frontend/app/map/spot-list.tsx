import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function SpotListScreen() {
  return (
    <FlowScreen title="MAP03 구별 스팟/미션 리스트" subtitle="관광청 사진 + 미션 카드">
      <FlowButton label="일반 미션 상세" onPress={() => router.push('/mission/detail')} />
      <FlowButton label="희귀 미션 잠금" onPress={() => router.push('/mission/locked')} />
    </FlowScreen>
  );
}
