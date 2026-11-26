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

type GameState = {
  xp: number;
  classicScore: number;
  classicWords: number;
  classicCompletedLevels: number[];
  classicClueUses: Record<string, number>;
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
  recordClassicClueUse: (level: number) => void;
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
  duelWins: 0,
  leaguePoints: 0,
  leagueWins: 0,
  leagueLosses: 0,
};
type StoredGameState = Partial<typeof DEFAULT_STATE>;
export function GameProvider({ children }: { children: ReactNode }) {
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
    duelWins,
    leaguePoints,
    leagueWins,
    leagueLosses,
    isHydrated,
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
      recordClassicClueUse: (level: number) => {
        setClassicClueUses(value => {
          const key = String(level);
          return { ...value, [key]: (value[key] ?? 0) + 1 };
        });
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
