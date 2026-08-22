import { ActivityIndicator, Pressable, View } from 'react-native';

import { FlowButton } from '@/components/flow-screen';
import { LocalizedText as Text } from '@/components/localized-text';
import { getDateRangeLabel, type TripInviteStatus } from '@/features/trip/invite/trip-invite-data';
import type { TripInvite } from '@/lib/trip-invite-api';

import { styles } from '@/features/trip/invite/trip-invite-styles';

type TripInvitePreviewProps = {
  invitePreview: TripInvite | null;
  message: string;
  onAccept: () => void;
  onBack: () => void;
  onOpenTripHub: () => void;
  status: TripInviteStatus;
};

// 초대 링크로 진입했을 때 초대 내용을 확인하고 입장하는 화면입니다.
export function TripInvitePreview({ invitePreview, message, onAccept, onBack, onOpenTripHub, status }: TripInvitePreviewProps) {
  const isBusy = status === 'loading' || status === 'accepting';
  const title = status === 'success' ? '초대 완료' : status === 'acceptError' ? '입장할 수 없어요' : status === 'error' ? '초대 확인 실패' : '여행 초대장';

  return (
    <View style={styles.centerContainer}>
      {isBusy ? <ActivityIndicator color="#409CB7" /> : null}
      <Text style={styles.previewTitle}>{title}</Text>

      {invitePreview && status !== 'success' ? (
        <View style={styles.previewCard}>
          <Text style={styles.roomName}>{invitePreview.roomName}</Text>
          <Text style={styles.previewText}>{invitePreview.inviterName}님이 함께 여행하자고 초대했어요.</Text>
          {invitePreview.startDate || invitePreview.endDate ? (
            <Text style={styles.previewText}>여행 기간: {getDateRangeLabel(invitePreview.startDate, invitePreview.endDate)}</Text>
          ) : null}
        </View>
      ) : null}

      {message ? <Text style={styles.centerMessage}>{message}</Text> : null}

      {status === 'ready' || status === 'error' || status === 'acceptError' ? (
        <Pressable
          accessibilityRole="button"
          disabled={!invitePreview || status === 'error' || status === 'acceptError'}
          onPress={onAccept}
          style={[styles.primaryButton, (!invitePreview || status === 'error' || status === 'acceptError') && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>입장하기</Text>
        </Pressable>
      ) : null}

      {status === 'success' ? <FlowButton label="여행 목록으로" onPress={onOpenTripHub} /> : null}
      {status === 'error' ? <FlowButton label="돌아가기" onPress={onBack} /> : null}
    </View>
  );
}
