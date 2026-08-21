import { LocalizedTextInput as TextInput } from '@/components/localized-text';
import type { TextInputProps } from 'react-native';

import { styles } from '../styles';

export function AuthInput({ style, ...props }: TextInputProps) {
  return <TextInput {...props} style={[styles.input, style]} />;
}
