import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { refreshAuthToken, saveAuthTokens } from '@/lib/auth-api';
import { deletePersistentAuthItem, getPersistentAuthItem } from '@/lib/auth-storage';

const splashText = require('../assets/svg/logo_text.svg');
const splashMap = require('../assets/svg/splash_map.svg');
const MIN_SPLASH_DURATION = 1000;

function waitForMinimumSplash(startedAt: number) {
  const remaining = MIN_SPLASH_DURATION - (Date.now() - startedAt);

  if (remaining <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    setTimeout(resolve, remaining);
  });
}

export default function SplashScreen() {
  const { bottomSafeInset } = useResponsiveLayout();

  useEffect(() => {
    let isActive = true;
    const startedAt = Date.now();

    const routeAfterSplash = async (path: '/login' | '/main') => {
      await waitForMinimumSplash(startedAt);

      if (isActive) {
        router.replace(path);
      }
    };

    const restoreSession = async () => {
      const shouldAutoLogin = await getPersistentAuthItem('auto_login');
      const refreshToken = await getPersistentAuthItem('refresh_token');

      if (shouldAutoLogin !== 'true' || !refreshToken) {
        await routeAfterSplash('/login');
        return;
      }

      try {
        const tokens = await refreshAuthToken(refreshToken);
        await saveAuthTokens(tokens, true);
        await routeAfterSplash('/main');
      } catch {
        await deletePersistentAuthItem('access_token');
        await deletePersistentAuthItem('refresh_token');
        await deletePersistentAuthItem('auto_login');
        await deletePersistentAuthItem('user_id');
        await routeAfterSplash('/login');
      }
    };

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: bottomSafeInset }]}>
      <View style={styles.brandGroup}>
        <Image source={splashText} style={styles.logoText} contentFit="contain" />
        <Image source={splashMap} style={styles.logoMap} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
  },
  brandGroup: {
    alignItems: 'center',
    gap: 28,
    transform: [{ translateY: -36 }],
  },
  logoText: {
    height: 42,
    width: 119,
  },
  logoMap: {
    height: 170,
    width: 218,
  },
});
