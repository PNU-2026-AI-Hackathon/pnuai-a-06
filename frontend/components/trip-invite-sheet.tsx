import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { type TripInvite } from '@/lib/trip-invite-api';

const kakaoTalkIcon = require('@/assets/svg/kakaotalk.svg');

type TripInviteSheetProps = {
  bottomSafeInset: number;
  invite: TripInvite | null;
  isSharing: boolean;
  message?: string;
  onClose: () => void;
  onCopy: () => void;
  onShare: () => void;
  visible: boolean;
};

export function TripInviteSheet({ bottomSafeInset, invite, isSharing, message, onClose, onCopy, onShare, visible }: TripInviteSheetProps) {
  return (
    <Modal animationType="fade" transparent visible={visible && Boolean(invite)} onRequestClose={onClose}>
      <Pressable accessibilityLabel="초대 닫기" onPress={onClose} style={styles.backdrop}>
        <Pressable style={[styles.panel, { marginBottom: bottomSafeInset + 8, paddingBottom: 22 }]}>
          <Text style={styles.title}>동행자 추가하기</Text>
          <View style={styles.titleDivider} />
          <View style={styles.optionsRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="카카오톡으로 초대하기" disabled={isSharing} onPress={onShare} style={styles.option}>
              <View style={[styles.kakaoAvatar, isSharing && styles.disabled]}>
                {isSharing ? <ActivityIndicator color="#3A2D00" /> : <Image contentFit="contain" source={kakaoTalkIcon} style={styles.kakaoIcon} />}
              </View>
              <Text style={styles.optionText}>카카오톡</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 복사하기" onPress={onCopy} style={styles.copyButton}>
            <Text style={styles.copyText}>링크 복사하기</Text>
            <Ionicons color="#54676F" name="copy-outline" size={20} />
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    paddingTop: 20,
    width: '100%',
  },
  title: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 32,
  },
  titleDivider: {
    backgroundColor: '#E8ECEF',
    height: 1,
    marginTop: 13,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 32,
    paddingTop: 13,
  },
  option: {
    alignItems: 'center',
    gap: 7,
    width: 72,
  },
  kakaoAvatar: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderRadius: 999,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  kakaoIcon: {
    height: 30,
    width: 30,
  },
  optionText: {
    color: '#54676F',
    fontSize: 12,
    fontWeight: '400',
  },
  divider: {
    backgroundColor: '#E7ECEE',
    height: 1,
    marginTop: 13,
  },
  copyButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E7ECEE',
    borderRadius: 16,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    marginTop: 13,
    paddingHorizontal: 28,
    width: '85%',
  },
  copyText: {
    color: '#54676F',
    fontSize: 12,
    fontWeight: '400',
  },
  message: {
    color: '#409CB7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    paddingHorizontal: 32,
  },
  disabled: {
    opacity: 0.6,
  },
});
