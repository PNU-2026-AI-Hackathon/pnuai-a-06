import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const missionCards = [
  { id: 'empty', flag: null, tilt: 0 },
  { id: 'mission-1', flag: require('../../assets/svg/flag/red_flag.svg'), tilt: -7 },
  { id: 'mission-2', flag: require('../../assets/svg/flag/red_flag.svg'), tilt: 8 },
  { id: 'mission-3', flag: require('../../assets/svg/flag/red_flag.svg'), tilt: -7 },
];

export default function ActiveTripScreen() {
  const { bottomSafeInset, height, horizontalPadding, isCompactWidth, topSafeInset } = useResponsiveLayout();
  const headerHeight = Math.min(Math.max(height * 0.25, 244), 286);
  const titleSize = isCompactWidth ? 24 : 27;
  const cardSize = isCompactWidth ? 86 : 96;
  const cardGap = isCompactWidth ? 18 : 24;

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
          <Text style={[styles.title, { fontSize: titleSize }]}>우정여행🐷🐷</Text>
          <Text style={styles.subtitle}>여행 2일차네요{`\n`}오늘은 어떤 재밌는 일이 일어날까요?</Text>
        </View>
      </View>

      <View style={[styles.sheet, { marginTop: -1, paddingBottom: bottomSafeInset + 28 }]}>
        <ScrollView
          contentContainerStyle={[styles.missionRow, { gap: cardGap, paddingHorizontal: horizontalPadding }]}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {missionCards.map((card) => (
            <ScalePressable
              accessibilityLabel={card.flag ? '미션 카드' : '빈 미션 카드'}
              key={card.id}
              onPress={() => card.flag && router.push('/trip/capture')}
              pressedScale={card.flag ? 0.94 : 1}
              style={[
                styles.missionCard,
                {
                  height: cardSize + 10,
                  transform: [{ rotate: `${card.tilt}deg` }],
                  width: cardSize,
                },
              ]}>
              {card.flag ? <Image source={card.flag} style={styles.flagIcon} contentFit="contain" /> : null}
            </ScalePressable>
          ))}
        </ScrollView>
      </View>
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
    paddingTop: 48,
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
    paddingTop: 24,
  },
  flagIcon: {
    height: 30,
    width: 30,
  },
});
