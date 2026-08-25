// 비밀번호 변경·로그아웃·계정 탈퇴 메뉴를 담당합니다.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ScalePressable } from '@/components/scale-pressable';

import { styles } from '../styles';

type MenuItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
};

type ProfileMenuProps = {
  contentMaxWidth: number;
  horizontalPadding: number;
  isAccountActionInProgress: boolean;
  onDeleteAccount: () => void;
  onLogout: () => void;
  onPasswordReset: () => void;
};

const menuItems: MenuItem[] = [
  { icon: 'account-circle-outline', label: '카카오 계정' },
  { icon: 'lock-outline', label: '개인정보 / 보안' },
  { icon: 'bell-outline', label: '알림' },
];

export function ProfileMenu({
  contentMaxWidth,
  horizontalPadding,
  isAccountActionInProgress,
  onDeleteAccount,
  onLogout,
  onPasswordReset,
}: ProfileMenuProps) {
  return (
    <View style={[styles.menuSection, { paddingBottom: 30, paddingHorizontal: horizontalPadding }]}>
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
        <ScalePressable accessibilityRole="button" disabled={isAccountActionInProgress} onPress={onPasswordReset} pressedScale={0.98} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <MaterialCommunityIcons color="#10161F" name="lock-reset" size={25} />
            <Text style={styles.menuText}>비밀번호 변경</Text>
          </View>
          <MaterialCommunityIcons color="#10161F" name="chevron-right" size={30} />
        </ScalePressable>
        <ScalePressable accessibilityRole="button" disabled={isAccountActionInProgress} onPress={onLogout} pressedScale={0.98} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <MaterialCommunityIcons color="#10161F" name="logout-variant" size={25} />
            <Text style={styles.menuText}>로그아웃</Text>
          </View>
          <MaterialCommunityIcons color="#10161F" name="chevron-right" size={30} />
        </ScalePressable>
        <ScalePressable accessibilityRole="button" disabled={isAccountActionInProgress} onPress={onDeleteAccount} pressedScale={0.98} style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <MaterialCommunityIcons color="#C74444" name="account-remove-outline" size={25} />
            <Text style={styles.deleteAccountText}>계정 탈퇴</Text>
          </View>
          <MaterialCommunityIcons color="#C74444" name="chevron-right" size={30} />
        </ScalePressable>
      </View>
    </View>
  );
}
