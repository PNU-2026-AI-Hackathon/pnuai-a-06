import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { refreshAuthToken, saveAuthTokens, saveWebKakaoAuthToken } from '@/lib/auth-api';
import { deletePersistentAuthItem, getAuthItem, getPersistentAuthItem } from '@/lib/auth-storage';
import { hasSeenWelcomeScreen } from '@/lib/tutorial-storage';

const splashText = require('@/assets/svg/logo_text.svg');
const splashMap = require('@/assets/svg/splash_map.svg');
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

function getWebKakaoCallbackTokens() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('token');

  if (!accessToken) {
    return null;
  }

  return {
    access_token: accessToken,
    user_id: params.get('user_id') ?? undefined,
  };
}

function clearWebKakaoCallbackUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
}

export default function SplashScreen() {
  const { bottomSafeInset } = useResponsiveLayout();

  useEffect(() => {
    let isActive = true;
    const startedAt = Date.now();

    const routeAfterSplash = async (path: '/login' | '/main' | '/welcome') => {
      await waitForMinimumSplash(startedAt);

      if (isActive) {
        router.replace(path);
      }
    };

    const routeAfterAuthentication = async () => {
      const userId = getAuthItem('user_id');
      const shouldShowWelcome = userId ? !(await hasSeenWelcomeScreen(userId)) : false;
      await routeAfterSplash(shouldShowWelcome ? '/welcome' : '/main');
    };

    const restoreSession = async () => {
      const webKakaoTokens = getWebKakaoCallbackTokens();

      if (webKakaoTokens) {
        saveWebKakaoAuthToken(webKakaoTokens);
        clearWebKakaoCallbackUrl();
        await routeAfterAuthentication();
        return;
      }

      const shouldAutoLogin = await getPersistentAuthItem('auto_login');
      const refreshToken = await getPersistentAuthItem('refresh_token');

      if (shouldAutoLogin !== 'true' || !refreshToken) {
        await routeAfterSplash('/login');
        return;
      }

      try {
        const tokens = await refreshAuthToken(refreshToken);
        await saveAuthTokens(tokens, true);
        await routeAfterAuthentication();
      } catch {
        await Promise.all([
          deletePersistentAuthItem('access_token'),
          deletePersistentAuthItem('refresh_token'),
          deletePersistentAuthItem('auto_login'),
          deletePersistentAuthItem('user_id'),
        ]);
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
