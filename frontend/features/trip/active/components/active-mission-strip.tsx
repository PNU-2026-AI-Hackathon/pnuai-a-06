import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';
import { Rect, Svg } from 'react-native-svg';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import type { TripScheduleMission } from '@/lib/trip-schedule-api';
import { formatDateValue } from '../active-data';
import { styles } from './active-mission-strip-styles';

const activeAddIcon = require('@/assets/svg/active/add.svg');

type ActiveMissionStripProps = {
  activeMissions: TripScheduleMission[];
  canAddMission: boolean;
  hasSchedule: boolean;
  horizontalPadding: number;
  isMissionBlockedForPlay: (mission: TripScheduleMission) => boolean;
  onOpenMissionDetail: () => void;
  onOpenRouteRecommendation: () => void;
  onOpenMissionSession: (mission: TripScheduleMission) => void;
};

// active 여행 화면의 미션 추가 타일과 오늘의 미션 목록을 담당합니다.
export function ActiveMissionStrip({
  activeMissions,
  canAddMission,
  hasSchedule,
  horizontalPadding,
  isMissionBlockedForPlay,
  onOpenMissionDetail,
  onOpenRouteRecommendation,
  onOpenMissionSession,
}: ActiveMissionStripProps) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>미션 리스트</Text>
        <ScalePressable accessibilityLabel="날짜별 경로 추천 열기" disabled={!hasSchedule} onPress={onOpenRouteRecommendation} pressedScale={0.9} style={styles.routeLink}>
          <Text style={styles.routeLinkText}>날짜별 경로</Text>
          <Text style={styles.routeLinkArrow}>›</Text>
        </ScalePressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -horizontalPadding }}
        contentContainerStyle={[styles.photoStrip, { paddingHorizontal: horizontalPadding }]}>
        {canAddMission ? (
          <ScalePressable accessibilityRole="button" accessibilityLabel="미션 상세 리스트 열기" disabled={!hasSchedule} onPress={onOpenMissionDetail} pressedScale={0.96} style={styles.inviteTile}>
            <Image source={activeAddIcon} style={styles.addTileIcon} contentFit="contain" />
            <Text style={styles.addTileText}>미션추가</Text>
          </ScalePressable>
        ) : null}
        {activeMissions.map((mission) => {
          const isPlayBlocked = isMissionBlockedForPlay(mission);
          const isTodayMission = mission.plannedDate === formatDateValue(new Date());

          return (
            <ScalePressable disabled={!isTodayMission || isPlayBlocked} key={mission.scheduleMissionId} onPress={() => onOpenMissionSession(mission)} pressedScale={0.96} style={[styles.photoTile, isPlayBlocked && styles.blockedMissionTile]}>
              <Svg height="100%" pointerEvents="none" style={styles.photoTileGradient} viewBox="0 0 82 96" width="100%">
                <Rect fill={isTodayMission ? '#AFD8E5' : '#C3D2D7'} height="96" rx="28" width="82" x="0" y="0" />
              </Svg>
              <View style={styles.photoTileInner}>
                <View style={[styles.missionTileContent, isTodayMission ? styles.todayMissionTileInner : styles.futureMissionTileInner]}>
                  {isTodayMission && mission.emojiUrl ? <Image source={{ uri: mission.emojiUrl }} style={styles.missionTileIcon} contentFit="contain" /> : null}
                </View>
              </View>
            </ScalePressable>
          );
        })}
      </ScrollView>
    </>
  );
}
