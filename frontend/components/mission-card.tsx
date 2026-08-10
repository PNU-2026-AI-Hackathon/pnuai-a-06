import { Image, type ImageSource } from 'expo-image';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const missionLevelFrames = [
  require('../assets/svg/mission_level/standard_frame.svg'),
  require('../assets/svg/mission_level/rare_frame.svg'),
  require('../assets/svg/mission_level/side_frame.svg'),
];

const missionLevelByType = {
  BASIC: { accentColor: '#437084', frame: missionLevelFrames[0], label: '기본 미션', titleColor: '#163745' },
  RARE: { accentColor: '#83B1C3', frame: missionLevelFrames[1], label: '희귀 미션', titleColor: '#F3F9FC' },
  SIDE: { accentColor: '#245B6B', frame: missionLevelFrames[2], label: '사이드 미션', titleColor: '#182428' },
};

export type MissionCardData = {
  description?: string | null;
  iconText?: string | null;
  iconUrl?: string | null;
  title?: string | null;
  type?: string | null;
};

export function getMissionCardLevel(mission?: MissionCardData | null) {
  const type = mission?.type === 'RARE' || mission?.type === 'SIDE' ? mission.type : 'BASIC';

  return missionLevelByType[type];
}

type MissionCardProps = {
  emptyMessage?: string;
  errorMessage?: string;
  isLoading?: boolean;
  mission?: MissionCardData | null;
};

export function MissionCard({ emptyMessage = '표시할 미션이 없습니다.', errorMessage = '', isLoading = false, mission }: MissionCardProps) {
  const missionLevel = getMissionCardLevel(mission);

  useEffect(() => {
    if (!mission?.iconUrl) {
      return;
    }

    void Image.prefetch(mission.iconUrl, 'memory-disk').catch(() => undefined);
  }, [mission?.iconUrl]);

  return (
    <View style={styles.container}>
      <Image source={missionLevel.frame as ImageSource} style={styles.frameImage} contentFit="contain" />
      <View style={styles.content} pointerEvents="none">
        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={missionLevel.titleColor} />
            <Text style={[styles.stateText, { color: missionLevel.accentColor }]}>미션을 불러오는 중</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text style={[styles.stateText, { color: missionLevel.accentColor }]}>{errorMessage}</Text>
          </View>
        ) : mission ? (
          <>
            <View style={[styles.typeBadge, { borderColor: missionLevel.accentColor }]}>
              <Text style={[styles.typeText, { color: missionLevel.accentColor }]}>{missionLevel.label}</Text>
            </View>
            <Text style={[styles.title, { color: missionLevel.titleColor }]} numberOfLines={2}>
              {mission.title ?? '미션명'}
            </Text>
            <View style={styles.iconBox}>
              {mission.iconUrl ? (
                <Image source={{ uri: mission.iconUrl }} style={styles.iconImage} cachePolicy="memory-disk" contentFit="contain" />
              ) : mission.iconText ? (
                <Text style={styles.rewardIcon}>{mission.iconText}</Text>
              ) : (
                <View style={styles.photoPlaceholder} />
              )}
            </View>
            <Text style={[styles.description, { color: missionLevel.accentColor }]} numberOfLines={2}>
              {mission.description ?? '미션 설명이 아직 없습니다.'}
            </Text>
          </>
        ) : (
          <View style={styles.stateBox}>
            <Text style={[styles.stateText, { color: missionLevel.accentColor }]}>{emptyMessage}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  frameImage: {
    height: '100%',
    width: '100%',
    zIndex: 1,
  },
  content: {
    alignItems: 'center',
    bottom: '15%',
    left: '10%',
    paddingHorizontal: 10,
    position: 'absolute',
    right: '10%',
    top: '15%',
    zIndex: 2,
  },
  typeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 17,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 8,
    minHeight: 22,
    textAlign: 'center',
    width: '75%',
  },
  iconBox: {
    alignItems: 'center',
    aspectRatio: 1,
    justifyContent: 'center',
    width: '68%',
  },
  iconImage: {
    height: '95%',
    width: '95%',
  },
  rewardIcon: {
    fontSize: 64,
    lineHeight: 72,
    textAlign: 'center',
  },
  photoPlaceholder: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderColor: 'rgba(95, 121, 136, 0.26)',
    borderWidth: 1,
    width: '100%',
  },
  description: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 15,
    marginTop: 7,
    textAlign: 'center',
    width: '80%',
  },
  stateBox: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
