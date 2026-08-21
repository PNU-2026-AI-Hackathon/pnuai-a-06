import { Image } from 'expo-image';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import type { AuthMode } from '../types';
import { styles } from '../styles';

const kakaoTalk = require('../../../assets/svg/kakaotalk.svg');
const splashMap = require('../../../assets/svg/splash_map.svg');
const splashText = require('../../../assets/svg/logo_text.svg');

type AuthHomeProps = {
  bottomActionInset: number;
  horizontalPadding: number;
  isSubmitting: boolean;
  onKakaoLogin: () => void;
  onOpenMode: (mode: AuthMode) => void;
  topInset: number;
};

export function AuthHome({
  bottomActionInset,
  horizontalPadding,
  isSubmitting,
  onKakaoLogin,
  onOpenMode,
  topInset,
}: AuthHomeProps) {
  return (
    <View
      style={[
        styles.homeScreen,
        {
          paddingBottom: bottomActionInset,
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <View style={styles.homeHero}>
        <Image contentFit="contain" source={splashText} style={styles.homeLogoText} />
        <Text style={styles.homeSubtitle}>반가워요! 여행을 시작할까요?</Text>
        <Image contentFit="contain" source={splashMap} style={styles.homeLogoMap} />
      </View>

      <View style={styles.homeBottomArea}>
        <ScalePressable
          accessibilityLabel="카카오로 계속하기"
          disabled={isSubmitting}
          onPress={onKakaoLogin}
          style={styles.homeKakaoButton}>
          <Image source={kakaoTalk} style={styles.homeKakaoIcon} />
          <Text style={styles.homeKakaoText}>카카오로 계속하기</Text>
        </ScalePressable>

        <View style={styles.homeLinkRow}>
          <ScalePressable disabled={isSubmitting} onPress={() => onOpenMode('register')} pressedScale={0.95}>
            <Text style={styles.homeLinkText}>회원가입</Text>
          </ScalePressable>
          <View style={styles.homeDivider} />
          <ScalePressable disabled={isSubmitting} onPress={() => onOpenMode('login')} pressedScale={0.95}>
            <Text style={styles.homeLinkText}>이메일 로그인</Text>
          </ScalePressable>
          <View style={styles.homeDivider} />
          <ScalePressable disabled={isSubmitting} onPress={() => onOpenMode('resetRequest')} pressedScale={0.95}>
            <Text style={styles.homeLinkText}>비밀번호 변경</Text>
          </ScalePressable>
        </View>
      </View>
    </View>
  );
}
