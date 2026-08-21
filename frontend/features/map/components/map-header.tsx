// 지도 화면의 상단 제목과 뒤로가기 영역입니다.
import { router } from 'expo-router';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import { styles } from '../styles';

export function MapHeader() {
  return (
    <View style={styles.header}>
      <ScalePressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} pressedScale={0.86} style={styles.backButton}>
        <Text style={styles.backIcon}>‹</Text>
      </ScalePressable>
      <Text style={styles.title}>부산</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}
