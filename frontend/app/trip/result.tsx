import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { ScalePressable } from '@/components/scale-pressable';
import { useMissionResult } from '@/features/trip/result/hooks/use-mission-result';
import { getParamValue } from '@/features/trip/result/mission-result-data';
import { styles } from '@/features/trip/result/mission-result-styles';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const pinkEffect = require('@/assets/svg/effect/pink_llipse.svg');
const yellowEffect = require('@/assets/svg/effect/yellow_ellipse.svg');
const blueEffect = require('@/assets/svg/effect/blue_ellipse.svg');

export default function MissionResultScreen() {
  const params = useLocalSearchParams<{
    scheduleId?: string | string[];
    sessionId?: string | string[];
    returnTo?: string | string[];
  }>();
  const scheduleId = getParamValue(params.scheduleId);
  const sessionId = getParamValue(params.sessionId);
  const returnTo = getParamValue(params.returnTo);
  const { bottomSafeInset, horizontalPadding, topSafeInset } = useResponsiveLayout();
  const {
    currentResultIndex,
    currentSession,
    isLoading,
    message,
    resultSessions,
    setCurrentResultIndex,
    session,
    winnerSubmission,
  } = useMissionResult({ scheduleId, sessionId });

  const goTrip = () => {
    if (currentResultIndex < resultSessions.length - 1) {
      setCurrentResultIndex((index) => index + 1);
      return;
    }

    if (returnTo === 'hub') {
      router.replace('/trip/hub');
      return;
    }

    if (scheduleId) {
      router.replace({
        pathname: '/trip/active',
        params: {
          scheduleId,
          ...(currentSession?.id ? { sessionId: currentSession.id } : {}),
        },
      });
      return;
    }

    router.replace('/trip/hub');
  };

  return (
    <View style={styles.container}>
      {isLoading && !session ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
        </View>
      ) : winnerSubmission ? (
        <View style={[styles.resultContent, { paddingBottom: bottomSafeInset + 20, paddingHorizontal: horizontalPadding, paddingTop: topSafeInset + 90 }]}>
          <View style={styles.resultHeading}>
            <Text style={styles.title}>친구들이{`\n`}가장 많이 선택한 사진</Text>
            <View pointerEvents="none" style={styles.effects}>
              <Image contentFit="contain" source={pinkEffect} style={styles.pinkEffect} />
              <Image contentFit="contain" source={yellowEffect} style={styles.yellowEffect} />
              <Image contentFit="contain" source={blueEffect} style={styles.blueEffect} />
            </View>
            <Text style={styles.subtitle}>{winnerSubmission.nickname ? `${winnerSubmission.nickname}님이 담았어요` : '친구가 담은 사진이에요'}</Text>
          </View>

          <Image source={{ uri: winnerSubmission.imageUrl }} style={styles.photo} contentFit="cover" />

          <View style={styles.footer}>
            <Text style={styles.savedText}>이 사진이 매거진에 담겨요</Text>
            <ScalePressable onPress={goTrip} pressedScale={0.97} style={styles.tripButton}>
              <Text style={styles.tripButtonText}>{currentResultIndex < resultSessions.length - 1 ? '다음' : '목록으로 돌아가기'}</Text>
            </ScalePressable>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContent} />
      )}
      {message ? <Text style={[styles.toast, { bottom: bottomSafeInset + 24 }]}>{message}</Text> : null}
    </View>
  );
}
