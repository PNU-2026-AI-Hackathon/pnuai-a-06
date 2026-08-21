// 미션 테마를 선택하는 상단 필터 UI입니다.

import { Image } from 'expo-image';
import { View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import { themeItems } from '../mission-data';
import { styles } from '../styles';
import type { MissionTheme } from '../types';

type MissionThemeSelectorProps = {
  selectedTheme: MissionTheme;
  onSelectTheme: (theme: MissionTheme) => void;
};

export function MissionThemeSelector({ selectedTheme, onSelectTheme }: MissionThemeSelectorProps) {
  return (
    <View style={styles.themeRow}>
      {themeItems.map((item) => {
        const isSelected = item.value === selectedTheme;

        return (
          <ScalePressable
            accessibilityRole="button"
            key={item.label}
            onPress={() => onSelectTheme(item.value)}
            pressedScale={0.94}
            style={[styles.themeCard, isSelected && styles.selectedThemeCard]}>
            <Image source={item.icon} style={styles.themeIcon} contentFit="contain" />
            <Text style={[styles.themeLabel, isSelected && styles.selectedThemeLabel]}>{item.label}</Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}
