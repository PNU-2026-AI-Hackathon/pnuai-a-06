import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function TripHubScreen() {
  return (
    <FlowScreen title="T00 여행 일정 허브" subtitle="전, 중, 후 탭">
      <FlowButton label="새 일정 만들기" onPress={() => router.push('/trip')} />
      <FlowButton label="진행 중 여행" onPress={() => router.push('/trip/active')} />
      <FlowButton label="여행 후 매거진" onPress={() => router.push('/trip/after')} />
    </FlowScreen>
  );
}
