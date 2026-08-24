// 프로필 화면의 헤더와 사용자 아바타 영역을 담당합니다.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';

import { styles } from '../styles';

type ProfileHeaderProps = {
  contentMaxWidth: number;
  horizontalPadding: number;
  nickname: string;
  onBack: () => void;
  onEdit: () => void;
  onOpenSettings: () => void;
  profileEmoji: string | null;
  profileImageUrl: string | null;
  topInset: number;
};

export function ProfileHeader({
  contentMaxWidth,
  horizontalPadding,
  nickname,
  onBack,
  onEdit,
  onOpenSettings,
  profileEmoji,
  profileImageUrl,
  topInset,
}: ProfileHeaderProps) {
  return (
    <View style={[styles.profileSection, { paddingHorizontal: horizontalPadding, paddingTop: topInset }]}>
      <View style={[styles.header, { maxWidth: contentMaxWidth }]}>
        <ScalePressable accessibilityLabel="뒤로 가기" onPress={onBack} pressedScale={0.86} style={styles.iconButton}>
          <MaterialCommunityIcons color="#141820" name="chevron-left" size={36} />
        </ScalePressable>
        <Text style={styles.headerTitle}>프로필 편집</Text>
        <ScalePressable accessibilityLabel="설정" onPress={onOpenSettings} pressedScale={0.9} style={styles.iconButton}>
          <MaterialCommunityIcons color="#141820" name="cog-outline" size={25} />
        </ScalePressable>
      </View>

      <View style={styles.profileInfo}>
        <Pressable accessibilityRole="button" accessibilityLabel="프로필 편집" onPress={onEdit} style={styles.avatarButton}>
          <ProfileAvatar profileImageUrl={profileImageUrl} profileEmoji={profileEmoji} />
          <View style={styles.editBadge}>
            <MaterialCommunityIcons color="#4E5259" name="pencil" size={20} />
          </View>
        </Pressable>
        <Text style={styles.username}>{nickname}</Text>
      </View>
    </View>
  );
}
