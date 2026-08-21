// 프로필 헤더·언어 설정·메뉴를 조립하는 화면 컴포넌트입니다.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { useLanguage } from '@/hooks/use-language';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

import { ProfileHeader } from './components/profile-header';
import { ProfileLanguageModal } from './components/profile-language-modal';
import { ProfileMenu } from './components/profile-menu';
import { useProfileScreen } from './hooks/use-profile-screen';
import { styles } from './styles';

export default function ProfileScreen() {
  const { contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const { language, setLanguage } = useLanguage();
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const profile = useProfileScreen({ onSignedOut: () => router.replace('/login') });

  const handleSelectLanguage = async (nextLanguage: typeof language) => {
    setIsSavingLanguage(true);
    try {
      await setLanguage(nextLanguage);
      setIsLanguageModalVisible(false);
    } finally {
      setIsSavingLanguage(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      key={language}
      showsVerticalScrollIndicator={false}
      style={styles.container}>
      <ProfileHeader
        contentMaxWidth={contentMaxWidth}
        horizontalPadding={horizontalPadding}
        nickname={profile.nickname}
        onBack={() => router.back()}
        onEdit={() => router.push('/main/profile-edit')}
        onOpenSettings={() => setIsLanguageModalVisible(true)}
        profileEmoji={profile.profileEmoji}
        profileImageUrl={profile.profileImageUrl}
        topInset={topInset}
      />

      <ProfileLanguageModal
        isSavingLanguage={isSavingLanguage}
        language={language}
        onClose={() => setIsLanguageModalVisible(false)}
        onSelectLanguage={handleSelectLanguage}
        visible={isLanguageModalVisible}
      />

      <ProfileMenu
        contentMaxWidth={contentMaxWidth}
        horizontalPadding={horizontalPadding}
        isAccountActionInProgress={profile.isAccountActionInProgress}
        onDeleteAccount={profile.handleDeleteAccount}
        onLogout={profile.handleLogout}
        onPasswordReset={() => router.push({ pathname: '/login', params: { mode: 'reset' } })}
      />
    </ScrollView>
  );
}
