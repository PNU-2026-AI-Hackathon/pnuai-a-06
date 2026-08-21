import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import { styles } from '../styles';
import { useAuthKeyboard } from '../hooks/use-auth-keyboard';

const kakaoTalk = require('../../../assets/svg/kakaotalk.svg');

type AuthFormLayoutProps = {
  autoLogin: boolean;
  bottomSafeInset: number;
  children: (keepFocusedInputVisible: () => void) => ReactNode;
  horizontalPadding: number;
  isLoginMode: boolean;
  isSubmitting: boolean;
  message: string;
  onBack: () => void;
  onKakaoLogin: () => void;
  onOpenRegister: () => void;
  onSubmit: () => void;
  onToggleAutoLogin: () => void;
  submitLabel: string;
  title: string;
  topInset: number;
};

export function AuthFormLayout({
  autoLogin,
  bottomSafeInset,
  children,
  horizontalPadding,
  isLoginMode,
  isSubmitting,
  message,
  onBack,
  onKakaoLogin,
  onOpenRegister,
  onSubmit,
  onToggleAutoLogin,
  submitLabel,
  title,
  topInset,
}: AuthFormLayoutProps) {
  const { authScrollRef, keyboardHeight, keepFocusedInputVisible } = useAuthKeyboard();
  const isKeyboardVisible = keyboardHeight > 0;
  const authBottomInset = isKeyboardVisible ? 0 : Math.max(bottomSafeInset, 12);
  const keyboardScrollPadding = isKeyboardVisible ? Math.max(keyboardHeight - topInset, 120) : 28;

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
          <Pressable accessibilityLabel="뒤로가기" disabled={isSubmitting} hitSlop={12} onPress={onBack}>
            <Ionicons color="#10161F" name="chevron-back" size={27} />
          </Pressable>
        </View>

        <View style={styles.formArea}>
          <Text style={styles.title}>{title}</Text>
          {children(keepFocusedInputVisible)}

          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          {isLoginMode ? (
            <ScalePressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: autoLogin }}
              disabled={isSubmitting}
              onPress={onToggleAutoLogin}
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
            onPress={onSubmit}
            style={[styles.primaryButton, isSubmitting && styles.disabledButton]}>
            {isSubmitting ? <ActivityIndicator color="#5E9DB8" /> : <Text style={styles.primaryButtonText}>{submitLabel}</Text>}
          </ScalePressable>

          {isLoginMode ? (
            <View style={styles.signupPrompt}>
              <Text style={styles.promptText}>처음이신가요?</Text>
              <ScalePressable disabled={isSubmitting} onPress={onOpenRegister} pressedScale={0.95}>
                <Text style={styles.signupLink}>회원가입하기</Text>
              </ScalePressable>
            </View>
          ) : null}
        </View>

        {isLoginMode ? (
          <View style={styles.easyLoginArea}>
            <Text style={styles.easyLoginText}>간편 로그인</Text>
            <ScalePressable
              accessibilityLabel="카카오 간편 로그인"
              disabled={isSubmitting}
              onPress={onKakaoLogin}
              style={styles.kakaoButton}>
              <Image source={kakaoTalk} style={styles.kakaoIcon} />
            </ScalePressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
