import { Ionicons } from '@expo/vector-icons';
import { login as loginWithKakao } from '@react-native-seoul/kakao-login';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import {
  loginWithEmail,
  loginWithKakaoAccessToken,
  registerWithEmail,
  saveAuthTokens,
  verifyEmail,
} from '@/lib/auth-api';
import { getLoginErrorMessage, getRegisterErrorMessage, getRequestErrorMessage } from '@/lib/auth-error';
import { getPasswordMatchState, isValidEmail, isValidPassword } from '@/lib/auth-validation';

const kakaoTalk = require('../../assets/svg/kakaotalk.svg');
const splashMap = require('../../assets/svg/splash_map.svg');
const splashText = require('../../assets/svg/logo_text.svg');

type AuthMode = 'home' | 'login' | 'register' | 'verify';

const MATCH_COLOR = '#409CB7';
const MISMATCH_COLOR = '#B74040';

export default function LoginScreen() {
  const { bottomActionInset, bottomSafeInset, horizontalPadding, topInset } = useResponsiveLayout();
  const [mode, setMode] = useState<AuthMode>('home');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoLogin, setAutoLogin] = useState(true);
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

  const passwordMatchState = getPasswordMatchState(password, passwordConfirmation);

  const resetMessage = () => setMessage('');

  const completeLogin = async (shouldPersist = false) => {
    const tokens = await loginWithEmail(email.trim(), password);
    await saveAuthTokens(tokens, shouldPersist);
    router.replace('/main');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setMessage('이메일 주소와 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await completeLogin(autoLogin);
    } catch (error) {
      setMessage(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !passwordConfirmation) {
      setMessage('모든 항목을 입력해주세요.');
      return;
    }

    if (!isValidEmail(email)) {
      setMessage('올바른 이메일 형식으로 입력해 주세요.');
      return;
    }

    if (!isValidPassword(password)) {
      setMessage('비밀번호는 영문·숫자 포함 8자 이상이어야 합니다.');
      return;
    }

    if (password !== passwordConfirmation) {
      setMessage('비밀번호가 일치하지 않아요.');
      return;
    }

    try {
      setIsSubmitting(true);
      resetMessage();
      await registerWithEmail(email.trim(), password, name.trim());
      setMode('verify');
      setMessage('이메일로 받은 인증 코드를 입력해주세요.');
    } catch (error) {
      setMessage(getRegisterErrorMessage(error));
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
      await verifyEmail(email.trim(), verificationCode.trim());
      await completeLogin();
    } catch (error) {
      setMessage(getRequestErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKakaoLogin = async () => {
    try {
      setIsSubmitting(true);
      resetMessage();
      const kakaoToken = await loginWithKakao();
      const serviceTokens = await loginWithKakaoAccessToken(kakaoToken.accessToken);
      await saveAuthTokens(serviceTokens, true);
      router.replace('/main');
    } catch (error) {
      setMessage(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMode = (nextMode: AuthMode) => {
    resetMessage();
    setVerificationCode('');
    setPasswordConfirmation('');
    if (nextMode !== 'register') {
      setName('');
    }
    setMode(nextMode);
  };

  const handleBack = () => {
    if (mode === 'verify') {
      setMode('register');
      resetMessage();
      return;
    }

    openMode('home');
  };

  if (mode === 'home') {
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
            onPress={handleKakaoLogin}
            style={styles.homeKakaoButton}>
            <Image source={kakaoTalk} style={styles.homeKakaoIcon} />
            <Text style={styles.homeKakaoText}>카카오로 계속하기</Text>
          </ScalePressable>

          <View style={styles.homeLinkRow}>
            <ScalePressable disabled={isSubmitting} onPress={() => openMode('register')} pressedScale={0.95}>
              <Text style={styles.homeLinkText}>회원가입</Text>
            </ScalePressable>
            <View style={styles.homeDivider} />
            <ScalePressable disabled={isSubmitting} onPress={() => openMode('login')} pressedScale={0.95}>
              <Text style={styles.homeLinkText}>이메일 로그인</Text>
            </ScalePressable>
          </View>
        </View>
      </View>
    );
  }

  const isVerifyMode = mode === 'verify';
  const isRegisterMode = mode === 'register';
  const submitAuth = mode === 'login' ? handleLogin : mode === 'register' ? handleRegister : handleVerify;
  const buttonText = mode === 'login' ? '로그인' : mode === 'register' ? '회원가입' : '인증하고 시작하기';
  const isKeyboardVisible = keyboardHeight > 0;
  const authBottomInset = isKeyboardVisible ? 0 : Math.max(bottomSafeInset, 12);
  const keyboardScrollPadding = isKeyboardVisible ? Math.max(keyboardHeight - topInset, 120) : 28;

  const keepFocusedInputVisible = () => {
    window.setTimeout(() => {
      authScrollRef.current?.scrollTo({ animated: true, y: 96 });
    }, 80);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingBottom: authBottomInset }]}>
      <ScrollView
        ref={authScrollRef}
        bounces={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: keyboardScrollPadding,
            paddingTop: topInset + 8,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="뒤로가기" disabled={isSubmitting} hitSlop={12} onPress={handleBack}>
            <Ionicons color="#10161F" name="chevron-back" size={27} />
          </Pressable>
        </View>

        <View style={styles.formArea}>
          <Text style={styles.title}>{mode === 'login' ? '로그인' : mode === 'register' ? '회원가입' : '이메일 인증'}</Text>

          {isVerifyMode ? (
            <>
              <Text style={styles.verifyDescription}>이메일로 받은 인증 코드를 입력해주세요.</Text>
              <TextInput
                editable={!isSubmitting}
                keyboardType="number-pad"
                onChangeText={setVerificationCode}
                placeholder="인증 코드"
                placeholderTextColor="#92989C"
                style={styles.input}
                value={verificationCode}
              />
            </>
          ) : (
            <>
              {isRegisterMode ? (
                <TextInput
                  editable={!isSubmitting}
                  onChangeText={setName}
                  onFocus={keepFocusedInputVisible}
                  placeholder="닉네임"
                  placeholderTextColor="#92989C"
                  style={styles.input}
                  value={name}
                />
              ) : null}

              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                keyboardType="email-address"
                onChangeText={setEmail}
                onFocus={keepFocusedInputVisible}
                placeholder="이메일 주소"
                placeholderTextColor="#92989C"
                style={styles.input}
                value={email}
              />

              {isRegisterMode ? <Text style={styles.passwordLabel}>비밀번호를 입력해 주세요</Text> : null}

              <TextInput
                editable={!isSubmitting}
                onChangeText={setPassword}
                onFocus={keepFocusedInputVisible}
                placeholder={isRegisterMode ? '영문, 숫자를 포함해 8자 이상' : '비밀번호'}
                placeholderTextColor="#92989C"
                secureTextEntry
                style={styles.input}
                value={password}
              />

              {isRegisterMode ? (
                <View>
                  <TextInput
                    editable={!isSubmitting}
                    onChangeText={setPasswordConfirmation}
                    onFocus={keepFocusedInputVisible}
                    placeholder="비밀번호를 다시 입력해 주세요"
                    placeholderTextColor={passwordMatchState === 'empty' ? '#92989C' : passwordMatchState === 'match' ? MATCH_COLOR : MISMATCH_COLOR}
                    secureTextEntry
                    style={[
                      styles.input,
                      passwordMatchState === 'match' && styles.matchInput,
                      passwordMatchState === 'mismatch' && styles.mismatchInput,
                    ]}
                    value={passwordConfirmation}
                  />
                  {passwordMatchState !== 'empty' ? (
                    <Text style={[styles.passwordMessage, { color: passwordMatchState === 'match' ? MATCH_COLOR : MISMATCH_COLOR }]}>
                      {passwordMatchState === 'match' ? '비밀번호가 일치해요' : '비밀번호가 일치하지 않아요'}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </>
          )}

          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          {mode === 'login' ? (
            <ScalePressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: autoLogin }}
              disabled={isSubmitting}
              onPress={() => setAutoLogin((current) => !current)}
              style={styles.autoLoginRow}>
              <View style={[styles.checkbox, autoLogin && styles.checkedBox]}>
                {autoLogin ? <Ionicons color="#FFFFFF" name="checkmark" size={14} /> : null}
              </View>
              <Text style={styles.autoLoginText}>자동 로그인</Text>
            </ScalePressable>
          ) : null}

          <ScalePressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={submitAuth}
            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}>
            {isSubmitting ? <ActivityIndicator color="#5E9DB8" /> : <Text style={styles.primaryButtonText}>{buttonText}</Text>}
          </ScalePressable>

          {mode === 'login' ? (
            <View style={styles.signupPrompt}>
              <Text style={styles.promptText}>처음이신가요?</Text>
              <ScalePressable disabled={isSubmitting} onPress={() => openMode('register')} pressedScale={0.95}>
                <Text style={styles.signupLink}>회원가입하기</Text>
              </ScalePressable>
            </View>
          ) : null}
        </View>

        {mode === 'login' ? (
          <View style={styles.easyLoginArea}>
            <Text style={styles.easyLoginText}>간편 로그인</Text>
            <ScalePressable
              accessibilityLabel="카카오 간편 로그인"
              disabled={isSubmitting}
              onPress={handleKakaoLogin}
              style={styles.kakaoButton}>
              <Image source={kakaoTalk} style={styles.kakaoIcon} />
            </ScalePressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  homeScreen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  homeHero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 42,
  },
  homeLogoText: {
    height: 42,
    width: 119,
  },
  homeSubtitle: {
    color: '#70777B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 20,
  },
  homeLogoMap: {
    height: 170,
    marginTop: 72,
    width: 218,
  },
  homeBottomArea: {
    alignItems: 'center',
    gap: 34,
    marginBottom: 24,
  },
  homeKakaoButton: {
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
  homeKakaoIcon: {
    height: 24,
    width: 24,
  },
  homeKakaoText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  homeLinkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
  },
  homeDivider: {
    backgroundColor: '#676D70',
    height: 17,
    width: 1,
  },
  homeLinkText: {
    color: '#676D70',
    fontSize: 12,
    fontWeight: '500',
  },
  screen: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  header: {
    height: 48,
    justifyContent: 'center',
  },
  formArea: {
    gap: 11,
    marginTop: 62,
  },
  title: {
    color: '#10161F',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1.5,
    color: '#151A20',
    fontSize: 14,
    minHeight: 49,
    paddingHorizontal: 16,
  },
  passwordLabel: {
    color: '#8A9194',
    fontSize: 12,
    marginLeft: 6,
    marginTop: 8,
  },
  matchInput: {
    borderColor: MATCH_COLOR,
  },
  mismatchInput: {
    borderColor: MISMATCH_COLOR,
  },
  passwordMessage: {
    fontSize: 12,
    marginLeft: 6,
    marginTop: 6,
  },
  verifyDescription: {
    color: '#8A9194',
    fontSize: 14,
    marginBottom: 3,
  },
  messageText: {
    color: MISMATCH_COLOR,
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 6,
  },
  autoLoginRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 3,
    marginTop: 8,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#8A9194',
    borderRadius: 13,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  checkedBox: {
    backgroundColor: '#8A9194',
    borderColor: '#8A9194',
  },
  autoLoginText: {
    color: '#8A9194',
    fontSize: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#E3F0F6',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 32,
    minHeight: 63,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#409CB7',
    fontSize: 16,
    fontWeight: '500',
  },
  signupPrompt: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  promptText: {
    color: '#8A9194',
    fontSize: 12,
  },
  signupLink: {
    color: '#10161F',
    fontSize: 12,
    fontWeight: '500',
  },
  easyLoginArea: {
    alignItems: 'center',
    gap: 16,
    marginTop: 83,
  },
  easyLoginText: {
    color: '#8A9194',
    fontSize: 12,
    fontWeight: '500',
  },
  kakaoButton: {
    alignItems: 'center',
    backgroundColor: '#FFE812',
    borderRadius: 38,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  kakaoIcon: {
    height: 22,
    width: 22,
  },
});
