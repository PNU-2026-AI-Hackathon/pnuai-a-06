import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMissions, type MissionItem } from '@/lib/mission-api';

const themeItems = [
  { icon: require('../../assets/svg/mission_theme/mountain.svg'), label: '산', value: 'MOUNTAIN' },
  { icon: require('../../assets/svg/mission_theme/sea.svg'), label: '바다', value: 'SEA' },
  { icon: require('../../assets/svg/mission_theme/city.svg'), label: '도시', value: 'CITY' },
];
const districtCodeByLabel: Record<string, string> = {
  부산진구: 'BUSANJIN',
  금정구: 'GEUMJEONG',
  기장군: 'GIJANG',
  해운대구: 'HAEUNDAE',
  중구: 'JUNG',
  남구: 'NAM',
  수영구: 'SUYEONG',
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function MissionDetailScreen() {
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const params = useLocalSearchParams<{ district?: string; theme?: string }>();
  const district = getParamValue(params.district) ?? '금정구';
  const districtCode = districtCodeByLabel[district];
  const [selectedTheme, setSelectedTheme] = useState(getParamValue(params.theme) ?? themeItems[0].value);
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadMissions() {
      try {
        setIsLoading(true);
        setErrorMessage('');
        // 선택된 구와 테마로 미션 목록 요청
        const missionList = await fetchMissions({ districtCode, theme: selectedTheme });

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
  }, [districtCode, selectedTheme]);

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

          <Text style={styles.title}>{district} 미션 리스트</Text>

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
          ) : missions.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>표시할 미션이 없습니다.</Text>
            </View>
          ) : (
            <View style={styles.missionList}>
              {missions.map((mission) => (
                <View key={mission.id} style={styles.missionCard}>
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
    color: '#111111',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
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
    height: 36,
    marginBottom: 8,
    width: 36,
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
    paddingVertical: 32,
  },
  missionTitle: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 12,
  },
  locationText: {
    color: '#AEAEAE',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 10,
  },
  descriptionText: {
    color: '#AEAEAE',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    marginBottom: 32,
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