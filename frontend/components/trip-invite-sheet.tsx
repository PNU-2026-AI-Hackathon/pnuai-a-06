import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type TripInvite } from '@/lib/trip-invite-api';

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
        <Pressable style={[styles.panel, { paddingBottom: bottomSafeInset + 22 }]}>
          <Text style={styles.title}>동행자 추가하기</Text>
          <View style={styles.optionsRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="카카오톡으로 초대하기" disabled={isSharing} onPress={onShare} style={styles.option}>
              <View style={[styles.kakaoAvatar, isSharing && styles.disabled]}>
                {isSharing ? <ActivityIndicator color="#3A2D00" /> : <Text style={styles.kakaoText}>TALK</Text>}
              </View>
              <Text style={styles.optionText}>카카오톡</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 복사하기" onPress={onCopy} style={styles.copyButton}>
            <Text style={styles.copyText}>링크 복사하기</Text>
            <Ionicons color="#626E75" name="copy-outline" size={27} />
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingTop: 23,
    width: '100%',
  },
  title: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 32,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 18,
    paddingHorizontal: 32,
    paddingTop: 27,
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
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  kakaoText: {
    color: '#3A2D00',
    fontSize: 10,
    fontWeight: '800',
  },
  optionText: {
    color: '#72787D',
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    backgroundColor: '#E8ECEF',
    height: 1,
    marginTop: 20,
  },
  copyButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E9EDF0',
    borderRadius: 16,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 28,
    width: '77%',
  },
  copyText: {
    color: '#626E75',
    fontSize: 13,
    fontWeight: '600',
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