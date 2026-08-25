// 프로필 편집 화면의 상단 헤더를 담당합니다.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import { styles } from '../styles';

type ProfileEditHeaderProps = {
  contentMaxWidth: number;
  onBack: () => void;
};

export function ProfileEditHeader({ contentMaxWidth, onBack }: ProfileEditHeaderProps) {
  return (
    <View style={[styles.header, { maxWidth: contentMaxWidth }]}>
      <ScalePressable accessibilityLabel="뒤로 가기" onPress={onBack} pressedScale={0.86} style={styles.iconButton}>
        <MaterialCommunityIcons color="#141820" name="chevron-left" size={36} />
      </ScalePressable>
      <Text style={styles.headerTitle}>프로필 편집</Text>
      <ScalePressable accessibilityLabel="설정" onPress={() => {}} pressedScale={0.9} style={styles.iconButton}>
        <MaterialCommunityIcons color="#141820" name="cog-outline" size={25} />
      </ScalePressable>
    </View>
  );
}
