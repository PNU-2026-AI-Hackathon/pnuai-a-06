import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { ScalePressable } from '@/components/scale-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { getAuthItem } from '@/lib/auth-storage';
import { hasSeenWelcomeScreen, markWelcomeScreenCompleted } from '@/lib/tutorial-storage';

const welcomeImage = require('@/assets/svg/main/sig_home.svg');

export default function WelcomeScreen() {
  const { bottomSafeInset, height, topSafeInset, width } = useResponsiveLayout();
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let isActive = true;
    const userId = getAuthItem('user_id');

    if (!userId) {
      router.replace('/login');
      return () => {
        isActive = false;
      };
    }

    void hasSeenWelcomeScreen(userId).then((hasSeen) => {
      if (!isActive) {
        return;
      }

      if (hasSeen) {
        router.replace('/main');
        return;
      }

      setIsReady(true);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const startJourney = async () => {
    if (isStarting) {
      return;
    }

    const userId = getAuthItem('user_id');

    if (!userId) {
      router.replace('/login');
      return;
    }

    setIsStarting(true);
    await markWelcomeScreenCompleted(userId);
    router.replace('/onboarding/step1' as Href);
  };

  if (!isReady) {
    return <View style={styles.container} />;
  }

  const imageSize = Math.min(Math.max(width * 0.43, 165), 190);

  return (
    <View style={styles.container}>
      <Svg height={height} pointerEvents="none" preserveAspectRatio="none" style={StyleSheet.absoluteFill} width={width}>
        <Defs>
          <LinearGradient id="welcome-background" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#BDEAFB" stopOpacity="0.7" />
            <Stop offset="0.24" stopColor="#BDEAFB" stopOpacity="0.32" />
            <Stop offset="0.56" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#welcome-background)" height={height} width={width} />
      </Svg>

      <View style={[styles.content, { paddingBottom: bottomSafeInset + 28, paddingTop: Math.max(topSafeInset + 52, height * 0.145) }]}>
        <View style={styles.copy}>
          <Text style={styles.title}>찌그까와{`\n`}여행을 시작해요</Text>
          <Text style={styles.subtitle}>AI 미션을 따라 숨은 로컬을 발견하고{`\n`}여행을 매거진으로 남길 수 있어요</Text>
        </View>

        <Image
          accessibilityLabel="여행 가방을 끌고 있는 찌그까"
          contentFit="contain"
          source={welcomeImage}
          style={[styles.image, { height: imageSize, marginTop: Math.max(76, height * 0.12), width: imageSize }]}
        />

        <View style={styles.spacer} />

        <ScalePressable accessibilityRole="button" disabled={isStarting} onPress={startJourney} style={styles.button}>
          <Text style={styles.buttonText}>다음</Text>
        </ScalePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  copy: {
    alignItems: 'flex-start',
  },
  title: {
    color: '#10161F',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 34,
  },
  subtitle: {
    color: '#8A9194',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 31,
  },
  image: {
    alignSelf: 'center',
  },
  spacer: {
    flex: 1,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 63,
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
