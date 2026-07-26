import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { loginWithEmail, registerWithEmail, saveAuthTokens, verifyEmail } from '@/lib/auth-api';

const splashText = require('../../assets/svg/logo_text.svg');
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
  const { bottomActionInset, bottomSafeInset, horizontalPadding, topInset } = useResponsiveLayout();
  const [mode, setMode] = useState<AuthMode>('home');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const authScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      authScrollRef.current?.scrollTo({ animated: true, y: 0 });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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

  const authTitle = mode === 'login' ? '이메일 로그인' : mode === 'verify' ? '이메일 인증' : '회원가입';
  const authButtonText = mode === 'login' ? '로그인' : mode === 'verify' ? '인증하고 시작하기' : '가입하기';
  const submitAuth = mode === 'login' ? handleLogin : mode === 'verify' ? handleVerify : handleRegister;
  const isKeyboardVisible = keyboardHeight > 0;
  const authBottomInset = isKeyboardVisible ? 0 : Math.max(bottomSafeInset, 12);
  const keyboardScrollPadding = isKeyboardVisible ? Math.max(keyboardHeight - topInset, 120) : 28;

  const keepFocusedInputVisible = () => {
    window.setTimeout(() => {
      authScrollRef.current?.scrollTo({ animated: true, y: 96 });
    }, 80);
  };

  if (mode !== 'home') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View
          style={[
            styles.authContainer,
            {
              paddingBottom: authBottomInset,
              paddingHorizontal: horizontalPadding,
              paddingTop: topInset,
            },
          ]}>
          <View style={styles.authHeader}>
            <ScalePressable disabled={isSubmitting} onPress={() => openMode('home')} pressedScale={0.9}>
              <Text style={styles.headerBackText}>돌아가기</Text>
            </ScalePressable>
            <Image source={splashText} style={styles.headerLogoText} contentFit="contain" />
          </View>

          <ScrollView
            ref={authScrollRef}
            bounces={false}
            contentContainerStyle={[
              styles.authScrollContent,
              { paddingBottom: keyboardScrollPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.formArea}>
              <Text style={styles.formTitle}>{authTitle}</Text>
              <Text style={styles.formSubtitle}>
                {mode === 'verify' ? '이메일로 받은 인증 코드를 입력해주세요.' : '여행 기록을 이어갈 계정 정보를 입력해주세요.'}
              </Text>

              <View style={styles.inputGroup}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={mode !== 'verify' && !isSubmitting}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  onFocus={keepFocusedInputVisible}
                  placeholder="이메일"
                  placeholderTextColor="#9AA0A4"
                  style={[styles.input, mode === 'verify' && styles.disabledInput]}
                  value={email}
                />
                {mode === 'register' ? (
                  <TextInput
                    editable={!isSubmitting}
                    onChangeText={setName}
                    onFocus={keepFocusedInputVisible}
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
                    onFocus={keepFocusedInputVisible}
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
                    onFocus={keepFocusedInputVisible}
                    placeholder="인증 코드"
                    placeholderTextColor="#9AA0A4"
                    style={styles.input}
                    value={verificationCode}
                  />
                )}
              </View>

              {message ? <Text style={styles.messageText}>{message}</Text> : null}

              <ScalePressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={submitAuth}
                style={[styles.primaryButton, isSubmitting && styles.disabledButton]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{authButtonText}</Text>
                )}
              </ScalePressable>

              {mode !== 'verify' ? (
                <ScalePressable
                  disabled={isSubmitting}
                  onPress={() => openMode(mode === 'login' ? 'register' : 'login')}
                  pressedScale={0.9}>
                  <Text style={styles.switchText}>{mode === 'login' ? '회원가입하기' : '이미 계정이 있어요'}</Text>
                </ScalePressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

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
          <ScalePressable onPress={() => openMode('register')} pressedScale={0.9}>
            <Text style={styles.linkText}>회원가입</Text>
          </ScalePressable>
          <View style={styles.divider} />
          <ScalePressable onPress={() => openMode('login')} pressedScale={0.9}>
            <Text style={styles.linkText}>이메일 로그인</Text>
          </ScalePressable>
        </View>
      </View>
    </View>
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
  authContainer: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  authHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  headerBackText: {
    color: '#676D70',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 10,
  },
  headerLogoText: {
    height: 30,
    width: 86,
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 28,
    paddingTop: 34,
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
  formArea: {
    alignItems: 'stretch',
    gap: 14,
    width: '100%',
  },
  formTitle: {
    color: '#2B2F33',
    fontSize: 26,
    fontWeight: '800',
  },
  formSubtitle: {
    color: '#70777b',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    marginBottom: 14,
  },
  inputGroup: {
    gap: 10,
  },
  input: {
    borderColor: '#D5DADD',
    borderRadius: 14,
    borderWidth: 1,
    color: '#2B2F33',
    fontSize: 15,
    minHeight: 50,
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
    marginTop: 4,
    minHeight: 50,
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
  switchText: {
    color: '#676D70',
    fontSize: 13,
    fontWeight: '600',
    paddingTop: 4,
    textAlign: 'center',
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
