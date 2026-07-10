import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { FlowButton, FlowScreen } from '@/components/flow-screen';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { shareKakaoInvite } from '@/lib/kakao-share';
import { acceptTripInvite, createKakaoInviteTemplateArgs, createTripInvite, previewTripInvite, type TripInvite } from '@/lib/trip-invite-api';

const kakaoTalk = require('../../assets/svg/kakaotalk.svg');

const companions = [
  { label: '나', color: '#b9d7ee' },
  { label: '선우', color: '#c9d1d7' },
];

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '초대 확인에 실패했습니다.';
}

function createFallbackInviteUrl(inviteToken: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL('/trip/invite', window.location.origin);
    url.searchParams.set('inviteToken', inviteToken);

    return url.toString();
  }

  return Linking.createURL('/trip/invite', {
    isTripleSlashed: true,
    queryParams: {
      inviteToken,
    },
  });
}

function getInviteUrl(invite: TripInvite | null) {
  if (!invite) {
    return '';
  }

  return invite.inviteUrl ?? createFallbackInviteUrl(invite.inviteToken);
}

export default function TripInviteScreen() {
  const params = useLocalSearchParams<{
    endDate?: string | string[];
    inviteToken?: string | string[];
    invite_token?: string | string[];
    peopleCount?: string | string[];
    roomName?: string | string[];
    scheduleId?: string | string[];
    schedule_id?: string | string[];
    startDate?: string | string[];
  }>();
  const { bottomActionInset, horizontalPadding, isCompactWidth, isTallScreen, topInset } = useResponsiveLayout();
  const scheduleId = useMemo(() => getParamValue(params.scheduleId) ?? getParamValue(params.schedule_id), [params.scheduleId, params.schedule_id]);
  const inviteToken = useMemo(() => getParamValue(params.inviteToken) ?? getParamValue(params.invite_token), [params.inviteToken, params.invite_token]);
  const roomName = getParamValue(params.roomName) ?? 'B-Cut 여행';
  const startDate = getParamValue(params.startDate);
  const endDate = getParamValue(params.endDate);
  const peopleCount = getParamValue(params.peopleCount);
  const hasInviteParams = Boolean(inviteToken);
  const hasScheduleParams = Boolean(scheduleId);
  const avatarSize = isCompactWidth ? 54 : 60;
  const contentTopGap = isTallScreen ? 38 : 22;
  const companionsTopGap = isTallScreen ? 28 : 20;
  const startButtonPadding = isTallScreen ? 18 : 15;
  const titleSize = isCompactWidth ? 23 : 25;

  const [invitePreview, setInvitePreview] = useState<TripInvite | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'accepting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [inviteData, setInviteData] = useState<TripInvite | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);

  const inviteUrl = getInviteUrl(inviteData);


  useEffect(() => {
    if (!inviteToken) {
      return;
    }

    let isMounted = true;

    setStatus('loading');
    setMessage('');
    setInvitePreview(null);

    previewTripInvite(inviteToken)
      .then((preview) => {
        if (!isMounted) {
          return;
        }

        setInvitePreview(preview);
        setStatus('ready');
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setStatus('error');
        setMessage(getErrorMessage(error));
      });

    return () => {
      isMounted = false;
    };
  }, [inviteToken]);

  const closeInviteSheet = () => {
    if (isSharingInvite) {
      return;
    }

    setInviteSheetVisible(false);
    setMessage('');
  };

  const handleCreateInvite = async () => {
    if (!scheduleId || isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);
      setMessage('');
      const nextInvite = await createTripInvite({ roomName, scheduleId });
      setInviteData(nextInvite);
      setInviteSheetVisible(true);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteData || !inviteUrl || isSharingInvite) {
      return;
    }

    const templateArgs = createKakaoInviteTemplateArgs({ ...inviteData, inviteUrl });

    try {
      setIsSharingInvite(true);
      setMessage('');
      await shareKakaoInvite(templateArgs);
    } catch {
      await Share.share({
        message: `${templateArgs.inviterName}님이 ${templateArgs.roomName} 여행에 초대했어요.\n${templateArgs.inviteUrl}`,
        title: `${templateArgs.roomName} 초대`,
        url: templateArgs.inviteUrl,
      });
    } finally {
      setIsSharingInvite(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return;
    }

    await Clipboard.setStringAsync(inviteUrl);
    setMessage('초대 링크를 복사했어요.');
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken || status === 'accepting') {
      return;
    }

    try {
      setStatus('accepting');
      setMessage('');
      await acceptTripInvite({ inviteToken });
      setStatus('success');
      setMessage('동행자 방에 입장했어요.');
    } catch (error) {
      setStatus('error');
      setMessage(getErrorMessage(error));
    }
  };

  if (hasInviteParams) {
    const isBusy = status === 'loading' || status === 'accepting';
    const title = status === 'success' ? '초대 완료' : status === 'error' ? '초대 확인 실패' : '여행 초대장';

    return (
      <View style={styles.centerContainer}>
        {isBusy ? <ActivityIndicator color="#409CB7" /> : null}
        <Text style={styles.previewTitle}>{title}</Text>

        {invitePreview && status !== 'success' ? (
          <View style={styles.previewCard}>
            <Text style={styles.roomName}>{invitePreview.roomName}</Text>
            <Text style={styles.previewText}>{invitePreview.inviterName}님이 함께 여행하자고 초대했어요.</Text>
          </View>
        ) : null}

        {message ? <Text style={styles.centerMessage}>{message}</Text> : null}

        {status === 'ready' || status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            disabled={!invitePreview || status === 'error'}
            onPress={handleAcceptInvite}
            style={[styles.primaryButton, (!invitePreview || status === 'error') && styles.disabledButton]}>
            <Text style={styles.primaryButtonText}>입장하기</Text>
          </Pressable>
        ) : null}

        {status === 'success' ? <FlowButton label="진행 중 여행으로" onPress={() => router.replace('/trip/active')} /> : null}
        {status === 'error' ? <FlowButton label="돌아가기" onPress={() => router.back()} /> : null}
      </View>
    );
  }

  if (!hasScheduleParams) {
    return (
      <FlowScreen title="T02 동행자 초대" subtitle="일정을 만든 뒤 동행자를 초대할 수 있어요.">
        <FlowButton label="여행 기간 정하기" onPress={() => router.replace('/trip')} />
      </FlowScreen>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomActionInset,
          paddingHorizontal: horizontalPadding,
          paddingTop: topInset,
        },
      ]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>동행자 초대하기</Text>
        <View style={styles.topSpacer} />
      </View>

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
            onPress={handleCreateInvite}
            style={styles.companionItem}>
            <View style={[styles.addAvatar, { height: avatarSize, width: avatarSize }, isCreatingInvite && styles.disabledButton]}>
              {isCreatingInvite ? <ActivityIndicator color="#409CB7" /> : <Text style={styles.addIcon}>+</Text>}
            </View>
            <Text style={styles.mutedLabel}>추가</Text>
          </Pressable>
          {companions.map((item) => (
            <View key={item.label} style={styles.companionItem}>
              <View style={[styles.avatar, { backgroundColor: item.color, height: avatarSize, width: avatarSize }]} />
              <Text style={item.label === '나' ? styles.activeLabel : styles.mutedLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {message && !inviteSheetVisible ? <Text style={styles.inlineMessageText}>{message}</Text> : null}
      </View>

      <Pressable
        onPress={() => router.replace({ pathname: '/trip/active', params: { scheduleId } })}
        style={[styles.startButton, { paddingVertical: startButtonPadding }]}>
        <Text style={styles.startButtonText}>여행 시작</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={inviteSheetVisible} onRequestClose={closeInviteSheet}>
        <Pressable accessibilityLabel="초대 닫기" onPress={closeInviteSheet} style={styles.modalBackdrop}>
          <Pressable style={[styles.invitePanel, { paddingBottom: bottomActionInset + 18 }]}>
            <Text style={styles.invitePanelTitle}>동행자 추가하기</Text>
            <View style={styles.inviteOptionsRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="카카오톡으로 초대하기" onPress={handleShareInvite} style={styles.inviteOption}>
                <View style={[styles.kakaoInviteAvatar, isSharingInvite && styles.disabledButton]}>
                  {isSharingInvite ? <ActivityIndicator color="#3A2D00" /> : <Image source={kakaoTalk} style={styles.kakaoInviteIcon} contentFit="contain" />}
                </View>
                <Text style={styles.inviteOptionText}>카카오톡</Text>
              </Pressable>
              {companions.map((item) => (
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}에게 초대 공유`} key={`invite-${item.label}`} onPress={handleShareInvite} style={styles.inviteOption}>
                  <View style={[styles.inviteContactAvatar, { backgroundColor: item.color }]}>
                    <View style={styles.contactKakaoBadge}>
                      <Image source={kakaoTalk} style={styles.contactKakaoIcon} contentFit="contain" />
                    </View>
                  </View>
                  <Text style={styles.inviteOptionText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inviteDivider} />

            <Pressable accessibilityRole="button" accessibilityLabel="초대 링크 복사하기" onPress={handleCopyInviteLink} style={styles.copyInviteButton}>
              <Text style={styles.copyInviteText}>링크 복사하기</Text>
              <Ionicons color="#626E75" name="copy-outline" size={27} />
            </Pressable>
            {message ? <Text style={styles.inviteMessageText}>{message}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    flex: 1,
  },
  centerContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: 48,
  },
  backIcon: {
    color: '#202124',
    fontSize: 44,
    lineHeight: 44,
  },
  topTitle: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '600',
  },
  topSpacer: {
    width: 48,
  },
  content: {
    flex: 1,
  },
  heading: {
    color: '#000000',
    fontWeight: '600',
    lineHeight: 30,
  },
  description: {
    color: '#AEAEAE',
    fontSize: 12,
    marginTop: 8,
  },
  scheduleSummary: {
    backgroundColor: '#F4F7F8',
    borderRadius: 14,
    gap: 6,
    marginTop: 30,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  scheduleName: {
    color: '#10161F',
    fontSize: 16,
    fontWeight: '800',
  },
  scheduleMeta: {
    color: '#6D7478',
    fontSize: 12,
    lineHeight: 17,
  },
  companions: {
    flexDirection: 'row',
    gap: 14,
  },
  companionItem: {
    alignItems: 'center',
    gap: 8,
  },
  addAvatar: {
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    borderRadius: 999,
    justifyContent: 'center',
  },
  addIcon: {
    color: '#409CB7',
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 40,
  },
  avatar: {
    borderRadius: 999,
  },
  activeLabel: {
    color: '#409CB7',
    fontSize: 12,
  },
  mutedLabel: {
    color: '#b2b2b2',
    fontSize: 12,
  },
  inlineMessageText: {
    color: '#D06958',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    justifyContent: 'center',
    shadowColor: '#409CB7',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  invitePanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    paddingTop: 23,
  },
  invitePanelTitle: {
    color: '#10161F',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 40,
  },
  inviteOptionsRow: {
    flexDirection: 'row',
    gap: 22,
    paddingHorizontal: 40,
    paddingTop: 27,
  },
  inviteOption: {
    alignItems: 'center',
    gap: 7,
    width: 72,
  },
  kakaoInviteAvatar: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderRadius: 999,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  kakaoInviteIcon: {
    height: 28,
    width: 28,
  },
  inviteContactAvatar: {
    borderRadius: 999,
    height: 62,
    position: 'relative',
    width: 62,
  },
  contactKakaoBadge: {
    alignItems: 'center',
    backgroundColor: '#FBE339',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    bottom: 1,
    height: 21,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 21,
  },
  contactKakaoIcon: {
    height: 13,
    width: 13,
  },
  inviteOptionText: {
    color: '#72787D',
    fontSize: 12,
    fontWeight: '500',
  },
  inviteDivider: {
    backgroundColor: '#E8ECEF',
    height: 1,
    marginTop: 20,
  },
  copyInviteButton: {
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
  copyInviteText: {
    color: '#626E75',
    fontSize: 13,
    fontWeight: '600',
  },
  inviteMessageText: {
    color: '#409CB7',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    paddingHorizontal: 40,
  },
  previewTitle: {
    color: '#10161F',
    fontSize: 23,
    fontWeight: '800',
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: '#F4F7F8',
    borderRadius: 16,
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 22,
    width: '100%',
  },
  roomName: {
    color: '#10161F',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  previewText: {
    color: '#6D7478',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  centerMessage: {
    color: '#6D7478',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#409CB7',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 38,
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
