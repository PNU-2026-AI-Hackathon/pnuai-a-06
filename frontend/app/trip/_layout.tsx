import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="active" options={{ animation: 'none' }} />
      <Stack.Screen name="participation" options={{ animation: 'none' }} />
    </Stack>
  );
}
