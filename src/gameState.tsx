import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './authState';
import {
  fetchCloudProgress,
  saveCloudProgress,
  type CloudProgress,
} from './services/progressService';

type GameState = {
  xp: number;
  classicScore: number;
  classicWords: number;
  classicCompletedLevels: number[];
  classicClueUses: Record<string, number>;
  classicClueWords: Record<string, string>;
  isHydrated: boolean;
  duelWins: number;
  leaguePoints: number;
  leagueWins: number;
  leagueLosses: number;
  level: number;
  award: (xp: number) => void;
  spendXp: (amount: number) => boolean;
  solveClassic: () => void;
  completeClassicLevel: (level: number) => void;
  recordClassicClueUse: (level: number, word: string) => void;
  finishDuel: (result: 'win' | 'lose' | 'draw') => void;
  resetProgress: () => void;
};
const GameContext = createContext<GameState | null>(null);
// İlerleme sıfırlama sürümü: eski cihaz kayıtları yeni sezona taşınmaz.
// Sunucu tarafındaki toplu temizleme sonrası eski cihaz ilerlemesi yeniden
// yüklenmesin diye yerel kayıt sürümü bilinçli olarak artırıldı.
const GAME_STATE_KEY = '@sozcuko/game-state:v3';
const ONE_TIME_RESET_KEY = '@sozcuko/one-time-reset-applied:v1';
const LEGACY_GAME_STATE_KEYS = [
  '@sozcuko/game-state',
  '@sozcuko/game-state:v1',
  '@sozcuko/game-state:v2',
];
const DEFAULT_STATE = {
  xp: 0,
  classicScore: 0,
  classicWords: 0,
  classicCompletedLevels: [] as number[],
  classicClueUses: {} as Record<string, number>,
  classicClueWords: {} as Record<string, string>,
  duelWins: 0,
  leaguePoints: 0,
  leagueWins: 0,
  leagueLosses: 0,
};
type StoredGameState = Partial<typeof DEFAULT_STATE>;

const maxRecord = (
  local: Record<string, number>,
  remote: Record<string, number>,
) =>
  Object.fromEntries(
    [...new Set([...Object.keys(local), ...Object.keys(remote)])].map(key => [
      key,
      Math.max(local[key] ?? 0, remote[key] ?? 0),
    ]),
  );

const mergeProgress = (
  local: Omit<CloudProgress, 'player_id' | 'updated_at'>,
  remote: CloudProgress,
): Omit<CloudProgress, 'player_id' | 'updated_at'> => {
  const clueUses = maxRecord(local.classic_clue_uses, remote.classic_clue_uses);
  const clueWords = [
    ...new Set([
      ...Object.keys(local.classic_clue_words),
      ...Object.keys(remote.classic_clue_words),
    ]),
  ].reduce<Record<string, string>>((result, key) => {
    const selectedWord =
      (remote.classic_clue_uses[key] ?? 0) >
      (local.classic_clue_uses[key] ?? 0)
        ? remote.classic_clue_words[key]
        : local.classic_clue_words[key] ?? remote.classic_clue_words[key];
    if (selectedWord) result[key] = selectedWord;
    return result;
  }, {});
  return {
    xp: Math.max(local.xp, remote.xp),
    classic_score: Math.max(local.classic_score, remote.classic_score),
    classic_words: Math.max(local.classic_words, remote.classic_words),
    classic_completed_levels: Array.from(
      new Set([
        ...local.classic_completed_levels,
        ...remote.classic_completed_levels,
      ]),
    ).sort((a, b) => a - b),
    classic_clue_uses: clueUses,
    classic_clue_words: clueWords,
    duel_wins: Math.max(local.duel_wins, remote.duel_wins),
    league_points: Math.max(local.league_points, remote.league_points),
    league_wins: Math.max(local.league_wins, remote.league_wins),
    league_losses: Math.max(local.league_losses, remote.league_losses),
  };
};

export function GameProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [xp, setXp] = useState(DEFAULT_STATE.xp);
  const xpRef = useRef(DEFAULT_STATE.xp);
  const [classicScore, setClassicScore] = useState(DEFAULT_STATE.classicScore);
  const [classicWords, setClassicWords] = useState(DEFAULT_STATE.classicWords);
  const [classicCompletedLevels, setClassicCompletedLevels] = useState<
    number[]
  >(DEFAULT_STATE.classicCompletedLevels);
  const [classicClueUses, setClassicClueUses] = useState<
    Record<string, number>
  >(DEFAULT_STATE.classicClueUses);
  const [classicClueWords, setClassicClueWords] = useState<
    Record<string, string>
  >(DEFAULT_STATE.classicClueWords);
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [duelWins, setDuelWins] = useState(DEFAULT_STATE.duelWins);
  const [leaguePoints, setLeaguePoints] = useState(DEFAULT_STATE.leaguePoints);
  const [leagueWins, setLeagueWins] = useState(DEFAULT_STATE.leagueWins);
  const [leagueLosses, setLeagueLosses] = useState(DEFAULT_STATE.leagueLosses);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONE_TIME_RESET_KEY)
      .then(resetApplied => {
        if (resetApplied) return;
        return AsyncStorage.multiRemove([
          GAME_STATE_KEY,
          ...LEGACY_GAME_STATE_KEYS,
        ]).then(() => AsyncStorage.setItem(ONE_TIME_RESET_KEY, 'true'));
      })
      .then(() => AsyncStorage.multiRemove(LEGACY_GAME_STATE_KEYS))
      .then(() => AsyncStorage.getItem(GAME_STATE_KEY))
      .then(raw => {
        if (!active) return;
        try {
          const stored = raw ? (JSON.parse(raw) as StoredGameState) : null;
          if (stored) {
            if (typeof stored.xp === 'number') {
              xpRef.current = stored.xp;
              setXp(stored.xp);
            }
            if (typeof stored.classicScore === 'number')
              setClassicScore(stored.classicScore);
            if (typeof stored.classicWords === 'number')
              setClassicWords(stored.classicWords);
            if (Array.isArray(stored.classicCompletedLevels))
              setClassicCompletedLevels(
                stored.classicCompletedLevels.filter(
                  level => Number.isInteger(level) && level >= 0,
                ),
              );
            if (
              stored.classicClueUses &&
              typeof stored.classicClueUses === 'object' &&
              !Array.isArray(stored.classicClueUses)
            ) {
              const validClueUses = Object.fromEntries(
                Object.entries(stored.classicClueUses).filter(
                  ([key, value]) =>
                    /^\d+$/.test(key) &&
                    typeof value === 'number' &&
                    Number.isInteger(value) &&
                    value >= 0,
                ),
              );
              setClassicClueUses(validClueUses);
            }
            if (
              stored.classicClueWords &&
              typeof stored.classicClueWords === 'object' &&
              !Array.isArray(stored.classicClueWords)
            ) {
              const validClueWords = Object.fromEntries(
                Object.entries(stored.classicClueWords).filter(
                  ([key, value]) =>
                    /^\d+$/.test(key) && typeof value === 'string',
                ),
              );
              setClassicClueWords(validClueWords);
            }
            if (typeof stored.duelWins === 'number')
              setDuelWins(stored.duelWins);
            if (typeof stored.leaguePoints === 'number')
              setLeaguePoints(Math.max(0, stored.leaguePoints));
            if (typeof stored.leagueWins === 'number')
              setLeagueWins(Math.max(0, stored.leagueWins));
            if (typeof stored.leagueLosses === 'number')
              setLeagueLosses(Math.max(0, stored.leagueLosses));
            return;
          }

          return;
        } catch {
          /* Bozuk kayıt varsa temiz başlangıç kullanılır. */
        }
      })
      .finally(() => {
        if (active) setIsHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!isHydrated) return;
    const snapshot = {
      xp,
      classicScore,
      classicWords,
      classicCompletedLevels,
      classicClueUses,
      classicClueWords,
      duelWins,
      leaguePoints,
      leagueWins,
      leagueLosses,
    };
    AsyncStorage.setItem(GAME_STATE_KEY, JSON.stringify(snapshot)).catch(
      () => undefined,
    );
  }, [
    xp,
    classicScore,
    classicWords,
    classicCompletedLevels,
    classicClueUses,
    classicClueWords,
    duelWins,
    leaguePoints,
    leagueWins,
    leagueLosses,
    isHydrated,
  ]);
  useEffect(() => {
    if (!isHydrated) return;
    const accessToken = session?.access_token;
    const playerId = session?.user?.id;
    if (!accessToken || !playerId) {
      setCloudSyncReady(false);
      return;
    }

    let active = true;
    setCloudSyncReady(false);
    const localProgress = {
      xp,
      classic_score: classicScore,
      classic_words: classicWords,
      classic_completed_levels: classicCompletedLevels,
      classic_clue_uses: classicClueUses,
      classic_clue_words: classicClueWords,
      duel_wins: duelWins,
      league_points: leaguePoints,
      league_wins: leagueWins,
      league_losses: leagueLosses,
    };
    fetchCloudProgress(accessToken, playerId)
      .then(cloudProgress => {
        if (!active) return;
        if (!cloudProgress) {
          setCloudSyncReady(true);
          return;
        }
        const merged = mergeProgress(localProgress, cloudProgress);
        xpRef.current = merged.xp;
        setXp(merged.xp);
        setClassicScore(merged.classic_score);
        setClassicWords(merged.classic_words);
        setClassicCompletedLevels(merged.classic_completed_levels);
        setClassicClueUses(merged.classic_clue_uses);
        setClassicClueWords(merged.classic_clue_words);
        setDuelWins(merged.duel_wins);
        setLeaguePoints(merged.league_points);
        setLeagueWins(merged.league_wins);
        setLeagueLosses(merged.league_losses);
        setCloudSyncReady(true);
      })
      .catch(() => {
        // Bulut erişilemiyorsa yerel ilerleme ile devam edilir.
        if (active) setCloudSyncReady(true);
      });
    return () => {
      active = false;
    };
  }, [isHydrated, session?.access_token, session?.user?.id]);
  const cloudPlayerId = session?.user?.id;
  useEffect(() => {
    if (!isHydrated || !cloudSyncReady || !session?.access_token || !cloudPlayerId)
      return;
    const timeout = setTimeout(() => {
      saveCloudProgress(session.access_token, {
        player_id: cloudPlayerId,
        xp,
        classic_score: classicScore,
        classic_words: classicWords,
        classic_completed_levels: classicCompletedLevels,
        classic_clue_uses: classicClueUses,
        classic_clue_words: classicClueWords,
        duel_wins: duelWins,
        league_points: leaguePoints,
        league_wins: leagueWins,
        league_losses: leagueLosses,
      }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timeout);
  }, [
    isHydrated,
    cloudSyncReady,
    session?.access_token,
    cloudPlayerId,
    xp,
    classicScore,
    classicWords,
    classicCompletedLevels,
    classicClueUses,
    classicClueWords,
    duelWins,
    leaguePoints,
    leagueWins,
    leagueLosses,
  ]);
  useEffect(() => {
    xpRef.current = xp;
  }, [xp]);
  const level = Math.floor(xp / 200) + 1;
  const award = (amount: number) => {
    const nextXp = xpRef.current + amount;
    xpRef.current = nextXp;
    setXp(nextXp);
  };
  const spendXp = (amount: number) => {
    if (amount <= 0 || xpRef.current < amount) return false;
    const nextXp = xpRef.current - amount;
    xpRef.current = nextXp;
    setXp(nextXp);
    return true;
  };
  const resetProgress = () => {
    xpRef.current = DEFAULT_STATE.xp;
    setXp(DEFAULT_STATE.xp);
    setClassicScore(DEFAULT_STATE.classicScore);
    setClassicWords(DEFAULT_STATE.classicWords);
    setClassicCompletedLevels(DEFAULT_STATE.classicCompletedLevels);
    setClassicClueUses(DEFAULT_STATE.classicClueUses);
    setClassicClueWords(DEFAULT_STATE.classicClueWords);
    setDuelWins(DEFAULT_STATE.duelWins);
    setLeaguePoints(DEFAULT_STATE.leaguePoints);
    setLeagueWins(DEFAULT_STATE.leagueWins);
    setLeagueLosses(DEFAULT_STATE.leagueLosses);
  };
  const value = useMemo(
    () => ({
      xp,
      classicScore,
      classicWords,
      classicCompletedLevels,
      classicClueUses,
      classicClueWords,
      isHydrated,
      duelWins,
      leaguePoints,
      leagueWins,
      leagueLosses,
      level,
      award,
      spendXp,
      solveClassic: () => {
        setClassicScore(value => value + 160);
        setClassicWords(value => value + 1);
        award(25);
      },
      completeClassicLevel: (level: number) => {
        setClassicCompletedLevels(value =>
          value.includes(level) ? value : [...value, level],
        );
      },
      recordClassicClueUse: (level: number, word: string) => {
        setClassicClueUses(value => {
          const key = String(level);
          return { ...value, [key]: (value[key] ?? 0) + 1 };
        });
        setClassicClueWords(value => ({ ...value, [String(level)]: word }));
      },
      finishDuel: (result: 'win' | 'lose' | 'draw') => {
        if (result === 'win') {
          setDuelWins(value => value + 1);
          award(30);
        }
      },
      resetProgress,
    }),
    [
      xp,
      classicScore,
      classicWords,
      classicCompletedLevels,
      classicClueUses,
      classicClueWords,
      isHydrated,
      duelWins,
      leaguePoints,
      leagueWins,
      leagueLosses,
      level,
    ],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
export function useGame() {
  const state = useContext(GameContext);
  if (!state) throw new Error('GameProvider eksik');
  return state;
}
