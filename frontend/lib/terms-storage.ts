import { getPersistentAuthItem, setPersistentAuthItem } from './auth-storage';

// 약관 내용이 변경되면 버전을 올려 재동의를 받을 수 있습니다.
export const TERMS_VERSION = '2026-08-27';

function getTermsKey(userId: string) {
  return `terms_agreement_completed:${TERMS_VERSION}:${userId}`;
}

export async function hasAcceptedTerms(userId?: string | null) {
  return userId ? (await getPersistentAuthItem(getTermsKey(userId))) === 'true' : false;
}

export function markTermsAccepted(userId: string) {
  return setPersistentAuthItem(getTermsKey(userId), 'true');
}
