import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/top-bar';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { deleteTripSchedule, getCachedTripSchedules, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';

function formatDateRange(schedule: TripSchedule) {
  if (!schedule.startDate && !schedule.endDate) {
    return '날짜 미정';
  }

  if (schedule.startDate && schedule.endDate) {
    return `${schedule.startDate} - ${schedule.endDate}`;
  }

  return schedule.startDate ?? schedule.endDate ?? '날짜 미정';
}

function getPeopleText(schedule: TripSchedule) {
  return schedule.peopleCount ? `${schedule.peopleCount}명` : '인원 미정';
}

export default function TripHubScreen() {
  const { bottomActionInset, horizontalPadding, topInset } = useResponsiveLayout();
  const [schedules, setSchedules] = useState<TripSchedule[]>(() => getCachedTripSchedules());
  const [isLoading, setIsLoading] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const refreshSchedules = useCallback(() => {
    let isActive = true;

    setSchedules(getCachedTripSchedules());
    setIsLoading(true);
    setMessage('');

    listTripSchedules()
      .then((nextSchedules) => {
        if (!isActive) {
          return;
        }

        setSchedules(nextSchedules);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const cachedSchedules = getCachedTripSchedules();
        setSchedules(cachedSchedules);
        setMessage(cachedSchedules.length === 0 ? (error instanceof Error ? error.message : '여행 일정을 불러오지 못했어요.') : '');
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useFocusEffect(refreshSchedules);

  const openSchedule = (schedule: TripSchedule) => {
    router.push({
      pathname: '/trip/active',
      params: { scheduleId: schedule.scheduleId },
    });
  };

  const deleteSchedule = async (schedule: TripSchedule) => {
    if (deletingScheduleId) {
      return;
    }

    try {
      setDeletingScheduleId(schedule.scheduleId);
      setMessage('');
      await deleteTripSchedule(schedule.scheduleId);
      const nextSchedules = getCachedTripSchedules();
      setSchedules(nextSchedules);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '여행 일정 삭제에 실패했어요.');
    } finally {
      setDeletingScheduleId(null);
    }
  };

  const confirmDeleteSchedule = (schedule: TripSchedule) => {
    Alert.alert('일정 삭제', `${schedule.roomName} 일정을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', onPress: () => deleteSchedule(schedule), style: 'destructive' },
    ]);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <TopBar title="여행" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomActionInset }]} keyboardShouldPersistTaps="handled" removeClippedSubviews={false} showsVerticalScrollIndicator={false} style={styles.scrollArea}>
        <View style={styles.headerBlock}>
          <Text style={styles.heading}>여행 일정</Text>
          <Text style={styles.description}>새 여행을 만들고 진행 중인 일정을 확인해요.</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/trip')} style={styles.createButton}>
          <View>
            <Text style={styles.createButtonTitle}>새 일정 만들기</Text>
            <Text style={styles.createButtonSubtitle}>여행 날짜와 동행자를 설정해요</Text>
          </View>
          <Text style={styles.createButtonIcon}>+</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>진행 중 여행</Text>
          {isLoading ? <ActivityIndicator color="#6EA4BF" /> : null}
        </View>

        {schedules.length > 0 ? (
          <View style={styles.scheduleList}>
            {schedules.map((schedule) => {
              const isDeleting = deletingScheduleId === schedule.scheduleId;

              return (
                <View key={schedule.scheduleId} style={styles.scheduleItem}>
                  <Pressable accessibilityRole="button" onPress={() => openSchedule(schedule)} style={styles.scheduleOpenArea}>
                    <View style={styles.scheduleThumb}>
                      <Text style={styles.scheduleThumbText}>{schedule.roomName.slice(0, 1)}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text numberOfLines={1} style={styles.scheduleTitle}>
                        {schedule.roomName}
                      </Text>
                      <Text numberOfLines={1} style={styles.scheduleMeta}>
                        {formatDateRange(schedule)} · {getPeopleText(schedule)}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${schedule.roomName} 삭제`}
                    disabled={isDeleting}
                    onPress={() => confirmDeleteSchedule(schedule)}
                    style={styles.deleteButton}>
                    {isDeleting ? <ActivityIndicator color="#D06958" /> : <Text style={styles.deleteButtonText}>삭제</Text>}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>아직 만든 일정이 없어요</Text>
            <Text style={styles.emptyDescription}>새 일정 만들기로 여행을 시작해보세요.</Text>
          </View>
        )}

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingTop: 30,
  },
  headerBlock: {
    marginBottom: 26,
  },
  heading: {
    color: '#10161F',
    fontSize: 25,
    fontWeight: '700',
    lineHeight: 33,
  },
  description: {
    color: '#8A9194',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: '#EAF5F9',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 92,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  createButtonTitle: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '700',
  },
  createButtonSubtitle: {
    color: '#6F7B81',
    fontSize: 12,
    marginTop: 7,
  },
  createButtonIcon: {
    color: '#6EA4BF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 36,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 34,
    minHeight: 26,
  },
  sectionTitle: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '700',
  },
  scheduleList: {
    gap: 10,
    marginTop: 14,
  },
  scheduleItem: {
    alignItems: 'center',
    borderBottomColor: '#E5E9EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
    paddingVertical: 12,
  },
  scheduleOpenArea: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  scheduleThumb: {
    alignItems: 'center',
    backgroundColor: '#D6EAF5',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  scheduleThumbText: {
    color: '#4D8DA9',
    fontSize: 18,
    fontWeight: '700',
  },
  scheduleInfo: {
    flex: 1,
    marginLeft: 14,
  },
  scheduleTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '700',
  },
  scheduleMeta: {
    color: '#8A9194',
    fontSize: 12,
    marginTop: 6,
  },
  deleteButton: {
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
    paddingLeft: 12,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#D06958',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#F5F7F8',
    borderRadius: 16,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 34,
  },
  emptyTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDescription: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  messageText: {
    color: '#D06958',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
});
