import { LocalizedText as Text } from '@/components/localized-text';

import { AuthInput } from './auth-input';
import { styles } from '../styles';

type PasswordResetRequestFormProps = {
  email: string;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onFocus: () => void;
};

export function PasswordResetRequestForm({
  email,
  isSubmitting,
  onEmailChange,
  onFocus,
}: PasswordResetRequestFormProps) {
  return (
    <>
      <Text style={styles.verifyDescription}>비밀번호를 변경하려면 이메일 인증이 필요해요.</Text>
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
    </>
  );
}
