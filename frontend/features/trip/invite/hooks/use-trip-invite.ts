import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';

import {
  findConflictingSchedule,
  getDateRangeLabel,
  getErrorMessage,
  getInviteUrl,
  isAccessibleTripError,
  isJoinedInviteStatus,
  isScheduleConflictError,
  type TripInviteStatus,
} from '@/features/trip/invite/trip-invite-data';
import { shareKakaoInvite } from '@/lib/kakao-share';
import { getCachedTripSchedules, listTripSchedules, type TripSchedule } from '@/lib/trip-schedule-api';
import { acceptTripInvite, createKakaoInviteTemplateArgs, createTripInvite, declineTripInvite, previewTripInvite, type TripInvite } from '@/lib/trip-invite-api';

type UseTripInviteOptions = {
  inviteToken?: string;
  onOpenTripHub: () => void;
  roomName: string;
  scheduleId?: string;
};

// 초대 미리보기 조회와 초대 생성·수락·공유 상태를 관리합니다.
export function useTripInvite({ inviteToken, onOpenTripHub, roomName, scheduleId }: UseTripInviteOptions) {
  const [invitePreview, setInvitePreview] = useState<TripInvite | null>(null);
  const [mySchedules, setMySchedules] = useState<TripSchedule[]>(() => getCachedTripSchedules());
  const [status, setStatus] = useState<TripInviteStatus>('idle');
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
    setMySchedules(getCachedTripSchedules());

    listTripSchedules()
      .then((schedules) => {
        if (isMounted) {
          setMySchedules(schedules);
        }
      })
      .catch(() => {
        // 로그인 전 초대 미리보기에서는 일정 목록을 조회할 수 없으므로 캐시를 사용한다.
      });

    previewTripInvite(inviteToken)
      .then((preview) => {
        if (!isMounted) {
          return;
        }

        setInvitePreview(preview);

        if (isJoinedInviteStatus(preview.status)) {
          onOpenTripHub();
          return;
        }

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
  }, [inviteToken, onOpenTripHub]);

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
      console.log('[KakaoInvite] sharing custom template', templateArgs);
      await shareKakaoInvite(templateArgs);
      setInviteSheetVisible(false);
      setMessage('카카오톡 초대장을 열었어요.');
    } catch (error) {
      console.error('[KakaoInvite] share failed', error);
      setMessage(`카카오 초대 실패: ${getErrorMessage(error)}`);
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

      const schedules = await listTripSchedules().catch(() => mySchedules);
      setMySchedules(schedules);
      if (invitePreview && findConflictingSchedule(invitePreview, schedules)) {
        try {
          await declineTripInvite({ inviteToken });
          setMessage(`${getDateRangeLabel(invitePreview.startDate, invitePreview.endDate)}에 이미 일정이 있어 초대를 거절했어요.`);
        } catch {
          setMessage(`${getDateRangeLabel(invitePreview.startDate, invitePreview.endDate)}에 이미 일정이 있어 입장할 수 없어요.`);
        }

        setStatus('acceptError');
        return;
      }

      await acceptTripInvite({ inviteToken });
      setStatus('success');
      setMessage('동행자 방에 입장했어요.');
      onOpenTripHub();
    } catch (error) {
      if (isScheduleConflictError(error)) {
        try {
          await declineTripInvite({ inviteToken });
          setMessage('해당 날짜에 이미 일정이 있어 초대를 거절했어요.');
        } catch {
          setMessage('해당 날짜에 이미 일정이 있어 입장할 수 없어요.');
        }

        setStatus('acceptError');
        return;
      }

      if (isAccessibleTripError(error)) {
        onOpenTripHub();
        return;
      }

      setStatus('acceptError');
      setMessage(getErrorMessage(error));
    }
  };

  return {
    closeInviteSheet,
    handleAcceptInvite,
    handleCopyInviteLink,
    handleCreateInvite,
    handleShareInvite,
    inviteData,
    invitePreview,
    inviteSheetVisible,
    inviteUrl,
    isCreatingInvite,
    isSharingInvite,
    message,
    setInviteSheetVisible,
    status,
  };
}
