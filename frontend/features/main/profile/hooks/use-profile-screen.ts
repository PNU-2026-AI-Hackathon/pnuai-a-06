// 프로필 정보 조회와 로그아웃·계정 탈퇴 상태를 관리합니다.
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { clearAuthSession, deleteCurrentAccount, fetchMe } from '@/lib/auth-api';
import { markDeletedAccountEmail } from '@/lib/auth-storage';
import { prefetchProfileIcons } from '@/components/profile-avatar';

import { confirmAction, showActionError } from '../profile-alerts';

type UseProfileScreenOptions = {
  onSignedOut: () => void;
};

export function useProfileScreen({ onSignedOut }: UseProfileScreenOptions) {
  const [nickname, setNickname] = useState('사용자');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileEmoji, setProfileEmoji] = useState<string | null>(null);
  const [isAccountActionInProgress, setIsAccountActionInProgress] = useState(false);

  const handleLogout = () => {
    confirmAction('로그아웃', '현재 기기에서 로그아웃할까요?', () => {
      void (async () => {
        setIsAccountActionInProgress(true);
        try {
          await clearAuthSession();
          onSignedOut();
        } finally {
          setIsAccountActionInProgress(false);
        }
      })();
    });
  };

  const handleDeleteAccount = () => {
    confirmAction('계정 탈퇴', '계정을 탈퇴하면 프로필과 서비스 이용 정보가 삭제됩니다. 계속할까요?', () => {
      void (async () => {
        setIsAccountActionInProgress(true);
        try {
          await deleteCurrentAccount();
          if (email) {
            markDeletedAccountEmail(email);
          }
          onSignedOut();
        } catch (error) {
          showActionError('탈퇴 실패', error instanceof Error ? error.message : '계정 탈퇴에 실패했습니다.');
        } finally {
          setIsAccountActionInProgress(false);
        }
      })();
    });
  };

  useEffect(() => {
    void prefetchProfileIcons();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      fetchMe()
        .then((user) => {
          if (isActive) {
            setEmail(user.email?.trim() || '');
            setNickname(user.nickname?.trim() || '사용자');
            setProfileImageUrl(user.profile_image_url);
            setProfileEmoji(user.profile_emoji);
          }
        })
        .catch(() => {
          if (isActive) {
            setNickname('사용자');
            setProfileImageUrl(null);
            setProfileEmoji(null);
          }
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  return {
    email,
    handleDeleteAccount,
    handleLogout,
    isAccountActionInProgress,
    nickname,
    profileEmoji,
    profileImageUrl,
  };
}
