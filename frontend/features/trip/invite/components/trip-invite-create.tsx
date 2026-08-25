import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, View } from 'react-native';

import { GuardedPressable as Pressable } from '@/components/guarded-pressable';
import { LocalizedText as Text } from '@/components/localized-text';
import { INVITE_COMPANIONS } from '@/features/trip/invite/trip-invite-data';

import { styles } from '@/features/trip/invite/trip-invite-styles';

type TripInviteCreateProps = {
  avatarSize: number;
  bottomActionInset: number;
  companionsTopGap: number;
  contentTopGap: number;
  endDate?: string;
  inviteSheetVisible: boolean;
  isCreatingInvite: boolean;
  isSharingInvite: boolean;
  message: string;
  onCloseInviteSheet: () => void;
  onCopyInviteLink: () => void;
  onCreateInvite: () => void;
  onShareInvite: () => void;
  onStartTrip: () => void;
  roomName: string;
  startButtonPadding: number;
  startDate?: string;
  titleSize: number;
  peopleCount?: string;
};

// 일정 초대 생성과 공유 수단을 제공하는 화면입니다.
export function TripInviteCreate({
  avatarSize,
  bottomActionInset,
  companionsTopGap,
  contentTopGap,
  endDate,
  inviteSheetVisible,
  isCreatingInvite,
  isSharingInvite,
  message,
  onCloseInviteSheet,
  onCopyInviteLink,
  onCreateInvite,
  onShareInvite,
  onStartTrip,
  roomName,
  startButtonPadding,
  startDate,
  titleSize,
  peopleCount,
}: TripInviteCreateProps) {
  return (
    <>
      <View style={[styles.content, { paddingTop: contentTopGap }]}>
        <View>
          <Text style={[styles.heading, { fontSize: titleSize }]}>동행자를{`\n`}추가해 주세요</Text>
          <Text style={styles.description}>카톡으로 여행갈 친구들을 모아보세요!</Text>
        </View>

        <View style={styles.scheduleSummary}>
          <Text style={styles.scheduleName}>{roomName}</Text>
          {startDate && endDate ? <Text style={styles.scheduleMeta}>{startDate} - {endDate}</Text> : null}
          {peopleCount ? <Text style={styles.scheduleMeta}>총 {peopleCount}명까지 함께할 수 있어요.</Text> : null}
        </View>

        <View style={[styles.companions, { marginTop: companionsTopGap }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="동행자 추가하기"
            disabled={isCreatingInvite}
            onPress={onCreateInvite}
            style={styles.companionItem}>
            <View style={[styles.addAvatar, { height: avatarSize, width: avatarSize }, isCreatingInvite && styles.disabledButton]}>
              {isCreatingInvite ? <ActivityIndicator color="#409CB7" /> : <Text style={styles.addIcon}>+</Text>}
            </View>
            <Text style={styles.mutedLabel}>추가</Text>
          </Pressable>
          {INVITE_COMPANIONS.map((item) => (
            <View key={item.label} style={styles.companionItem}>
              <View style={[styles.avatar, { backgroundColor: item.color, height: avatarSize, width: avatarSize }]} />
              <Text style={item.label === '나' ? styles.activeLabel : styles.mutedLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {message && !inviteSheetVisible ? <Text style={styles.inlineMessageText}>{message}</Text> : null}
      </View>

      <Pressable onPress={onStartTrip} style={[styles.startButton, { paddingVertical: startButtonPadding }]}>
        <Text style={styles.startButtonText}>여행 시작</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={inviteSheetVisible} onRequestClose={onCloseInviteSheet}>
        <Pressable accessibilityLabel="초대 닫기" onPress={onCloseInviteSheet} style={styles.modalBackdrop}>
          <Pressable style={[styles.invitePanel, { paddingBottom: bottomActionInset + 18 }]}>
            <Text style={styles.invitePanelTitle}>동행자 추가하기</Text>
            <View style={styles.inviteOptionsRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="카카오톡으로 초대하기" onPress={onShareInvite} style={styles.inviteOption}>
                <View style={[styles.kakaoInviteAvatar, isSharingInvite && styles.disabledButton]}>
                  {isSharingInvite ? <ActivityIndicator color="#3A2D00" /> : <Text style={styles.kakaoTalkText}>TALK</Text>}
                </View>
                <Text style={styles.inviteOptionText}>카카오톡</Text>
              </Pressable>
              {INVITE_COMPANIONS.map((item) => (
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}에게 초대 공유`} key={`invite-${item.label}`} onPress={onShareInvite} style={styles.inviteOption}>
                  <View style={[styles.inviteContactAvatar, { backgroundColor: item.color }]}>
                    <View style={styles.contactKakaoBadge}>
                      <Text style={styles.contactKakaoText}>TALK</Text>
                    </View>
                  </View>
                  <Text style={styles.inviteOptionText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inviteDivider} />

            <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 복사하기" onPress={onCopyInviteLink} style={styles.copyInviteButton}>
              <Text style={styles.copyInviteText}>링크 복사하기</Text>
              <Ionicons color="#626E75" name="copy-outline" size={27} />
            </Pressable>
            {message ? <Text style={styles.inviteMessageText}>{message}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
