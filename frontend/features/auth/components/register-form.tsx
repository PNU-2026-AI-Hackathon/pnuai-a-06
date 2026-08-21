import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';

import type { PasswordMatchState } from '@/lib/auth-validation';

import { AuthInput } from './auth-input';
import { MATCH_COLOR, MISMATCH_COLOR, styles } from '../styles';

type RegisterFormProps = {
  email: string;
  isSubmitting: boolean;
  name: string;
  onEmailChange: (value: string) => void;
  onFocus: () => void;
  onNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  password: string;
  passwordConfirmation: string;
  passwordMatchState: PasswordMatchState;
};

export function RegisterForm({
  email,
  isSubmitting,
  name,
  onEmailChange,
  onFocus,
  onNameChange,
  onPasswordChange,
  onPasswordConfirmationChange,
  password,
  passwordConfirmation,
  passwordMatchState,
}: RegisterFormProps) {
  return (
    <>
      <AuthInput
        editable={!isSubmitting}
        onChangeText={onNameChange}
        onFocus={onFocus}
        placeholder="닉네임"
        placeholderTextColor="#92989C"
        value={name}
      />
      <AuthInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSubmitting}
        keyboardType="email-address"
        onChangeText={onEmailChange}
        onFocus={onFocus}
        placeholder="이메일 주소"
        placeholderTextColor="#92989C"
        value={email}
      />
      <Text style={styles.passwordLabel}>비밀번호를 입력해 주세요</Text>
      <AuthInput
        editable={!isSubmitting}
        onChangeText={onPasswordChange}
        onFocus={onFocus}
        placeholder="영문, 숫자를 포함해 8자 이상"
        placeholderTextColor="#92989C"
        secureTextEntry
        value={password}
      />
      <View>
        <AuthInput
          editable={!isSubmitting}
          onChangeText={onPasswordConfirmationChange}
          onFocus={onFocus}
          placeholder="비밀번호를 다시 입력해 주세요"
          placeholderTextColor={
            passwordMatchState === 'empty'
              ? '#92989C'
              : passwordMatchState === 'match'
                ? MATCH_COLOR
                : MISMATCH_COLOR
          }
          secureTextEntry
          style={[
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
    </>
  );
}
