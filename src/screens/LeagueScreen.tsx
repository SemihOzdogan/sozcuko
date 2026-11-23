import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import type { RootStackParamList } from '../../App';
import { BackHeader, Button, C, Card, Pill, Progress } from '../ui';
import { useGame } from '../gameState';
import { useAuth } from '../authState';
import { getDuelPlayerId } from '../services/duelService';
import {
  ensureLeaguePlayer,
  fetchLeaguePlayers,
  type LeaguePlayer,
} from '../services/leagueService';
import { trackEvent } from '../services/analyticsService';

type Props = NativeStackScreenProps<RootStackParamList, 'League'>;

const TIERS = [
  { name: 'Bronz III', min: 0, color: '#CD8B62' },
  { name: 'Bronz II', min: 300, color: '#CD8B62' },
  { name: 'Bronz I', min: 600, color: '#CD8B62' },
  { name: 'Gümüş III', min: 900, color: '#C7D2E1' },
  { name: 'Gümüş II', min: 1200, color: '#C7D2E1' },
  { name: 'Gümüş I', min: 1500, color: '#C7D2E1' },
  { name: 'Altın III', min: 1800, color: '#F8C744' },
  { name: 'Altın II', min: 2200, color: '#F8C744' },
  { name: 'Altın I', min: 2600, color: '#F8C744' },
] as const;

const getTierIndex = (points: number) => {
  let index = 0;
  TIERS.forEach((tier, tierIndex) => {
    if (points >= tier.min) index = tierIndex;
  });
  return index;
};

export function LeagueScreen({ navigation }: Props) {
  const game = useGame();
  const { session } = useAuth();
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const displayName =
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'Oyuncu';

  const loadLeaderboard = () => {
    setLoading(true);
    setError('');
    getDuelPlayerId(session?.user?.id)
      .then(id => {
        setPlayerId(id);
        return ensureLeaguePlayer(id, displayName);
      })
      .then(() => fetchLeaguePlayers())
      .then(setPlayers)
      .catch(reason => {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Lig sıralaması yüklenemedi.',
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    trackEvent('league_viewed');
    loadLeaderboard();
  }, [displayName]);

  const currentPlayer = players.find(player => player.player_id === playerId);
  const leaguePoints = currentPlayer?.points ?? game.leaguePoints;
  const leagueWins = currentPlayer?.wins ?? game.leagueWins;
  const leagueLosses = currentPlayer?.losses ?? game.leagueLosses;
  const tierIndex = getTierIndex(leaguePoints);
  const tier = TIERS[tierIndex];
  const nextTier = TIERS[tierIndex + 1];
  const tierRange = nextTier ? nextTier.min - tier.min : 1;
  const isLight = useColorScheme() === 'light';
  const tierProgress = nextTier
    ? ((leaguePoints - tier.min) / tierRange) * 100
    : 100;
  const playerRank = currentPlayer
    ? players.findIndex(player => player.player_id === playerId) + 1
    : null;

  return (
    <View style={s.root}>
      <BackHeader
        title="Kelime Ligi"
        tag="PUAN VE RÜTBE"
        color={C.gold}
        onBack={navigation.goBack}
      />
      <ScrollView
        contentContainerStyle={s.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Card
          colors={isLight ? ['#FFFFFF', '#FFFFFF'] : ['#4B3A1B', '#243554']}
          preserveColors
          style={s.rankCard}
        >
          <View style={s.rankInner}>
            <View style={[s.rankAccent, { backgroundColor: tier.color }]} />
            <View style={s.rankTop}>
              <View style={s.rankCopy}>
                <View style={s.eyebrowRow}>
                  <Text style={s.eyebrow}>MEVCUT RÜTBEN</Text>
                  <Pill color={tier.color}>AKTİF</Pill>
                </View>
                <Text style={s.rankTitle}>{tier.name}</Text>
                <View style={s.pointsRow}>
                  <Text style={s.points}>{leaguePoints}</Text>
                  <Text style={s.pointsLabel}> lig puanı</Text>
                </View>
              </View>
              <View style={[s.rankBadge, { borderColor: tier.color }]}>
                <Text style={[s.rankBadgeText, { color: tier.color }]}>♛</Text>
              </View>
            </View>
            <View style={s.progressMeta}>
              <Text style={s.progressLabel}>RÜTBE İLERLEMESİ</Text>
              <Text numberOfLines={1} style={s.progressValue}>
                {nextTier ? `${leaguePoints}/${nextTier.min}` : 'MAKSİMUM'}
              </Text>
            </View>
            <Progress value={tierProgress} color={tier.color} />
            <Text style={s.progressCopy}>
              {nextTier
                ? `${nextTier.min - leaguePoints} puan sonra ${nextTier.name}`
                : 'En üst rütbedesin.'}
            </Text>
          </View>
        </Card>

        <View style={s.seasonCard}>
          <View style={s.seasonCopy}>
            <Text style={s.seasonEyebrow}>SEZON HEDEFİ</Text>
            <Text style={s.seasonTitle}>
              {nextTier ? `${nextTier.name} rütbesine ulaş` : 'Zirveyi koru'}
            </Text>
            <Text style={s.seasonSubtitle}>
              Bir sonraki rütbe için ilerlemeni takip et.
            </Text>
          </View>
          <Text style={s.seasonIcon}>♛</Text>
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>
              {playerRank ? `${playerRank}.` : '—'}
            </Text>
            <Text style={s.statLabel}>Sıralama</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>{leagueWins}</Text>
            <Text style={s.statLabel}>Galibiyet</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>{leagueLosses}</Text>
            <Text style={s.statLabel}>Mağlubiyet</Text>
          </View>
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Lig sıralaması</Text>
          <Pill color={C.gold}>AKTİF</Pill>
        </View>
        <View style={s.leaderboard}>
          {loading ? (
            <View style={s.loading}>
              <ActivityIndicator color={C.gold} />
              <Text style={s.loadingText}>Sıralama güncelleniyor…</Text>
            </View>
          ) : error ? (
            <View style={s.loading}>
              <Text style={s.errorText}>{error}</Text>
              <Button
                title="TEKRAR DENE"
                color={C.gold}
                onPress={loadLeaderboard}
              />
            </View>
          ) : (
            players.map((player, index) => {
              const isCurrentPlayer = player.player_id === playerId;
              return (
                <View
                  key={player.player_id}
                  style={[s.playerRow, isCurrentPlayer && s.currentPlayer]}
                >
                  <Text style={s.playerRank}>{index + 1}</Text>
                  <View style={s.playerAvatar}>
                    <Text style={s.playerAvatarText}>
                      {player.display_name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={s.playerName}>
                    {isCurrentPlayer ? 'Sen' : player.display_name}
                  </Text>
                  <Text style={s.playerPoints}>{player.points} P</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Maç başına puan</Text>
          <View style={s.rulesRow}>
            <View style={s.rule}>
              <Text style={s.ruleLabel}>Galibiyet</Text>
              <Text style={s.ruleWin}>+25 P</Text>
            </View>
            <View style={s.rule}>
              <Text style={s.ruleLabel}>Beraberlik</Text>
              <Text style={s.ruleDraw}>+5 P</Text>
            </View>
            <View style={s.rule}>
              <Text style={s.ruleLabel}>Mağlubiyet</Text>
              <Text style={s.ruleLoss}>−15 P</Text>
            </View>
          </View>
        </View>
        <Button
          title="DÜELLO BAŞLAT"
          color={C.gold}
          onPress={() => navigation.navigate('Duel')}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 16, paddingBottom: 30 },
  rankCard: { borderRadius: 24, overflow: 'hidden' },
  rankInner: { padding: 20, paddingTop: 16, gap: 12 },
  rankAccent: { height: 4, width: 42, borderRadius: 4, marginBottom: 2 },
  rankTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rankCopy: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rankTitle: { color: C.text, fontSize: 26, fontWeight: '900', marginTop: 7 },
  rankBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.06)',
    flexShrink: 0,
  },
  rankBadgeText: { fontSize: 31, fontWeight: '900' },
  pointsRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  points: { color: C.text, fontSize: 30, fontWeight: '900' },
  pointsLabel: { color: C.muted, fontSize: 13, marginLeft: 6 },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    minWidth: 0,
  },
  progressLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  progressValue: {
    color: C.text,
    fontSize: 11,
    fontWeight: '900',
    flexShrink: 0,
  },
  progressCopy: { color: C.muted, fontSize: 12, marginTop: 8 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: C.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '900' },
  leaderboard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 8,
    gap: 4,
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  loadingText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  errorText: { color: C.coral, fontSize: 12, textAlign: 'center' },
  playerRow: {
    minHeight: 58,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  seasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(248,199,68,.10)',
    borderWidth: 1,
    borderColor: 'rgba(248,199,68,.22)',
  },
  seasonCopy: { flex: 1, minWidth: 0 },
  seasonEyebrow: { color: C.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  seasonTitle: { color: C.text, fontSize: 16, fontWeight: '900', marginTop: 4 },
  seasonSubtitle: { color: C.muted, fontSize: 11, marginTop: 4 },
  seasonIcon: { color: C.gold, fontSize: 32, marginLeft: 12 },
  currentPlayer: { backgroundColor: 'rgba(248,199,68,.12)' },
  playerRank: {
    width: 18,
    color: C.muted,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: C.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarText: { color: C.gold, fontSize: 13, fontWeight: '900' },
  playerName: { flex: 1, color: C.text, fontSize: 13, fontWeight: '800' },
  playerPoints: { color: C.gold, fontSize: 12, fontWeight: '900' },
  infoCard: {
    backgroundColor: 'rgba(248,199,68,.08)',
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(248,199,68,.16)',
  },
  infoTitle: { color: C.gold, fontSize: 13, fontWeight: '900' },
  rulesRow: { flexDirection: 'row', gap: 8 },
  rule: { flex: 1, gap: 4 },
  ruleLabel: { color: C.muted, fontSize: 10, fontWeight: '700' },
  ruleWin: { color: C.mint, fontSize: 13, fontWeight: '900' },
  ruleDraw: { color: C.gold, fontSize: 13, fontWeight: '900' },
  ruleLoss: { color: C.coral, fontSize: 13, fontWeight: '900' },
});
