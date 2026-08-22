import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { FlowButton, FlowScreen } from '@/components/flow-screen';
import { TopBar } from '@/components/top-bar';
import { TripInviteCreate } from '@/features/trip/invite/components/trip-invite-create';
import { TripInvitePreview } from '@/features/trip/invite/components/trip-invite-preview';
import { getParamValue } from '@/features/trip/invite/trip-invite-data';
import { useTripInvite } from '@/features/trip/invite/hooks/use-trip-invite';
import { styles } from '@/features/trip/invite/trip-invite-styles';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

// 여행 초대 링크 확인과 동행자 초대 생성을 조합하는 라우트입니다.
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
  const scheduleId = getParamValue(params.scheduleId) ?? getParamValue(params.schedule_id);
  const inviteToken = getParamValue(params.inviteToken) ?? getParamValue(params.invite_token);
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
  const openTripHub = useCallback(() => router.replace('/trip/hub'), []);
  const {
    closeInviteSheet,
    handleAcceptInvite,
    handleCopyInviteLink,
    handleCreateInvite,
    handleShareInvite,
    invitePreview,
    inviteSheetVisible,
    isCreatingInvite,
    isSharingInvite,
    message,
    status,
  } = useTripInvite({ inviteToken, onOpenTripHub: openTripHub, roomName, scheduleId });

  if (hasInviteParams) {
    return (
      <TripInvitePreview
        invitePreview={invitePreview}
        message={message}
        onAccept={handleAcceptInvite}
        onBack={() => router.back()}
        onOpenTripHub={openTripHub}
        status={status}
      />
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
      <TopBar title="동행자 초대하기" />
      <TripInviteCreate
        avatarSize={avatarSize}
        bottomActionInset={bottomActionInset}
        companionsTopGap={companionsTopGap}
        contentTopGap={contentTopGap}
        endDate={endDate}
        inviteSheetVisible={inviteSheetVisible}
        isCreatingInvite={isCreatingInvite}
        isSharingInvite={isSharingInvite}
        message={message}
        onCloseInviteSheet={closeInviteSheet}
        onCopyInviteLink={handleCopyInviteLink}
        onCreateInvite={handleCreateInvite}
        onShareInvite={handleShareInvite}
        onStartTrip={() => router.replace({ pathname: '/trip/active', params: { scheduleId } })}
        peopleCount={peopleCount}
        roomName={roomName}
        startButtonPadding={startButtonPadding}
        startDate={startDate}
        titleSize={titleSize}
      />
    </View>
  );
}
