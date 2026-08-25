/**
 * Backward-compatible auth API entry point.
 *
 * Keep existing imports stable while the implementation is organized by responsibility
 * under lib/auth.
 */
export { API_BASE_URL } from '@/lib/api-config';

export { fetchWithAuth } from './auth/auth-client';
export {
  confirmPasswordReset,
  deleteCurrentAccount,
  loginWithEmail,
  refreshAuthToken,
  registerWithEmail,
  requestPasswordReset,
  updateMe,
  verifyEmail,
} from './auth/auth-account-api';
export { loginWithKakaoAccessToken } from './auth/auth-social-api';
export { clearAuthSession, saveAuthTokens, saveWebKakaoAuthToken } from './auth/auth-session';
export {
  fetchMe,
  getProfileImageUrl,
  updateProfileEmoji,
  uploadProfileImage,
} from './auth/auth-profile-api';
export type { AuthTokens, AuthUser } from './auth/auth-types';
