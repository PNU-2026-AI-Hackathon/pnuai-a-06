import { Platform } from 'react-native';

import type { KakaoInviteTemplateArgs } from '@/lib/trip-invite-api';

const kakaoInviteTemplateId = Number(process.env.EXPO_PUBLIC_KAKAO_INVITE_TEMPLATE_ID);

function toTemplateArgs(args: KakaoInviteTemplateArgs) {
  return [
    { key: 'roomId', value: args.roomId },
    { key: 'roomName', value: args.roomName },
    { key: 'inviterName', value: args.inviterName },
    { key: 'inviteToken', value: args.inviteToken },
    { key: 'inviteUrl', value: args.inviteUrl },
  ];
}

export async function shareKakaoInvite(args: KakaoInviteTemplateArgs) {
  if (Platform.OS === 'web') {
    throw new Error('카카오 템플릿 공유는 네이티브 앱에서만 사용할 수 있습니다.');
  }

  if (!Number.isFinite(kakaoInviteTemplateId) || kakaoInviteTemplateId <= 0) {
    throw new Error('EXPO_PUBLIC_KAKAO_INVITE_TEMPLATE_ID가 설정되지 않았습니다.');
  }

  const KakaoShareLink = (await import('react-native-kakao-share-link')).default;

  return KakaoShareLink.sendCustom({
    templateArgs: toTemplateArgs(args),
    templateId: kakaoInviteTemplateId,
  });
}
