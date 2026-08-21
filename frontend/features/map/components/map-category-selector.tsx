// 지도 테마를 선택하는 카테고리 버튼 영역입니다.
import { Image } from 'expo-image';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import { categoryItems } from '../map-data';
import { styles } from '../styles';
import type { CategoryValue } from '../types';

type MapCategorySelectorProps = {
  onSelectCategory: (category: CategoryValue) => void;
  selectedCategory: CategoryValue;
};

export function MapCategorySelector({ onSelectCategory, selectedCategory }: MapCategorySelectorProps) {
  return (
    <View style={styles.categoryRow}>
      {categoryItems.map((item) => {
        const isSelected = item.value === selectedCategory;

        return (
          <ScalePressable
            accessibilityLabel={`${item.label} 미션 보기`}
            accessibilityRole="button"
            key={item.label}
            onPress={() => onSelectCategory(item.value)}
            pressedScale={0.94}
            style={[styles.categoryButton, isSelected && styles.selectedCategoryButton]}>
            <Image source={isSelected ? item.selectedIcon : item.icon} style={styles.categoryIcon} contentFit="contain" />
            <Text style={[styles.categoryLabel, isSelected && styles.selectedCategoryLabel]}>{item.label}</Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}
