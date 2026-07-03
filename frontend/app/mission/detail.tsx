import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMissions, type MissionItem } from '@/lib/mission-api';

type MissionTheme = 'MOUNTAIN' | 'SEA' | 'CITY';

const themeItems: { icon: number; label: string; value: MissionTheme }[] = [
  { icon: require('../../assets/svg/mission_theme/mountain.svg'), label: '산', value: 'MOUNTAIN' },
  { icon: require('../../assets/svg/mission_theme/sea.svg'), label: '바다', value: 'SEA' },
  { icon: require('../../assets/svg/mission_theme/city.svg'), label: '도시', value: 'CITY' },
];
const districtCodeByLabel: Record<string, string> = {
  강서구: 'GANGSEO',
  사하구: 'SAHA',
  사상구: 'SASANG',
  북구: 'BUK',
  금정구: 'GEUMJEONG',
  동래구: 'DONGNAE',
  연제구: 'YEONJE',
  부산진구: 'BUSANJIN',
  서구: 'SEO',
  동구: 'DONG',
  중구: 'JUNG',
  수영구: 'SUYEONG',
  남구: 'NAM',
  영도구: 'YEONGDO',
  해운대구: 'HAEUNDAE',
  기장군: 'GIJANG',
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

function getValidTheme(value: string | string[] | undefined): MissionTheme {
  const theme = normalizeValue(getParamValue(value));

  return theme === 'SEA' || theme === 'CITY' ? theme : 'MOUNTAIN';
}

function getSortedMissions(
  missions: MissionItem[],
  options: { district: string; districtCode: string; missionCode: string; theme: MissionTheme }
) {
  const focusedDistrictCode = normalizeValue(options.districtCode);
  const focusedMissionCode = normalizeValue(options.missionCode);

  return missions
    .map((mission, index) => {
      const missionCode = normalizeValue(mission.code ?? mission.id);
      const missionTheme = normalizeValue(mission.theme);
      const missionDistrictCode = normalizeValue(mission.districtCode);
      const isSameTheme = missionTheme === options.theme;
      const isSameDistrict =
        Boolean(focusedDistrictCode && missionDistrictCode === focusedDistrictCode) || mission.districtLabel === options.district;
      const isSameMission = Boolean(focusedMissionCode && missionCode === focusedMissionCode);
      let priority = 4;

      if (isSameTheme && isSameDistrict) {
        priority = isSameMission ? 0 : 1;
      } else if (isSameTheme) {
        priority = 2;
      } else if (isSameDistrict) {
        priority = 3;
      }

      return { index, mission, priority };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ mission }) => mission);
}

export default function MissionDetailScreen() {
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const params = useLocalSearchParams<{ district?: string; districtCode?: string; missionCode?: string; theme?: string }>();
  const focusedDistrict = getParamValue(params.district) ?? '금정구';
  const focusedDistrictCode = getParamValue(params.districtCode) || districtCodeByLabel[focusedDistrict] || '';
  const focusedMissionCode = getParamValue(params.missionCode) ?? '';
  const [selectedTheme, setSelectedTheme] = useState<MissionTheme>(getValidTheme(params.theme));
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const sortedMissions = useMemo(
    () =>
      getSortedMissions(missions, {
        district: focusedDistrict,
        districtCode: focusedDistrictCode,
        missionCode: focusedMissionCode,
        theme: selectedTheme,
      }),
    [focusedDistrict, focusedDistrictCode, focusedMissionCode, missions, selectedTheme]
  );

  useEffect(() => {
    let isActive = true;

    async function loadMissions() {
      try {
        setIsLoading(true);
        setErrorMessage('');
        // 전체 미션을 가져와서 화면에서 우선순위만 바꿈
        const missionList = await fetchMissions({});

        if (isActive) {
          setMissions(missionList);
        }
      } catch (error) {
        if (isActive) {
          setMissions([]);
          setErrorMessage(error instanceof Error ? error.message : '미션 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadMissions();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: bottomActionInset + 28,
            paddingHorizontal: horizontalPadding,
            paddingTop: topInset,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
          <ScalePressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} pressedScale={0.86} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </ScalePressable>

          <Text style={styles.title}>미션 상세 리스트</Text>

          <View style={styles.themeRow}>
            {themeItems.map((item) => {
              const isSelected = item.value === selectedTheme;

              return (
                <ScalePressable
                  accessibilityRole="button"
                  key={item.label}
                  onPress={() => setSelectedTheme(item.value)}
                  pressedScale={0.94}
                  style={[styles.themeCard, isSelected && styles.selectedThemeCard]}>
                  <Image source={item.icon} style={styles.themeIcon} contentFit="contain" />
                  <Text style={[styles.themeLabel, isSelected && styles.selectedThemeLabel]}>{item.label}</Text>
                </ScalePressable>
              );
            })}
          </View>

          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color="#2B2F33" />
              <Text style={styles.stateText}>미션 정보를 불러오는 중입니다.</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{errorMessage}</Text>
            </View>
          ) : sortedMissions.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>표시할 미션이 없습니다.</Text>
            </View>
          ) : (
            <View style={styles.missionList}>
              {sortedMissions.map((mission) => (
                <View key={mission.id} style={styles.missionCard}>
                  {/* <View style={styles.missionMetaRow}>
                    <Text style={styles.missionThemeText}>{mission.theme ?? 'THEME'}</Text>
                    <Text style={styles.missionDistrictText}>{mission.districtLabel ?? '부산'}</Text>
                  </View> */}
                  <Text style={styles.missionTitle}>{mission.title}</Text>
                  <Text style={styles.locationText}>{mission.location}</Text>
                  <Text style={styles.descriptionText}>{mission.description}</Text>
                  {mission.photoUrl ? (
                    <Image source={{ uri: mission.photoUrl }} style={styles.missionPhoto} contentFit="cover" />
                  ) : (
                    <View style={styles.photoPlaceholder} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#eaf5f9',
    flex: 1,
  },
  content: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
  backButton: {
    alignItems: 'flex-start',
    height: 50,
    justifyContent: 'center',
    marginBottom: 22,
    width: 54,
  },
  backIcon: {
    color: '#111111',
    fontSize: 46,
    lineHeight: 48,
  },
  title: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  themeCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 11,
    height: 98,
    justifyContent: 'center',
    width: 82,
  },
  selectedThemeCard: {
    borderColor: '#2B2F33',
    borderWidth: 1,
  },
  themeIcon: {
    height: 40,
    marginBottom: 8,
    width: 40,
  },
  themeLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
  },
  selectedThemeLabel: {
    fontWeight: '700',
  },
  stateBox: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  stateText: {
    color: '#676D70',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  missionList: {
    gap: 12,
  },
  missionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  missionTitle: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 7,
  },
  locationText: {
    color: '#AEAEAE',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 10,
  },
  descriptionText: {
    color: '#AEAEAE',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 24,
  },
  missionPhoto: {
    aspectRatio: 1.55,
    backgroundColor: '#eef3f5',
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },
  photoPlaceholder: {
    aspectRatio: 1.55,
    backgroundColor: '#eef3f5',
    borderRadius: 10,
    width: '100%',
  },
});