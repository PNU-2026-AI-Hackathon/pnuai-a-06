// 인증 코드와 새 비밀번호를 입력하는 재설정 완료 폼입니다.
import { LocalizedText as Text } from '@/components/localized-text';

import { AuthInput } from './auth-input';
import { styles } from '../styles';

type PasswordResetConfirmFormProps = {
  email: string;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onFocus: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onVerificationCodeChange: (value: string) => void;
  password: string;
  passwordConfirmation: string;
  verificationCode: string;
};

export function PasswordResetConfirmForm({
  email,
  isSubmitting,
  onEmailChange,
  onFocus,
  onPasswordChange,
  onPasswordConfirmationChange,
  onVerificationCodeChange,
  password,
  passwordConfirmation,
  verificationCode,
}: PasswordResetConfirmFormProps) {
  return (
    <>
      <Text style={styles.verifyDescription}>이메일로 받은 인증 코드와 새 비밀번호를 입력해주세요.</Text>
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
      <AuthInput
        editable={!isSubmitting}
        keyboardType="number-pad"
        onChangeText={onVerificationCodeChange}
        onFocus={onFocus}
        placeholder="인증 코드 6자리"
        placeholderTextColor="#92989C"
        value={verificationCode}
      />
      <AuthInput
        editable={!isSubmitting}
        onChangeText={onPasswordChange}
        onFocus={onFocus}
        placeholder="새 비밀번호"
        placeholderTextColor="#92989C"
        secureTextEntry
        value={password}
      />
      <AuthInput
        editable={!isSubmitting}
        onChangeText={onPasswordConfirmationChange}
        onFocus={onFocus}
        placeholder="새 비밀번호를 다시 입력해 주세요"
        placeholderTextColor="#92989C"
        secureTextEntry
        value={passwordConfirmation}
      />
    </>
  );
}
