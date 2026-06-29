import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const themeItems = [
  { icon: require('../../assets/svg/mission_theme/mountain.svg'), label: '산' },
  { icon: require('../../assets/svg/mission_theme/sea.svg'), label: '바다' },
  { icon: require('../../assets/svg/mission_theme/city.svg'), label: '도시' },
];

const missionItems = [
  { id: 'mission-1', title: '미션명', location: '부산 · 금정구 어디 어디' },
  { id: 'mission-2', title: '미션명', location: '부산 · 영도구 어디 어디' },
  { id: 'mission-3', title: '미션명', location: '부산 · 중구 어디 어디' },
];

export default function MissionDetailScreen() {
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();

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
            {themeItems.map((item) => (
              <ScalePressable accessibilityRole="button" key={item.label} pressedScale={0.94} style={styles.themeCard}>
                <Image source={item.icon} style={styles.themeIcon} contentFit="contain" />
                <Text style={styles.themeLabel}>{item.label}</Text>
              </ScalePressable>
            ))}
          </View>

          <View style={styles.missionList}>
            {missionItems.map((mission) => (
              <View key={mission.id} style={styles.missionCard}>
                <Text style={styles.missionTitle}>{mission.title}</Text>
                <Text style={styles.locationText}>{mission.location}</Text>
                <Text style={styles.descriptionText}>미션에 대해 가이드 및 상세 설명을 하는 부분입니다. 최대 2줄까지 설명할 수 있습니다.</Text>
                <View style={styles.photoPlaceholder} />
              </View>
            ))}
          </View>
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
  photoPlaceholder: {
    aspectRatio: 1.55,
    backgroundColor: '#eef3f5',
    borderRadius: 10,
    width: '100%',
  },
});
