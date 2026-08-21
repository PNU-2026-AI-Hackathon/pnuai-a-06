// 일정 생성 후 동행자 초대 링크를 공유하는 모달 UI입니다.

import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { LocalizedText as Text } from '@/components/localized-text';

import { styles } from '../trip-create-styles';

type TripInviteModalProps = {
  visible: boolean;
  isSharingInvite: boolean;
  message: string;
  onClose: () => void;
  onShare: () => void;
  onCopyLink: () => void;
};

export function TripInviteModal({ visible, isSharingInvite, message, onClose, onShare, onCopyLink }: TripInviteModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="초대 닫기" onPress={onClose} style={styles.inviteModalBackdrop}>
        <Pressable style={styles.invitePanel}>
          <Text style={styles.invitePanelTitle}>동행자 추가하기</Text>
          <View style={styles.inviteTopDivider} />

          <View style={styles.inviteOptionsRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="카카오톡으로 초대하기" onPress={onShare} style={styles.inviteOption}>
              <View style={[styles.kakaoInviteAvatar, isSharingInvite && styles.disabledButton]}>
                {isSharingInvite ? <ActivityIndicator color="#3A2D00" /> : <Text style={styles.kakaoTalkText}>TALK</Text>}
              </View>
              <Text style={styles.inviteOptionText}>카카오톡</Text>
            </Pressable>

            {[
              { label: '연진이', color: '#E9EDF0' },
              { label: '김민지', color: '#E9EDF0' },
            ].map((item) => (
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}에게 카카오톡 초대하기`} key={item.label} onPress={onShare} style={styles.inviteOption}>
                <View style={[styles.inviteContactAvatar, { backgroundColor: item.color }]}>
                  <View style={styles.contactKakaoBadge}>
                    <Text style={styles.contactKakaoText}>TALK</Text>
                  </View>
                </View>
                <Text style={styles.inviteOptionText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inviteMiddleDivider} />

          <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 복사하기" onPress={onCopyLink} style={styles.copyInviteButton}>
            <Text style={styles.copyInviteText}>링크 복사하기</Text>
            <View style={styles.copyIcon}>
              <View style={styles.copyIconBack} />
              <View style={styles.copyIconFront} />
            </View>
          </Pressable>
          {message ? <Text style={styles.inviteMessageText}>{message}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
