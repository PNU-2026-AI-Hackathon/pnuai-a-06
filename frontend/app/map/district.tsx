import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function DistrictScreen() {
  return (
    <FlowScreen title="MAP02 구 상세" subtitle="혼잡도, 통계, 명소, 액상">
      <FlowButton label="구별 스팟/미션 리스트" onPress={() => router.push('/map/spot-list')} />
      <FlowButton label="지도 돌아가기" onPress={() => router.back()} />
    </FlowScreen>
  );
}
