import { useEffect, useRef, useState, type ComponentRef } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Animated,
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
  useColorScheme,
  TouchableOpacity,
  DynamicColorIOS,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../App';
import { BackHeader, C as GlobalC, gameFeedback } from '../ui';
import { useGame } from '../gameState';
import type { ClassicPuzzle } from '../game/classicPuzzles';
import {
  fetchClassicPuzzle,
  fetchWordMeaning,
  validateWord,
} from '../services/wordService';
import {
  createClassicEngineState,
  submitClassicWord,
} from '../game/classicEngine';
import { trackEvent } from '../services/analyticsService';
import { showCheckpointAd, showRewardedClueAd } from '../services/adService';

type Props = NativeStackScreenProps<RootStackParamList, 'Classic'>;
type FeedbackTone = 'neutral' | 'success' | 'error';
const adaptive = (dark: string, light: string) =>
  DynamicColorIOS({ dark, light }) as unknown as string;
const C = {
  ...GlobalC,
  bg: adaptive('#101729', '#D7E3E4'),
  surface: adaptive('#17243B', '#F0F6F3'),
  raised: adaptive('#213452', '#E0ECE9'),
  text: adaptive('#FFFDF5', '#18343B'),
  muted: adaptive('#AAB9CC', '#5B7174'),
  ink: '#081426',
  cream: adaptive('#FFF5D8', '#6A4B15'),
};
const WHEEL_SIZE = 314;
const LETTER_SIZE = 72;
const RADIUS = 112;
const HINT_COST = 50;
const WORD_CLUES: Record<string, string> = {
  EMİR: 'Buyruk veya talimat anlamına gelir.',
  REİS: 'Bir grubun veya topluluğun başındaki kişi.',
  SERİ: 'Ardışık gelen veya hızlı gerçekleşen.',
  ESİR: 'Özgürlüğü olmayan, tutsak kişi.',
  KALEM: 'Yazı yazmaya yarayan araç.',
  KALE: 'Savunma amacıyla yapılmış büyük yapı.',
  ELMA: 'Genellikle kırmızı veya yeşil olan bir meyve.',
  KEL: 'Saçları olmayan kişi.',
  MAL: 'Alınıp satılan eşya veya ürün.',
  KAM: 'Eski Türklerde dinî törenleri yöneten kişi.',
  BAHAR: 'Kış ile yaz arasındaki mevsim.',
  BAH: 'Satrançta veya dama oyununda kullanılan bir terim.',
  HAR: 'Ateşin çıkardığı sıcaklık veya alev.',
  KUŞAK: 'Bele sarılan veya nesilleri ifade eden kelime.',
  KUŞ: 'Kanatları ve tüyleri olan hayvan.',
  ŞAK: 'Şaka kelimesinin kısa kullanımı.',
};
const CONFETTI = [
  { x: -150, y: -170, color: C.gold, rotate: '210deg' },
  { x: -105, y: -210, color: C.coral, rotate: '35deg' },
  { x: -45, y: -185, color: C.mint, rotate: '140deg' },
  { x: 35, y: -215, color: '#FFF5D8', rotate: '260deg' },
  { x: 105, y: -180, color: C.gold, rotate: '85deg' },
  { x: 155, y: -125, color: C.coral, rotate: '190deg' },
  { x: -175, y: -45, color: C.mint, rotate: '300deg' },
  { x: 175, y: -35, color: '#FFF5D8', rotate: '20deg' },
  { x: -160, y: 55, color: C.gold, rotate: '120deg' },
  { x: 165, y: 65, color: C.coral, rotate: '250deg' },
  { x: -115, y: 145, color: '#FFF5D8', rotate: '15deg' },
  { x: -45, y: 175, color: C.mint, rotate: '200deg' },
  { x: 35, y: 185, color: C.gold, rotate: '65deg' },
  { x: 110, y: 145, color: C.coral, rotate: '300deg' },
];
const shuffleLetters = (letters: string[]): string[] => {
  const shuffled = [...letters];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
};
const isPuzzleBoardComplete = (
  currentPuzzle: ClassicPuzzle,
  cells: Record<string, string>,
) => {
  const activeCells = new Set<string>();
  currentPuzzle.words.forEach(word =>
    currentPuzzle.placements[word].forEach(({ row, column }) =>
      activeCells.add(`${row}:${column}`),
    ),
  );
  return (
    activeCells.size > 0 && [...activeCells].every(key => Boolean(cells[key]))
  );
};
export function ClassicScreen({ navigation }: Props) {
  const game = useGame();
  const isLight = useColorScheme() === 'light';
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Base the whole game layout on the reference 390x844 viewport.
  // Width and height use the same scale so the composition never gets squashed.
  const referenceScale = Math.min(screenWidth / 390, screenHeight / 844);
  const uiScale = Math.max(0.62, Math.min(0.88, referenceScale));
  const lineThickness = Math.max(4, Math.round(5 * uiScale));
  const [level, setLevel] = useState(0);
  const [retry, setRetry] = useState(0);
  const [puzzle, setPuzzle] = useState<ClassicPuzzle | null>(null);
  const [totalPuzzles, setTotalPuzzles] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialLevelResolvedRef = useRef(false);
  const wheelRef = useRef<ComponentRef<typeof View>>(null);
  const wheelFrame = useRef({ x: 0, y: 0 });
  const [wheelLetters, setWheelLetters] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  const submittingRef = useRef(false);
  const hintInFlightRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellAnimationsRef = useRef<Record<string, Animated.Value>>({});
  const previousRevealedRef = useRef<Record<string, string>>({});
  const animationPuzzleRef = useRef<string | null>(null);
  const [solved, setSolved] = useState<string[]>([]);
  const [bonusWords, setBonusWords] = useState<string[]>([]);
  const [revealedCells, setRevealedCells] = useState<Record<string, string>>(
    {},
  );
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('neutral');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canRetrySubmit, setCanRetrySubmit] = useState(false);
  const feedbackAnimation = useRef(new Animated.Value(0)).current;
  const [clueMessage, setClueMessage] = useState<string | null>(null);
  const [isClueVisible, setIsClueVisible] = useState(false);
  const [isClueLoading, setIsClueLoading] = useState(false);
  const [isClueRewardLoading, setIsClueRewardLoading] = useState(false);
  const [isClueRewardUnavailable, setIsClueRewardUnavailable] = useState(false);
  const clueRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [successBurstVisible, setSuccessBurstVisible] = useState(false);
  const successBurstAnimation = useRef(new Animated.Value(0)).current;
  const [advanceRequested, setAdvanceRequested] = useState(false);
  useEffect(() => {
    if (!game.isHydrated || initialLevelResolvedRef.current) return;
    const next = Array.from({ length: 100 }, (_, index) => index).find(
      index => !game.classicCompletedLevels.includes(index),
    );
    initialLevelResolvedRef.current = true;
    setLevel(next ?? 0);
  }, [game.isHydrated, game.classicCompletedLevels]);
  useEffect(() => {
    if (!game.isHydrated) return;
    let active = true;
    selectedRef.current = [];
    setSelected([]);
    setSolved([]);
    setBonusWords([]);
    setRevealedCells({});
    setFeedback('');
    setIsSubmitting(false);
    setCanRetrySubmit(false);
    setClueMessage(null);
    setIsClueLoading(false);
    setIsClueVisible(false);
    setIsClueRewardLoading(false);
    setIsClueRewardUnavailable(false);
    if (clueRetryTimerRef.current) {
      clearTimeout(clueRetryTimerRef.current);
      clueRetryTimerRef.current = null;
    }
    setSuccessBurstVisible(false);
    setLoadError(null);
    setPuzzle(null);
    fetchClassicPuzzle(level)
      .then(result => {
        if (!active) return;
        setPuzzle(result.puzzle);
        setTotalPuzzles(result.totalPuzzles);
        setWheelLetters(shuffleLetters(result.puzzle.letters));
        trackEvent('level_started', {
          level,
          puzzleId: result.puzzle.id,
          wordCount: result.puzzle.words.length,
        });
      })
      .catch(error => {
        if (active)
          setLoadError(
            error instanceof Error ? error.message : 'Kelime API erişilemedi.',
          );
      });
    return () => {
      active = false;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (clueRetryTimerRef.current) {
        clearTimeout(clueRetryTimerRef.current);
        clueRetryTimerRef.current = null;
      }
    };
  }, [game.isHydrated, level, retry]);
  useEffect(() => {
    if (!advanceRequested) return;
    setAdvanceRequested(false);
    if (totalPuzzles > 0 && level + 1 >= totalPuzzles) return;
    setPuzzle(null);
    setWheelLetters([]);
    setLevel(value => value + 1);
    selectedRef.current = [];
    setSelected([]);
    setSolved([]);
    setBonusWords([]);
    setRevealedCells({});
  }, [advanceRequested, level, totalPuzzles]);
  useEffect(() => {
    if (!puzzle) return;
    if (animationPuzzleRef.current !== puzzle.id) {
      animationPuzzleRef.current = puzzle.id;
      cellAnimationsRef.current = {};
      previousRevealedRef.current = {};
    }
    const newlyRevealed = Object.keys(revealedCells).filter(
      key => revealedCells[key] && !previousRevealedRef.current[key],
    );
    newlyRevealed.forEach(key => {
      const animation = cellAnimationsRef.current[key] ?? new Animated.Value(0);
      cellAnimationsRef.current[key] = animation;
      animation.setValue(0);
    });
    if (newlyRevealed.length > 0) {
      Animated.stagger(
        55,
        newlyRevealed.map(key =>
          Animated.spring(cellAnimationsRef.current[key], {
            toValue: 1,
            friction: 6,
            tension: 110,
            useNativeDriver: true,
          }),
        ),
      ).start();
    }
    previousRevealedRef.current = revealedCells;
  }, [puzzle, revealedCells]);
  const requestAdvance = () => {
    if (totalPuzzles > 0 && level + 1 >= totalPuzzles) {
      setFeedback('Bölüm tamamlandı. Tüm bölümler bitti.');
      return;
    }
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(async () => {
      advanceTimerRef.current = null;
      await showCheckpointAd(level);
      setAdvanceRequested(true);
    }, 900);
  };
  const showFeedback = (message: string, tone: FeedbackTone = 'neutral') => {
    setFeedback(message);
    setFeedbackTone(tone);
    feedbackAnimation.stopAnimation();
    feedbackAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackAnimation, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(feedbackAnimation, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };
  const triggerSuccessBurst = () => {
    setSuccessBurstVisible(true);
    successBurstAnimation.setValue(0);
    Animated.timing(successBurstAnimation, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: true,
    }).start();
  };
  const allCompleted =
    totalPuzzles > 0 && game.classicCompletedLevels.length >= totalPuzzles;
  if (allCompleted)
    return (
      <LinearGradient
        colors={
          isLight
            ? ['#D7E3E4', '#C8D9D9', '#DDE9E5']
            : ['#101729', '#17243B', '#213452']
        }
        style={s.root}
      >
        <StatusBar
          barStyle={isLight ? 'dark-content' : 'light-content'}
          backgroundColor={isLight ? '#D7E3E4' : '#101729'}
        />
        <BackHeader
          title="Klasik Kelime"
          tag="TÜM BÖLÜMLER TAMAM"
          color={C.mint}
          minimal
          onBack={navigation.goBack}
        />
        <View style={s.completion}>
          <Text style={s.completionIcon}>✓</Text>
          <Text style={s.completionTitle}>Tüm bölümler tamamlandı</Text>
          <Text style={s.completionText}>
            Yeni bölümler eklendiğinde burada görünecek.
          </Text>
        </View>
      </LinearGradient>
    );
  if (!puzzle)
    return (
      <LinearGradient
        colors={
          isLight
            ? ['#D7E3E4', '#C8D9D9', '#DDE9E5']
            : ['#101729', '#17243B', '#213452']
        }
        style={s.root}
      >
        <StatusBar
          barStyle={isLight ? 'dark-content' : 'light-content'}
          backgroundColor={isLight ? '#D7E3E4' : '#101729'}
        />
        <BackHeader
          title="Klasik Kelime"
          tag="BÖLÜM YÜKLENİYOR"
          color={C.mint}
          minimal
          onBack={navigation.goBack}
        />
        <View style={s.completion}>
          {loadError ? (
            <Text style={s.completionTitle}>{loadError}</Text>
          ) : (
            <ActivityIndicator size="large" color={C.mint} />
          )}
          {loadError && (
            <Pressable onPress={() => setRetry(value => value + 1)}>
              <Text style={s.shuffle}>Tekrar dene</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
    );
  const sizingSlots = Object.values(puzzle.placements).flat();
  const sizingRows =
    Math.max(...sizingSlots.map(slot => slot.row)) -
    Math.min(...sizingSlots.map(slot => slot.row)) +
    1;
  const sizingColumns =
    Math.max(...sizingSlots.map(slot => slot.column)) -
    Math.min(...sizingSlots.map(slot => slot.column)) +
    1;
  const boardInset = Math.max(3, Math.round(4 * uiScale));
  const boardPadding = boardInset * 2;
  const boardOuterPadding = Math.round(10 * uiScale);
  // BackHeader = safe-area top + 46px XP frame + 14px bottom padding.
  const headerHeight = insets.top + 46 + 14;
  const contentPadding = 12 + 24;
  const boardMargin = Math.round(4 * uiScale);
  // Selection panel without the wheel: clue button, word display, feedback,
  // utility row, margins and card padding. Keep this larger than the visual
  // minimum so the bottom controls never get pushed below the viewport.
  // Compact selection controls: clue, word preview, feedback, gaps and
  // utility buttons. This leaves the wheel large without overflowing.
  // Fixed space above and below the wheel. The utility row is pushed to the
  // bottom of the 60% card with an auto top margin.
  const reservedSelection = 162;
  const availableContentHeight = Math.max(
    0,
    screenHeight - headerHeight - contentPadding,
  );
  // The playable area is split independently of puzzle content: cells use
  // 40%, while the wheel card uses the remaining 60%.
  const playableHeight = Math.max(0, availableContentHeight - boardMargin);
  const boardCardHeight = Math.round(playableHeight * 0.4);
  const selectionCardHeight = playableHeight - boardCardHeight;
  const wheelSize = Math.min(
    250,
    Math.max(132, selectionCardHeight - reservedSelection),
  );
  const maximumBoardHeight = Math.max(140, boardCardHeight);
  const sizingPitch = Math.max(
    18,
    Math.min(
      56 * uiScale,
      (screenWidth - 32) / sizingColumns,
      (maximumBoardHeight - boardPadding - boardOuterPadding * 2) / sizingRows,
    ),
  );
  const letterSize = Math.round(LETTER_SIZE * (wheelSize / WHEEL_SIZE));
  const wheelCenter = wheelSize / 2;
  const wheelRadius = RADIUS * (wheelSize / WHEEL_SIZE);
  const positions = wheelLetters.map((_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / wheelLetters.length;
    return {
      x: wheelCenter + Math.cos(angle) * wheelRadius,
      y: wheelCenter + Math.sin(angle) * wheelRadius,
    };
  });
  const pick = (x: number, y: number) => {
    if (submittingRef.current) return;
    const index = positions.findIndex(
      point => Math.hypot(point.x - x, point.y - y) < letterSize * 0.63,
    );
    if (index < 0) return;
    const firstIndex = selectedRef.current[0];
    const lastIndex = selectedRef.current[selectedRef.current.length - 1];
    const closesWord =
      selectedRef.current.length >= 2 &&
      index === firstIndex &&
      lastIndex !== firstIndex;
    if (closesWord || !selectedRef.current.includes(index)) {
      const next = [...selectedRef.current, index];
      selectedRef.current = next;
      setSelected(next);
    }
  };
  const finish = async () => {
    if (submittingRef.current) return;
    const candidate = selectedRef.current
      .map(index => wheelLetters[index])
      .join('');
    if (!candidate) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setCanRetrySubmit(false);
    showFeedback('Kelime kontrol ediliyor…');
    let valid = false;
    try {
      valid = await validateWord(candidate);
    } catch {
      submittingRef.current = false;
      setIsSubmitting(false);
      setCanRetrySubmit(true);
      showFeedback('Kelime kontrol edilemedi.', 'error');
      return;
    }
    const result = submitClassicWord(
      puzzle,
      {
        ...createClassicEngineState(),
        solvedWords: solved,
        bonusWords,
        revealedCells,
      },
      candidate,
      valid,
    );
    trackEvent('word_submitted', {
      level,
      wordLength: result.word.length,
      outcome: result.kind,
    });
    setSolved(result.state.solvedWords);
    setBonusWords(result.state.bonusWords);
    setRevealedCells(result.state.revealedCells);
    if (result.kind === 'target') {
      trackEvent('word_solved', { level, wordLength: result.word.length });
      gameFeedback('success');
      game.solveClassic();
      if (result.complete) {
        trackEvent('level_completed', {
          level,
          solvedWords: result.state.solvedWords.length,
          bonusWords: result.state.bonusWords.length,
        });
        game.completeClassicLevel(level);
        triggerSuccessBurst();
        requestAdvance();
      } else showFeedback(`Doğru! ${result.word} · +25 XP`, 'success');
    } else if (result.kind === 'bonus') {
      gameFeedback('success');
      game.award(5);
      showFeedback(`Bonus kelime! ${result.word} · +5 XP`, 'success');
    } else if (result.kind === 'duplicate') {
      gameFeedback('error');
      showFeedback('Bu kelimeyi zaten buldun.', 'error');
    } else {
      trackEvent('word_invalid', { level, wordLength: result.word.length });
      gameFeedback('error');
      showFeedback(`“${result.word}” geçerli bir kelime değil.`, 'error');
    }
    selectedRef.current = [];
    setSelected([]);
    submittingRef.current = false;
    setIsSubmitting(false);
    setCanRetrySubmit(false);
  };
  const showHint = () => {
    if (hintInFlightRef.current) return;
    hintInFlightRef.current = true;
    const hiddenSlots = puzzle.words
      .filter(word => !solved.includes(word))
      .flatMap(word => puzzle.placements[word])
      .filter(slot => !revealedCells[`${slot.row}:${slot.column}`]);
    const hiddenSlot =
      hiddenSlots[Math.floor(Math.random() * hiddenSlots.length)];
    if (!hiddenSlot) {
      setFeedback('Bu bölümde açılacak başka harf kalmadı.');
      hintInFlightRef.current = false;
      return;
    }
    if (!game.spendXp(HINT_COST)) {
      setFeedback(`Yetersiz XP. İpucu için ${HINT_COST} XP gerekiyor.`);
      hintInFlightRef.current = false;
      return;
    }
    const key = `${hiddenSlot.row}:${hiddenSlot.column}`;
    trackEvent('hint_used', { level, cost: HINT_COST });
    const nextRevealedCells = { ...revealedCells, [key]: hiddenSlot.letter };
    setRevealedCells(nextRevealedCells);
    if (isPuzzleBoardComplete(puzzle, nextRevealedCells)) {
      game.completeClassicLevel(level);
      triggerSuccessBurst();
      requestAdvance();
    }
    setFeedback(`İpucu kullanıldı: bir harf açıldı. · -${HINT_COST} XP`);
    hintInFlightRef.current = false;
  };
  const showClue = async () => {
    const target = puzzle.words.find(word => !solved.includes(word));
    if (!target) {
      setClueMessage('Bu bölümde ipucu verilecek kelime kalmadı.');
      setIsClueVisible(true);
      return;
    }
    const clueUses = game.classicClueUses[String(level)] ?? 0;
    if (clueUses > 0) {
      setIsClueRewardLoading(true);
      const rewardGranted = await showRewardedClueAd();
      setIsClueRewardLoading(false);
      if (!rewardGranted) {
        showFeedback(
          'Reklam şu anda yüklenemedi. Lütfen tekrar dene.',
          'error',
        );
        setIsClueRewardUnavailable(true);
        if (clueRetryTimerRef.current) {
          clearTimeout(clueRetryTimerRef.current);
        }
        clueRetryTimerRef.current = setTimeout(() => {
          clueRetryTimerRef.current = null;
          setIsClueRewardUnavailable(false);
        }, 15000);
        return;
      }
    }
    game.recordClassicClueUse(level);
    const meaning = WORD_CLUES[target];
    setIsClueVisible(true);
    setIsClueLoading(!meaning);
    setClueMessage(
      meaning ? `${target.length} harfli kelime: Bu kelime ${meaning}` : null,
    );
    if (meaning) return;

    const fetchedMeaning = await fetchWordMeaning(target);
    setIsClueLoading(false);
    setClueMessage(
      fetchedMeaning
        ? `${target.length} harfli kelime: Bu kelime ${fetchedMeaning}`
        : 'Bu kelime için sözlük anlamı şu anda alınamadı. Biraz sonra tekrar dene.',
    );
  };
  const pickFromScreen = (pageX: number, pageY: number) =>
    pick(pageX - wheelFrame.current.x, pageY - wheelFrame.current.y);
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event =>
      pickFromScreen(event.nativeEvent.pageX, event.nativeEvent.pageY),
    onPanResponderMove: event =>
      pickFromScreen(event.nativeEvent.pageX, event.nativeEvent.pageY),
    onPanResponderRelease: finish,
    onPanResponderTerminate: finish,
  });
  const active = new Set<string>();
  puzzle.words.forEach(word =>
    puzzle.placements[word].forEach(({ row, column }) =>
      active.add(`${row}:${column}`),
    ),
  );
  const boardCells = [...active].map(key => {
    const [row, column] = key.split(':').map(Number);
    return { row, column, value: revealedCells[key] ?? null };
  });
  const getCellAnimation = (key: string) => {
    if (!cellAnimationsRef.current[key]) {
      cellAnimationsRef.current[key] = new Animated.Value(0);
    }
    return cellAnimationsRef.current[key];
  };
  const rows = boardCells.map(cell => cell.row);
  const columns = boardCells.map(cell => cell.column);
  const minRow = Math.min(...rows);
  const minColumn = Math.min(...columns);
  const maxRow = Math.max(...rows);
  const maxColumn = Math.max(...columns);
  const boardColumns = maxColumn - minColumn + 1;
  const boardRows = maxRow - minRow + 1;
  const pitch = Math.max(
    22,
    Math.min(
      56 * uiScale,
      (screenWidth - 32) / boardColumns,
      (maximumBoardHeight - boardPadding - boardOuterPadding * 2) / boardRows,
    ),
  );
  // Keep a visible gutter between adjacent cells on every screen size.
  const cellGap = Math.max(8, Math.round(10 * uiScale));
  const cellSize = Math.max(18, pitch - cellGap);
  const current = selected.map(index => wheelLetters[index]).join('');
  const complete =
    solved.length === puzzle.words.length ||
    isPuzzleBoardComplete(puzzle, revealedCells);
  return (
    <LinearGradient
      colors={
        isLight
          ? ['#D7E3E4', '#C8D9D9', '#DDE9E5']
          : ['#101729', '#17243B', '#213452']
      }
      style={s.root}
    >
      <StatusBar
        barStyle={isLight ? 'dark-content' : 'light-content'}
        backgroundColor={isLight ? '#D7E3E4' : '#101729'}
      />
      <BackHeader
        title=""
        tag={`KLASİK · BÖLÜM ${level + 1}${
          puzzle.design?.isRelief ? ' · RAHAT' : ''
        }`}
        color={C.mint}
        tagOnly
        onBack={navigation.goBack}
        rightContent={
          <View style={[s.xpBadge, isLight && s.xpBadgeLight]}>
            <Text style={[s.xpIcon, isLight && s.xpTextLight]}>XP</Text>
            <Text style={[s.xpText, isLight && s.xpTextLight]}>
              {game.xp.toLocaleString('tr-TR')}
            </Text>
          </View>
        }
      />
      <View style={s.content}>
        <View
          style={[
            s.boardCard,
            {
              height: boardCardHeight,
              paddingVertical: boardInset,
              marginBottom: Math.round(4 * uiScale),
            },
          ]}
        >
          <View
            key={puzzle.id}
            style={[
              s.board,
              {
                width: boardColumns * pitch + boardOuterPadding * 2,
                height: (maxRow - minRow + 1) * pitch + boardOuterPadding * 2,
              },
            ]}
          >
            {boardCells.map(cell => {
              const filled =
                typeof cell.value === 'string' && cell.value.length > 0;
              const animation = getCellAnimation(`${cell.row}:${cell.column}`);
              return (
                <Animated.View
                  key={`${cell.row}:${cell.column}`}
                  style={[
                    s.cell,
                    s.activeCell,
                    filled && s.filled,
                    {
                      opacity: filled ? animation : 1,
                      transform: [
                        {
                          scale: filled
                            ? animation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.7, 1],
                              })
                            : 1,
                        },
                      ],
                    },
                    {
                      width: cellSize,
                      height: cellSize,
                      left:
                        boardOuterPadding +
                        (cell.column - minColumn) * pitch +
                        cellGap / 2,
                      top:
                        boardOuterPadding +
                        (cell.row - minRow) * pitch +
                        cellGap / 2,
                    },
                  ]}
                >
                  {filled && (
                    <Animated.Text
                      style={[
                        s.cellText,
                        {
                          width: cellSize,
                          height: cellSize,
                          lineHeight: cellSize - 8,
                          fontSize: Math.max(18, cellSize * 0.58),
                        },
                      ]}
                    >
                      {String(cell.value)}
                    </Animated.Text>
                  )}
                </Animated.View>
              );
            })}
          </View>
        </View>
        <View
          style={[
            s.selectionCard,
            {
              height: selectionCardHeight,
              justifyContent: 'flex-start',
              paddingTop: Math.round(6 * uiScale),
              paddingBottom: Math.round(6 * uiScale),
            },
          ]}
        >
          <TouchableOpacity
            onPress={showClue}
            disabled={isClueRewardLoading}
            accessibilityLabel="Konu ipucunu göster"
            style={[
              s.utilityButton,
              s.clueButton,
              isClueRewardLoading && s.hintDisabled,
            ]}
          >
            <Text style={s.utilityText}>🔎</Text>
            <Text style={s.utilityLabel}>
              {isClueRewardLoading ? 'Reklam hazırlanıyor…' : 'Konu ipucu'}
            </Text>
          </TouchableOpacity>
          <View
            style={[
              s.wordDisplay,
              {
                height: Math.round(32 * uiScale),
                marginTop: Math.round(6 * uiScale),
              },
              !current && s.wordDisplayEmpty,
            ]}
          >
            {current ? <Text style={s.wordDisplayText}>{current}</Text> : null}
          </View>
          <Animated.View
            style={{
              opacity: feedback ? 1 : 0,
              transform: [
                {
                  translateX: feedbackAnimation.interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: [0, -4, 4, -2, 0],
                  }),
                },
                {
                  scale: feedbackAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            }}
          >
            <View style={s.feedbackRow}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={C.mint} />
              ) : null}
              <Text
                style={[
                  s.feedback,
                  feedbackTone === 'success' && s.feedbackSuccess,
                  feedbackTone === 'error' && s.feedbackError,
                ]}
              >
                {feedback}
              </Text>
              {canRetrySubmit ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Kelimeyi tekrar kontrol et"
                  onPress={finish}
                  style={({ pressed }) => [
                    s.retrySubmit,
                    pressed && s.retrySubmitPressed,
                  ]}
                >
                  <Text style={s.retrySubmitText}>TEKRAR DENE</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
          <View
            ref={wheelRef}
            onLayout={() =>
              wheelRef.current?.measureInWindow((x: number, y: number) => {
                wheelFrame.current = { x, y };
              })
            }
            style={[
              s.wheel,
              {
                width: wheelSize,
                height: wheelSize,
                borderRadius: wheelSize / 2,
                marginTop: Math.round(8 * uiScale),
              },
            ]}
            {...panResponder.panHandlers}
          >
            {selected.slice(1).map((index, order) => {
              const from = positions[selected[order]];
              const to = positions[index];
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const length = Math.hypot(dx, dy);
              return (
                <View
                  key={`${index}-${order}`}
                  style={[
                    s.line,
                    {
                      width: length,
                      left: (from.x + to.x) / 2 - length / 2,
                      top: (from.y + to.y) / 2 - lineThickness / 2,
                      height: lineThickness,
                      transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                    },
                  ]}
                />
              );
            })}
            {wheelLetters.map((letter, index) => (
              <View
                key={`${letter}-${index}`}
                style={[
                  s.letter,
                  {
                    left: positions[index].x - letterSize / 2,
                    top: positions[index].y - letterSize / 2,
                    width: letterSize,
                    height: letterSize,
                    borderRadius: letterSize / 2,
                  },
                  selected.includes(index) && s.activeLetter,
                ]}
              >
                <Text
                  style={[s.letterText, { fontSize: Math.round(30 * uiScale) }]}
                >
                  {letter}
                </Text>
              </View>
            ))}
          </View>
          <View style={s.utilityRow}>
            <TouchableOpacity
              onPress={showHint}
              disabled={complete || game.xp < HINT_COST}
              accessibilityLabel="Harf al"
              style={[
                s.utilityButton,
                s.hintButton,
                (complete || game.xp < HINT_COST) && s.hintDisabled,
              ]}
            >
              <Text style={s.utilityText}>💡</Text>
              <Text style={s.utilityLabel}>Harf al</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setWheelLetters(value => shuffleLetters(value));
                selectedRef.current = [];
                setSelected([]);
              }}
              accessibilityLabel="Harfleri karıştır"
              style={[s.utilityButton, s.shuffleButton]}
            >
              <Text style={s.utilityText}>↻</Text>
              <Text style={s.utilityLabel}>Karıştır</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {successBurstVisible ? (
        <View pointerEvents="none" style={s.burstOverlay}>
          {CONFETTI.map((piece, index) => (
            <Animated.View
              key={`confetti-${index}`}
              style={[
                s.burstConfetti,
                { backgroundColor: piece.color },
                {
                  opacity: successBurstAnimation.interpolate({
                    inputRange: [0, 0.12, 0.82, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                  transform: [
                    {
                      translateX: successBurstAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, piece.x],
                      }),
                    },
                    {
                      translateY: successBurstAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, piece.y],
                      }),
                    },
                    {
                      rotate: successBurstAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', piece.rotate],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
          <Animated.View
            style={[
              s.burstCard,
              {
                opacity: successBurstAnimation.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    scale: successBurstAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.55, 1.18],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={s.burstStars}>✦ ✨ ✦</Text>
            <Text style={s.burstTitle}>Bölüm tamamlandı!</Text>
            <Text style={s.burstStars}>✦ ✨ ✦</Text>
          </Animated.View>
        </View>
      ) : null}
      <Modal
        visible={isClueVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsClueVisible(false);
          setClueMessage(null);
          setIsClueLoading(false);
        }}
      >
        <View style={s.modalBackdrop}>
          <View style={s.clueModal}>
            <View style={s.clueIcon}>
              <Text style={s.clueIconText}>🔎</Text>
            </View>
            <Text style={s.clueTitle}>Kelime ipucu</Text>
            <Text style={s.clueText}>
              {isClueLoading ? 'Sözlük anlamı aranıyor…' : clueMessage}
            </Text>
            <Pressable
              onPress={() => {
                setIsClueVisible(false);
                setClueMessage(null);
                setIsClueLoading(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="İpucunu kapat"
              style={({ pressed }) => [
                s.clueAction,
                pressed && s.clueActionPressed,
              ]}
            >
              <Text style={s.clueActionText}>Tamam</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 24,
  },
  contentContainer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  xpBadge: {
    height: 42,
    flexShrink: 0,
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 0,
    marginBottom: 0,
    borderRadius: 16,
    backgroundColor: adaptive('rgba(248,199,68,.18)', 'rgba(244,200,75,.22)'),
    borderWidth: 1,
    borderColor: adaptive('rgba(248,199,68,.3)', 'rgba(181,132,27,.35)'),
    shadowColor: '#17343A',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  xpBadgeLight: {
    backgroundColor: C.raised,
    borderColor: C.border,
  },
  xpIcon: { color: C.gold, fontSize: 10, marginRight: 6 },
  xpText: { color: C.text, fontSize: 12, fontWeight: '900' },
  xpTextLight: { color: C.ink },
  boardCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.raised,
    borderRadius: 22,
    paddingVertical: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: adaptive('rgba(255,255,255,.12)', 'rgba(40,83,87,.16)'),
    shadowColor: '#19383D',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  board: { position: 'relative' },
  cell: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCell: {
    backgroundColor: adaptive('rgba(244,251,255,.94)', '#F2F7F4'),
    borderWidth: 1,
    borderColor: adaptive('rgba(255,255,255,.08)', 'rgba(65,111,111,.16)'),
  },
  filled: { backgroundColor: C.coral },
  letterOverlay: { ...StyleSheet.absoluteFill, zIndex: 50, elevation: 10 },
  cellText: {
    position: 'absolute',
    width: 42,
    height: 42,
    textAlign: 'center',
    color: '#071A3D',
    fontWeight: '900',
    includeFontPadding: false,
    paddingTop: 5,
    zIndex: 60,
    elevation: 12,
  },
  selectionCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 26,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: adaptive('rgba(255,255,255,.13)', 'rgba(40,83,87,.16)'),
    shadowColor: '#19383D',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  wordDisplay: {
    minWidth: 190,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: adaptive('rgba(255,255,255,.10)', 'rgba(39,86,88,.08)'),
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: adaptive('rgba(255,255,255,.16)', 'rgba(39,86,88,.18)'),
  },
  wordDisplayText: {
    color: C.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 2,
  },
  wordDisplayEmpty: { opacity: 0.35 },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    marginTop: 12,
    backgroundColor: adaptive('rgba(236,248,255,.08)', 'rgba(39,86,88,.07)'),
    borderWidth: 1,
    borderColor: adaptive('rgba(255,255,255,.12)', 'rgba(39,86,88,.18)'),
    shadowColor: '#17343A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  letter: {
    position: 'absolute',
    width: LETTER_SIZE,
    height: LETTER_SIZE,
    borderRadius: LETTER_SIZE / 2,
    backgroundColor: adaptive(C.gold, '#F4C84C'),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#061B4C',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  activeLetter: {
    backgroundColor: adaptive(C.mint, '#19B7A7'),
    transform: [{ scale: 1.08 }],
  },
  letterText: { color: C.ink, fontWeight: '900', fontSize: 30 },
  line: {
    position: 'absolute',
    height: 5,
    borderRadius: 6,
    backgroundColor: C.mint,
    zIndex: 1,
  },
  utilityButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: adaptive('rgba(22,214,196,.13)', 'rgba(25,183,167,.10)'),
    borderWidth: 1,
    borderColor: adaptive('rgba(22,214,196,.28)', 'rgba(17,126,116,.28)'),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  utilityRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginTop: 'auto',
  },
  shuffleButton: {
    flex: 1,
    minWidth: 0,
  },
  shuffle: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '900',
    padding: 12,
  },
  hintButton: {
    flex: 1,
    minWidth: 0,
  },
  clueButton: {
    minWidth: 148,
    paddingHorizontal: 16,
  },
  hintDisabled: { opacity: 0.45 },
  utilityText: {
    color: adaptive(C.mint, '#087F76'),
    fontSize: 20,
    fontWeight: '900',
  },
  utilityLabel: {
    color: adaptive(C.mint, '#087F76'),
    fontSize: 12,
    fontWeight: '900',
  },
  wordBadge: {
    marginTop: 12,
    minWidth: 220,
    height: 50,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: C.gold,
    shadowColor: '#021A40',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  wordBadgeReady: { backgroundColor: C.mint },
  wordBadgeText: {
    color: C.ink,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1,
  },
  feedback: {
    color: C.muted,
    marginTop: 7,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    minHeight: 18,
  },
  feedbackRow: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  feedbackSuccess: { color: C.mint },
  feedbackError: { color: adaptive('#FF9B83', '#B44A1E') },
  retrySubmit: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: adaptive('rgba(255,155,131,.14)', 'rgba(180,74,30,.10)'),
    borderWidth: 1,
    borderColor: adaptive('rgba(255,155,131,.34)', 'rgba(180,74,30,.28)'),
  },
  retrySubmitPressed: { opacity: 0.7 },
  retrySubmitText: {
    color: adaptive('#FFB09C', '#B44A1E'),
    fontSize: 9,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: adaptive('rgba(3, 10, 24, 0.78)', 'rgba(23,51,64,.38)'),
  },
  clueModal: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderRadius: 28,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(248, 199, 68, 0.42)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  clueIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: 'rgba(248, 199, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(248, 199, 68, 0.38)',
  },
  clueIconText: { fontSize: 26 },
  clueTitle: {
    marginTop: 14,
    color: C.text,
    fontSize: 20,
    fontWeight: '900',
  },
  clueText: {
    marginTop: 10,
    color: C.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  clueAction: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: C.gold,
    borderBottomWidth: 3,
    borderBottomColor: '#B88716',
  },
  clueActionPressed: { opacity: 0.78 },
  clueActionText: {
    color: C.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  completion: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  completionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.gold,
    color: C.ink,
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  completionTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 20,
  },
  completionText: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  burstOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  burstConfetti: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 9,
    height: 18,
    borderRadius: 3,
  },
  burstCard: {
    minWidth: 250,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(22,214,196,.96)',
    borderWidth: 2,
    borderColor: '#FFF5D8',
    shadowColor: '#061B4C',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  burstTitle: {
    color: C.ink,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  burstStars: {
    color: C.cream,
    fontSize: 22,
    fontWeight: '900',
    marginVertical: 4,
  },
  stats: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stat: { color: '#F6FCFF', fontSize: 12, fontWeight: '900' },
});
