import { Image } from 'expo-image';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';
import type { MissionSession } from '@/lib/mission-session-api';
import type { TripScheduleMission } from '@/lib/trip-schedule-api';
import { getFeedSubmissions, getMissionLocation, isFeedReadySession } from '../active-data';
import { styles } from './active-mission-feed-styles';

const activeAddIcon = require('@/assets/svg/active/add.svg');

type MissionFeedPhoto = {
  id: string;
  imageUrl: string;
  isBlurred: boolean;
};

type MissionFeed = {
  mission: TripScheduleMission;
  photos: MissionFeedPhoto[];
  session: MissionSession | undefined;
};

type ActiveMissionFeedProps = {
  currentUserId: string | null;
  hasSchedule: boolean;
  isLoading: boolean;
  message: string;
  missionSessions: Record<string, MissionSession>;
  missions: TripScheduleMission[];
  onOpenFeedSession: (session: MissionSession | undefined) => void;
  requiredScheduleMemberCount: number;
  revealedSessions: Record<string, MissionSession>;
  tripDayLabel: string;
};

// active 여행 화면에서 미션별 촬영 사진과 피드 상태를 표시합니다.
export function ActiveMissionFeed({
  currentUserId,
  hasSchedule,
  isLoading,
  message,
  missionSessions,
  missions,
  onOpenFeedSession,
  requiredScheduleMemberCount,
  revealedSessions,
  tripDayLabel,
}: ActiveMissionFeedProps) {
  const feedTarget = useTutorialTarget('trip-feed', { offsetY: 27 });
  const completedMissionFeeds: MissionFeed[] = missions
    .map((mission) => {
      const session = missionSessions[mission.scheduleMissionId] ?? revealedSessions[mission.scheduleMissionId];
      const isMissionResultComplete = session?.status === 'COMPLETED';
      const photos = getFeedSubmissions(session).map((submission) => ({
        id: submission.id,
        imageUrl: submission.imageUrl,
        isBlurred: !isMissionResultComplete && submission.userId !== currentUserId,
      }));

      return { mission, photos, session };
    })
    .filter((item) => item.photos.length > 0);
  const hasSavedMissions = missions.length > 0;

  return (
    <View onLayout={feedTarget.onLayout} ref={feedTarget.ref} style={[styles.feedPanel, !hasSavedMissions && styles.emptyFeedPanel]}>
      <Text style={styles.dayLabel}>{tripDayLabel}</Text>
      {isLoading && !hasSchedule ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color="#409CB7" />
          <Text style={styles.stateText}>담긴 미션을 불러오는 중이에요.</Text>
        </View>
      ) : message ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{message}</Text>
        </View>
      ) : missions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>아직 담긴 미션이 없어요</Text>
          <Text style={styles.emptyText}>미션 상세 리스트에서 원하는 미션을 담아보세요.</Text>
        </View>
      ) : completedMissionFeeds.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>아직 찍은 사진이 없어요</Text>
          <Text style={styles.emptyText}>카메라로 미션 사진을 찍으면 여기에 보여요.</Text>
        </View>
      ) : (
        completedMissionFeeds.map(({ mission, photos, session: feedSession }) => {
          const canOpenFeed = Boolean(feedSession && isFeedReadySession(feedSession, requiredScheduleMemberCount));

          return (
            <ScalePressable disabled={!canOpenFeed} key={mission.scheduleMissionId} onPress={() => onOpenFeedSession(feedSession)} pressedScale={0.99} style={styles.feedMissionItem}>
              <View style={styles.feedIcon}>
                <Image source={activeAddIcon} style={styles.feedCameraIcon} contentFit="contain" />
              </View>
              <View style={styles.feedCopy}>
                <Text style={styles.feedTitle}>{mission.title}</Text>
                <Text style={styles.feedLocation}>{getMissionLocation(mission)}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedPhotoRow}>
                  {photos.map((photo) => (
                    <Image blurRadius={photo.isBlurred ? 18 : 0} key={`${mission.scheduleMissionId}-${photo.id}`} source={{ uri: photo.imageUrl }} style={styles.feedPhoto} contentFit="cover" />
                  ))}
                </ScrollView>
              </View>
            </ScalePressable>
          );
        })
      )}
    </View>
  );
}
