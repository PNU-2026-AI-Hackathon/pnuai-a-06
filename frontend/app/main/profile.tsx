import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMe } from '@/lib/auth-api';

type MenuItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
};

const menuItems: MenuItem[] = [
  { icon: 'account-circle-outline', label: '카카오 계정' },
  { icon: 'lock-outline', label: '개인정보 / 보안' },
  { icon: 'bell-outline', label: '알림' },
];

export default function ProfileScreen() {
  const { bottomActionInset, contentMaxWidth, horizontalPadding, topInset } = useResponsiveLayout();
  const [nickname, setNickname] = useState('사용자');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null);

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
    <View style={styles.container}>
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
          <ScalePressable accessibilityLabel="설정" onPress={() => {}} pressedScale={0.9} style={styles.iconButton}>
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

      <View
        style={[
          styles.menuSection,
          {
            paddingBottom: bottomActionInset,
            paddingHorizontal: horizontalPadding,
          },
        ]}>
        <View style={[styles.menuCard, { maxWidth: contentMaxWidth }]}>
          {menuItems.map((item) => (
            <ScalePressable accessibilityRole="button" key={item.label} onPress={() => {}} pressedScale={0.98} style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <MaterialCommunityIcons color="#10161F" name={item.icon} size={25} />
                <Text style={styles.menuText}>{item.label}</Text>
              </View>
              <MaterialCommunityIcons color="#10161F" name="chevron-right" size={30} />
            </ScalePressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F2F8FB',
    flex: 1,
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
    flex: 1,
    paddingTop: 27,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    minHeight: 530,
    paddingHorizontal: 34,
    paddingTop: 20,
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
});
