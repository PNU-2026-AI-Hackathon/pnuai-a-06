import { Image } from 'expo-image';
import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const hiddenPathnames = ['/', '/login', '/auth/callback', '/trip/capture'];

const navItems: {
  accessibilityLabel: string;
  href: Href;
  icon: number;
  match: string[];
  type: 'standard' | 'camera';
}[] = [
  {
    accessibilityLabel: '홈',
    href: '/main',
    icon: require('../assets/svg/navigation_bar/home.svg'),
    match: ['/main'],
    type: 'standard',
  },
  {
    accessibilityLabel: '미션',
    href: '/mission/detail',
    icon: require('../assets/svg/navigation_bar/mission.svg'),
    match: ['/mission/detail', '/mission/locked', '/map', '/map/district'],
    type: 'standard',
  },
  {
    accessibilityLabel: '카메라',
    href: '/trip/capture',
    icon: require('../assets/svg/navigation_bar/camera.svg'),
    match: ['/trip/capture'],
    type: 'camera',
  },
  {
    accessibilityLabel: '일정',
    href: '/trip/hub',
    icon: require('../assets/svg/navigation_bar/calendar.svg'),
    match: ['/trip', '/trip/hub', '/trip/invite', '/trip/active', '/trip/after', '/trip/result'],
    type: 'standard',
  },
  {
    accessibilityLabel: '프로필',
    href: '/main/profile',
    icon: require('../assets/svg/navigation_bar/profile.svg'),
    match: ['/main/profile', '/main/profile-edit'],
    type: 'standard',
  },
];

function isActivePath(pathname: string, matchers: string[]) {
  return matchers.includes(pathname);
}

export function BottomNavigationBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);

  if (hiddenPathnames.includes(pathname)) {
    return null;
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomInset }]}>
      <View style={styles.bar}>
        {navItems.map((item) => {
          const isActive = isActivePath(pathname, item.match);
          const isCamera = item.type === 'camera';

          return (
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              hitSlop={10}
              key={item.accessibilityLabel}
              onPress={() => router.push(item.href)}
              style={[styles.item, isCamera && styles.cameraItem]}>
              <View style={[isCamera ? styles.cameraButton : styles.iconSlot, isActive && !isCamera && styles.activeIconSlot]}>
                <Image source={item.icon} style={isCamera ? styles.cameraIcon : styles.icon} contentFit="contain" />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const BOTTOM_NAVIGATION_RESERVED_HEIGHT = 52;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: BOTTOM_NAVIGATION_RESERVED_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  item: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 48,
  },
  cameraItem: {
    transform: [{ translateY: -18 }],
    width: 58,
  },
  iconSlot: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  activeIconSlot: {
    opacity: 0.78,
  },
  icon: {
    height: 21,
    width: 22,
  },
  cameraButton: {
    alignItems: 'center',
    backgroundColor: '#63B5CD',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  cameraIcon: {
    height: 21,
    width: 22,
  },
});
