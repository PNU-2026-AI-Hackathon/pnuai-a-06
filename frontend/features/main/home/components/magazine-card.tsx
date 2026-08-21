// 완료된 여행 사진으로 매거진 카드를 보여주는 화면입니다.
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { ClipPath, Defs, Ellipse, Image as SvgImage, Svg } from 'react-native-svg';

import { styles } from '../styles';

const magazineTitle = require('@/assets/svg/magazine/JUST THE TWO OF US.svg');
const magazineNumber = require('@/assets/svg/magazine/No.05.svg');
const singleMagazineTitle = require('@/assets/svg/magazine/THE Starry Night.svg');
const singleMagazineNumber = require('@/assets/svg/magazine/No.02.svg');
const magazineBlackEllipse = require('@/assets/svg/magazine/black_ellipse.svg');

type MagazineCardProps = {
  isLoading: boolean;
  onPress: () => void;
  photoUrls: string[];
  scheduleId: string | null;
};

export function MagazineCard({ isLoading, onPress, photoUrls, scheduleId }: MagazineCardProps) {
  const isSingleMagazine = photoUrls.length === 1;
  const magazinePhotoSlots = [0, 1, 2].map((index) => photoUrls[index] ?? null);

  return (
    <Pressable
      disabled={isLoading || !scheduleId}
      onPress={onPress}
      style={[styles.magazineCard, isSingleMagazine && styles.singleMagazineFrame]}>
      {isSingleMagazine ? (
        <View style={styles.singleMagazineInner}>
          <Image source={singleMagazineTitle} style={styles.singleMagazineTitle} contentFit="contain" />
          <Svg height="100%" style={styles.singleMagazinePhoto} viewBox="0 0 100 100" width="100%">
            <Defs>
              <ClipPath id="singleMagazinePhotoClip">
                <Ellipse cx="50" cy="51" rx="34" ry="52" transform="rotate(28 50 51)" />
              </ClipPath>
            </Defs>
            <SvgImage
              clipPath="url(#singleMagazinePhotoClip)"
              height="100"
              href={{ uri: photoUrls[0] }}
              preserveAspectRatio="xMidYMid slice"
              width="100"
              x="0"
              y="0"
            />
          </Svg>
          <Image source={magazineBlackEllipse} style={styles.singleMagazineDotTop} />
          <Image source={magazineBlackEllipse} style={styles.singleMagazineDotBottom} />
          <Image source={{ uri: photoUrls[0] }} style={styles.singleMagazinePhotoBubble} contentFit="cover" />
          <Image source={singleMagazineNumber} style={styles.singleMagazineNumber} contentFit="contain" />
        </View>
      ) : (
        <>
          <View style={styles.magazineCopy}>
            <Image source={magazineTitle} style={styles.magazineTitle} contentFit="contain" />
            <Image source={magazineNumber} style={styles.magazineNumber} contentFit="contain" />
          </View>
          <View style={styles.magazinePhotos}>
            {magazinePhotoSlots.map((photoUrl, index) => photoUrl ? (
              <Image key={`${photoUrl}-${index}`} source={{ uri: photoUrl }} style={styles.magazinePhoto} contentFit="cover" />
            ) : (
              <View key={`magazine-photo-placeholder-${index}`} style={styles.magazinePhotoPlaceholder} />
            ))}
          </View>
        </>
      )}
    </Pressable>
  );
}
