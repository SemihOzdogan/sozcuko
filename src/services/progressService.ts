import {
  SUPABASE_ANON_KEY,
  SUPABASE_RPC_URL,
  SUPABASE_REST_URL,
} from '../config';

export type CloudProgress = {
  player_id: string;
  xp: number;
  classic_score: number;
  classic_words: number;
  classic_completed_levels: number[];
  classic_clue_uses: Record<string, number>;
  classic_clue_words: Record<string, string>;
  duel_wins: number;
  league_points: number;
  league_wins: number;
  league_losses: number;
  updated_at?: string;
};

const progressUrl = `${SUPABASE_REST_URL}/player_progress`;

const request = async <T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`İlerleme senkronizasyonu başarısız (${response.status})`);
  }
  return response.json() as Promise<T>;
};

export const fetchCloudProgress = async (
  accessToken: string,
  playerId: string,
) => {
  const rows = await request<CloudProgress[]>(
    accessToken,
    `${progressUrl}?player_id=eq.${encodeURIComponent(playerId)}&select=*&limit=1`,
  );
  return rows[0] ?? null;
};

export const saveCloudProgress = async (
  accessToken: string,
  progress: CloudProgress,
) => {
  const response = await request<CloudProgress | CloudProgress[]>(
    accessToken,
    `${SUPABASE_RPC_URL}/merge_player_progress`,
    {
      method: 'POST',
      body: JSON.stringify({
        p_player_id: progress.player_id,
        p_xp: progress.xp,
        p_classic_score: progress.classic_score,
        p_classic_words: progress.classic_words,
        p_classic_completed_levels: progress.classic_completed_levels,
        p_classic_clue_uses: progress.classic_clue_uses,
        p_classic_clue_words: progress.classic_clue_words,
        p_duel_wins: progress.duel_wins,
        p_league_points: progress.league_points,
        p_league_wins: progress.league_wins,
        p_league_losses: progress.league_losses,
      }),
    },
  );
  return Array.isArray(response) ? response[0] ?? null : response;
};
