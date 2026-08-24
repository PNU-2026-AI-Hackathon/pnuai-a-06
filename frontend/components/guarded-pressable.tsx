import { useCallback } from 'react';
import { Pressable, TouchableOpacity, type PressableProps, type TouchableOpacityProps } from 'react-native';

import { usePressGuard } from '@/lib/press-guard';

export function GuardedPressable({ onPress, ...props }: PressableProps) {
  const allowPress = usePressGuard();
  const guardedOnPress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (allowPress()) {
        onPress?.(event);
      }
    },
    [allowPress, onPress],
  );

  return <Pressable {...props} onPress={guardedOnPress} />;
}

export function GuardedTouchableOpacity({ onPress, ...props }: TouchableOpacityProps) {
  const allowPress = usePressGuard();
  const guardedOnPress = useCallback<NonNullable<TouchableOpacityProps['onPress']>>(
    (event) => {
      if (allowPress()) {
        onPress?.(event);
      }
    },
    [allowPress, onPress],
  );

  return <TouchableOpacity {...props} onPress={guardedOnPress} />;
}
