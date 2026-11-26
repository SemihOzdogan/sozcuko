import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { useEffect, useState } from 'react';
import type { RootStackParamList } from '../../App';
import {
  BackHeader,
  AppModal,
  Card,
  C,
  getHapticsEnabled,
  loadThemeMode,
  loadHapticsEnabled,
  Pill,
  Progress,
  setHapticsEnabled,
  setThemeMode,
} from '../ui';
import { useGame } from '../gameState';
import { useAuth } from '../authState';
export function ProfileScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Profile'>) {
  const game = useGame();
  const { session, logout, deleteAccount } = useAuth();
  const [accountModal, setAccountModal] = useState<
    'confirm' | 'success' | 'error' | null
  >(null);
  const [accountError, setAccountError] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [hapticsEnabled, setHapticsEnabledState] = useState(
    getHapticsEnabled(),
  );
  const isLight = useColorScheme() === 'light';
  const [darkMode, setDarkMode] = useState(!isLight);
  useEffect(() => {
    loadHapticsEnabled().then(setHapticsEnabledState);
    loadThemeMode().then(mode => setDarkMode(mode === 'dark'));
  }, []);
  const displayName =
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'Misafir';
  const initials = displayName.slice(0, 2).toUpperCase();
  const requestAccountDeletion = () => {
    if (!session || deletingAccount) return;
    setAccountError('');
    setAccountModal('confirm');
  };
  const confirmAccountDeletion = async () => {
    try {
      setDeletingAccount(true);
      await deleteAccount();
      game.resetProgress();
      setAccountModal('success');
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : 'Lütfen tekrar dene.',
      );
      setAccountModal('error');
    } finally {
      setDeletingAccount(false);
    }
  };
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
        <Card
          colors={isLight ? ['#FFFFFF', '#FFFFFF'] : ['#4B3A1B', '#243554']}
          preserveColors
          style={s.profile}
        >
          <View style={s.profileInner}>
            <View style={s.accountLabelRow}>
              <Text style={s.accountLabel}>HESAP ÖZETİ</Text>
            </View>
            <View style={s.profileHeader}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <View style={s.profileCopy}>
                <Text style={s.level}>SEVİYE {game.level}</Text>
                <Text
                  style={s.title}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  Kelime Ustası
                </Text>
                {session?.user?.email ? (
                  <Text style={s.email} numberOfLines={1}>
                    {session.user.email}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={session ? 'Çıkış yap' : 'Giriş yap'}
                onPress={() =>
                  session ? logout() : navigation.navigate('Auth')
                }
                style={({ pressed }) => [
                  s.authAction,
                  session ? s.logoutAction : s.loginAction,
                  pressed && s.pressed,
                ]}
              >
                <Text
                  style={[
                    s.authActionText,
                    session ? s.logoutActionText : s.loginActionText,
                  ]}
                >
                  {session ? 'ÇIKIŞ YAP' : 'GİRİŞ YAP'}
                </Text>
                <Text
                  style={[
                    s.authActionIcon,
                    session ? s.logoutActionText : s.loginActionText,
                  ]}
                >
                  ↗
                </Text>
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
        <View style={s.preferenceCard}>
          <View style={s.preferenceCopy}>
            <Text style={s.preferenceTitle}>Titreşimli geri bildirim</Text>
            <Text style={s.preferenceSubtitle}>
              Doğru ve hatalı kelimelerde kısa titreşim kullan.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Titreşimli geri bildirimi aç veya kapat"
            value={hapticsEnabled}
            onValueChange={enabled => {
              setHapticsEnabledState(enabled);
              setHapticsEnabled(enabled);
            }}
            trackColor={{
              false: isLight ? '#CBD5E1' : '#3A4A62',
              true: 'rgba(22,214,196,.45)',
            }}
            thumbColor={hapticsEnabled ? C.mint : '#FFFFFF'}
          />
        </View>
        <View style={s.preferenceCard}>
          <View style={s.preferenceCopy}>
            <Text style={s.preferenceTitle}>
              {darkMode ? 'Koyu tema' : 'Açık tema'}
            </Text>
            <Text style={s.preferenceSubtitle}>
              Uygulamanın görünümünü açık veya koyu olarak seç.
            </Text>
          </View>
          <Switch
            accessibilityLabel={`${
              darkMode ? 'Koyu' : 'Açık'
            } temayı aç veya kapat`}
            value={darkMode}
            onValueChange={enabled => {
              setDarkMode(enabled);
              setThemeMode(enabled ? 'dark' : 'light');
            }}
            trackColor={{ false: '#CBD5E1', true: 'rgba(22,214,196,.45)' }}
            thumbColor={darkMode ? C.mint : '#FFFFFF'}
          />
        </View>
        {session ? (
          <View style={s.dangerCard}>
            <View style={s.preferenceCopy}>
              <Text style={s.preferenceTitle}>Hesabı sil</Text>
              <Text style={s.preferenceSubtitle}>
                Hesabını ve hesabına bağlı oyun verilerini kalıcı olarak sil.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hesabı sil"
              accessibilityState={{ disabled: deletingAccount }}
              disabled={deletingAccount}
              onPress={requestAccountDeletion}
              style={({ pressed }) => [
                s.deleteAccountButton,
                pressed && s.pressed,
              ]}
            >
              {deletingAccount ? (
                <ActivityIndicator color={C.coral} />
              ) : (
                <Text style={s.deleteAccountText}>SİL</Text>
              )}
            </Pressable>
          </View>
        ) : null}
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
      <AppModal
        visible={accountModal === 'confirm'}
        title="Hesabı sil?"
        message="Hesabın, lig sıralaman ve düello verilerin kalıcı olarak silinecek. Bu işlem geri alınamaz."
        confirmLabel="Hesabı Sil"
        cancelLabel="Vazgeç"
        destructive
        loading={deletingAccount}
        onCancel={() => setAccountModal(null)}
        onConfirm={confirmAccountDeletion}
      />
      <AppModal
        visible={accountModal === 'success'}
        title="Hesap silindi"
        message="Hesabın ve bağlı verilerin silindi."
        onConfirm={() => setAccountModal(null)}
      />
      <AppModal
        visible={accountModal === 'error'}
        title="Hesap silinemedi"
        message={accountError}
        onConfirm={() => setAccountModal(null)}
      />
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
    color: C.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  authAction: {
    minWidth: 92,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  loginAction: {
    backgroundColor: 'rgba(248,199,68,.14)',
    borderColor: 'rgba(248,199,68,.3)',
  },
  logoutAction: {
    backgroundColor: 'rgba(255,138,76,.12)',
    borderColor: 'rgba(255,138,76,.28)',
  },
  authActionText: { fontSize: 10, fontWeight: '900' },
  loginActionText: { color: C.gold },
  logoutActionText: { color: C.coral },
  authActionIcon: {
    color: C.gold,
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '900',
  },
  pressed: { opacity: 0.72 },
  profileDivider: { height: 1, backgroundColor: C.border },
  profileCopy: { flex: 1, minWidth: 0 },
  avatar: {
    height: 72,
    width: 72,
    borderRadius: 24,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.ink, fontSize: 20, fontWeight: '700' },
  level: { color: C.gold, fontSize: 10, fontWeight: '900' },
  title: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginTop: 4,
    flexShrink: 1,
  },
  email: { color: C.muted, fontSize: 11, marginTop: 7 },
  resourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  resource: { flex: 1, minWidth: 0 },
  resourceLabel: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resourceValue: {
    color: C.text,
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
  progressLabel: { color: C.muted, fontSize: 10, fontWeight: '700' },
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
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(248,199,68,.16)',
    gap: 10,
  },
  preferenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  preferenceCopy: { flex: 1, minWidth: 0 },
  preferenceTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
  preferenceSubtitle: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,138,76,.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,76,.28)',
  },
  deleteAccountButton: {
    minWidth: 58,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,138,76,.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    color: C.coral,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  levelProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelProgressEyebrow: {
    color: C.gold,
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
