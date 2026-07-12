import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getTripSchedule, type TripSchedule, type TripScheduleMission } from '@/lib/trip-schedule-api';

const flagIcon = require('../../assets/svg/flag/red_flag.svg');

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateRange(schedule: TripSchedule | null) {
  if (!schedule) {
    return '';
  }

  if (schedule.startDate && schedule.endDate) {
    return `${schedule.startDate} - ${schedule.endDate}`;
  }

  return schedule.startDate ?? schedule.endDate ?? '';
}

export default function ActiveTripScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const { bottomSafeInset, height, horizontalPadding, isCompactWidth, topSafeInset } = useResponsiveLayout();
  const headerHeight = Math.min(Math.max(height * 0.25, 244), 286);
  const titleSize = isCompactWidth ? 24 : 27;
  const cardSize = isCompactWidth ? 86 : 96;
  const cardGap = isCompactWidth ? 18 : 24;
  const [schedule, setSchedule] = useState<TripSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [missionListVisible, setMissionListVisible] = useState(false);
  const missions = schedule?.missions ?? [];
  const cardSlots = missions.length > 0 ? missions.slice(0, 6) : [];

  const refreshSchedule = useCallback(() => {
    if (!scheduleId) {
      setSchedule(null);
      setMessage('일정 정보가 없습니다.');
      return;
    }

    let isActive = true;

    setIsLoading(true);
    setMessage('');

    getTripSchedule(scheduleId)
      .then((nextSchedule) => {
        if (isActive) {
          setSchedule(nextSchedule);
        }
      })
      .catch((error) => {
        if (isActive) {
          setSchedule(null);
          setMessage(error instanceof Error ? error.message : '일정을 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [scheduleId]);

  useFocusEffect(refreshSchedule);

  const openMissionList = () => {
    if (missions.length > 0) {
      setMissionListVisible(true);
    }
  };

  const openMissionSession = (mission: TripScheduleMission) => {
    setMissionListVisible(false);
    router.push({
      pathname: '/trip/capture',
      params: {
        scheduleId: schedule?.scheduleId,
        scheduleMissionId: mission.scheduleMissionId,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          {
            height: headerHeight,
            paddingHorizontal: horizontalPadding,
            paddingTop: topSafeInset + 37,
          },
        ]}>
        <ScalePressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} pressedScale={0.86} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </ScalePressable>

        <View style={styles.avatarDot} />

        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.title, { fontSize: titleSize }]}>{schedule?.roomName ?? '여행 일정'}</Text>
          <Text style={styles.subtitle}>{formatDateRange(schedule) || '담긴 미션을 확인해 보세요'}{`\n`}{missions.length}개의 미션이 담겨 있어요</Text>
        </View>
      </View>

      <View style={[styles.sheet, { marginTop: -1, paddingBottom: bottomSafeInset + 28 }]}>
        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#409CB7" />
            <Text style={styles.stateText}>담긴 미션을 불러오는 중이에요.</Text>
          </View>
        ) : message ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{message}</Text>
          </View>
        ) : missions.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>아직 담긴 미션이 없어요</Text>
            <Text style={styles.stateText}>미션 상세 리스트에서 원하는 미션을 일정에 담아보세요.</Text>
            <ScalePressable onPress={() => router.push('/mission/detail')} pressedScale={0.96} style={styles.stateButton}>
              <Text style={styles.stateButtonText}>미션 보러가기</Text>
            </ScalePressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>담긴 미션</Text>
              <ScalePressable accessibilityRole="button" onPress={openMissionList} pressedScale={0.94} style={styles.listButton}>
                <Text style={styles.listButtonText}>리스트 보기</Text>
              </ScalePressable>
            </View>
            <ScrollView
              contentContainerStyle={[styles.missionRow, { gap: cardGap, paddingHorizontal: horizontalPadding }]}
              horizontal
              showsHorizontalScrollIndicator={false}>
              {cardSlots.map((mission, index) => (
                <ScalePressable
                  accessibilityLabel={`${mission.title} 미션 카드`}
                  key={mission.scheduleMissionId}
                  onPress={() => openMissionSession(mission)}
                  pressedScale={0.94}
                  style={[
                    styles.missionCard,
                    {
                      height: cardSize + 10,
                      transform: [{ rotate: `${index % 2 === 0 ? -7 : 8}deg` }],
                      width: cardSize,
                    },
                  ]}>
                  <Image source={flagIcon} style={styles.flagIcon} contentFit="contain" />
                  <Text numberOfLines={2} style={styles.cardTitle}>{mission.title}</Text>
                </ScalePressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      <Modal animationType="fade" transparent visible={missionListVisible} onRequestClose={() => setMissionListVisible(false)}>
        <Pressable accessibilityLabel="담긴 미션 닫기" onPress={() => setMissionListVisible(false)} style={styles.modalBackdrop}>
          <Pressable style={styles.missionPanel}>
            <Text style={styles.panelTitle}>담긴 미션</Text>
            <ScrollView contentContainerStyle={styles.panelMissionList} showsVerticalScrollIndicator={false}>
              {missions.map((mission) => (
                <ScalePressable
                  accessibilityRole="button"
                  key={mission.scheduleMissionId}
                  onPress={() => openMissionSession(mission)}
                  pressedScale={0.98}
                  style={styles.panelMissionItem}>
                  {mission.photoUrl ? <Image source={{ uri: mission.photoUrl }} style={styles.panelMissionPhoto} contentFit="cover" /> : <View style={styles.panelMissionPhotoPlaceholder} />}
                  <View style={styles.panelMissionCopy}>
                    <Text numberOfLines={1} style={styles.panelMissionTitle}>{mission.title}</Text>
                    <Text numberOfLines={2} style={styles.panelMissionDescription}>{mission.description}</Text>
                    <Text style={styles.panelMissionStatus}>{mission.status ?? 'ADDED'}</Text>
                  </View>
                </ScalePressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    backgroundColor: '#eaf5f9',
    overflow: 'hidden',
  },
  backButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 48,
  },
  backIcon: {
    color: '#202124',
    fontSize: 44,
    lineHeight: 44,
  },
  avatarDot: {
    backgroundColor: '#CBDAE2',
    borderRadius: 999,
    height: 58,
    position: 'absolute',
    right: 26,
    top: 52,
    width: 58,
  },
  headerCopy: {
    bottom: 20,
    left: 0,
    paddingHorizontal: 22,
    position: 'absolute',
    right: 0,
  },
  title: {
    color: '#2D3C43',
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 44,
    paddingRight: 68,
  },
  subtitle: {
    color: '#8A9194',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 10,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    flex: 1,
    paddingTop: 38,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#2D3C43',
    fontSize: 18,
    fontWeight: '700',
  },
  listButton: {
    alignItems: 'center',
    backgroundColor: '#EAF5F9',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  listButtonText: {
    color: '#409CB7',
    fontSize: 13,
    fontWeight: '700',
  },
  missionRow: {
    alignItems: 'flex-start',
    paddingRight: 28,
  },
  missionCard: {
    alignItems: 'center',
    backgroundColor: '#E3E9EC',
    borderRadius: 24,
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  flagIcon: {
    height: 30,
    width: 30,
  },
  cardTitle: {
    color: '#53626A',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  stateBox: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  stateTitle: {
    color: '#2D3C43',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  stateText: {
    color: '#8A9194',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  stateButton: {
    alignItems: 'center',
    backgroundColor: '#6EA6BF',
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 22,
  },
  stateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 34,
  },
  missionPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    maxHeight: '72%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  panelTitle: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  panelMissionList: {
    gap: 12,
  },
  panelMissionItem: {
    backgroundColor: '#F4F7F8',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  panelMissionPhoto: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionPhotoPlaceholder: {
    backgroundColor: '#E3E9EC',
    borderRadius: 12,
    height: 74,
    width: 74,
  },
  panelMissionCopy: {
    flex: 1,
  },
  panelMissionTitle: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
  },
  panelMissionDescription: {
    color: '#8A9194',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  panelMissionStatus: {
    color: '#409CB7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
});