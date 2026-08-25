// 프로필 이미지 선택·업로드·삭제 시트를 담당합니다.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Animated, Modal, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import { ProfileAvatar } from '@/components/profile-avatar';
import type { ProfileIconKey } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { BOTTOM_NAVIGATION_RESERVED_HEIGHT } from '@/components/bottom-navigation-bar';

import { styles } from '../styles';

type ProfileImageSheetProps = {
  bottomActionInset: number;
  canSaveProfile: boolean;
  displayNickname: string;
  isSavingProfile: boolean;
  onClearPendingProfile: () => void;
  onClose: () => void;
  onOpenImageSourcePicker: () => void;
  onSaveProfileIcon: () => void;
  onSelectProfileEmoji: (emoji: ProfileIconKey) => void;
  overlayOpacity: Animated.AnimatedInterpolation<number>;
  pendingProfileEmoji: ProfileIconKey | null;
  pendingProfileImageUrl: string | null;
  profileIconOptions: typeof import('@/components/profile-avatar').profileIconOptions;
  sheetMessage: string;
  sheetTranslateY: Animated.AnimatedInterpolation<number>;
  visible: boolean;
};

export function ProfileImageSheet({
  bottomActionInset,
  canSaveProfile,
  displayNickname,
  isSavingProfile,
  onClearPendingProfile,
  onClose,
  onOpenImageSourcePicker,
  onSaveProfileIcon,
  onSelectProfileEmoji,
  overlayOpacity,
  pendingProfileEmoji,
  pendingProfileImageUrl,
  profileIconOptions,
  sheetMessage,
  sheetTranslateY,
  visible,
}: ProfileImageSheetProps) {
  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]} />
        <Pressable accessibilityLabel="프로필 이미지 선택 닫기" onPress={onClose} style={styles.modalBackdrop} />
        <Animated.View
          style={[
            styles.profileSheet,
            {
              marginBottom: BOTTOM_NAVIGATION_RESERVED_HEIGHT - 42,
              paddingBottom: Math.max(bottomActionInset - 20, 18),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}>
          <Text style={styles.sheetTitle}>{displayNickname}님{`\n`}프로필이미지를 골라보세요</Text>
          <View style={styles.sheetPreviewWrap}>
            <ProfileAvatar profileImageUrl={pendingProfileImageUrl} profileEmoji={pendingProfileEmoji} size={110} />
          </View>
          <View style={styles.profileOptionsGrid}>
            <Pressable accessibilityRole="button" accessibilityLabel="앨범 또는 카메라에서 프로필 사진 선택" onPress={onOpenImageSourcePicker} style={styles.futureImageOption}>
              {isSavingProfile ? <ActivityIndicator color="#4E5259" /> : <MaterialCommunityIcons color="#4E5259" name="image" size={28} />}
            </Pressable>
            {profileIconOptions.map((option) => {
              const isSelected = pendingProfileEmoji === option.key;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${option.key} 프로필 이미지 선택`}
                  key={option.key}
                  onPress={() => onSelectProfileEmoji(option.key)}
                  style={[styles.profileOptionButton, isSelected && styles.profileOptionSelected]}>
                  <Image source={option.source} style={styles.profileOptionImage} contentFit="cover" />
                </Pressable>
              );
            })}
          </View>
          {sheetMessage ? <Text style={styles.sheetMessageText}>{sheetMessage}</Text> : null}
          <View style={styles.sheetActionRow}>
            <ScalePressable onPress={onClearPendingProfile} pressedScale={0.98} style={styles.sheetDeleteButton}>
              <Text style={styles.sheetDeleteText}>지우기</Text>
            </ScalePressable>
            <ScalePressable
              disabled={!canSaveProfile}
              onPress={onSaveProfileIcon}
              pressedScale={0.98}
              style={[styles.sheetSaveButton, !canSaveProfile && styles.sheetSaveButtonDisabled]}>
              {isSavingProfile ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.sheetSaveText}>저장하기</Text>}
            </ScalePressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
