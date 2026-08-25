import { forwardRef, useCallback, type ComponentRef } from 'react';
import { Pressable, TouchableOpacity, type PressableProps, type TouchableOpacityProps } from 'react-native';

import { usePressGuard } from '@/lib/press-guard';

export const GuardedPressable = forwardRef<ComponentRef<typeof Pressable>, PressableProps>(function GuardedPressable(
  { onPress, ...props },
  ref,
) {
  const allowPress = usePressGuard();
  const guardedOnPress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (allowPress()) {
        onPress?.(event);
      }
    },
    [allowPress, onPress],
  );

  return <Pressable ref={ref} {...props} onPress={guardedOnPress} />;
});

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
