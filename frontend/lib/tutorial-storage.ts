import { getPersistentAuthItem, setPersistentAuthItem } from './auth-storage';

export type TutorialId = 'profile' | 'map' | 'trip-hub' | 'trip-active';

const APP_TUTORIAL_KEY = 'tutorial_app_onboarding_completed';
const WELCOME_SCREEN_KEY = 'welcome_screen_completed';

function getTutorialKey(userId: string, tutorialId: TutorialId) {
  return `${APP_TUTORIAL_KEY}:${tutorialId}:${userId}`;
}

export async function hasSeenTutorial(userId: string, tutorialId: TutorialId) {
  return (await getPersistentAuthItem(getTutorialKey(userId, tutorialId))) === 'true';
}

export function markTutorialCompleted(userId: string, tutorialId: TutorialId) {
  return setPersistentAuthItem(getTutorialKey(userId, tutorialId), 'true');
}

function getWelcomeScreenKey(userId: string) {
  return `${WELCOME_SCREEN_KEY}:${userId}`;
}

export async function hasSeenWelcomeScreen(userId?: string | null) {
  return userId ? (await getPersistentAuthItem(getWelcomeScreenKey(userId))) === 'true' : false;
}

export function markWelcomeScreenCompleted(userId: string) {
  return setPersistentAuthItem(getWelcomeScreenKey(userId), 'true');
}
