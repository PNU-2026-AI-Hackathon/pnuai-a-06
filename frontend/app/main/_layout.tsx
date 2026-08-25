// main 화면들의 공통 라우트 레이아웃입니다.
import { Stack } from 'expo-router';

export default function MainLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
