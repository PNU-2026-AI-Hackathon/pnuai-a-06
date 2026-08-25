import { getPersistentAuthItem, setPersistentAuthItem } from './auth-storage';

const APP_TUTORIAL_KEY = 'tutorial_app_onboarding_completed';

function getAppTutorialKey(userId: string) {
  return `${APP_TUTORIAL_KEY}:${userId}`;
}

export async function hasSeenAppTutorial(userId: string) {
  return (await getPersistentAuthItem(getAppTutorialKey(userId))) === 'true';
}

export function markAppTutorialCompleted(userId: string) {
  return setPersistentAuthItem(getAppTutorialKey(userId), 'true');
}
