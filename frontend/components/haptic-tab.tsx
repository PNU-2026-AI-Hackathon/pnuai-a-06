import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

import { usePressGuard } from '@/lib/press-guard';

export function HapticTab(props: BottomTabBarButtonProps) {
  const allowPress = usePressGuard();

  return (
    <PlatformPressable
      {...props}
      onPress={(ev) => {
        if (!allowPress()) {
          return;
        }
        props.onPress?.(ev);
      }}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
