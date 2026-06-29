import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const splashText = require('../../assets/svg/splash_text.svg');
const splashMap = require('../../assets/svg/splash_map.svg');
const kakaoTalk = require('../../assets/svg/kakaotalk.svg');

export default function LoginScreen() {
  const { bottomActionInset, horizontalPadding, topInset } = useResponsiveLayout();

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
      <View style={styles.hero}>
        <Image source={splashText} style={styles.logoText} contentFit="contain" />
        <Text style={styles.subtitle}>반가워요! 여행을 시작할까요?</Text>
        <Image source={splashMap} style={styles.logoMap} contentFit="contain" />
      </View>

      <View style={styles.bottomArea}>
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel="카카오로 계속하기"
          onPress={() => router.replace('/main')}
          style={styles.kakaoButton}>
          <Image source={kakaoTalk} style={styles.kakaoIcon} contentFit="contain" />
          <Text style={styles.kakaoText}>카카오로 계속하기</Text>
        </ScalePressable>

        <View style={styles.linkRow}>
          <ScalePressable onPress={() => router.push('/tutorial')} pressedScale={0.9}>
            <Text style={styles.linkText}>회원가입</Text>
          </ScalePressable>
          <View style={styles.divider} />
          <ScalePressable onPress={() => router.replace('/main')} pressedScale={0.9}>
            <Text style={styles.linkText}>이메일 로그인</Text>
          </ScalePressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 42,
  },
  logoText: {
    height: 42,
    width: 119,
  },
  subtitle: {
    color: '#70777b',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 20,
  },
  logoMap: {
    height: 170,
    marginTop: 72,
    width: 218,
  },
  bottomArea: {
    alignItems: 'center',
    gap: 34,
    marginBottom: 24,
  },
  kakaoButton: {
    alignItems: 'center',
    backgroundColor: '#FFE812',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 24,
    width: '95%',
  },
  kakaoIcon: {
    height: 24,
    width: 24,
  },
  kakaoText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  linkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
  },
  divider: {
    backgroundColor: '#676D70',
    height: 17,
    width: 1,
  },
  linkText: {
    color: '#676D70',
    fontSize: 12,
    fontWeight: '500',
  },
});
