import { router } from 'expo-router';

import { FlowButton, FlowScreen } from '@/components/flow-screen';

export default function LoginScreen() {
  return (
    <FlowScreen title="A02 로그인" subtitle="임시 로그인">
      <FlowButton label="로그인" onPress={() => router.replace('/main')} />
      <FlowButton label="신규 사용자 튜토리얼 보기" onPress={() => router.push('/tutorial')} />
    </FlowScreen>
  );
}
