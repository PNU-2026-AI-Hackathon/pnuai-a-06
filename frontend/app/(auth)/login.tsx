import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { loginWithEmail, registerWithEmail, saveAuthTokens, verifyEmail } from '@/lib/auth-api';

const splashText = require('../../assets/svg/splash_text.svg');
const splashMap = require('../../assets/svg/splash_map.svg');
const kakaoTalk = require('../../assets/svg/kakaotalk.svg');

type AuthMode = 'home' | 'login' | 'register' | 'verify';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '요청 처리 중 오류가 발생했습니다.';
}

export default function LoginScreen() {
  const { bottomActionInset, horizontalPadding, topInset } = useResponsiveLayout();
  const [mode, setMode] = useState<AuthMode>('home');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetMessage = () => {
    setMessage('');
  };

  const completeLogin = async () => {
    // 로그인 성공 후 토큰 저장
    const tokens = await loginWithEmail(email.trim(), password);
    saveAuthTokens(tokens);
    router.replace('/main');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setMessage('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await completeLogin();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !name.trim() || !password) {
      setMessage('이름, 이메일, 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      // 회원가입 후 인증 코드 입력 단계로 이동
      await registerWithEmail(email.trim(), password, name.trim());
      setMode('verify');
      setMessage('이메일로 받은 인증 코드를 입력해주세요.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setMessage('인증 코드를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      // 이메일 인증 완료 후 바로 로그인
      await verifyEmail(email.trim(), verificationCode.trim());
      await completeLogin();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMode = (nextMode: AuthMode) => {
    resetMessage();
    setVerificationCode('');
    if (nextMode !== 'register') {
      setName('');
    }
    setMode(nextMode);
  };

  const showForm = mode !== 'home';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}>
      <View
        style={[
          styles.container,
          {
            paddingBottom: bottomActionInset,
            paddingHorizontal: horizontalPadding,
            paddingTop: topInset,
          },
        ]}>
        <View style={[styles.hero, showForm && styles.compactHero]}>
          <Image source={splashText} style={styles.logoText} contentFit="contain" />
          <Text style={styles.subtitle}>반가워요! 여행을 시작할까요?</Text>
          <Image source={splashMap} style={[styles.logoMap, showForm && styles.compactLogoMap]} contentFit="contain" />
        </View>

        <View style={styles.bottomArea}>
          {showForm ? (
            <View style={styles.formArea}>
              <Text style={styles.formTitle}>{mode === 'login' ? '이메일 로그인' : mode === 'verify' ? '이메일 인증' : '회원가입'}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={mode !== 'verify' && !isSubmitting}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="이메일"
                placeholderTextColor="#9AA0A4"
                style={[styles.input, mode === 'verify' && styles.disabledInput]}
                value={email}
              />
              {mode === 'register' ? (
                <TextInput
                  editable={!isSubmitting}
                  onChangeText={setName}
                  placeholder="이름"
                  placeholderTextColor="#9AA0A4"
                  style={styles.input}
                  value={name}
                />
              ) : null}
              {mode !== 'verify' ? (
                <TextInput
                  editable={!isSubmitting}
                  onChangeText={setPassword}
                  placeholder="비밀번호"
                  placeholderTextColor="#9AA0A4"
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              ) : (
                <TextInput
                  editable={!isSubmitting}
                  keyboardType="number-pad"
                  onChangeText={setVerificationCode}
                  placeholder="인증 코드"
                  placeholderTextColor="#9AA0A4"
                  style={styles.input}
                  value={verificationCode}
                />
              )}

              {message ? <Text style={styles.messageText}>{message}</Text> : null}

              <ScalePressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={mode === 'login' ? handleLogin : mode === 'verify' ? handleVerify : handleRegister}
                style={[styles.primaryButton, isSubmitting && styles.disabledButton]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{mode === 'login' ? '로그인' : mode === 'verify' ? '인증하고 시작하기' : '가입하기'}</Text>
                )}
              </ScalePressable>

              <ScalePressable disabled={isSubmitting} onPress={() => openMode('home')} pressedScale={0.9}>
                <Text style={styles.backText}>돌아가기</Text>
              </ScalePressable>
            </View>
          ) : (
            <>
              <ScalePressable
                accessibilityRole="button"
                accessibilityLabel="카카오로 계속하기"
                onPress={() => router.replace('/main')}
                style={styles.kakaoButton}>
                <Image source={kakaoTalk} style={styles.kakaoIcon} contentFit="contain" />
                <Text style={styles.kakaoText}>카카오로 계속하기</Text>
              </ScalePressable>

              <View style={styles.linkRow}>
                <ScalePressable onPress={() => openMode('register')} pressedScale={0.9}>
                  <Text style={styles.linkText}>회원가입</Text>
                </ScalePressable>
                <View style={styles.divider} />
                <ScalePressable onPress={() => openMode('login')} pressedScale={0.9}>
                  <Text style={styles.linkText}>이메일 로그인</Text>
                </ScalePressable>
              </View>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
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
  compactHero: {
    paddingBottom: 20,
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
  compactLogoMap: {
    height: 120,
    marginTop: 34,
    width: 154,
  },
  bottomArea: {
    alignItems: 'center',
    gap: 34,
    marginBottom: 24,
  },
  formArea: {
    alignItems: 'center',
    gap: 12,
    width: '95%',
  },
  formTitle: {
    color: '#2B2F33',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderColor: '#D5DADD',
    borderRadius: 14,
    borderWidth: 1,
    color: '#2B2F33',
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 16,
    width: '100%',
  },
  disabledInput: {
    backgroundColor: '#F5F7F8',
    color: '#70777b',
  },
  messageText: {
    color: '#676D70',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2B2F33',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  backText: {
    color: '#676D70',
    fontSize: 12,
    fontWeight: '500',
    paddingTop: 4,
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
