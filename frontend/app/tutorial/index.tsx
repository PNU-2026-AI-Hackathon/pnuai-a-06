import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function TutorialScreen() {
  return (
    <FlowScreen title="A03 첫 사용자 튜토리얼" subtitle="지도, 구, 미션, 장바구니, 일정 학습">
      <FlowButton label="튜토리얼 완료하고 메인으로" onPress={() => router.replace('/main')} />
    </FlowScreen>
  );
}
