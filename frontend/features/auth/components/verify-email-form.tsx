import { LocalizedText as Text } from '@/components/localized-text';

import { AuthInput } from './auth-input';
import { styles } from '../styles';

type VerifyEmailFormProps = {
  isSubmitting: boolean;
  onChange: (value: string) => void;
  value: string;
};

export function VerifyEmailForm({ isSubmitting, onChange, value }: VerifyEmailFormProps) {
  return (
    <>
      <Text style={styles.verifyDescription}>이메일로 받은 인증 코드를 입력해주세요.</Text>
      <AuthInput
        editable={!isSubmitting}
        keyboardType="number-pad"
        onChangeText={onChange}
        placeholder="인증 코드"
        placeholderTextColor="#92989C"
        value={value}
      />
    </>
  );
}
