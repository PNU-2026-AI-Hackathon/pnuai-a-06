import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile-avatar';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { fetchMe } from '@/lib/auth-api';

const splashText = require('../../assets/svg/logo_text.svg');

export default function MainScreen() {
  const {
    availableWidth,
    bottomActionInset,
    height,
    horizontalPadding,
    isTallScreen,
    topInset,
  } = useResponsiveLayout();
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null);
  const cardGap = 10;
  const smallCardWidth = (availableWidth - cardGap) / 2;
  const smallCardHeight = isTallScreen ? 238 : 210;
  const headerHeight = 56;
  const verticalGaps = 18 + 12;
  const availableMagazineHeight =
    height - topInset - bottomActionInset - headerHeight - smallCardHeight - verticalGaps;
  const magazineHeight = Math.max(300, Math.min(isTallScreen ? 520 : 440, availableMagazineHeight));

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      fetchMe()
        .then((user) => {
          if (isActive) {
            setProfileImageUrl(user.profile_image_url);
            setProfileEmoji(user.profile_emoji);
          }
        })
        .catch(() => {
          if (isActive) {
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
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomActionInset,
          paddingHorizontal: horizontalPadding,
        },
      ]}>
      <View style={[styles.header, { paddingTop: topInset }]}>
        <Image source={splashText} style={styles.logoText} contentFit="contain" />
        <Pressable accessibilityLabel="프로필" onPress={() => router.push('/main/profile')} style={styles.profileButton}>
          <ProfileAvatar profileImageUrl={profileImageUrl} profileEmoji={profileEmoji} size={56} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/magazine/detail')}
        style={[styles.magazineCard, { height: magazineHeight }]}>
        <Text style={styles.magazineText}>매거진 전시대</Text>
      </Pressable>

      <View style={styles.bottomGrid}>
        <Pressable
          onPress={() => router.push('/map')}
          style={[styles.smallCard, { minHeight: smallCardHeight, width: smallCardWidth }]}>
          <Text style={styles.cardTitle}>여행지 탐색</Text>
          <Text style={styles.cardSubtitle}>미션 확인하기</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/trip/hub')}
          style={[styles.smallCard, { minHeight: smallCardHeight, width: smallCardWidth }]}>
          <Text style={styles.cardTitle}>일정 관리</Text>
          <Text style={styles.cardSubtitle}>여행 시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e9f4f8',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brandText: {
    color: '#000000',
    fontSize: 14,
  },
  logoText: {
    height: 30,
    width: 86,
  },
  profileButton: {
    borderRadius: 999,
    height: 56,
    overflow: 'hidden',
    width: 56,
  },
  magazineCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    justifyContent: 'center',
    marginBottom: 12,
    width: '100%',
  },
  magazineText: {
    color: '#000000',
    fontSize: 14,
  },
  bottomGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  smallCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  cardTitle: {
    color: '#24394b',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
  },
  cardSubtitle: {
    color: '#adb3b7',
    fontSize: 14,
    marginTop: 10,
  },
});