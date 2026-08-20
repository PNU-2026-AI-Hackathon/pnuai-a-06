const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

// Local development can override this with EXPO_PUBLIC_API_BASE_URL.
// Production keeps using the public HTTPS backend by default.
export const API_BASE_URL = (configuredApiBaseUrl || 'https://jjigeukka.kro.kr').replace(/\/+$/, '');
