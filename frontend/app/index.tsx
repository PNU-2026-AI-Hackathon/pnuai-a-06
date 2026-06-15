import { router } from 'expo-router';
import { useEffect } from 'react';

import { FlowScreen } from '@/components/flow-screen';

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('로그인 화면 진입');
      router.replace('/login');
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return <FlowScreen title="A01 스플래시" subtitle="로그인으로 이동 중" />;
}
