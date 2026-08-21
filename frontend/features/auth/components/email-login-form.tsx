// 이메일 로그인에 필요한 입력 폼을 담당합니다.
import { AuthInput } from './auth-input';

type EmailLoginFormProps = {
  email: string;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onFocus: () => void;
  onPasswordChange: (value: string) => void;
  password: string;
};

export function EmailLoginForm({
  email,
  isSubmitting,
  onEmailChange,
  onFocus,
  onPasswordChange,
  password,
}: EmailLoginFormProps) {
  return (
    <>
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
        onChangeText={onPasswordChange}
        onFocus={onFocus}
        placeholder="비밀번호"
        placeholderTextColor="#92989C"
        secureTextEntry
        value={password}
      />
    </>
  );
}
