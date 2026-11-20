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
  created_at: string;
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
const INVITATION_TTL_SECONDS = 120;
const invitationCutoff = () =>
  new Date(Date.now() - INVITATION_TTL_SECONDS * 1000).toISOString();

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
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

const fetchDuelLettersFromApi = async () => {
  const puzzles = await request<Array<{ letters: string[] }>>(
    `${SUPABASE_REST_URL}/classic_puzzles?select=letters&limit=100`,
  );
  const candidates = puzzles.filter(
    puzzle => Array.isArray(puzzle.letters) && puzzle.letters.length >= 3,
  );
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  if (!selected) throw new Error('API geçerli bir düello harf seti döndürmedi.');
  return selected.letters;
};

export const getDuelPlayerId = async (userId?: string) => {
  const storageKey = userId ? `${PLAYER_KEY}:${userId}` : PLAYER_KEY;
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) return existing;
  const id = userId
    ? `user-${userId}`
    : `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await AsyncStorage.setItem(storageKey, id);
  return id;
};

export const findOrCreateDuelRoom = async (playerId: string) => {
  const payload = await request<DuelRoom | DuelRoom[]>(
    `${SUPABASE_RPC_URL}/find_or_create_duel_room`,
    {
      method: 'POST',
      body: JSON.stringify({ p_player_id: playerId }),
    },
  );
  const room = Array.isArray(payload) ? payload[0] : payload;
  if (!room) throw new Error('Düello odası oluşturulamadı.');
  return room;
/* legacy REST fallback intentionally removed
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (!message.includes('(404)')) throw reason;

    // 011 migration'ı henüz schema cache'e girmediyse eski akışla devam et.
    const waitingCutoff = encodeURIComponent(
      new Date(Date.now() - 10_000).toISOString(),
    );
    const ownWaiting = await request<DuelRoom[]>(
      `${SUPABASE_REST_URL}/duel_rooms?status=eq.waiting&player_two_id=is.null&player_one_id=eq.${encodeURIComponent(
        playerId,
      )}&created_at=gte.${waitingCutoff}&select=*&order=created_at.desc&limit=1`,
    );
    if (ownWaiting[0]) return ownWaiting[0];

    const waiting = await request<DuelRoom[]>(
      `${SUPABASE_REST_URL}/duel_rooms?status=eq.waiting&player_two_id=is.null&player_one_id=neq.${encodeURIComponent(
        playerId,
      )}&created_at=gte.${waitingCutoff}&select=*&order=created_at.asc&limit=1`,
    );
    if (waiting[0]) {
      const joined = await request<DuelRoom[]>(
        `${SUPABASE_REST_URL}/duel_rooms?id=eq.${encodeURIComponent(
          waiting[0].id,
        )}&status=eq.waiting&player_two_id=is.null`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            player_two_id: playerId,
            status: 'playing',
            started_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 10_000).toISOString(),
          }),
        },
      );
      if (joined[0]) return joined[0];
    }

    const created = await request<DuelRoom[]>(
      `${SUPABASE_REST_URL}/duel_rooms`,
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          letters: await fetchDuelLettersFromApi(),
          player_one_id: playerId,
        }),
      },
    );
    if (!created[0]) throw new Error('Düello odası oluşturulamadı.');
    return created[0];
  }
*/
};

export const createDuelInvitation = async (
  playerId: string,
  opponentId: string,
) => {
  const payload = await request<DuelRoom | DuelRoom[]>(
    `${SUPABASE_RPC_URL}/create_duel_invitation`,
    {
      method: 'POST',
      body: JSON.stringify({
        p_player_id: playerId,
        p_opponent_id: opponentId,
      }),
    },
  );
  const room = Array.isArray(payload) ? payload[0] : payload;
  if (!room) throw new Error('Düello daveti oluşturulamadı.');
  return room;
};

export const fetchIncomingDuelInvitation = async (playerId: string) => {
  const rooms = await request<DuelRoom[]>(
    `${SUPABASE_REST_URL}/duel_rooms?player_two_id=eq.${encodeURIComponent(
      playerId,
    )}&status=eq.waiting&created_at=gte.${encodeURIComponent(
      invitationCutoff(),
    )}&select=*&order=created_at.desc&limit=1`,
  );
  return rooms[0];
};

export const acceptDuelInvitationForPlayer = async (
  roomId: string,
  playerId: string,
) => {
  const payload = await request<DuelRoom | DuelRoom[]>(
    `${SUPABASE_RPC_URL}/accept_duel_invitation`,
    {
      method: 'POST',
      body: JSON.stringify({ p_room_id: roomId, p_player_id: playerId }),
    },
  );
  const room = Array.isArray(payload) ? payload[0] : payload;
  if (!room) throw new Error('Düello başlatılamadı.');
  return room;
};

export const fetchDuelRoom = (roomId: string) =>
  request<DuelRoom[]>(
    `${SUPABASE_REST_URL}/duel_rooms?id=eq.${roomId}&select=*`,
  ).then(rows => rows[0]);

/*
export const tryJoinOlderDuelRoom = async (playerId: string) => {
  const waiting = await request<DuelRoom[]>(
    `${SUPABASE_REST_URL}/duel_rooms?status=eq.waiting&player_two_id=is.null&player_one_id=neq.${encodeURIComponent(
      playerId,
    )}&created_at=gte.${encodeURIComponent(
      new Date(Date.now() - 10_000).toISOString(),
    )}&select=*&order=created_at.asc&limit=1`,
  );
  if (!waiting[0]) return null;

  const joined = await request<DuelRoom[]>(
    `${SUPABASE_REST_URL}/duel_rooms?id=eq.${encodeURIComponent(
      waiting[0].id,
    )}&status=eq.waiting&player_two_id=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        player_two_id: playerId,
        status: 'playing',
        started_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 10_000).toISOString(),
      }),
    },
  );
  return joined[0] ?? null;
};
*/

export const cancelWaitingDuel = async (roomId: string, playerId: string) => {
  await request(
    `${SUPABASE_RPC_URL}/cancel_waiting_duel`,
    {
      method: 'POST',
      body: JSON.stringify({ p_room_id: roomId, p_player_id: playerId }),
    },
  );
};

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
