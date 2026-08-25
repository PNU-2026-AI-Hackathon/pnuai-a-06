// main 홈의 로고와 프로필 진입 영역을 담당합니다.
import { Image } from 'expo-image';
import { View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { useTutorialTarget } from '@/components/tutorial-provider';

import { ProfileAvatar } from '@/components/profile-avatar';

import { styles } from '../styles';

const splashText = require('@/assets/svg/logo_text.svg');

type MainHeaderProps = {
  onOpenLogin: () => void;
  onOpenProfile: () => void;
  profileEmoji: string | null;
  profileImageUrl: string | null;
  topInset: number;
};

export function MainHeader({ onOpenLogin, onOpenProfile, profileEmoji, profileImageUrl, topInset }: MainHeaderProps) {
  const profileTarget = useTutorialTarget('profile-header', { offsetY: 27 });

  return (
    <View style={[styles.header, { paddingTop: topInset }]}>
      <Pressable
        accessibilityLabel="찌그까 로그인 화면으로 이동"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenLogin}
        style={styles.logoButton}>
        <Image source={splashText} style={styles.logoText} contentFit="contain" />
      </Pressable>
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
