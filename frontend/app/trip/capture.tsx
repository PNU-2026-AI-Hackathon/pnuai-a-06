import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function MissionCaptureScreen() {
  return (
    <FlowScreen title="T04 미션 수행/촬영" subtitle="카메라 + GPS + 시간 + 이미지 검증">
      <FlowButton label="인증 성공" onPress={() => router.push('/trip/result')} />
      <FlowButton label="인증 실패" onPress={() => router.push('/collection/badge')} />
    </FlowScreen>
  );
}
