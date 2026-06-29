import { type PropsWithChildren, useRef } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScalePressableProps = PropsWithChildren<
  Omit<PressableProps, 'style' | 'onPressIn' | 'onPressOut'> & {
    onPressIn?: (event: GestureResponderEvent) => void;
    onPressOut?: (event: GestureResponderEvent) => void;
    pressedScale?: number;
    style?: StyleProp<ViewStyle>;
  }
>;

export function ScalePressable({
  children,
  disabled,
  onPressIn,
  onPressOut,
  pressedScale = 0.92,
  style,
  ...pressableProps
}: ScalePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

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
      {...pressableProps}
      disabled={disabled}
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
