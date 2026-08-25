import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';

import { shareKakaoInvite } from '@/lib/kakao-share';
import { createKakaoInviteTemplateArgs, createTripInvite, type TripInvite } from '@/lib/trip-invite-api';
import type { TripSchedule } from '@/lib/trip-schedule-api';
import { getInviteUrl } from '../active-data';

type UseActiveInviteOptions = {
  hasStartedMissionSession: boolean;
  schedule: TripSchedule | null;
};

// active 여행 화면의 동행자 초대장 생성, 공유, 복사 상태를 담당합니다.
export function useActiveInvite({ hasStartedMissionSession, schedule }: UseActiveInviteOptions) {
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [inviteData, setInviteData] = useState<TripInvite | null>(null);
  const inviteUrl = getInviteUrl(inviteData);

  const closeInviteSheet = () => {
    if (isSharingInvite) {
      return;
    }

    setInviteSheetVisible(false);
    setInviteMessage('');
  };

  const handleCreateInvite = async () => {
    if (!schedule?.permissions.canInviteCompanion) {
      setInviteMessage('동행자 추가 권한이 없습니다.');
      return;
    }

    if (hasStartedMissionSession) {
      setInviteMessage('이미 시작한 미션이 있어 동행자를 추가할 수 없어요.');
      return;
    }

    if (!schedule || isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);
      setInviteMessage('');
      const nextInvite = await createTripInvite({ roomName: schedule.roomName, scheduleId: schedule.scheduleId });
      setInviteData(nextInvite);
      setInviteSheetVisible(true);
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : '초대장을 만들지 못했어요.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteData || !inviteUrl || isSharingInvite) {
      return;
    }

    try {
      setIsSharingInvite(true);
      setInviteMessage('');
      await shareKakaoInvite(createKakaoInviteTemplateArgs({ ...inviteData, inviteUrl }));
      setInviteSheetVisible(false);
      setInviteMessage('카카오톡 초대장을 열었어요.');
    } catch (error) {
      setInviteMessage(error instanceof Error ? error.message : '카카오 초대에 실패했어요.');
    } finally {
      setIsSharingInvite(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return;
    }

    await Clipboard.setStringAsync(inviteUrl);
    setInviteMessage('초대 링크를 복사했어요.');
  };

  return {
    closeInviteSheet,
    handleCopyInviteLink,
    handleCreateInvite,
    handleShareInvite,
    inviteData,
    inviteMessage,
    inviteSheetVisible,
    isCreatingInvite,
    isSharingInvite,
  };
}
