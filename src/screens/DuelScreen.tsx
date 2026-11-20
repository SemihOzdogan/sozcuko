import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  AppState,
  FlatList,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DuelEvent, DuelRoom } from '../services/duelService';
import {
  acceptDuelInvitationForPlayer,
  cancelWaitingDuel,
  createDuelInvitation,
  fetchDuelEvents,
  fetchDuelRoom,
  fetchIncomingDuelInvitation,
  findOrCreateDuelRoom,
  finishDuel,
  getDuelPlayerId,
  submitDuelWord,
} from '../services/duelService';
import {
  ensureLeaguePlayer,
  fetchActiveLeaguePlayers,
  type LeaguePlayer,
  touchLeaguePlayer,
} from '../services/leagueService';

type Props = NativeStackScreenProps<RootStackParamList, 'Duel'>;
const ROUND_SECONDS = 10;
const MATCHMAKING_SECONDS = 10;
const WHEEL_SIZE = 314;
const RADIUS = 112;
const LETTER_SIZE = 72;
const normalize = (value: string) => value.toLocaleUpperCase('tr-TR');
const baseDuelPoints = (word: string) => {
  const length = normalize(word).length;
  if (length >= 6) return 50;
  if (length === 5) return 35;
  if (length === 4) return 20;
  return 10;
};

const scoreDuelEvents = (events: DuelEvent[]) => {
  const firstEventByWord = new Map<string, number>();
  events
    .slice()
    .sort((left, right) => left.id - right.id)
    .forEach(event => {
      const word = normalize(event.word);
      if (!firstEventByWord.has(word)) firstEventByWord.set(word, event.id);
    });

  return events.map(event => ({
    ...event,
    points:
      baseDuelPoints(event.word) +
      (firstEventByWord.get(normalize(event.word)) === event.id ? 20 : 0),
  }));
};

export function DuelScreen({ navigation, route }: Props) {
  const game = useGame();
  const { session } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableWidth = Math.max(280, width - 32);
  const scale = Math.max(
    0.62,
    Math.min(0.88, (height - 120) / 800, availableWidth / 390),
  );
  const wheelSize = Math.round(WHEEL_SIZE * scale);
  const radius = RADIUS * scale;
  const letterSize = Math.round(LETTER_SIZE * scale);
  const [playerId, setPlayerId] = useState('local-player');
  const displayName =
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'Oyuncu';
  const [room, setRoom] = useState<DuelRoom | null>(null);
  const [activePlayers, setActivePlayers] = useState<LeaguePlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [isQuickMatch, setIsQuickMatch] = useState(false);
  const [matchmakingSeconds, setMatchmakingSeconds] = useState(
    MATCHMAKING_SECONDS,
  );
  const [events, setEvents] = useState<DuelEvent[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('Rakip aranıyor…');
  const [roomError, setRoomError] = useState('');
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const selectedRef = useRef<number[]>([]);
  const secondsRef = useRef(ROUND_SECONDS);
  const lastEventId = useRef(0);
  const finishingRef = useRef(false);
  const matchmakingRequestId = useRef(0);
  const screenOpenedAt = useRef(Date.now());
  const [finishAttempt, setFinishAttempt] = useState(0);
  const invitationIdFromNotification = route.params?.invitationId;
  const startNewDuel = useCallback(async () => {
    const requestId = ++matchmakingRequestId.current;
    selectedRef.current = [];
    secondsRef.current = ROUND_SECONDS;
    lastEventId.current = 0;
    finishingRef.current = false;
    setRoom(null);
    setEvents([]);
    setSelected([]);
    setSelectedOpponent(null);
    setIsQuickMatch(true);
    setFeedback('Rakip aranıyor…');
    setRoomError('');
    setSeconds(ROUND_SECONDS);
    setResult(null);
    setMatchmakingSeconds(MATCHMAKING_SECONDS);

    try {
      const nextRoom = await findOrCreateDuelRoom(playerId);
      if (requestId !== matchmakingRequestId.current) return;
      setRoom(nextRoom);
      if (nextRoom.status === 'playing' && nextRoom.ends_at) {
        const remaining = Math.max(
          0,
          Math.ceil((Date.parse(nextRoom.ends_at) - Date.now()) / 1000),
        );
        secondsRef.current = remaining;
        setSeconds(remaining);
        setFeedback('Rakip bulundu. Kelimeleri toplamaya başla.');
      } else {
        setFeedback('Rakip bekleniyor…');
      }
    } catch (reason) {
      if (requestId !== matchmakingRequestId.current) return;
      setRoomError(
        reason instanceof Error
          ? reason.message
          : 'Yeni düello başlatılamadı.',
      );
    }
  }, [playerId]);
  const exitDuel = useCallback(async () => {
    const roomToCancel = room;
    if (
      isQuickMatch &&
      roomToCancel?.status === 'waiting' &&
      roomToCancel.player_one_id === playerId
    ) {
      cancelWaitingDuel(roomToCancel.id, playerId).catch(() => undefined);
    }
    matchmakingRequestId.current += 1;
    selectedRef.current = [];
    secondsRef.current = ROUND_SECONDS;
    lastEventId.current = 0;
    finishingRef.current = false;
    setRoom(null);
    setEvents([]);
    setSelected([]);
    setSelectedOpponent(null);
    setIsQuickMatch(false);
    setRoomError('');
    setSeconds(ROUND_SECONDS);
    setResult(null);
    setFeedback('Düello arenası hazır.');
  }, [isQuickMatch, playerId, room]);
  const appendEvents = useCallback((incoming: DuelEvent | DuelEvent[]) => {
    const additions = Array.isArray(incoming) ? incoming : [incoming];
    setEvents(currentEvents => {
      const existingIds = new Set(currentEvents.map(event => event.id));
      const uniqueAdditions = additions.filter(
        event => !existingIds.has(event.id),
      );
      return uniqueAdditions.length
        ? [...currentEvents, ...uniqueAdditions]
        : currentEvents;
    });
  }, []);
  const syncRemaining = useCallback((endsAt: string | null) => {
    const endTime = endsAt ? Date.parse(endsAt) : Number.NaN;
    const remaining = Number.isFinite(endTime)
      ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      : 0;
    secondsRef.current = remaining;
    setSeconds(current => (current === remaining ? current : remaining));
    return remaining;
  }, []);
  const resolveDuel = useCallback(
    async (roomId: string) => {
      if (finishingRef.current || result) return;
      finishingRef.current = true;
      setFeedback('Maç sonucu hesaplanıyor…');
      try {
        const results = await finishDuel(roomId);
        const ownResult = results.find(item => item.player_id === playerId);
        if (!ownResult) throw new Error('Maç sonucu bulunamadı.');
        const finalEvents = await fetchDuelEvents(roomId);
        appendEvents(finalEvents);
        setResult(ownResult.result);
        game.finishDuel(ownResult.result);
      } catch (reason) {
        setFeedback(
          reason instanceof Error
            ? reason.message
            : 'Maç sonucu alınamadı. Tekrar deneniyor…',
        );
        setTimeout(() => setFinishAttempt(attempt => attempt + 1), 1500);
      } finally {
        finishingRef.current = false;
      }
    },
    [appendEvents, game, playerId, result],
  );

  useEffect(() => {
    let active = true;
    getDuelPlayerId(session?.user?.id)
      .then(id => {
        if (active) setPlayerId(id);
        return ensureLeaguePlayer(id, displayName).then(() => id);
      })
      .then(id => {
        if (!active) return;
        return fetchActiveLeaguePlayers(id).then(players => {
          if (active) setActivePlayers(players);
        });
      })
      .catch(reason => {
        if (active) {
          setRoomError(
            reason instanceof Error
              ? reason.message
              : 'Aktif oyuncular alınamadı.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingPlayers(false);
      });
    return () => {
      active = false;
    };
  }, [displayName, session?.user?.id]);

  useEffect(() => {
    if (!playerId || playerId === 'local-player' || room?.status === 'playing')
      return;
    const refresh = () => {
      touchLeaguePlayer(playerId, displayName).catch(() => undefined);
      fetchActiveLeaguePlayers(playerId)
        .then(players => setActivePlayers(players))
        .catch(() => undefined);
      const invitationRequest = invitationIdFromNotification
        ? fetchDuelRoom(invitationIdFromNotification)
        : fetchIncomingDuelInvitation(playerId);
      invitationRequest
        .then(invitation => {
          if (
            !invitation ||
            invitation.status !== 'waiting' ||
            invitation.player_two_id !== playerId
          ) {
            return;
          }
          const createdAt = invitation ? Date.parse(invitation.created_at) : 0;
          const isNewInvitation =
            createdAt >= screenOpenedAt.current - 2_000;
          const openedFromNotification =
            invitation?.id === invitationIdFromNotification;
          if (
            invitation &&
            !room &&
            !isQuickMatch &&
            (isNewInvitation || openedFromNotification)
          ) {
            setRoom(invitation);
            if (invitationIdFromNotification) {
              navigation.setParams({ invitationId: undefined });
            }
          }
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [
    displayName,
    invitationIdFromNotification,
    isQuickMatch,
    navigation,
    playerId,
    room,
  ]);

  const startDuelWith = useCallback(
    async (opponentId: string, opponentName: string) => {
      if (selectedOpponent || room) return;
      setIsQuickMatch(false);
      setSelectedOpponent(opponentId);
      setRoomError('');
      try {
        const invitation = await createDuelInvitation(playerId, opponentId);
        setRoom(invitation);
        setFeedback(`${opponentName} davet edildi. Kabul etmesi bekleniyor…`);
      } catch (reason) {
        setSelectedOpponent(null);
        setRoomError(
          reason instanceof Error
            ? reason.message
            : 'Düello daveti gönderilemedi.',
        );
      }
    },
    [playerId, room, selectedOpponent],
  );

  const acceptInvitation = async () => {
    if (!room || room.player_two_id !== playerId) return;
    try {
      const started = await acceptDuelInvitationForPlayer(room.id, playerId);
      setRoom(started);
      setFeedback('Rakip bulundu. Kelimeleri toplamaya başla.');
      syncRemaining(started.ends_at);
    } catch (reason) {
      setRoomError(
        reason instanceof Error ? reason.message : 'Düello başlatılamadı.',
      );
    }
  };

  useEffect(() => {
    if (!room || room.status !== 'playing' || result) return;
    const sync = () => syncRemaining(room.ends_at);
    sync();
    const timer = setInterval(sync, 1000);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') sync();
    });
    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [result, room, syncRemaining]);

  useEffect(() => {
    if (
      !room ||
      room.status !== 'waiting' ||
      (isQuickMatch && matchmakingSeconds === 0)
    )
      return;
    const timer = setInterval(() => {
      const checkRoom = async () => {
        if (isQuickMatch) {
          const matched = await findOrCreateDuelRoom(playerId).catch(
            () => null,
          );
          if (matched?.status === 'playing') {
            setRoom(matched);
            setFeedback('Rakip bulundu. Kelimeleri toplamaya başla.');
            syncRemaining(matched.ends_at);
            return;
          }
        }
        const nextRoom = await fetchDuelRoom(room.id).catch(() => undefined);
        if (nextRoom?.status === 'playing') {
          setRoom(nextRoom);
          setFeedback('Rakip bulundu. Kelimeleri toplamaya başla.');
          syncRemaining(nextRoom.ends_at);
        }
      };
      checkRoom();
    }, 2000);
    return () => clearInterval(timer);
  }, [isQuickMatch, matchmakingSeconds, playerId, room, syncRemaining]);

  useEffect(() => {
    if (!isQuickMatch || !room || room.status !== 'waiting') return;
    const createdAt = Date.parse(room.created_at);
    const deadline = Number.isFinite(createdAt)
      ? createdAt + MATCHMAKING_SECONDS * 1000
      : Date.now() + MATCHMAKING_SECONDS * 1000;
    const update = () => {
      setMatchmakingSeconds(
        Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
      );
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [isQuickMatch, room]);

  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    const poll = () => {
      fetchDuelEvents(room.id, lastEventId.current)
        .then(nextEvents => {
          if (!nextEvents.length) return;
          lastEventId.current = Math.max(
            lastEventId.current,
            nextEvents[nextEvents.length - 1].id,
          );
          appendEvents(nextEvents);
        })
        .catch(() => undefined);
    };
    poll();
    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, [appendEvents, room]);

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
  const scoredEvents = useMemo(() => scoreDuelEvents(events), [events]);
  const ownEvents = scoredEvents.filter(event => event.player_id === playerId);
  const opponentEvents = scoredEvents.filter(
    event => event.player_id !== playerId,
  );
  const playerScore = ownEvents.reduce((sum, event) => sum + event.points, 0);
  const opponentScore = opponentEvents.reduce(
    (sum, event) => sum + event.points,
    0,
  );
  useEffect(() => {
    if (seconds !== 0 || result || !room || room.status !== 'playing') return;
    resolveDuel(room.id);
  }, [finishAttempt, resolveDuel, result, room, seconds]);
  const interactive = room?.status === 'playing' && seconds > 0 && !result;

  const pick = (x: number, y: number) => {
    const index = positions.findIndex(
      point => Math.hypot(point.x - x, point.y - y) < letterSize * 0.65,
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
      appendEvents(event);
      gameFeedback('success');
      const scoredEvent = scoreDuelEvents([...events, event]).find(
        candidate => candidate.id === event.id,
      );
      setFeedback(
        `${word} bulundu! +${scoredEvent?.points ?? event.points} puan`,
      );
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
    onStartShouldSetPanResponderCapture: () => interactive,
    onMoveShouldSetPanResponderCapture: () => interactive,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: event =>
      pick(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderMove: event =>
      pick(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderRelease: submit,
    onPanResponderTerminate: submit,
  });
  const renderPlayer = useCallback(
    ({ item }: { item: LeaguePlayer }) => (
      <PlayerRow
        displayName={item.display_name}
        playerId={item.player_id}
        points={item.points}
        wins={item.wins}
        selected={selectedOpponent === item.player_id}
        disabled={Boolean(selectedOpponent)}
        onPress={startDuelWith}
      />
    ),
    [selectedOpponent, startDuelWith],
  );

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
                onPress={startNewDuel}
                style={s.retryButton}
              >
                <Text style={s.retryButtonText}>TEKRAR DENE</Text>
              </Pressable>
            </>
          ) : room?.status === 'waiting' && room.player_two_id === playerId ? (
            <>
              <Text style={s.waitingEyebrow}>DÜELLO DAVETİ</Text>
              <Text style={s.waitingTitle}>
                Bir oyuncu seni düelloya çağırdı
              </Text>
              <Text style={s.waitingCopy}>
                Kabul ettiğinde 10 saniyelik test karşılaşması başlayacak.
              </Text>
              <Pressable
                onPress={acceptInvitation}
                style={({ pressed }) => [s.retryButton, pressed && s.pressed]}
              >
                <Text style={s.retryButtonText}>DÜELLOYU KABUL ET</Text>
              </Pressable>
            </>
          ) : room?.status === 'waiting' ? (
            <>
              <ActivityIndicator size="large" color={C.coral} />
              <Text style={s.waitingTitle}>
                {isQuickMatch
                  ? `Uygun oyuncu aranıyor… ${matchmakingSeconds} sn`
                  : 'Davet bekleniyor…'}
              </Text>
              <Text style={s.waitingCopy}>
                {isQuickMatch
                  ? 'Rakip bulunamazsa arama otomatik olarak sona erecek.'
                  : 'Rakibin daveti kabul ettiğinde düello başlayacak.'}
              </Text>
              {isQuickMatch && matchmakingSeconds === 0 ? (
                <Pressable
                  onPress={exitDuel}
                  style={({ pressed }) => [s.retryButton, pressed && s.pressed]}
                >
                  <Text style={s.retryButtonText}>ÇIKIŞ YAP</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <FlatList
              data={loadingPlayers ? [] : activePlayers}
              keyExtractor={item => item.player_id}
              renderItem={renderPlayer}
              style={s.playerList}
              contentContainerStyle={s.playerListContent}
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="automatic"
              ListHeaderComponent={
                <>
                  <View style={s.lobbyHero}>
                    <View style={s.lobbyHeroTop}>
                      <View style={s.liveBadge}>
                        <View style={s.liveDot} />
                        <Text style={s.liveBadgeText}>CANLI LOBİ</Text>
                      </View>
                      <Text numberOfLines={1} style={s.liveStatusText}>
                        ŞİMDİ AKTİF
                      </Text>
                    </View>
                    <Text style={s.lobbyTitle}>Rakibini seç, oyuna başla.</Text>
                    <Text style={s.lobbyCopy}>
                      Aynı anda çevrimiçi olan oyuncular burada görünür. Birini
                      seçtiğinde davet gönderilir.
                    </Text>
                    <View style={s.lobbyFooter}>
                      <Text style={s.lobbyFooterLabel}>10 SANİYE</Text>
                      <Text style={s.lobbyFooterHint}>
                        Hızlı kelimeler, canlı rekabet
                      </Text>
                    </View>
                  </View>
                  <View style={s.playersHeader}>
                    <View style={s.playersHeaderCopy}>
                      <Text style={s.playersTitle}>Aktif oyuncular</Text>
                      <Text style={s.playersSubtitle}>
                        Düello için bir rakip seç
                      </Text>
                    </View>
                    <View style={s.playerCount}>
                      <Text style={s.playerCountText}>
                        {activePlayers.length}
                      </Text>
                    </View>
                  </View>
                </>
              }
              ListEmptyComponent={
                loadingPlayers ? (
                  <ActivityIndicator
                    size="large"
                    color={C.coral}
                    style={s.playersLoader}
                  />
                ) : (
                  <View style={s.emptyPlayers}>
                    <Text style={s.emptyPlayersTitle}>
                      Şu an başka oyuncu yok
                    </Text>
                    <Text style={s.emptyPlayersCopy}>
                      Başka bir oyuncu Düello ekranını açtığında burada
                      görünecek.
                    </Text>
                  </View>
                )
              }
            />
          )}
        </View>
      ) : null}
      {room?.status === 'playing' ? (
        <View style={[s.content, { paddingBottom: insets.bottom + 16 }]}>
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
                  pointerEvents="none"
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
                pointerEvents="none"
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
              accessibilityLabel="Yeni düello başlat"
              onPress={startNewDuel}
              hitSlop={6}
              style={({ pressed }) => [
                s.newRoundButton,
                pressed && s.newRoundButtonPressed,
              ]}
            >
              <Text style={s.newRoundButtonText}>YENİ DÜELLO</Text>
              <Text style={s.newRoundButtonIcon}>↗</Text>
            </Pressable>
            <Pressable onPress={exitDuel} style={s.exitAction}>
              <Text style={s.exitActionText}>ÇIKIŞ YAP</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const PlayerRow = memo(function DuelPlayerRow({
  displayName,
  playerId,
  points,
  wins,
  selected,
  disabled,
  onPress,
}: {
  displayName: string;
  playerId: string;
  points: number;
  wins: number;
  selected: boolean;
  disabled: boolean;
  onPress: (playerId: string, displayName: string) => void;
}) {
  const handlePress = useCallback(
    () => onPress(playerId, displayName),
    [displayName, onPress, playerId],
  );
  return (
    <View style={s.playerRow}>
      <View style={s.playerAvatar}>
        <Text style={s.playerAvatarText}>
          {displayName.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={s.playerLiveDot} />
      <View style={s.playerCopy}>
        <Text numberOfLines={1} style={s.playerName}>
          {displayName}
        </Text>
        <Text style={s.playerMeta}>
          {wins} galibiyet · {points} puan
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${displayName} ile düello başlat`}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          s.challengeButton,
          pressed && s.pressed,
          selected && s.challengeButtonSelected,
        ]}
      >
        <Text style={s.challengeButtonText}>
          {selected ? 'GÖNDERİLDİ' : 'DÜELLO'}
        </Text>
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  waiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  waitingTitle: {
    color: C.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  waitingEyebrow: {
    color: C.coral,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 2,
  },
  waitingCopy: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  lobbyHero: {
    alignSelf: 'stretch',
    padding: 20,
    marginBottom: 16,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: '#153B61',
    borderWidth: 1,
    borderColor: 'rgba(110, 198, 255, .18)',
  },
  lobbyHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0, 214, 196, .14)',
  },
  liveBadgeText: {
    color: C.mint,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.mint,
  },
  liveStatusText: {
    color: C.mint,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    flexShrink: 1,
    maxWidth: '42%',
    textAlign: 'right',
  },
  lobbyTitle: {
    color: C.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.4,
    alignSelf: 'stretch',
  },
  lobbyCopy: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  lobbyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.10)',
  },
  lobbyFooterLabel: { color: C.gold, fontSize: 10, fontWeight: '900' },
  lobbyFooterHint: { color: C.muted, fontSize: 10, marginLeft: 8 },
  playersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  playersHeaderCopy: { flex: 1, minWidth: 0 },
  playersTitle: { color: C.text, fontSize: 18, fontWeight: '900' },
  playersSubtitle: { color: C.muted, fontSize: 11, marginTop: 4 },
  playerCount: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(22,214,196,.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(22,214,196,.25)',
  },
  playerCountText: { color: C.mint, fontSize: 13, fontWeight: '900' },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.coral,
  },
  retryButtonText: { color: C.ink, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  playerList: { flex: 1, alignSelf: 'stretch' },
  playerListContent: {
    alignItems: 'stretch',
    paddingHorizontal: 6,
    paddingBottom: 20,
  },
  playersLoader: { marginTop: 32 },
  emptyPlayers: {
    marginTop: 16,
    padding: 18,
    alignItems: 'center',
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  emptyPlayersTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '900',
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  emptyPlayersCopy: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
    flexShrink: 1,
    alignSelf: 'stretch',
  },
  playerRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },
  playerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarText: { color: C.ink, fontSize: 12, fontWeight: '900' },
  playerLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.mint,
    borderWidth: 2,
    borderColor: C.surface,
    marginLeft: -8,
    marginTop: 29,
    zIndex: 2,
  },
  playerCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 11,
    marginRight: 8,
  },
  playerName: { color: C.text, fontSize: 14, fontWeight: '900' },
  playerMeta: { color: C.muted, fontSize: 11, marginTop: 4 },
  challengeButton: {
    flexShrink: 0,
    backgroundColor: C.coral,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  challengeButtonSelected: { backgroundColor: C.mint },
  challengeButtonText: { color: C.ink, fontSize: 10, fontWeight: '900' },
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
