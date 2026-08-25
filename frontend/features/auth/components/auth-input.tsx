// 인증 화면에서 공통으로 사용하는 입력 컴포넌트입니다.
import { LocalizedTextInput as TextInput } from '@/components/localized-text';
import type { TextInputProps } from 'react-native';

import { styles } from '../styles';

export function AuthInput({ style, ...props }: TextInputProps) {
  return <TextInput {...props} style={[styles.input, style]} />;
}
