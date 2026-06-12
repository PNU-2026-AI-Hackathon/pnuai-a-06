import { FlowButton, FlowScreen } from '@/components/flow-screen';
import { saveAuthCallback } from '@/lib/auth-callback';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

function getFirstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const [message, setMessage] = useState('카카오 로그인 결과를 확인하고 있습니다.');
  const {
    token,
    access_token: accessToken,
    user,
    user_id: userId,
  } = useLocalSearchParams<{
    token?: string;
    access_token?: string;
    user?: string;
    user_id?: string;
  }>();

  useEffect(() => {
    const browserParams =
      Platform.OS === 'web'
        ? new URLSearchParams(`${window.location.search}&${window.location.hash.replace('#', '')}`)
        : undefined;

    const authToken =
      getFirstParam(token) ??
      getFirstParam(accessToken) ??
      browserParams?.get('token') ??
      browserParams?.get('access_token');
    const authUserId =
      getFirstParam(userId) ??
      getFirstParam(user) ??
      browserParams?.get('user_id') ??
      browserParams?.get('user');

    if (!authToken) {
      setMessage('토큰을 찾지 못했습니다. 로그인 화면으로 돌아갑니다.');
      router.replace('/login');
      return;
    }

    const params = new URLSearchParams();
    params.set('token', authToken);

    if (authUserId) {
      params.set('user_id', authUserId);
    }

    saveAuthCallback(`auth/callback?${params.toString()}`);

    setMessage('로그인 정보를 저장했습니다. 메인 화면으로 이동합니다.');

    if (Platform.OS === 'web') {
      window.location.replace('/main');
      return;
    }

    router.replace('/main');
  }, [accessToken, token, user, userId]);

  return (
    <FlowScreen title="로그인 처리중" subtitle={message}>
      <FlowButton label="메인으로 이동" onPress={() => router.replace('/main')} />
      <FlowButton label="로그인으로 돌아가기" onPress={() => router.replace('/login')} />
    </FlowScreen>
  );
}
