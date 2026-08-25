// 프로필 화면의 언어 선택 모달을 담당합니다.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import type { AppLanguage } from '@/lib/language';

import { styles } from '../styles';

type ProfileLanguageModalProps = {
  isSavingLanguage: boolean;
  language: AppLanguage;
  onClose: () => void;
  onSelectLanguage: (language: AppLanguage) => Promise<void>;
  visible: boolean;
};

const languageOptions: { key: AppLanguage; label: string }[] = [
  { key: 'ko', label: '한국어' },
  { key: 'en', label: 'English' },
];

export function ProfileLanguageModal({
  isSavingLanguage,
  language,
  onClose,
  onSelectLanguage,
  visible,
}: ProfileLanguageModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.languageModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>언어 설정</Text>
            <Pressable accessibilityLabel="언어 설정 닫기" onPress={onClose} style={styles.modalCloseButton}>
              <MaterialCommunityIcons color="#4E5259" name="close" size={24} />
            </Pressable>
          </View>
          <Text style={styles.modalDescription}>매거진 생성 및 조회에 사용할 언어를 선택해주세요.</Text>
          {languageOptions.map((option) => {
            const isSelected = language === option.key;

            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected, disabled: isSavingLanguage }}
                disabled={isSavingLanguage}
                key={option.key}
                onPress={async () => {
                  if (isSelected) {
                    onClose();
                    return;
                  }

                  await onSelectLanguage(option.key);
                }}
                style={[styles.languageOption, isSelected && styles.selectedLanguageOption]}>
                <Text style={[styles.languageOptionText, isSelected && styles.selectedLanguageOptionText]}>{option.label}</Text>
                {isSelected ? <MaterialCommunityIcons color="#409CB7" name="check" size={23} /> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
