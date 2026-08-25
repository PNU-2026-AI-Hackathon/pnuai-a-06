import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from 'react-native';
import type { ReactNode } from 'react';

import { translateText } from '@/lib/language';
import { useLanguage } from '@/hooks/use-language';

function localizeChild(child: ReactNode): ReactNode {
  if (typeof child === 'string') {
    return translateText(child);
  }

  if (Array.isArray(child)) {
    if (child.every((item) => typeof item === 'string' || typeof item === 'number')) {
      return translateText(child.map((item) => String(item)).join(''));
    }

    return child.map(localizeChild);
  }

  return child;
}

export function LocalizedText({ children, ...props }: TextProps) {
  const { language } = useLanguage();

  return <NativeText key={language} {...props}>{localizeChild(children)}</NativeText>;
}

export function LocalizedTextInput({ placeholder, ...props }: TextInputProps) {
  const { language } = useLanguage();

  return <NativeTextInput key={language} {...props} placeholder={placeholder ? translateText(placeholder) : placeholder} />;
}
