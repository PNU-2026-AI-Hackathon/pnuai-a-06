import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function TripCreateScreen() {
  return (
    <FlowScreen title="T01 여행 전" subtitle="장바구니 + 동행자 초대 + 여행 시작">
      <FlowButton label="동행자 초대" onPress={() => router.push('/trip/invite')} />
      <FlowButton label="여행 시작하기" onPress={() => router.push('/trip/active')} />
    </FlowScreen>
  );
}
