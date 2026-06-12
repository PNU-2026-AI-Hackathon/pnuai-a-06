import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { FlowScreen } from '@/components/flow-screen';
import { parseAuthCallbackUrl, saveAuthCallback } from '@/lib/auth-callback';
import { getAuthItem } from '@/lib/auth-storage';

export default function SplashScreen() {
  useEffect(() => {
    let isMounted = true;

    async function routeBySession() {
      const initialUrl = await Linking.getInitialURL();

      if (!isMounted) {
        return;
      }

      if (initialUrl) {
        const callback = parseAuthCallbackUrl(initialUrl);

        if (callback.isCallback) {
          saveAuthCallback(initialUrl);
          router.replace(callback.token ? '/main' : '/login');
          return;
        }
      }

      router.replace(getAuthItem('access_token') ? '/main' : '/login');
    }

    const timer = setTimeout(routeBySession, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  return <FlowScreen title="A01 스플래시" subtitle="세션 확인" />;
}
