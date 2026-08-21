import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { getProfileImageUrl } from '@/lib/auth-api';

export type ProfileIconKey = 'people1' | 'people2' | 'people3' | 'people4' | 'people5' | 'people6';

export type ProfileIconOption = {
  key: ProfileIconKey;
  source: ImageSource;
};

export const profileIconOptions: ProfileIconOption[] = [
  { key: 'people1', source: require('../assets/svg/profile_icon/people1.svg') },
  { key: 'people2', source: require('../assets/svg/profile_icon/people2.svg') },
  { key: 'people3', source: require('../assets/svg/profile_icon/people3.svg') },
  { key: 'people4', source: require('../assets/svg/profile_icon/people4.svg') },
  { key: 'people5', source: require('../assets/svg/profile_icon/people5.svg') },
  { key: 'people6', source: require('../assets/svg/profile_icon/people6.svg') },
];

let profileIconPrefetchPromise: Promise<void> | null = null;

export function prefetchProfileIcons() {
  if (!profileIconPrefetchPromise) {
    profileIconPrefetchPromise = Promise.all(
      profileIconOptions.map((option) => Image.loadAsync(option.source).catch(() => null)),
    ).then(() => undefined);
  }

  return profileIconPrefetchPromise;
}

const profileIconSourceByKey = new Map(profileIconOptions.map((option) => [option.key, option.source]));

type ProfileAvatarProps = {
  profileEmoji?: string | null;
  profileImageUrl?: string | null;
  size?: number;
};

export function isProfileIconKey(value: string | null | undefined): value is ProfileIconKey {
  return Boolean(value && profileIconSourceByKey.has(value as ProfileIconKey));
}

export function ProfileAvatar({ profileEmoji, profileImageUrl, size = 110 }: ProfileAvatarProps) {
  const iconSource = isProfileIconKey(profileEmoji) ? profileIconSourceByKey.get(profileEmoji) : null;
  const imageUrl = getProfileImageUrl(profileImageUrl);
  const borderRadius = size / 2;

  return (
    <View style={[styles.avatar, { borderRadius, height: size, width: size }]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.fill} contentFit="cover" /> : null}
      {!imageUrl && iconSource ? <Image source={iconSource} style={styles.fill} contentFit="cover" /> : null}
      {!imageUrl && !iconSource && profileEmoji ? <Text style={[styles.emoji, { fontSize: size * 0.5 }]}>{profileEmoji}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: {
    lineHeight: 62,
  },
  fill: {
    height: '100%',
    width: '100%',
  },
});
