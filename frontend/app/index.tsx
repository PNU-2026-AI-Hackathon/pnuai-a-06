import { router } from 'expo-router';
import { useEffect } from 'react';

import { FlowScreen } from '@/components/flow-screen';

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return <FlowScreen title="A01 스플래시" subtitle="세션 확인" />;
}
