import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const companions = [
  { label: '나', color: '#b9d7ee' },
  { label: '선우', color: '#c9d1d7' },
];

export default function TripCreateScreen() {
  const {
    bottomActionInset,
    horizontalPadding,
    isCompactWidth,
    isTallScreen,
    topInset,
  } = useResponsiveLayout();
  const avatarSize = isCompactWidth ? 54 : 60;
  const contentTopGap = isTallScreen ? 38 : 22;
  const companionsTopGap = isTallScreen ? 26 : 18;
  const formTopGap = isTallScreen ? 42 : 28;
  const peopleTopGap = isTallScreen ? 30 : 22;
  const startButtonPadding = isTallScreen ? 18 : 15;
  const titleSize = isCompactWidth ? 23 : 25;
  const valueSize = isCompactWidth ? 16 : 20;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomActionInset,
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>여행 시작하기</Text>
        <View style={styles.topSpacer} />
      </View>

      <View
        style={[
          styles.content,
          {
            paddingTop: contentTopGap,
            paddingBottom: 14,
          },
        ]}>
        <View>
          <Text style={[styles.heading, { fontSize: titleSize }]}>동행자를{'\n'}추가해 주세요</Text>
          <Text style={styles.description}>카톡으로 여행갈 친구들을 모아보세요!</Text>
        </View>

        <View style={[styles.companions, { marginTop: companionsTopGap }]}>
          <Pressable onPress={() => router.push('/trip/invite')} style={styles.companionItem}>
            <View style={[styles.addAvatar, { height: avatarSize, width: avatarSize }]}>
              <Text style={styles.addIcon}>+</Text>
            </View>
            <Text style={styles.mutedLabel}>추가</Text>
          </Pressable>
          {companions.map((item) => (
            <View key={item.label} style={styles.companionItem}>
              <View style={[styles.avatar, { backgroundColor: item.color, height: avatarSize, width: avatarSize }]} />
              <Text style={item.label === '나' ? styles.activeLabel : styles.mutedLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: formTopGap }}>
          <Text style={styles.sectionLabel}>여행 기간</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>시작일</Text>
              <View style={styles.selectLine}>
                <Text style={[styles.fieldValue, { fontSize: valueSize }]}>2026.6.6</Text>
                <Text style={styles.chevron}>⌄</Text>
              </View>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>종료일</Text>
              <View style={styles.selectLine}>
                <Text style={[styles.fieldValue, { fontSize: valueSize }]}>2026.6.12</Text>
                <Text style={styles.chevron}>⌄</Text>
              </View>
            </View>
          </View>
          <View style={styles.noticeRow}>
            <View style={styles.noticeIcon}>
              <Text style={styles.noticeIconText}>!</Text>
            </View>
            <Text style={styles.noticeText}>여행 기간에 맞춰 미션이 부여돼요.</Text>
          </View>

          <View style={{ marginTop: peopleTopGap }}>
            <Text style={styles.fieldLabel}>인원수</Text>
            <View style={styles.selectLine}>
              <Text style={[styles.fieldValue, { fontSize: valueSize }]}>4명</Text>
              <Text style={styles.chevron}>⌄</Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => router.push('/trip/active')}
        style={[styles.startButton, { paddingVertical: startButtonPadding }]}>
        <Text style={styles.startButtonText}>여행 시작</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
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
  topTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
  },
  topSpacer: {
    width: 48,
  },
  content: {
    flexGrow: 1,
  },
  heading: {
    color: '#000000',
    fontWeight: '600',
    lineHeight: 30,
  },
  description: {
    color: '#AEAEAE',
    fontSize: 12,
    marginTop: 8,
  },
  companions: {
    flexDirection: 'row',
    gap: 14,
  },
  companionItem: {
    alignItems: 'center',
    gap: 8,
  },
  addAvatar: {
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    borderRadius: 999,
    justifyContent: 'center',
  },
  addIcon: {
    color: '#409CB7',
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 40,
  },
  avatar: {
    borderRadius: 999,
  },
  activeLabel: {
    color: '#409CB7',
    fontSize: 12,
  },
  mutedLabel: {
    color: '#b2b2b2',
    fontSize: 12,
  },
  sectionLabel: {
    color: '#8A9194',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 24,
  },
  dateField: {
    flex: 1,
  },
  fieldLabel: {
    color: '#8A9194',
    fontSize: 12,
    marginBottom: 10,
  },
  selectLine: {
    alignItems: 'center',
    borderBottomColor: '#8A9194',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  fieldValue: {
    color: '#000000',
    fontWeight: '500',
  },
  chevron: {
    color: '#1f1f1f',
    fontSize: 22,
  },
  noticeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  noticeIcon: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  noticeIconText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  noticeText: {
    color: '#409CB7',
    fontSize: 12,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    justifyContent: 'center',
    shadowColor: '#409CB7',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});
