import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { styles } from '@/features/trip/capture/mission-capture-styles';

const waitingIcon = require('@/assets/svg/active/waiting_icon.svg');
const blueEffect = require('@/assets/svg/effect/blue_ellipse.svg');

type MissionReviewWaitingViewProps = {
  bottomSafeInset?: number;
  topSafeInset?: number;
};

export function MissionReviewWaitingView({ bottomSafeInset = 0, topSafeInset = 0 }: MissionReviewWaitingViewProps) {
  return (
    <View style={[styles.waitingContainer, { paddingBottom: bottomSafeInset + 20, paddingTop: topSafeInset + 86 }]}>
      <StatusBar style="dark" />
      <View style={styles.waitingHeader}>
        <Text style={styles.waitingTitle}>사진 감상 시작!</Text>
      </View>

      <View style={styles.waitingIllustrationArea}>
          <Image blurRadius={6} contentFit="contain" pointerEvents="none" source={blueEffect} style={styles.waitingBlueEffect} />
        <Image accessibilityLabel="쉿" contentFit="contain" source={waitingIcon} style={styles.waitingIllustration} />
      </View>

      <View style={styles.waitingCopy}>
        <Text style={styles.waitingSubtitle}>작성자는 아직 비밀!</Text>
        <Text style={styles.waitingDescription}>익명으로 댓글을 남겨보세요.</Text>
        <Text style={styles.waitingHint}>모두 댓글을 작성하면 3초 뒤 자동으로 넘어가요.</Text>
      </View>
    </View>
  );
}
