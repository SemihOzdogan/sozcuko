import {
  SUPABASE_ANON_KEY,
  SUPABASE_REST_URL,
  SUPABASE_RPC_URL,
} from '../config';

export type LeaguePlayer = {
  player_id: string;
  display_name: string;
  points: number;
  wins: number;
  losses: number;
  updated_at: string;
};

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
    throw new Error(details || `Lig servisi hatası (${response.status})`);
  }
  return response.json() as Promise<T>;
};

export const ensureLeaguePlayer = async (
  playerId: string,
  displayName: string,
): Promise<LeaguePlayer> => {
  const rows = await request<LeaguePlayer[]>(
    `${SUPABASE_REST_URL}/league_players?on_conflict=player_id`,
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        player_id: playerId,
        display_name: displayName || 'Oyuncu',
      }),
    },
  );
  if (!rows[0]) throw new Error('Lig oyuncusu oluşturulamadı.');
  return rows[0];
};

export const fetchLeaguePlayers = async (limit = 100) =>
  request<LeaguePlayer[]>(
    `${SUPABASE_REST_URL}/league_players?select=*&order=points.desc,updated_at.asc&limit=${limit}`,
  );

export const recordLeagueMatch = async (
  playerId: string,
  displayName: string,
  result: 'win' | 'lose' | 'draw',
) => {
  const payload = await request<LeaguePlayer | LeaguePlayer[]>(
    `${SUPABASE_RPC_URL}/record_league_match`,
    {
      method: 'POST',
      body: JSON.stringify({
        p_player_id: playerId,
        p_display_name: displayName || 'Oyuncu',
        p_result: result,
      }),
    },
  );
  const player = Array.isArray(payload) ? payload[0] : payload;
  if (!player) throw new Error('Lig sonucu kaydedilemedi.');
  return player;
};
