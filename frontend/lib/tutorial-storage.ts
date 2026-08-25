import { getPersistentAuthItem, setPersistentAuthItem } from './auth-storage';

export type TutorialId = 'profile' | 'map' | 'trip-hub' | 'trip-active';

const APP_TUTORIAL_KEY = 'tutorial_app_onboarding_completed';

function getTutorialKey(userId: string, tutorialId: TutorialId) {
  return `${APP_TUTORIAL_KEY}:${tutorialId}:${userId}`;
}

export async function hasSeenTutorial(userId: string, tutorialId: TutorialId) {
  return (await getPersistentAuthItem(getTutorialKey(userId, tutorialId))) === 'true';
}

export function markTutorialCompleted(userId: string, tutorialId: TutorialId) {
  return setPersistentAuthItem(getTutorialKey(userId, tutorialId), 'true');
}
