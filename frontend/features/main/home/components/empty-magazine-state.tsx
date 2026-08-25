// 완료된 여행이 없을 때 표시하는 빈 매거진 화면입니다.
import { Image } from 'expo-image';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { useTutorialTarget } from '@/components/tutorial-provider';

import { styles } from '../styles';

const emptyMagazineImage = require('@/assets/svg/main/sig_home.svg');

type EmptyMagazineStateProps = {
  centerContentOffset: number;
};

export function EmptyMagazineState({ centerContentOffset }: EmptyMagazineStateProps) {
  const magazineTarget = useTutorialTarget('magazine', { height: 370, offsetY: 57, width: 300 });

  return (
    <View style={[styles.emptyMagazineState, { transform: [{ translateY: centerContentOffset }] }]}>
      <View ref={magazineTarget.ref} onLayout={magazineTarget.onLayout} style={styles.emptyMagazineImageTarget}>
        <Image source={emptyMagazineImage} style={styles.emptyMagazineImage} contentFit="contain" />
      </View>
      <View style={styles.emptyMagazineCopy}>
        <Text style={styles.emptyMagazineTitle}>첫 번째 매거진을 기다리고 있어요</Text>
        <Text style={styles.emptyMagazineDescription}>여행을 완료하면 이곳에서 매거진을 확인할 수 있어요.</Text>
      </View>
    </View>
  );
}
