import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const onboardingSteps = [
  {
    description: '해당 카테고리의 지역만 활성화되고,\n이를 클릭하면 미션 카드가 나와요\n(현재 일정에 미션을 추가할 수도 있어요)',
    image: require('@/assets/svg/onboarding/step1.svg'),
    title: '미션 카테고리 선택',
  },
  {
    description: '해당 카테고리의 지역만 활성화되고,\n이를 클릭하면 미션 카드가 나와요\n(현재 일정에 미션을 추가할 수도 있어요)',
    image: require('@/assets/svg/onboarding/step2.svg'),
    title: '미션 카테고리 선택',
  },
  {
    description: '많은 미션들을 확인하거나 추가할 수 있고,\n담긴 미션 카드를 누르면\n곧바로 해당 미션을 수행할 수 있어요',
    image: require('@/assets/svg/onboarding/step3.svg'),
    title: '일정에서 미션 관리',
  },
  {
    description: '많은 미션들을 확인하거나 추가할 수 있고,\n담긴 미션 카드를 누르면\n곧바로 해당 미션을 수행할 수 있어요',
    image: require('@/assets/svg/onboarding/step4.svg'),
    title: '일정에서 미션 관리',
  },
  {
    description: '서로의 사진에 댓글을 달고,\n매거진에 실릴 사진을 투표할 수 있어요\n매거진은 전체 일정이 끝나면 자동으로 완성돼요',
    image: require('@/assets/svg/onboarding/step5.svg'),
    title: '미션 피드백',
  },
  {
    description: '서로의 사진에 댓글을 달고,\n매거진에 실릴 사진을 투표할 수 있어요\n매거진은 전체 일정이 끝나면 자동으로 완성돼요',
    image: require('@/assets/svg/onboarding/step6.svg'),
    title: '미션 피드백',
  },
  {
    description: '서로의 사진에 댓글을 달고,\n매거진에 실릴 사진을 투표할 수 있어요\n매거진은 전체 일정이 끝나면 자동으로 완성돼요',
    image: require('@/assets/svg/onboarding/step7.svg'),
    title: '미션 피드백',
  },
] as const;

export default function MissionCategoryScreen() {
  const { bottomSafeInset, height, topSafeInset, width } = useResponsiveLayout();
  const [stepIndex, setStepIndex] = useState(0);
  const isHandlingStep = useRef(false);
  const currentStep = onboardingSteps[stepIndex];
  const isLastStep = stepIndex === onboardingSteps.length - 1;
  const imageWidth = Math.min(Math.max(width * 0.46, 178), 210);
  const imageHeight = imageWidth * (340 / 168);

  useEffect(() => {
    // The onboarding SVGs contain large embedded PNGs. Load them in parallel
    // when the first step opens so changing steps can reuse the memory cache.
    onboardingSteps.forEach(({ image }) => {
      void Image.loadAsync(image).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    // Allow the next tap as soon as the new step is rendered. This prevents
    // duplicate taps on one step without adding a cooldown between steps.
    isHandlingStep.current = false;
  }, [stepIndex]);

  const handleNext = () => {
    if (isHandlingStep.current) {
      return;
    }

    isHandlingStep.current = true;

    if (isLastStep) {
      router.replace('/main');
      return;
    }

    setStepIndex((currentIndex) => currentIndex + 1);
  };

  return (
    <View style={styles.container}>
      <Svg height={height} pointerEvents="none" preserveAspectRatio="none" style={StyleSheet.absoluteFill} width={width}>
        <Defs>
          <LinearGradient id="onboarding-background" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#BDEAFB" stopOpacity="0.7" />
            <Stop offset="0.24" stopColor="#BDEAFB" stopOpacity="0.32" />
            <Stop offset="0.56" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#onboarding-background)" height={height} width={width} />
      </Svg>

      <View
        style={[
          styles.content,
          {
            paddingBottom: bottomSafeInset + 28,
            paddingTop: Math.max(topSafeInset + 52, height * 0.145),
          },
        ]}>
        <View style={styles.copy}>
          <Text style={styles.stepLabel}>step{stepIndex + 1}</Text>
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.subtitle}>{currentStep.description}</Text>
        </View>

        <Image
          accessibilityLabel="미션 카테고리를 선택하는 지도 화면"
          cachePolicy="memory-disk"
          contentFit="contain"
          source={currentStep.image}
          style={[styles.image, { height: imageHeight, marginTop: Math.max(26, height * 0.035), width: imageWidth }]}
          transition={0}
        />

        <View accessibilityLabel={`${stepIndex + 1}단계, 총 ${onboardingSteps.length}단계`} accessibilityRole="progressbar" style={styles.progress}>
          {onboardingSteps.map((step, index) => (
            <View key={step.image} style={[styles.progressDot, index === stepIndex && styles.activeProgressDot]} />
          ))}
        </View>

        <View style={styles.spacer} />

        <ScalePressable accessibilityRole="button" onPress={handleNext} pressGuard={false} style={styles.button}>
          <Text style={styles.buttonText}>{isLastStep ? '여행 시작하기' : '다음'}</Text>
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
  stepLabel: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    marginBottom: 6,
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
    marginTop: 21,
  },
  image: {
    alignSelf: 'center',
  },
  progress: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 14,
  },
  progressDot: {
    backgroundColor: '#D5E0E4',
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  activeProgressDot: {
    backgroundColor: '#63B5CD',
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
