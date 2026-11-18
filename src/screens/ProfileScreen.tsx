import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../../App';
import { BackHeader, Card, C, Pill, Progress } from '../ui';
import { useGame } from '../gameState';
import { useAuth } from '../authState';
export function ProfileScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Profile'>) {
  const game = useGame();
  const { session, logout } = useAuth();
  const displayName =
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'Oyuncu';
  const initials = displayName.slice(0, 2).toUpperCase();
  return (
    <View style={s.root}>
      <BackHeader
        title={displayName}
        tag="OYUNCU PROFİLİ"
        color={C.gold}
        onBack={navigation.goBack}
      />
      <ScrollView
        contentContainerStyle={s.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Card colors={['#4B3A1B', '#243554']} style={s.profile}>
          <View style={s.profileInner}>
            <View style={s.accountLabelRow}>
              <Text style={s.accountLabel}>HESAP ÖZETİ</Text>
              <Pill color={session ? C.mint : C.gold}>
                {session ? 'SENKRONİZE' : 'MİSAFİR'}
              </Pill>
            </View>
            <View style={s.profileHeader}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <View style={s.profileCopy}>
                <Text style={s.level}>SEVİYE {game.level}</Text>
                <Text style={s.title}>Kelime Ustası</Text>
                <Text style={s.email} numberOfLines={1}>
                  {session?.user?.email || 'İlerlemen bu cihazda saklanır'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={session ? 'Çıkış yap' : 'Giriş yap'}
                onPress={() =>
                  session ? logout() : navigation.navigate('Auth')
                }
                style={({ pressed }) => [s.authAction, pressed && s.pressed]}
              >
                <Text style={s.authActionText}>
                  {session ? 'ÇIKIŞ' : 'GİRİŞ'}
                </Text>
                <Text style={s.authActionIcon}>↗</Text>
              </Pressable>
            </View>
            <View style={s.profileDivider} />
            <View style={s.resourceRow}>
              <View style={s.resource}>
                <Text style={s.resourceLabel}>TOPLAM XP</Text>
                <Text style={s.resourceValue}>
                  {game.xp.toLocaleString('tr-TR')}
                </Text>
              </View>
              <View style={s.resource}>
                <Text style={s.resourceLabel}>SONRAKİ SEVİYE</Text>
                <Text style={s.resourceValue}>{200 - (game.xp % 200)} XP</Text>
              </View>
            </View>
            <View style={s.progressHeader}>
              <Text style={s.progressLabel}>Seviye ilerlemesi</Text>
              <Text style={s.progressValue}>
                %{Math.round((game.xp % 200) / 2)}
              </Text>
            </View>
            <Progress value={Math.round((game.xp % 200) / 2)} color={C.gold} />
          </View>
        </Card>
        <Text style={s.heading}>Oyun istatistikleri</Text>
        <View style={s.metrics}>
          {[
            [String(game.classicCompletedLevels.length), 'Bölüm'],
            [String(game.classicWords), 'Kelime'],
            [String(game.duelWins), 'Düello'],
          ].map(([value, label]) => (
            <View key={label} style={s.metric}>
              <Text style={s.metricValue}>{value}</Text>
              <Text style={s.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={s.levelProgressCard}>
          <View style={s.levelProgressHeader}>
            <View>
              <Text style={s.levelProgressEyebrow}>İLERLEMEN</Text>
              <Text style={s.levelProgressTitle}>Sonraki seviye</Text>
            </View>
            <Text style={s.levelProgressValue}>
              %{Math.round((game.xp % 200) / 2)}
            </Text>
          </View>
          <Progress value={Math.round((game.xp % 200) / 2)} color={C.gold} />
          <Text style={s.levelProgressCopy}>
            Seviye {game.level + 1} için {200 - (game.xp % 200)} XP kaldı
          </Text>
        </View>
        <Text style={s.heading}>Son başarımlar</Text>
        <View style={s.achievement}>
          <Text style={s.badge}>♛</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.achievementTitle}>
              {game.classicWords >= 10 ? 'Kelime Avcısı' : 'İlk Kelime'}
            </Text>
            <Text style={s.achievementCopy}>
              {game.classicWords >= 10
                ? '10 kelime buldun'
                : `${game.classicWords} kelime buldun`}
            </Text>
          </View>
          <Pill color={game.classicWords > 0 ? '#F5C966' : C.muted}>
            {game.classicWords > 0 ? 'AÇILDI' : 'KİLİTLİ'}
          </Pill>
        </View>
        <View style={s.achievement}>
          <Text style={s.badge}>◆</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.achievementTitle}>XP Kaşifi</Text>
            <Text style={s.achievementCopy}>1.000 XP biriktir</Text>
          </View>
          <Pill color={game.xp >= 1000 ? '#F5C966' : C.muted}>
            {game.xp >= 1000 ? 'AÇILDI' : 'KİLİTLİ'}
          </Pill>
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 16 },
  profile: {
    borderRadius: 26,
  },
  profileInner: {
    padding: 20,
    gap: 16,
  },
  accountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountLabel: {
    color: '#E5C978',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  authAction: {
    minWidth: 58,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.16)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  authActionText: { color: C.gold, fontSize: 9, fontWeight: '900' },
  authActionIcon: {
    color: C.gold,
    fontSize: 15,
    lineHeight: 15,
    fontWeight: '900',
  },
  pressed: { opacity: 0.72 },
  profileDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,.12)',
  },
  profileCopy: { flex: 1, minWidth: 0 },
  avatar: {
    height: 72,
    width: 72,
    borderRadius: 24,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#101729', fontSize: 20, fontWeight: '700' },
  level: { color: '#FFE7A1', fontSize: 10, fontWeight: '900' },
  title: { color: 'white', fontSize: 21, fontWeight: '900', marginTop: 4 },
  email: { color: '#C4D0DF', fontSize: 11, marginTop: 7 },
  resourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  resource: { flex: 1, minWidth: 0 },
  resourceLabel: {
    color: '#E5C978',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resourceValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -7,
  },
  progressLabel: { color: '#C4D0DF', fontSize: 10, fontWeight: '700' },
  progressValue: { color: C.gold, fontSize: 12, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 9 },
  metric: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    backgroundColor: C.surface,
    borderRadius: 18,
  },
  metricValue: { color: C.text, fontWeight: '900', fontSize: 18 },
  metricLabel: { color: C.muted, fontSize: 10, marginTop: 4 },
  levelProgressCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#17243B',
    borderWidth: 1,
    borderColor: 'rgba(248,199,68,.16)',
    gap: 10,
  },
  levelProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelProgressEyebrow: {
    color: '#E5C978',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  levelProgressTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  levelProgressValue: { color: C.gold, fontSize: 20, fontWeight: '900' },
  levelProgressCopy: { color: C.muted, fontSize: 11 },
  heading: { color: C.text, fontSize: 18, fontWeight: '900', marginTop: 7 },
  achievement: {
    backgroundColor: C.surface,
    padding: 15,
    borderRadius: 19,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  badge: { color: '#F5C966', fontSize: 25 },
  achievementTitle: { color: C.text, fontWeight: '900', fontSize: 13 },
  achievementCopy: { color: C.muted, fontSize: 10, marginTop: 4 },
});
