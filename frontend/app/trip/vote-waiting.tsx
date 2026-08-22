import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { getParamValue } from '@/features/trip/vote-waiting/mission-vote-waiting-data';
import { useMissionVoteWaiting } from '@/features/trip/vote-waiting/hooks/use-mission-vote-waiting';
import { styles } from '@/features/trip/vote-waiting/mission-vote-waiting-styles';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';


const pinkEffect = require('@/assets/svg/effect/pink_llipse.svg');
const yellowEffect = require('@/assets/svg/effect/yellow_ellipse.svg');
const blueEffect = require('@/assets/svg/effect/blue_ellipse.svg');

// 미션 투표 결과 공개를 기다리는 화면입니다.
export default function VoteWaitingScreen() {
  const params = useLocalSearchParams<{ scheduleId?: string | string[]; sessionId?: string | string[] }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const { topSafeInset } = useResponsiveLayout();
  const { resultCountdown } = useMissionVoteWaiting({ scheduleId, sessionId });

  return <View style={[styles.container, { paddingTop: topSafeInset }]}>
    <Text style={styles.title}>이번 미션의 주인공은?</Text>
    <View pointerEvents="none" style={styles.effects}>
      <Image contentFit="contain" source={pinkEffect} style={styles.pinkEffect} />
      <Image contentFit="contain" source={yellowEffect} style={styles.yellowEffect} />
      <Image contentFit="contain" source={blueEffect} style={styles.blueEffect} />
    </View>
    <View style={styles.copy}>
      {resultCountdown === null ? <>
        <Text style={styles.description}>친구들의 선택이 모였어요.</Text>
        <Text style={styles.description}>가장 많은 선택을 받은 사진을 공개할게요.</Text>
      </> : <Text style={styles.description}>{resultCountdown}초 뒤 결과를 보여드릴게요.</Text>}
    </View>
  </View>;
}
