import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { prefetchProfileIcons, ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { clearAuthSession, deleteCurrentAccount, fetchMe } from '@/lib/auth-api';
import { translateText, type AppLanguage } from '@/lib/language';

type MenuItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
};

const menuItems: MenuItem[] = [
  { icon: 'account-circle-outline', label: '카카오 계정' },
  { icon: 'lock-outline', label: '개인정보 / 보안' },
  { icon: 'bell-outline', label: '알림' },
];

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${translateText(title)}\n\n${translateText(message)}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: '확인', style: 'destructive', onPress: onConfirm },
  ]);
}

function showActionError(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${translateText(title)}\n\n${translateText(message)}`);
    }
    return;
  }

  Alert.alert(title, message);
}

export default function ProfileScreen() {
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const { language, setLanguage } = useLanguage();
  const [nickname, setNickname] = useState('사용자');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [isAccountActionInProgress, setIsAccountActionInProgress] = useState(false);

  const handleLogout = () => {
    confirmAction('로그아웃', '현재 기기에서 로그아웃할까요?', () => {
      void (async () => {
        setIsAccountActionInProgress(true);
        try {
          await clearAuthSession();
          router.replace('/login');
        } finally {
          setIsAccountActionInProgress(false);
        }
      })();
    });
  };

  const handleDeleteAccount = () => {
    confirmAction('계정 탈퇴', '계정을 탈퇴하면 프로필과 서비스 이용 정보가 삭제됩니다. 계속할까요?', () => {
      void (async () => {
        setIsAccountActionInProgress(true);
        try {
          await deleteCurrentAccount();
          router.replace('/login');
        } catch (error) {
          showActionError('탈퇴 실패', error instanceof Error ? error.message : '계정 탈퇴에 실패했습니다.');
        } finally {
          setIsAccountActionInProgress(false);
        }
      })();
    });
  };

  useEffect(() => {
    void prefetchProfileIcons();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      fetchMe()
        .then((user) => {
          if (isActive) {
            setNickname(user.nickname?.trim() || '사용자');
            setProfileImageUrl(user.profile_image_url);
            setProfileEmoji(user.profile_emoji);
          }
        })
        .catch(() => {
          if (isActive) {
            setNickname('사용자');
            setProfileImageUrl(null);
            setProfileEmoji(null);
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      key={language}
      showsVerticalScrollIndicator={false}
      style={styles.container}>
      <View
        style={[
          styles.profileSection,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: topInset,
          },
        ]}>
        <View style={[styles.header, { maxWidth: contentMaxWidth }]}>
          <ScalePressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} pressedScale={0.86} style={styles.iconButton}>
            <MaterialCommunityIcons color="#141820" name="chevron-left" size={36} />
          </ScalePressable>
          <Text style={styles.headerTitle}>프로필 편집</Text>
          <ScalePressable accessibilityLabel="설정" onPress={() => setIsLanguageModalVisible(true)} pressedScale={0.9} style={styles.iconButton}>
            <MaterialCommunityIcons color="#141820" name="cog-outline" size={25} />
          </ScalePressable>
        </View>

        <View style={styles.profileInfo}>
          <Pressable accessibilityRole="button" accessibilityLabel="프로필 편집" onPress={() => router.push('/main/profile-edit')} style={styles.avatarButton}>
            <ProfileAvatar profileImageUrl={profileImageUrl} profileEmoji={profileEmoji} />
            <View style={styles.editBadge}>
              <MaterialCommunityIcons color="#4E5259" name="pencil" size={20} />
            </View>
          </Pressable>
          <Text style={styles.username}>{nickname}</Text>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsLanguageModalVisible(false)}
        transparent
        visible={isLanguageModalVisible}>
        <Pressable onPress={() => setIsLanguageModalVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.languageModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>언어 설정</Text>
              <Pressable accessibilityLabel="언어 설정 닫기" onPress={() => setIsLanguageModalVisible(false)} style={styles.modalCloseButton}>
                <MaterialCommunityIcons color="#4E5259" name="close" size={24} />
              </Pressable>
            </View>
            <Text style={styles.modalDescription}>매거진 생성 및 조회에 사용할 언어를 선택해주세요.</Text>
            {([
              { key: 'ko', label: '한국어' },
              { key: 'en', label: 'English' },
            ] as { key: AppLanguage; label: string }[]).map((option) => {
              const isSelected = language === option.key;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: isSavingLanguage }}
                  disabled={isSavingLanguage}
                  key={option.key}
                  onPress={async () => {
                    if (isSelected) {
                      setIsLanguageModalVisible(false);
                      return;
                    }

                    setIsSavingLanguage(true);
                    try {
                      await setLanguage(option.key);
                      setIsLanguageModalVisible(false);
                    } finally {
                      setIsSavingLanguage(false);
                    }
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

      <View
        style={[
          styles.menuSection,
          {
            paddingBottom: 30,
            paddingHorizontal: horizontalPadding,
          },
        ]}>
        <View style={[styles.menuCard, { maxWidth: contentMaxWidth }]}>
          {menuItems.map((item) => (
            <ScalePressable accessibilityRole="button" disabled={isAccountActionInProgress} key={item.label} onPress={() => {}} pressedScale={0.98} style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <MaterialCommunityIcons color="#10161F" name={item.icon} size={25} />
                <Text style={styles.menuText}>{item.label}</Text>
              </View>
              <MaterialCommunityIcons color="#10161F" name="chevron-right" size={30} />
            </ScalePressable>
          ))}
          <View style={styles.menuDivider} />
          <ScalePressable
            accessibilityRole="button"
            disabled={isAccountActionInProgress}
            onPress={handleLogout}
            pressedScale={0.98}
            style={styles.menuRow}>
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons color="#10161F" name="logout-variant" size={25} />
              <Text style={styles.menuText}>로그아웃</Text>
            </View>
            <MaterialCommunityIcons color="#10161F" name="chevron-right" size={30} />
          </ScalePressable>
          <ScalePressable
            accessibilityRole="button"
            disabled={isAccountActionInProgress}
            onPress={handleDeleteAccount}
            pressedScale={0.98}
            style={styles.menuRow}>
            <View style={styles.menuLeft}>
              <MaterialCommunityIcons color="#C74444" name="account-remove-outline" size={25} />
              <Text style={styles.deleteAccountText}>계정 탈퇴</Text>
            </View>
            <MaterialCommunityIcons color="#C74444" name="chevron-right" size={30} />
          </ScalePressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F2F8FB',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minHeight: 368,
  },
  header: {
    alignItems: 'center',
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
  profileInfo: {
    alignItems: 'center',
    marginTop: 65,
  },
  avatarButton: {
    height: 110,
    position: 'relative',
    width: 110,
  },
  avatar: {
    backgroundColor: '#EFEFEF',
    borderRadius: 55,
    height: 110,
    left: 0,
    position: 'absolute',
    top: 0,
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
  username: {
    color: '#10161F',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 15,
  },
  menuSection: {
    alignItems: 'center',
    paddingTop: 27,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 34,
    paddingVertical: 20,
    width: '100%',
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 75,
    justifyContent: 'space-between',
  },
  menuLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  menuText: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
  menuDivider: {
    backgroundColor: '#E7ECEE',
    height: 1,
    marginVertical: 8,
  },
  deleteAccountText: {
    color: '#C74444',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 22, 31, 0.38)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  languageModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#10161F',
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalDescription: {
    color: '#6E767B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  languageOption: {
    alignItems: 'center',
    borderColor: '#E2E7E9',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  selectedLanguageOption: {
    backgroundColor: '#F0FAFC',
    borderColor: '#409CB7',
  },
  languageOptionText: {
    color: '#252B30',
    fontSize: 16,
    fontWeight: '500',
  },
  selectedLanguageOptionText: {
    color: '#287D95',
    fontWeight: '700',
  },
});
