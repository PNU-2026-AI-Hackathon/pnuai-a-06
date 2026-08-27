import { type PropsWithChildren, useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { usePressGuard } from '@/lib/press-guard';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScalePressableProps = PropsWithChildren<
  Omit<PressableProps, 'style' | 'onPressIn' | 'onPressOut'> & {
    onPressIn?: (event: GestureResponderEvent) => void;
    onPressOut?: (event: GestureResponderEvent) => void;
    pressGuard?: boolean;
    pressedScale?: number;
    style?: StyleProp<ViewStyle>;
  }
>;

export function ScalePressable({
  children,
  disabled,
  onPressIn,
  onPressOut,
  pressGuard = true,
  pressedScale = 0.92,
  style,
  ...pressableProps
}: ScalePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const allowPress = usePressGuard();
  const { onPress, ...restPressableProps } = pressableProps;
  const guardedOnPress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (!pressGuard || allowPress()) {
        onPress?.(event);
      }
    },
    [allowPress, onPress, pressGuard],
  );

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      friction: 5,
      tension: 260,
      toValue,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...restPressableProps}
      disabled={disabled}
      onPress={guardedOnPress}
      onPressIn={(event) => {
        if (!disabled) {
          animateTo(pressedScale);
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!disabled) {
          animateTo(1);
        }
        onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}>
      {children}
    </AnimatedPressable>
  );
}
