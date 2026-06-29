import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function ProfileScreen() {
  return (
    <FlowScreen title="M02 프로필 편집" subtitle="닉네임, 이미지, 알림, 로그아웃">
      <FlowButton label="메인으로" onPress={() => router.back()} />
    </FlowScreen>
  );
}
