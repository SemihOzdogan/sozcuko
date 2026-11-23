import {
  SUPABASE_ANON_KEY,
  SUPABASE_REST_URL,
  SUPABASE_RPC_URL,
} from '../config';
import type { ClassicPuzzle } from '../game/classicPuzzles';
import { getLevelDesign } from '../game/levelDesign';

export type WordSource = 'api';

export type WordLookup = {
  words: string[];
  source: WordSource;
};

const wordMeaningCache = new Map<string, string | null>();

type PuzzleRow = Omit<ClassicPuzzle, 'bonusWords'> & {
  bonus_words?: string[];
  total_puzzles?: number;
  design?: ClassicPuzzle['design'];
};

const mapPuzzle = (row: PuzzleRow, level: number): ClassicPuzzle => ({
  ...row,
  bonusWords: row.bonus_words ?? [],
  design:
    row.design && Object.keys(row.design).length > 0
      ? row.design
      : getLevelDesign(level),
});

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
  if (!response.ok) throw new Error(`Kelime API hatası (${response.status})`);
  return response.json() as Promise<T>;
};

export const fetchWordsForLetters = async (
  letters: string,
  limit = 100,
): Promise<WordLookup> => {
  const payload = await request<Array<{ word: string }>>(
    `${SUPABASE_RPC_URL}/find_words`,
    {
      method: 'POST',
      body: JSON.stringify({ input_letters: letters, result_limit: limit }),
    },
  );
  const words = payload
    .map(item => item.word?.trim().toLocaleUpperCase('tr-TR'))
    .filter((word): word is string => Boolean(word));
  return { words: Array.from(new Set(words)), source: 'api' };
};

export const validateWord = async (word: string): Promise<boolean> => {
  const payload = await request<boolean>(`${SUPABASE_RPC_URL}/validate_word`, {
    method: 'POST',
    body: JSON.stringify({ input_word: word }),
  });
  return payload === true;
};

type TdkMeaningResponse = {
  anlamlarListe?: Array<{ anlam?: string }>;
};

export const fetchWordMeaning = async (
  word: string,
): Promise<string | null> => {
  const normalized = word.trim().toLocaleUpperCase('tr-TR');
  if (!normalized) return null;
  if (wordMeaningCache.has(normalized)) {
    return wordMeaningCache.get(normalized) ?? null;
  }

  try {
    const query = normalized.toLocaleLowerCase('tr-TR');
    const response = await fetch(
      `https://sozluk.gov.tr/gts?ara=${encodeURIComponent(query)}`,
    );
    if (!response.ok) throw new Error(`TDK sözlük hatası (${response.status})`);
    const payload = (await response.json()) as TdkMeaningResponse[];
    const meanings = payload
      .flatMap(entry => entry.anlamlarListe ?? [])
      .map(entry => entry.anlam?.trim())
      .filter((entry): entry is string => Boolean(entry));
    const meaning =
      meanings.find(entry => !entry.startsWith('►')) ?? meanings[0] ?? null;
    if (meaning) wordMeaningCache.set(normalized, meaning);
    return meaning ?? null;
  } catch {
    return null;
  }
};

export const fetchClassicPuzzle = async (
  level: number,
): Promise<{ puzzle: ClassicPuzzle; totalPuzzles: number }> => {
  const rows = await request<PuzzleRow[]>(
    `${SUPABASE_REST_URL}/classic_puzzles?level=eq.${level}&select=*&limit=1`,
  );
  if (!rows[0]) throw new Error('API geçerli bir klasik bölüm döndürmedi.');
  return {
    puzzle: mapPuzzle(rows[0], level),
    totalPuzzles: rows[0].total_puzzles ?? 100,
  };
};
