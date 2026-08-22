import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { LocalizedText as Text } from '@/components/localized-text';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ScalePressable } from '@/components/scale-pressable';
import { styles } from '@/features/trip/participation/mission-participation-styles';
import type { MissionSession } from '@/lib/mission-session-api';

type MissionSessionMember = MissionSession['members'][number];

type MissionParticipationViewProps = {
  bottomSafeInset: number;
  canChangeParticipation: boolean;
  currentUserId: string | null;
  handleClose: () => Promise<void>;
  handleParticipation: (participation: 'PASS' | 'PARTICIPATE') => Promise<void>;
  handleStart: () => Promise<void>;
  horizontalPadding: number;
  isMissionLeader: boolean;
  isMyParticipationActive: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  message: string;
  missionLeader: MissionSessionMember | null;
  participantCount: number;
  participatingMembers: MissionSessionMember[];
  session: MissionSession | null;
  topSafeInset: number;
};

// 미션 참여자 목록과 참여·시작 액션을 보여주는 화면입니다.
export function MissionParticipationView({
  bottomSafeInset,
  canChangeParticipation,
  currentUserId,
  handleClose,
  handleParticipation,
  handleStart,
  horizontalPadding,
  isMissionLeader,
  isMyParticipationActive,
  isLoading,
  isSubmitting,
  message,
  missionLeader,
  participantCount,
  participatingMembers,
  session,
  topSafeInset,
}: MissionParticipationViewProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.closeHeader, { paddingTop: topSafeInset + 14, paddingHorizontal: horizontalPadding }]}>
        {isMissionLeader || participantCount === 0 ? (
          <ScalePressable accessibilityLabel={isMissionLeader ? '미션 취소' : '미션 참여 닫기'} disabled={isSubmitting} onPress={() => void handleClose()} pressedScale={0.86} style={styles.closeButton}>
            <Ionicons color="#1D252B" name="close" size={32} />
          </ScalePressable>
        ) : null}
      </View>

      {isLoading || (session?.members.length === 1 && !message) ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#409CB7" />
          {session?.members.length === 1 ? <Text style={styles.stateText}>촬영 화면을 준비하고 있어요.</Text> : null}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{session?.missionTitle ?? '미션'}</Text>
            <Text style={styles.description}>시작 버튼을 누르면 모두 동시에 미션이 시작돼요</Text>

            {missionLeader ? (
              <View style={styles.leaderCard}>
                <ProfileAvatar profileEmoji={missionLeader.profileEmoji} profileImageUrl={missionLeader.profileImageUrl} size={35} />
                <Text numberOfLines={1} style={styles.leaderName}>{missionLeader.nickname?.trim() || '미션장'}</Text>
                <View style={styles.leaderBadge}>
                  <Text style={styles.leaderBadgeText}>방장</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.participantCard}>
              <Text style={styles.participantLabel}>참가자</Text>
              {participatingMembers.map((member, index) => {
                const mine = member.userId === currentUserId;
                return (
                  <View key={member.userId || String(index)} style={[styles.memberRow, index === participatingMembers.length - 1 && styles.lastMemberRow]}>
                    <ProfileAvatar profileEmoji={member.profileEmoji} profileImageUrl={member.profileImageUrl} size={35} />
                    <Text numberOfLines={1} style={styles.memberName}>{member.nickname?.trim() || `멤버 ${index + 1}`}{mine ? ' (나)' : ''}</Text>
                  </View>
                );
              })}
            </View>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ScrollView>

          {isMissionLeader ? (
            <View style={[styles.bottomAction, { paddingBottom: bottomSafeInset + 22, paddingHorizontal: horizontalPadding }]}>
              <ScalePressable
                disabled={isSubmitting || participantCount === 0 || !['WAITING', 'READY'].includes(session?.status ?? '')}
                onPress={() => void handleStart()}
                pressedScale={0.97}
                style={[styles.startButton, participantCount > 0 ? styles.enabledStartButton : styles.disabledStartButton]}>
                {isSubmitting ? <ActivityIndicator color={participantCount > 0 ? '#FFFFFF' : '#409CB7'} /> : <Text style={[styles.startButtonText, participantCount === 0 && styles.disabledStartButtonText]}>미션 시작</Text>}
              </ScalePressable>
            </View>
          ) : canChangeParticipation ? (
            <View style={[styles.bottomAction, { paddingBottom: bottomSafeInset + 22, paddingHorizontal: horizontalPadding }]}>
              <ScalePressable
                disabled={isSubmitting}
                onPress={() => void handleParticipation(isMyParticipationActive ? 'PASS' : 'PARTICIPATE')}
                pressedScale={0.97}
                style={[styles.participationButton, isMyParticipationActive ? styles.passButton : styles.participateButton]}>
                {isSubmitting ? (
                  <ActivityIndicator color={isMyParticipationActive ? '#409CB7' : '#FFFFFF'} />
                ) : (
                  <Text style={[styles.participationButtonText, isMyParticipationActive && styles.passButtonText]}>
                    {isMyParticipationActive ? '패스하기' : '참여하기'}
                  </Text>
                )}
              </ScalePressable>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
