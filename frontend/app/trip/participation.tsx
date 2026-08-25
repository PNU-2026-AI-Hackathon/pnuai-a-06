import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';

import { MissionParticipationView } from '@/features/trip/participation/components/mission-participation-view';
import { getParamValue } from '@/features/trip/trip-data';
import { useMissionParticipation } from '@/features/trip/participation/hooks/use-mission-participation';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';

// 미션 참여 라우트와 참여 화면 상태를 조합합니다.
export default function MissionParticipationScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[]; verificationType?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const routeVerificationType = getParamValue(params.verificationType);
  const currentUserId = getAuthItem('user_id');
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const isFocused = useIsFocused();
  const participation = useMissionParticipation({ currentUserId, isFocused, routeVerificationType, scheduleId, sessionId });

  return (
    <MissionParticipationView
      {...participation}
      bottomSafeInset={bottomSafeInset}
      currentUserId={currentUserId}
      horizontalPadding={horizontalPadding}
      topSafeInset={topSafeInset}
    />
  );
}
