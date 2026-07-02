import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function MissionResultScreen() {
  return (
    <FlowScreen title="T05 미션 결과 피드 카드" subtitle="AI 칭호, 뱃지, 리액션">
      <FlowButton label="진행 중 여행으로" onPress={() => router.replace('/trip/active')} />
      <FlowButton label="칭호/뱃지 컬렉션" onPress={() => router.push('/collection/badge')} />
    </FlowScreen>
  );
}
