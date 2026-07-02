import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
