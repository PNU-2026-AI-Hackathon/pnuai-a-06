import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function BusanMapScreen() {
  return (
    <FlowScreen title="MAP01 부산 지도" subtitle="가본 구와 뱃지 표시">
      <FlowButton label="구 선택" onPress={() => router.push('/map/district')} />
      <FlowButton label="가본 곳 컬렉션" onPress={() => router.push('/collection/districts')} />
      <FlowButton label="메인으로" onPress={() => router.replace('/main')} />
    </FlowScreen>
  );
}
