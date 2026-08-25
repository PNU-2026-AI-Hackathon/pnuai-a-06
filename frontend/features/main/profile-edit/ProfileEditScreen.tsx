// 프로필 편집 화면을 조립하는 화면 컴포넌트입니다.
import { router } from 'expo-router';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import { ProfileEditForm } from './components/profile-edit-form';
import { ProfileEditHeader } from './components/profile-edit-header';
import { ProfileImageSheet } from './components/profile-image-sheet';
import { useProfileEdit } from './hooks/use-profile-edit';
import { styles } from './styles';

export default function ProfileEditScreen() {
  const { language } = useLanguage();
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const profile = useProfileEdit({ onSaved: () => router.back() });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} key={language} style={styles.keyboardView}>
      <View
        style={[
          styles.container,
          {
            paddingBottom: bottomActionInset - 48,
            paddingHorizontal: horizontalPadding,
            paddingTop: topInset,
          },
        ]}>
        <ProfileEditHeader contentMaxWidth={contentMaxWidth} onBack={() => router.back()} />

        <ProfileEditForm
          isLoading={profile.isLoading}
          isSaving={profile.isSaving}
          message={profile.message}
          nickname={profile.nickname}
          onChangeNickname={(value) => {
            profile.setNickname(value);
            profile.setMessage('');
          }}
          onClearNickname={() => profile.setNickname('')}
          onOpenProfileSheet={profile.openProfileSheet}
          profileEmoji={profile.profileEmoji}
          profileImageUrl={profile.profileImageUrl}
        />

        <ScalePressable
          accessibilityRole="button"
          disabled={!profile.canSave}
          onPress={profile.handleSave}
          pressedScale={0.98}
          style={[styles.saveButton, !profile.canSave && styles.saveButtonDisabled]}>
          {profile.isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>저장하기</Text>}
        </ScalePressable>
      </View>

      <ProfileImageSheet
        bottomActionInset={bottomActionInset}
        canSaveProfile={profile.canSaveProfile}
        displayNickname={profile.displayNickname}
        isSavingProfile={profile.isSavingProfile}
        onClearPendingProfile={profile.onClearPendingProfile}
        onClose={profile.closeProfileSheet}
        onOpenImageSourcePicker={profile.openImageSourcePicker}
        onSaveProfileIcon={profile.handleSaveProfileIcon}
        onSelectProfileEmoji={profile.onSelectProfileEmoji}
        overlayOpacity={profile.overlayOpacity}
        pendingProfileEmoji={profile.pendingProfileEmoji}
        pendingProfileImageUrl={profile.pendingProfileImageUrl}
        profileIconOptions={profile.profileIconOptions}
        sheetMessage={profile.sheetMessage}
        sheetTranslateY={profile.sheetTranslateY}
        visible={profile.isProfileSheetVisible}
      />
    </KeyboardAvoidingView>
  );
}
