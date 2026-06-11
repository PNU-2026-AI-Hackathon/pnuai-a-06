import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function BadgeCollectionScreen() {
  return (
    <FlowScreen title="C01 칭호/뱃지 컬렉션">
      <FlowButton label="미션 촬영으로 돌아가기" onPress={() => router.back()} />
    </FlowScreen>
  );
}
