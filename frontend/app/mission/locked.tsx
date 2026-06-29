import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function LockedMissionScreen() {
  return (
    <FlowScreen title="MAP05 희귀 미션 잠금" subtitle="모자이크, 룰렛표, 해금 안내">
      <FlowButton label="새 일정 만들기" onPress={() => router.push('/trip')} />
    </FlowScreen>
  );
}
