// 지도 테마를 선택하는 카테고리 버튼 영역입니다.
import { Image } from 'expo-image';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';

import { categoryItems } from '../map-data';
import { styles } from '../styles';
import type { CategoryValue } from '../types';

type MapCategorySelectorProps = {
  onSelectCategory: (category: CategoryValue) => void;
  selectedCategory: CategoryValue;
};

export function MapCategorySelector({ onSelectCategory, selectedCategory }: MapCategorySelectorProps) {
  const mountainTarget = useTutorialTarget('map-mountain', { offsetY: 27, onPress: () => onSelectCategory('MOUNTAIN') });
  const seaTarget = useTutorialTarget('map-sea', { offsetY: 27, onPress: () => onSelectCategory('SEA') });
  const cityTarget = useTutorialTarget('map-city', { offsetY: 27, onPress: () => onSelectCategory('CITY') });
  const demoTarget = useTutorialTarget('map-demo', { offsetY: 27, onPress: () => onSelectCategory('DEMO') });
  const tutorialTargets = [mountainTarget, seaTarget, cityTarget, demoTarget];

  return (
    <View style={styles.categoryRow}>
      {categoryItems.map((item, index) => {
        const isSelected = item.value === selectedCategory;
        const tutorialTarget = tutorialTargets[index];

        return (
          <View key={item.label} onLayout={tutorialTarget.onLayout} ref={tutorialTarget.ref}>
            <ScalePressable
              accessibilityLabel={`${item.label} 미션 보기`}
              accessibilityRole="button"
              onPress={() => onSelectCategory(item.value)}
              pressedScale={0.94}
              style={[styles.categoryButton, isSelected && styles.selectedCategoryButton]}>
              <Image source={isSelected ? item.selectedIcon : item.icon} style={styles.categoryIcon} contentFit="contain" />
              <Text style={[styles.categoryLabel, isSelected && styles.selectedCategoryLabel]}>{item.label}</Text>
            </ScalePressable>
          </View>
        );
      })}
    </View>
  );
}
