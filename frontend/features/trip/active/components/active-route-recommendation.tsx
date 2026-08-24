import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import type { TripScheduleMission } from '@/lib/trip-schedule-api';
import { getMissionDateLabel, getMissionLocation } from '../active-data';
import { styles } from './active-route-recommendation-styles';

export type ActiveRouteMissionGroup = {
  date: string;
  missions: TripScheduleMission[];
};

type ActiveRouteRecommendationProps = {
  canRecommendRoute: boolean;
  missionDateGroups: ActiveRouteMissionGroup[];
  onRecommendRoute: (plannedDate: string) => void;
  recommendingDate: string | null;
};

export function ActiveRouteRecommendation({
  canRecommendRoute,
  missionDateGroups,
  onRecommendRoute,
  recommendingDate,
}: ActiveRouteRecommendationProps) {
  const groupsWithMissions = missionDateGroups.filter((group) => group.date !== 'UNPLANNED' && group.missions.length > 0);

  if (groupsWithMissions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>날짜별 경로</Text>
        <Text style={styles.sectionDescription}>미션 순서를 추천받아 보세요</Text>
      </View>
      {groupsWithMissions.map((group) => {
        const isRecommending = recommendingDate === group.date;
        const isDisabled = Boolean(recommendingDate);
        const canRecommend = canRecommendRoute && group.missions.length >= 2;

        return (
          <View key={group.date} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{getMissionDateLabel(group.date)}</Text>
              {canRecommend ? (
                <ScalePressable
                  accessibilityRole="button"
                  accessibilityLabel={`${getMissionDateLabel(group.date)} 경로 생성`}
                  disabled={isDisabled}
                  onPress={() => onRecommendRoute(group.date)}
                  pressedScale={0.96}
                  style={[styles.routeButton, isRecommending && styles.routeButtonBusy, isDisabled && !isRecommending && styles.disabledButton]}>
                  {isRecommending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="navigate-outline" size={15} />}
                  <Text style={styles.routeButtonText}>{isRecommending ? '추천 중' : '경로 생성'}</Text>
                </ScalePressable>
              ) : null}
            </View>
            <View style={styles.missionList}>
              {group.missions.map((mission, index) => (
                <View key={mission.scheduleMissionId} style={styles.missionRow}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderText}>{mission.visitOrder ?? index + 1}</Text>
                  </View>
                  <View style={styles.missionCopy}>
                    <Text numberOfLines={1} style={styles.missionTitle}>{mission.title}</Text>
                    <Text numberOfLines={1} style={styles.missionLocation}>{getMissionLocation(mission)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
