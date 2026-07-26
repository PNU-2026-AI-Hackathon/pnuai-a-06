import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { BottomNavigationBar } from '@/components/bottom-navigation-bar';
import { MissionCompletionAlert } from '@/components/mission-completion-alert';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    Linking.getInitialURL().then(openKakaoInvite);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      openKakaoInvite(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
        <MissionCompletionAlert />
      </View>
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
