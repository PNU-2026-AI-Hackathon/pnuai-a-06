import type { MissionParticipationLocation } from '@/lib/mission-session-api';

export async function getCurrentParticipationLocation(): Promise<MissionParticipationLocation> {
  let Location: typeof import('expo-location');
  try {
    Location = await import('expo-location');
  } catch {
    throw new Error('위치 기능을 사용할 수 없어요. 앱을 최신 개발 빌드로 다시 설치해 주세요.');
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('미션 참여를 위해 위치 권한이 필요해요.');
  }

  let location: import('expo-location').LocationObject;
  try {
    location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    throw new Error('현재 위치를 가져오지 못했어요. 위치 서비스를 켜고 다시 시도해 주세요.');
  }

  const { accuracy, latitude, longitude } = location.coords;
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || typeof accuracy !== 'number'
    || !Number.isFinite(accuracy)
  ) {
    throw new Error('현재 위치의 정확도를 확인하지 못했어요. 다시 시도해 주세요.');
  }

  return {
    accuracy_m: accuracy,
    latitude,
    longitude,
    measured_at: new Date(location.timestamp).toISOString(),
  };
}
