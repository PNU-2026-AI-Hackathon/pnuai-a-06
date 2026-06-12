import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseAuthCallbackUrl, saveAuthCallback } from '@/lib/auth-callback';

function logAuthUrl(label: string, url: string | null) {
  console.log(`${label} url:`, url);

  if (!url) {
    return;
  }

  const parsed = Linking.parse(url);
  const callback = parseAuthCallbackUrl(url);

  console.log(`${label} parsed:`, parsed);
  console.log(`${label} token:`, callback.token);
  console.log(`${label} user_id:`, callback.userId);
}

function handleAuthUrl(url: string | null) {
  if (!url) {
    return;
  }

  const callback = saveAuthCallback(url);

  if (!callback.isCallback) {
    return;
  }

  if (!callback.token) {
    router.replace('/login');
    return;
  }

  router.replace('/main');
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const redirectUri = Linking.createURL('auth/callback');

    console.log('redirectUri:', redirectUri);

    Linking.getInitialURL().then((url) => {
      logAuthUrl('initial', url);
      handleAuthUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      logAuthUrl('received', url);
      handleAuthUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="main" />
        <Stack.Screen name="tutorial" />
        <Stack.Screen name="magazine" />
        <Stack.Screen name="map" />
        <Stack.Screen name="mission" />
        <Stack.Screen name="trip" />
        <Stack.Screen name="collection" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
