import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BOTTOM_NAVIGATION_RESERVED_HEIGHT } from '@/components/bottom-navigation-bar';
import { ProfileAvatar, profileIconOptions, type ProfileIconKey } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMe, updateMe, updateProfileEmoji, uploadProfileImage } from '@/lib/auth-api';

const FALLBACK_NICKNAME = '사용자';
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '요청 처리에 실패했습니다.';
}

export default function ProfileEditScreen() {
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const [initialNickname, setInitialNickname] = useState('');
  const [nickname, setNickname] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null);
  const [pendingProfileEmoji, setPendingProfileEmoji] = useState<ProfileIconKey | null>(null);
  const [pendingProfileImageUrl, setPendingProfileImageUrl] = useState<string | null>(null);
  const [isProfileSheetVisible, setIsProfileSheetVisible] = useState(false);
  const [hasSavedProfileChange, setHasSavedProfileChange] = useState(false);
  const [message, setMessage] = useState('');
  const [sheetMessage, setSheetMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchMe()
      .then((user) => {
        if (!isMounted) {
          return;
        }

        const nextNickname = user.nickname?.trim() || FALLBACK_NICKNAME;
        setInitialNickname(nextNickname);
        setNickname(nextNickname);
        setProfileImageUrl(user.profile_image_url);
        setProfileEmoji(user.profile_emoji);
      })
      .catch((error) => {
        if (isMounted) {
          setMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const trimmedNickname = nickname.trim();
  const displayNickname = trimmedNickname || initialNickname || FALLBACK_NICKNAME;
  const hasNicknameChange = trimmedNickname !== initialNickname;
  const canSave = trimmedNickname.length > 0 && (hasNicknameChange || hasSavedProfileChange) && !isSaving;
  const canSaveProfile = Boolean(pendingProfileEmoji) && pendingProfileEmoji !== profileEmoji && !isSavingProfile;

  const openProfileSheet = () => {
    setSheetMessage('');
    setPendingProfileEmoji(profileIconOptions.some((option) => option.key === profileEmoji) ? (profileEmoji as ProfileIconKey) : null);
    setPendingProfileImageUrl(profileImageUrl);
    setIsProfileSheetVisible(true);
    sheetProgress.setValue(0);
    Animated.timing(sheetProgress, {
      duration: 240,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const closeProfileSheet = () => {
    Animated.timing(sheetProgress, {
      duration: 180,
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsProfileSheetVisible(false);
      }
    });
  };

  const handleSave = async () => {
    if (!trimmedNickname) {
      setMessage('닉네임을 입력해주세요.');
      return;
    }

    if (!hasNicknameChange) {
      router.back();
      return;
    }

    try {
      setIsSaving(true);
      setMessage('');
      const updatedUser = await updateMe(trimmedNickname);
      const nextNickname = updatedUser.nickname?.trim() || trimmedNickname;
      setInitialNickname(nextNickname);
      setNickname(nextNickname);
      setProfileImageUrl(updatedUser.profile_image_url);
      setProfileEmoji(updatedUser.profile_emoji);
      router.back();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfileIcon = async () => {
    if (!pendingProfileEmoji) {
      setSheetMessage('프로필 이미지를 골라주세요.');
      return;
    }

    try {
      setIsSavingProfile(true);
      setSheetMessage('');
      const updatedUser = await updateProfileEmoji(pendingProfileEmoji);
      setProfileImageUrl(updatedUser.profile_image_url);
      setProfileEmoji(updatedUser.profile_emoji);
      setPendingProfileImageUrl(updatedUser.profile_image_url);
      setHasSavedProfileChange(true);
      closeProfileSheet();
    } catch (error) {
      setSheetMessage(getErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const uploadPickedImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.fileSize && asset.fileSize > MAX_PROFILE_IMAGE_BYTES) {
      setSheetMessage('프로필 사진은 5MB 이하만 업로드할 수 있어요.');
      return;
    }

    const fileName = asset.fileName || `profile-${Date.now()}.jpg`;
    const mimeType = asset.mimeType || 'image/jpeg';

    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(mimeType)) {
      setSheetMessage('JPEG, PNG, WebP 이미지만 업로드할 수 있어요.');
      return;
    }

    try {
      setIsSavingProfile(true);
      setSheetMessage('');
      const updatedUser = await uploadProfileImage({ name: fileName, type: mimeType, uri: asset.uri });
      setProfileImageUrl(updatedUser.profile_image_url);
      setProfileEmoji(updatedUser.profile_emoji);
      setPendingProfileEmoji(null);
      setPendingProfileImageUrl(updatedUser.profile_image_url);
      setHasSavedProfileChange(true);
      closeProfileSheet();
    } catch (error) {
      setSheetMessage(getErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const pickImageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setSheetMessage('앨범 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (!result.canceled) {
      await uploadPickedImage(result.assets[0]);
    }
  };

  const takeImageWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      setSheetMessage('카메라 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (!result.canceled) {
      await uploadPickedImage(result.assets[0]);
    }
  };

  const openImageSourcePicker = () => {
    setSheetMessage('');
    Alert.alert('프로필 사진', '사진을 가져올 방법을 선택해주세요.', [
      { text: '앨범에서 선택', onPress: pickImageFromLibrary },
      { text: '카메라 촬영', onPress: takeImageWithCamera },
      { style: 'cancel', text: '취소' },
    ]);
  };

  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  const overlayOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.22],
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
      <View
        style={[
          styles.container,
          {
            paddingBottom: bottomActionInset - 48,
            paddingHorizontal: horizontalPadding,
            paddingTop: topInset,
          },
        ]}>
        <View style={[styles.header, { maxWidth: contentMaxWidth }]}>
          <ScalePressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} pressedScale={0.86} style={styles.iconButton}>
            <MaterialCommunityIcons color="#141820" name="chevron-left" size={36} />
          </ScalePressable>
          <Text style={styles.headerTitle}>프로필 편집</Text>
          <ScalePressable accessibilityLabel="설정" onPress={() => {}} pressedScale={0.9} style={styles.iconButton}>
            <MaterialCommunityIcons color="#141820" name="cog-outline" size={25} />
          </ScalePressable>
        </View>

        <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
          <View style={styles.avatarArea}>
            <Pressable accessibilityRole="button" accessibilityLabel="프로필 사진 변경" onPress={openProfileSheet} style={styles.avatarButton}>
              <ProfileAvatar profileImageUrl={profileImageUrl} profileEmoji={profileEmoji} />
              <View style={styles.editBadge}>
                <MaterialCommunityIcons color="#4E5259" name="pencil" size={20} />
              </View>
            </Pressable>
          </View>

          <View style={styles.formArea}>
            <Text style={styles.label}>닉네임</Text>
            <View style={styles.inputRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading && !isSaving}
                onChangeText={(value) => {
                  setNickname(value);
                  setMessage('');
                }}
                placeholder="닉네임"
                placeholderTextColor="#C8C8C8"
                style={styles.input}
                value={nickname}
              />
              {nickname ? (
                <ScalePressable accessibilityLabel="닉네임 지우기" onPress={() => setNickname('')} pressedScale={0.9} style={styles.clearButton}>
                  <MaterialCommunityIcons color="#C8C8C8" name="close" size={26} />
                </ScalePressable>
              ) : null}
            </View>
            {message ? <Text style={styles.messageText}>{message}</Text> : null}
          </View>
        </View>

        <ScalePressable
          accessibilityRole="button"
          disabled={!canSave}
          onPress={handleSave}
          pressedScale={0.98}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}>
          {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>저장하기</Text>}
        </ScalePressable>
      </View>

      <Modal animationType="none" transparent visible={isProfileSheetVisible} onRequestClose={closeProfileSheet}>
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]} />
          <Pressable accessibilityLabel="프로필 이미지 선택 닫기" onPress={closeProfileSheet} style={styles.modalBackdrop} />
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
              <Pressable accessibilityRole="button" accessibilityLabel="앨범 또는 카메라에서 프로필 사진 선택" onPress={openImageSourcePicker} style={styles.futureImageOption}>
                {isSavingProfile ? <ActivityIndicator color="#4E5259" /> : <MaterialCommunityIcons color="#4E5259" name="image" size={28} />}
              </Pressable>
              {profileIconOptions.map((option) => {
                const isSelected = pendingProfileEmoji === option.key;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${option.key} 프로필 이미지 선택`}
                    key={option.key}
                    onPress={() => {
                      setPendingProfileEmoji(option.key);
                      setPendingProfileImageUrl(null);
                    }}
                    style={[styles.profileOptionButton, isSelected && styles.profileOptionSelected]}>
                    <Image source={option.source} style={styles.profileOptionImage} contentFit="cover" />
                  </Pressable>
                );
              })}
            </View>
            {sheetMessage ? <Text style={styles.sheetMessageText}>{sheetMessage}</Text> : null}
            <View style={styles.sheetActionRow}>
              <ScalePressable onPress={() => {
                  setPendingProfileEmoji(null);
                  setPendingProfileImageUrl(null);
                }} pressedScale={0.98} style={styles.sheetDeleteButton}>
                <Text style={styles.sheetDeleteText}>지우기</Text>
              </ScalePressable>
              <ScalePressable
                disabled={!canSaveProfile}
                onPress={handleSaveProfileIcon}
                pressedScale={0.98}
                style={[styles.sheetSaveButton, !canSaveProfile && styles.sheetSaveButtonDisabled]}>
                {isSavingProfile ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.sheetSaveText}>저장하기</Text>}
              </ScalePressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    width: '100%',
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    width: '100%',
  },
  avatarArea: {
    alignItems: 'center',
    paddingTop: 66,
  },
  avatarButton: {
    height: 110,
    position: 'relative',
    width: 110,
  },
  editBadge: {
    alignItems: 'center',
    backgroundColor: '#CECECE',
    borderRadius: 999,
    bottom: 5,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 30,
  },
  formArea: {
    marginTop: 64,
  },
  label: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
  inputRow: {
    alignItems: 'center',
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
  },
  input: {
    color: '#10161F',
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0,
    minHeight: 56,
    padding: 0,
  },
  clearButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  messageText: {
    color: '#D35B4F',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  saveButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#6EA6BF',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 65,
    width: '100%',
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  profileSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  sheetTitle: {
    color: '#10161F',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 27,
  },
  sheetPreviewWrap: {
    alignItems: 'center',
    marginTop: 42,
  },
  profileOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 20,
  },
  futureImageOption: {
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  profileOptionButton: {
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 3,
    height: 58,
    overflow: 'hidden',
    width: 58,
  },
  profileOptionSelected: {
    borderColor: '#6EA6BF',
  },
  profileOptionImage: {
    height: '100%',
    width: '100%',
  },
  sheetMessageText: {
    color: '#D35B4F',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
    textAlign: 'center',
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 18,
  },
  sheetDeleteButton: {
    alignItems: 'center',
    backgroundColor: '#C9E4EE',
    borderRadius: 18,
    flex: 1,
    height: 58,
    justifyContent: 'center',
  },
  sheetDeleteText: {
    color: '#409CB7',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
  sheetSaveButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 18,
    flex: 1,
    height: 58,
    justifyContent: 'center',
  },
  sheetSaveButtonDisabled: {
    opacity: 0.55,
  },
  sheetSaveText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
});
