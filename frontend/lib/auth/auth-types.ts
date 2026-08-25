export type ProfileImageUploadInput = {
  name: string;
  type: string;
  uri: string;
};

export type AuthTokens = {
  access_token?: string;
  refresh_token?: string;
  token?: string;
  user_id?: number | string;
};

export type AuthUser = {
  id: number;
  provider: string;
  provider_user_id: string;
  email: string | null;
  nickname: string | null;
  profile_image_url: string | null;
  profile_emoji: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};
