import { Platform } from 'react-native';

import type { KakaoInviteTemplateArgs } from '@/lib/trip-invite-api';

function getKakaoInviteTemplateId() {
  const templateId = Number(process.env.EXPO_PUBLIC_KAKAO_INVITE_TEMPLATE_ID);

  if (!Number.isInteger(templateId) || templateId <= 0) {
    throw new Error('EXPO_PUBLIC_KAKAO_INVITE_TEMPLATE_ID가 설정되지 않았습니다. .env에 템플릿 ID를 넣고 Metro를 다시 시작해 주세요.');
  }

  return templateId;
}

function toTemplateArgs(args: KakaoInviteTemplateArgs) {
  return [
    { key: 'roomId', value: String(args.roomId) },
    { key: 'roomName', value: String(args.roomName) },
    { key: 'inviterName', value: String(args.inviterName) },
    { key: 'inviteToken', value: String(args.inviteToken) },
    { key: 'inviteUrl', value: String(args.inviteUrl) },
  ];
}

export async function shareKakaoInvite(args: KakaoInviteTemplateArgs) {
  if (Platform.OS === 'web') {
    throw new Error('카카오 템플릿 공유는 네이티브 앱에서만 사용할 수 있습니다.');
  }


  const KakaoShareLink = (await import('react-native-kakao-share-link')).default;
  const templateId = getKakaoInviteTemplateId();
  const templateArgs = toTemplateArgs(args);

  console.log('[KakaoInvite] sendCustom', { templateArgs, templateId });

  return KakaoShareLink.sendCustom({
    templateArgs,
    templateId,
  });
}
