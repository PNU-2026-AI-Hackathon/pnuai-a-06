import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { TripEditForm } from '@/features/trip/edit/components/trip-edit-form';
import { getParamValue } from '@/features/trip/edit/trip-edit-data';
import { useTripEdit } from '@/features/trip/edit/hooks/use-trip-edit';
import { styles } from '@/features/trip/edit/trip-edit-styles';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

// 여행 일정 수정 라우트와 화면 조합을 담당합니다.
export default function EditTripScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const { bottomSafeInset, horizontalPadding, topInset } = useResponsiveLayout();
  const handleSaveSuccess = useCallback(() => router.back(), []);
  const edit = useTripEdit({ onSaveSuccess: handleSaveSuccess, scheduleId });

  if (edit.isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#6EA4BF" /></View>;
  }

  return (
    <TripEditForm
      {...edit}
      bottomSafeInset={bottomSafeInset}
      horizontalPadding={horizontalPadding}
      topInset={topInset}
    />
  );
}
