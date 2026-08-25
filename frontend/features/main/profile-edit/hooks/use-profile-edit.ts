// 프로필 조회·수정과 이미지 선택 상태 및 저장 로직을 관리합니다.
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated } from 'react-native';

import { prefetchProfileIcons, profileIconOptions, type ProfileIconKey } from '@/components/profile-avatar';
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

type UseProfileEditOptions = {
  onSaved: () => void;
};

export function useProfileEdit({ onSaved }: UseProfileEditOptions) {
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

    void prefetchProfileIcons();

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
    Animated.timing(sheetProgress, { duration: 240, toValue: 1, useNativeDriver: true }).start();
  };

  const closeProfileSheet = () => {
    Animated.timing(sheetProgress, { duration: 180, toValue: 0, useNativeDriver: true }).start(({ finished }) => {
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
      onSaved();
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
      onSaved();
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

  const sheetTranslateY = sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });
  const overlayOpacity = sheetProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });

  return {
    canSave,
    canSaveProfile,
    closeProfileSheet,
    displayNickname,
    handleSave,
    handleSaveProfileIcon,
    isLoading,
    isProfileSheetVisible,
    isSaving,
    isSavingProfile,
    message,
    nickname,
    onClearPendingProfile: () => {
      setPendingProfileEmoji(null);
      setPendingProfileImageUrl(null);
    },
    onSelectProfileEmoji: (nextEmoji: ProfileIconKey) => {
      setPendingProfileEmoji(nextEmoji);
      setPendingProfileImageUrl(null);
    },
    openImageSourcePicker,
    openProfileSheet,
    overlayOpacity,
    pendingProfileEmoji,
    pendingProfileImageUrl,
    profileEmoji,
    profileIconOptions,
    profileImageUrl,
    setNickname,
    setMessage,
    sheetMessage,
    sheetTranslateY,
  };
}
