import { FlowScreen } from '@/components/flow-screen';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

export default function AuthCallbackScreen() {
  const { token, user_id: userId } = useLocalSearchParams<{
    token?: string;
    user_id?: string;
  }>();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }

    localStorage.setItem('access_token', token);

    if (userId) {
      localStorage.setItem('user_id', userId);
    }

    router.replace('/main');
  }, [token, userId]);

  return <FlowScreen title="로그인 처리중" subtitle="카카오 로그인 결과를 확인하고 있습니다." />;
}
