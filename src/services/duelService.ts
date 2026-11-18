import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SUPABASE_ANON_KEY,
  SUPABASE_REST_URL,
  SUPABASE_RPC_URL,
} from '../config';

export type DuelRoom = {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  letters: string[];
  player_one_id: string;
  player_two_id: string | null;
  started_at: string | null;
  ends_at: string | null;
};

export type DuelEvent = {
  id: number;
  room_id: string;
  player_id: string;
  word: string;
  points: number;
  created_at: string;
};

export type DuelResult = 'win' | 'lose' | 'draw';

export type DuelFinish = {
  player_id: string;
  score: number;
  result: DuelResult;
};

const PLAYER_KEY = '@sozcuko/duel-player-id';
const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const details = await response.text();
    let message = details;
    try {
      const payload = JSON.parse(details) as {
        message?: string;
        hint?: string;
      };
      message = [payload.message, payload.hint].filter(Boolean).join(' · ');
    } catch {
      // Supabase dışı yanıtları olduğu gibi göster.
    }
    throw new Error(
      message
        ? `Düello servisi hatası (${response.status}): ${message}`
        : `Düello servisi hatası (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
};

export const getDuelPlayerId = async () => {
  const existing = await AsyncStorage.getItem(PLAYER_KEY);
  if (existing) return existing;
  const id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await AsyncStorage.setItem(PLAYER_KEY, id);
  return id;
};

export const findOrCreateDuelRoom = async (playerId: string) => {
  const waiting = await request<DuelRoom[]>(
    `${SUPABASE_REST_URL}/duel_rooms?status=eq.waiting&player_two_id=is.null&select=*&order=created_at.asc&limit=1`,
  );
  if (waiting[0] && waiting[0].player_one_id !== playerId) {
    const joined = await request<DuelRoom[]>(
      `${SUPABASE_REST_URL}/duel_rooms?id=eq.${waiting[0].id}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          player_two_id: playerId,
          status: 'playing',
          started_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 90_000).toISOString(),
        }),
      },
    );
    return joined[0];
  }
  const letters = ['K', 'A', 'L', 'E', 'M', 'İ'];
  const created = await request<DuelRoom[]>(`${SUPABASE_REST_URL}/duel_rooms`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ letters, player_one_id: playerId }),
  });
  return created[0];
};

export const fetchDuelRoom = (roomId: string) =>
  request<DuelRoom[]>(
    `${SUPABASE_REST_URL}/duel_rooms?id=eq.${roomId}&select=*`,
  ).then(rows => rows[0]);

export const fetchDuelEvents = (roomId: string, afterId = 0) =>
  request<DuelEvent[]>(
    `${SUPABASE_REST_URL}/duel_events?room_id=eq.${roomId}&id=gt.${afterId}&select=*&order=id.asc`,
  );

export const publishDuelWord = (event: Omit<DuelEvent, 'id' | 'created_at'>) =>
  request<DuelEvent[]>(`${SUPABASE_REST_URL}/duel_events`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(event),
  }).then(rows => rows[0]);

export const submitDuelWord = async (
  roomId: string,
  playerId: string,
  word: string,
) => {
  const payload = await request<DuelEvent | DuelEvent[]>(
    `${SUPABASE_RPC_URL}/submit_duel_word`,
    {
      method: 'POST',
      body: JSON.stringify({
        p_room_id: roomId,
        p_player_id: playerId,
        p_word: word,
      }),
    },
  );
  const event = Array.isArray(payload) ? payload[0] : payload;
  if (!event) throw new Error('Kelime düelloya kaydedilemedi.');
  return event;
};

export const finishDuel = async (roomId: string) => {
  const payload = await request<DuelFinish | DuelFinish[]>(
    `${SUPABASE_RPC_URL}/finish_duel`,
    { method: 'POST', body: JSON.stringify({ p_room_id: roomId }) },
  );
  return Array.isArray(payload) ? payload : [payload];
};
