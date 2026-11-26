import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_REST_URL, SUPABASE_URL } from '../config';

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  user?: AuthUser;
};

const SESSION_KEY = '@sozcuko/auth-session';
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;
const REDIRECT_URI = 'sozcuko://auth/callback';

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${AUTH_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  let payload: any = null;
  try {
    payload = body ? JSON.parse(body) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(
      payload?.msg ??
        payload?.error_description ??
        payload?.message ??
        'İşlem tamamlanamadı.',
    );
  }
  return payload as T;
};

export const loadSession = async () => {
  const value = await AsyncStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AuthSession>;
    if (!parsed.access_token || !parsed.refresh_token) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed as AuthSession;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
};

const saveSession = async (session: AuthSession) => {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const signInWithPassword = (email: string, password: string) =>
  request<AuthSession>('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }).then(saveSession);

export const signUpWithPassword = (
  email: string,
  password: string,
  name: string,
) =>
  request<AuthSession>('/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, data: { name } }),
  }).then(async session => {
    if (session.access_token) return saveSession(session);
    return session;
  });

export const getAppleSignInUrl = () =>
  `${AUTH_URL}/authorize?provider=apple&redirect_to=${encodeURIComponent(
    REDIRECT_URI,
  )}`;

export const signInWithGoogleIdToken = (
  idToken: string,
  accessToken?: string,
) => {
  const token = idToken.trim();
  if (!token)
    throw new Error(
      'Google ID token boş döndü. Google istemci ayarını kontrol et.',
    );
  return request<AuthSession>('/token?grant_type=id_token', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      id_token: token,
      ...(accessToken ? { access_token: accessToken } : {}),
    }),
  }).then(saveSession);
};

export const signInWithAppleIdToken = (idToken: string, nonce?: string) => {
  const token = idToken.trim();
  if (!token) throw new Error('Apple identity token boş döndü.');
  return request<AuthSession>('/token?grant_type=id_token', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'apple',
      id_token: token,
      ...(nonce ? { nonce } : {}),
    }),
  }).then(saveSession);
};

export const sessionFromCallback = async (url: string) => {
  const [, hash = ''] = url.split('#');
  const values = new URLSearchParams(hash || url.split('?')[1] || '');
  const accessToken = values.get('access_token');
  const refreshToken = values.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  const user = await request<AuthUser>('/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return saveSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    user,
  });
};

export const signOut = () => AsyncStorage.removeItem(SESSION_KEY);

export const deleteAccount = async (session: AuthSession) => {
  const response = await fetch(`${SUPABASE_REST_URL}/rpc/delete_current_user`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    let message = 'Hesap silinemedi.';
    try {
      const payload = body ? JSON.parse(body) : null;
      message = payload?.message ?? payload?.msg ?? message;
    } catch {
      // Supabase dışı yanıtları genel hata mesajıyla göster.
    }
    throw new Error(message);
  }

  await AsyncStorage.multiRemove([
    SESSION_KEY,
    '@sozcuko/game-state:v3',
    '@sozcuko/duel-device-player-id-v2',
  ]);
};
