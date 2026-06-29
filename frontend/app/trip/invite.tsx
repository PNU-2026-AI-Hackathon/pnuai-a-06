import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function TripInviteScreen() {
  return (
    <FlowScreen title="T02 동행자 초대" subtitle="코드, 카카오톡 공유, 참여자 관리">
      <FlowButton label="일정으로 돌아가기" onPress={() => router.back()} />
    </FlowScreen>
  );
}
