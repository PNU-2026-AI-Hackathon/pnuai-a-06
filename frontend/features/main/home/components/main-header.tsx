// main 홈의 로고와 프로필 진입 영역을 담당합니다.
import { Image } from 'expo-image';
import { View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';

import { ProfileAvatar } from '@/components/profile-avatar';

import { styles } from '../styles';

const splashText = require('@/assets/svg/logo_text.svg');

type MainHeaderProps = {
  onOpenProfile: () => void;
  profileEmoji: string | null;
  profileImageUrl: string | null;
  topInset: number;
};

export function MainHeader({ onOpenProfile, profileEmoji, profileImageUrl, topInset }: MainHeaderProps) {
  const profileTarget = useTutorialTarget('profile-header', { offsetY: 27 });

  return (
    <View style={[styles.header, { paddingTop: topInset }]}>
      <View style={styles.logoButton}>
        <Image source={splashText} style={styles.logoText} contentFit="contain" />
      </View>
      <Pressable
        accessibilityLabel="프로필"
        onLayout={profileTarget.onLayout}
        onPress={onOpenProfile}
        ref={profileTarget.ref}
        style={styles.profileButton}>
        <ProfileAvatar profileImageUrl={profileImageUrl} profileEmoji={profileEmoji} size={56} />
      </Pressable>
    </View>
  );
}
