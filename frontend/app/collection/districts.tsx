import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function DistrictCollectionScreen() {
  return (
    <FlowScreen title="C02 가본 곳 컬렉션" subtitle="지도 위 뱃지">
      <FlowButton label="지도 돌아가기" onPress={() => router.back()} />
    </FlowScreen>
  );
}
