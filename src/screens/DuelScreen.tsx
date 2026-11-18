import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { RootStackParamList } from '../../App';
import { BackHeader, C, gameFeedback, Progress } from '../ui';
import { useGame } from '../gameState';
import { useAuth } from '../authState';
import type { DuelEvent, DuelRoom } from '../services/duelService';
import {
  fetchDuelEvents,
  fetchDuelRoom,
  finishDuel,
  findOrCreateDuelRoom,
  getDuelPlayerId,
  submitDuelWord,
} from '../services/duelService';
import { ensureLeaguePlayer } from '../services/leagueService';

type Props = NativeStackScreenProps<RootStackParamList, 'Duel'>;
const ROUND_SECONDS = 90;
const WHEEL_SIZE = 314;
const RADIUS = 112;
const LETTER_SIZE = 72;
const normalize = (value: string) => value.toLocaleUpperCase('tr-TR');

export function DuelScreen({ navigation }: Props) {
  const game = useGame();
  const { session } = useAuth();
  const { height } = useWindowDimensions();
  const scale = Math.max(0.72, Math.min(0.88, (height - 100) / 800));
  const wheelSize = Math.round(WHEEL_SIZE * scale);
  const radius = RADIUS * scale;
  const letterSize = Math.round(LETTER_SIZE * scale);
  const [playerId, setPlayerId] = useState('local-player');
  const displayName =
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'Oyuncu';
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [events, setEvents] = useState<DuelEvent[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('Rakip aranıyor…');
  const [roomError, setRoomError] = useState('');
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const selectedRef = useRef<number[]>([]);
  const secondsRef = useRef(ROUND_SECONDS);
  const wheelRef = useRef<ComponentRef<typeof View>>(null);
  const wheelFrame = useRef({ x: 0, y: 0 });
  const lastEventId = useRef(0);
  const finishingRef = useRef(false);

  useEffect(() => {
    let active = true;
    getDuelPlayerId()
      .then(id => {
        if (active) setPlayerId(id);
        return ensureLeaguePlayer(id, displayName).then(() =>
          findOrCreateDuelRoom(id),
        );
      })
      .then(nextRoom => {
        if (!active) return;
        setRoom(nextRoom);
        setFeedback(
          nextRoom.status === 'playing'
            ? 'Rakip bulundu. Kelimeleri toplamaya başla.'
            : 'Rakip bekleniyor…',
        );
        if (nextRoom.ends_at) {
          const remaining = Math.max(
            0,
            Math.ceil((Date.parse(nextRoom.ends_at) - Date.now()) / 1000),
          );
          secondsRef.current = remaining;
          setSeconds(remaining);
        }
      })
      .catch(reason => {
        if (active) {
          setRoomError(
            reason instanceof Error
              ? reason.message
              : 'Düello odası oluşturulamadı.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [displayName]);

  useEffect(() => {
    if (!room || room.status !== 'playing' || result) return;
    const timer = setInterval(() => {
      secondsRef.current = Math.max(0, secondsRef.current - 1);
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [result, room]);

  useEffect(() => {
    if (!room || room.status !== 'waiting') return;
    const timer = setInterval(() => {
      fetchDuelRoom(room.id)
        .then(nextRoom => {
          if (nextRoom?.status === 'playing') {
            setRoom(nextRoom);
            setFeedback('Rakip bulundu. Kelimeleri toplamaya başla.');
            if (nextRoom.ends_at) {
              const remaining = Math.max(
                0,
                Math.ceil((Date.parse(nextRoom.ends_at) - Date.now()) / 1000),
              );
              secondsRef.current = remaining;
              setSeconds(remaining);
            }
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [room]);

  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    const poll = () => {
      fetchDuelEvents(room.id, lastEventId.current)
        .then(nextEvents => {
          if (!nextEvents.length) return;
          lastEventId.current = nextEvents[nextEvents.length - 1].id;
          setEvents(value => [...value, ...nextEvents]);
        })
        .catch(() => undefined);
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, [room]);

  const positions = useMemo(
    () =>
      (room?.letters ?? []).map((_, index, letters) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / letters.length;
        return {
          x: wheelSize / 2 + Math.cos(angle) * radius,
          y: wheelSize / 2 + Math.sin(angle) * radius,
        };
      }),
    [radius, room?.letters, wheelSize],
  );
  const current = selected.map(index => room?.letters[index] ?? '').join('');
  const ownEvents = events.filter(event => event.player_id === playerId);
  const opponentEvents = events.filter(event => event.player_id !== playerId);
  const playerScore = ownEvents.reduce((sum, event) => sum + event.points, 0);
  const opponentScore = opponentEvents.reduce(
    (sum, event) => sum + event.points,
    0,
  );
  useEffect(() => {
    if (seconds !== 0 || result || !room || room.status !== 'playing') return;
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFeedback('Maç sonucu hesaplanıyor…');
    finishDuel(room.id)
      .then(results => {
        const ownResult = results.find(item => item.player_id === playerId);
        if (!ownResult) throw new Error('Maç sonucu bulunamadı.');
        setResult(ownResult.result);
        game.finishDuel(ownResult.result);
      })
      .catch(reason => {
        setFeedback(
          reason instanceof Error
            ? reason.message
            : 'Maç sonucu alınamadı. Tekrar deneniyor…',
        );
      })
      .finally(() => {
        finishingRef.current = false;
      });
  }, [game, opponentScore, playerId, playerScore, result, room, seconds]);
  const interactive = room?.status === 'playing' && seconds > 0 && !result;

  const pick = (pageX: number, pageY: number) => {
    const index = positions.findIndex(
      point =>
        Math.hypot(
          point.x - (pageX - wheelFrame.current.x),
          point.y - (pageY - wheelFrame.current.y),
        ) <
        letterSize * 0.65,
    );
    if (index < 0 || selectedRef.current.includes(index)) return;
    const next = [...selectedRef.current, index];
    selectedRef.current = next;
    setSelected(next);
  };
  const submit = async () => {
    const word = normalize(
      selectedRef.current.map(index => room?.letters[index] ?? '').join(''),
    );
    selectedRef.current = [];
    setSelected([]);
    if (!word || !interactive || !room) return;
    try {
      const event = await submitDuelWord(room.id, playerId, word);
      lastEventId.current = Math.max(lastEventId.current, event.id);
      setEvents(value => [...value, event]);
      gameFeedback('success');
      setFeedback(`${word} bulundu! +${event.points} puan`);
    } catch (reason) {
      gameFeedback('error');
      setFeedback(
        reason instanceof Error ? reason.message : 'Kelime kabul edilmedi.',
      );
    }
  };
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => interactive,
    onMoveShouldSetPanResponder: () => interactive,
    onPanResponderGrant: event =>
      pick(event.nativeEvent.pageX, event.nativeEvent.pageY),
    onPanResponderMove: event =>
      pick(event.nativeEvent.pageX, event.nativeEvent.pageY),
    onPanResponderRelease: submit,
    onPanResponderTerminate: submit,
  });

  return (
    <View style={s.root}>
      <BackHeader
        title="Düello Arenası"
        tag="CANLI KARŞILAŞMA"
        color={C.coral}
        onBack={navigation.goBack}
      />
      {room?.status !== 'playing' ? (
        <View style={s.waiting}>
          {roomError ? (
            <>
              <Text style={s.waitingTitle}>Düello başlatılamadı</Text>
              <Text style={s.waitingCopy}>{roomError}</Text>
              <Pressable
                onPress={() => navigation.replace('Duel')}
                style={s.retryButton}
              >
                <Text style={s.retryButtonText}>TEKRAR DENE</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={C.coral} />
              <Text style={s.waitingTitle}>
                {room?.status === 'waiting'
                  ? 'Rakip bekleniyor…'
                  : 'Düello hazırlanıyor…'}
              </Text>
              <Text style={s.waitingCopy}>
                Başka bir oyuncu katıldığında maç otomatik başlayacak.
              </Text>
            </>
          )}
        </View>
      ) : null}
      {room?.status === 'playing' ? (
        <View style={s.content}>
          <View style={s.scores}>
            <View style={s.score}>
              <Text style={s.label}>SEN</Text>
              <Text style={s.scoreValue}>{playerScore}</Text>
            </View>
            <View style={s.matchCenter}>
              <Text style={s.vs}>VS</Text>
              <Text style={s.timer}>{seconds} sn</Text>
              <Progress
                value={(seconds / ROUND_SECONDS) * 100}
                color={C.coral}
              />
            </View>
            <View style={s.score}>
              <Text style={s.label}>RAKİP</Text>
              <Text style={s.scoreValue}>{opponentScore}</Text>
            </View>
          </View>
          <View style={s.lists}>
            <View style={s.list}>
              <Text numberOfLines={1} style={s.listTitle}>
                Senin buldukların
              </Text>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {ownEvents
                  .slice()
                  .reverse()
                  .map(event => (
                    <Text key={event.id} style={s.listWord}>
                      {event.word} <Text style={s.points}>+{event.points}</Text>
                    </Text>
                  ))}
              </ScrollView>
            </View>
            <View style={s.list}>
              <Text numberOfLines={1} style={s.listTitle}>
                Rakibin buldukları
              </Text>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {opponentEvents
                  .slice()
                  .reverse()
                  .map(event => (
                    <Text key={event.id} style={s.listWord}>
                      {event.word} <Text style={s.points}>+{event.points}</Text>
                    </Text>
                  ))}
              </ScrollView>
            </View>
          </View>
          <View style={s.wordBox}>
            <Text style={s.word}>{current}</Text>
          </View>
          <View
            ref={wheelRef}
            onLayout={() =>
              wheelRef.current?.measureInWindow((x, y) => {
                wheelFrame.current = { x, y };
              })
            }
            style={[
              s.wheel,
              {
                width: wheelSize,
                height: wheelSize,
                borderRadius: wheelSize / 2,
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
                  key={`line-${index}-${order}`}
                  style={[
                    s.line,
                    {
                      width: length,
                      left: (from.x + to.x) / 2 - length / 2,
                      top: (from.y + to.y) / 2 - 3,
                      transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                    },
                  ]}
                />
              );
            })}
            {room?.letters.map((letter, index) => (
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
                  selected.includes(index) && s.selected,
                ]}
              >
                <Text style={s.letterText}>{letter}</Text>
              </View>
            ))}
          </View>
          <Text style={s.feedback}>{feedback}</Text>
        </View>
      ) : null}
      <Modal
        visible={Boolean(result)}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={s.modalBackdrop}>
          <View style={s.resultCard}>
            <View
              style={[
                s.resultIcon,
                result === 'win'
                  ? s.resultIconWin
                  : result === 'lose'
                  ? s.resultIconLose
                  : s.resultIconDraw,
              ]}
            >
              <Text style={s.resultIconText}>
                {result === 'win' ? '★' : result === 'lose' ? '↺' : 'VS'}
              </Text>
            </View>
            <Text style={s.resultLabel}>DÜELLO TAMAMLANDI</Text>
            <Text style={s.resultTitle}>
              {result === 'win'
                ? 'Kazandın!'
                : result === 'lose'
                ? 'Kaybettin'
                : 'Berabere'}
            </Text>
            <Text style={s.resultSubtitle}>
              {result === 'win'
                ? 'Hızlı ve doğru kelimelerle rakibini geride bıraktın.'
                : result === 'lose'
                ? 'Bu turu kaçırdın. Yeni bir turda şansını tekrar dene.'
                : 'İkiniz de aynı puandasınız. Rövanş zamanı!'}
            </Text>
            <View style={s.resultScores}>
              <View
                style={[s.resultScore, result === 'win' && s.resultScoreActive]}
              >
                <Text style={s.resultName}>SEN</Text>
                <Text style={s.resultValue}>{playerScore}</Text>
              </View>
              <Text style={s.resultVs}>VS</Text>
              <View
                style={[
                  s.resultScore,
                  result === 'lose' && s.resultScoreActive,
                ]}
              >
                <Text style={s.resultName}>RAKİP</Text>
                <Text style={s.resultValue}>{opponentScore}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yeni maç başlat"
              onPress={() => navigation.replace('Duel')}
              hitSlop={6}
              style={({ pressed }) => [
                s.newRoundButton,
                pressed && s.newRoundButtonPressed,
              ]}
            >
              <Text style={s.newRoundButtonText}>YENİ MAÇ</Text>
              <Text style={s.newRoundButtonIcon}>↗</Text>
            </Pressable>
            <Pressable onPress={() => navigation.goBack()} style={s.exitAction}>
              <Text style={s.exitActionText}>Lig ekranına dön</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  waiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  waitingTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  waitingCopy: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.coral,
  },
  retryButtonText: { color: C.ink, fontSize: 11, fontWeight: '900' },
  content: {
    flex: 1,
    padding: 16,
    gap: 14,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  matchCenter: { alignItems: 'center', gap: 5, minWidth: 96 },
  timer: {
    color: C.coral,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  scores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 14,
  },
  score: { alignItems: 'center', minWidth: 90 },
  label: { color: C.muted, fontSize: 10, fontWeight: '900' },
  scoreValue: { color: C.text, fontSize: 28, fontWeight: '900', marginTop: 3 },
  vs: { color: C.coral, fontWeight: '900' },
  lists: { flexDirection: 'row', gap: 10 },
  list: {
    flex: 1,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    height: 148,
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.surface,
    overflow: 'hidden',
  },
  listTitle: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
  },
  listWord: { color: C.text, fontSize: 13, fontWeight: '800', lineHeight: 21 },
  points: { color: C.mint, fontSize: 11 },
  wordBox: {
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: { color: C.text, fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  wheel: {
    alignSelf: 'center',
    backgroundColor: 'rgba(236,248,255,.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.12)',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    height: 6,
    borderRadius: 6,
    backgroundColor: C.mint,
    zIndex: 1,
  },
  letter: {
    position: 'absolute',
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: C.mint,
    transform: [{ scale: 1.08 }],
    zIndex: 2,
  },
  letterText: { color: C.ink, fontSize: 29, fontWeight: '900' },
  feedback: {
    color: C.text,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,11,26,.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  resultCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#162842',
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.12)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },
  resultIconWin: {
    backgroundColor: 'rgba(22,214,196,.18)',
    borderColor: 'rgba(22,214,196,.45)',
  },
  resultIconLose: {
    backgroundColor: 'rgba(255,138,76,.16)',
    borderColor: 'rgba(255,138,76,.42)',
  },
  resultIconDraw: {
    backgroundColor: 'rgba(255,193,7,.16)',
    borderColor: 'rgba(255,193,7,.42)',
  },
  resultIconText: { fontSize: 32 },
  resultLabel: {
    color: C.coral,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resultTitle: { color: C.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  resultSubtitle: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  resultScores: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  resultScore: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,.06)',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  resultScoreActive: {
    backgroundColor: 'rgba(22,214,196,.14)',
    borderColor: 'rgba(22,214,196,.45)',
  },
  resultName: { color: C.muted, fontSize: 10, fontWeight: '900' },
  resultValue: {
    color: C.cream,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  resultVs: { color: C.coral, fontWeight: '900' },
  newRoundButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: C.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
    shadowColor: C.coral,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },
  newRoundButtonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  newRoundButtonText: {
    color: C.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  newRoundButtonIcon: {
    color: C.ink,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
  },
  exitAction: { paddingVertical: 12 },
  exitActionText: { color: C.muted, fontSize: 13, fontWeight: '800' },
});
