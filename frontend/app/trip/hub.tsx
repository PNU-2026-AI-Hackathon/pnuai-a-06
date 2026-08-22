import { router } from 'expo-router';
import { useCallback } from 'react';

import { TripHubContent } from '@/features/trip/hub/components/trip-hub-content';
import { useTripHub } from '@/features/trip/hub/hooks/use-trip-hub';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { isClosedSchedule } from '@/features/trip/hub/trip-hub-data';
import type { TripSchedule } from '@/lib/trip-schedule-api';

// 여행 일정 목록 라우트와 일정별 이동 경로를 조합합니다.
export default function TripHubScreen() {
  const { bottomActionInset, horizontalPadding, topInset } = useResponsiveLayout();
  const { language } = useLanguage();
  const hub = useTripHub({ language });
  const openSchedule = useCallback((schedule: TripSchedule) => {
    if (isClosedSchedule(schedule)) {
      router.push({ pathname: '/trip/result', params: { scheduleId: schedule.scheduleId, returnTo: 'hub' } });
      return;
    }

    router.push({ pathname: '/trip/active', params: { scheduleId: schedule.scheduleId } });
  }, []);

  return (
    <TripHubContent
      {...hub}
      bottomActionInset={bottomActionInset}
      onCreateTrip={() => router.push('/trip')}
      onGoBack={() => router.back()}
      onOpenSchedule={openSchedule}
      horizontalPadding={horizontalPadding}
      topInset={topInset}
    />
  );
}
