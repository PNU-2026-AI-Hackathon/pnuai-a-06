import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { BottomNavigationBar } from '@/components/bottom-navigation-bar';
import { TutorialOverlayHost, TutorialProvider } from '@/components/tutorial-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LanguageProvider } from '@/hooks/use-language';
import { saveAuthTokens } from '@/lib/auth-api';
function getKakaoInviteToken(url: string) {
  try {
    const parsedUrl = new URL(url);
    const scheme = parsedUrl.protocol.replace(':', '');
    const isKakaoLink = scheme.startsWith('kakao') && parsedUrl.hostname === 'kakaolink';

    if (!isKakaoLink) {
      return null;
    }

    return parsedUrl.searchParams.get('inviteToken') ?? parsedUrl.searchParams.get('invite_token');
  } catch {
    const match = url.match(/[?&](?:inviteToken|invite_token)=([^&]+)/);

    return match ? decodeURIComponent(match[1]) : null;
  }
}

function openKakaoInvite(url: string | null) {
  if (!url) {
    return;
  }

  const inviteToken = getKakaoInviteToken(url);

  if (!inviteToken) {
    return;
  }

  router.replace({
    pathname: '/trip/invite',
    params: { inviteToken },
  });
}

async function openKakaoAuth(url: string | null) {
  // Web callbacks are handled by the splash route so they cannot race with
  // its session-restore redirect. Native deep-link handling remains intact.
  if (!url || Platform.OS === 'web') {
    return;
  }

  try {
    const parsedUrl = new URL(url);
    const accessToken = parsedUrl.searchParams.get('token');

    if (!accessToken) {
      return;
    }

    const userId = parsedUrl.searchParams.get('user_id');
    await saveAuthTokens({
      access_token: accessToken,
      user_id: userId ?? undefined,
    });
    router.replace('/main');
  } catch {
    // Ignore unrelated deep links and malformed OAuth callback URLs.
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    Linking.getInitialURL().then(openKakaoInvite);
    Linking.getInitialURL().then((url) => void openKakaoAuth(url));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      openKakaoInvite(url);
      void openKakaoAuth(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <TutorialProvider>
        <LanguageProvider>
          <View style={styles.root}>
            <View style={styles.stackArea}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="main" />
                <Stack.Screen name="tutorial" />
                <Stack.Screen name="magazine" />
                <Stack.Screen name="map" />
                <Stack.Screen name="mission" />
                <Stack.Screen name="trip" />
                <Stack.Screen name="collection" />
              </Stack>
            </View>
            <BottomNavigationBar />
          </View>
        </LanguageProvider>
        <TutorialOverlayHost />
      </TutorialProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  stackArea: {
    flex: 1,
  },
});
