// 프로필 이미지와 닉네임을 수정하는 입력 영역입니다.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';

import { styles } from '../styles';

type ProfileEditFormProps = {
  isLoading: boolean;
  isSaving: boolean;
  message: string;
  nickname: string;
  onClearNickname: () => void;
  onChangeNickname: (value: string) => void;
  onOpenProfileSheet: () => void;
  profileEmoji: string | null;
  profileImageUrl: string | null;
};

export function ProfileEditForm({
  isLoading,
  isSaving,
  message,
  nickname,
  onClearNickname,
  onChangeNickname,
  onOpenProfileSheet,
  profileEmoji,
  profileImageUrl,
}: ProfileEditFormProps) {
  return (
    <View style={styles.content}>
      <View style={styles.avatarArea}>
        <Pressable accessibilityRole="button" accessibilityLabel="프로필 사진 변경" onPress={onOpenProfileSheet} style={styles.avatarButton}>
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
            onChangeText={onChangeNickname}
            placeholder="닉네임"
            placeholderTextColor="#C8C8C8"
            style={styles.input}
            value={nickname}
          />
          {nickname ? (
            <ScalePressable accessibilityLabel="닉네임 지우기" onPress={onClearNickname} pressedScale={0.9} style={styles.clearButton}>
              <MaterialCommunityIcons color="#C8C8C8" name="close" size={26} />
            </ScalePressable>
          ) : null}
        </View>
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>
    </View>
  );
}
