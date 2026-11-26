import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, type ComponentRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
  Image,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';
import { Card, C, Pill, Progress } from '../ui';
import { useGame } from '../gameState';
import { useAuth } from '../authState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const modes = [
  [
    'Klasik Kelime',
    'Bölümleri sırayla çöz, ipuçlarını doğru yerde kullan.',
    '#16D6C4',
    '#123B52',
    'Classic',
  ],
  [
    'Düello',
    'Rakibinden önce kelimeyi bul, süre bitmeden puanı kap.',
    '#FF8A4C',
    '#4A2B26',
    'Duel',
  ],
  [
    'Kelime Ligi',
    'Düellolardan puan kazan, sıralamada yüksel.',
    '#F8C744',
    '#3B321E',
    'League',
  ],
] as const;
const CLASSIC_TOTAL_LEVELS = 100;
export function HomeScreen({ navigation }: Props) {
  const game = useGame();
  const { session } = useAuth();
  const displayName =
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'Misafir';
  const initials = displayName.slice(0, 2).toUpperCase();
  const { width: screenWidth } = useWindowDimensions();
  const isLight = useColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const contentWidth = Math.max(0, screenWidth - 32);
  const classicProgress = Math.min(
    100,
    Math.round(
      (game.classicCompletedLevels.length / CLASSIC_TOTAL_LEVELS) * 100,
    ),
  );
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(
        () => scrollRef.current?.scrollTo({ y: 0, animated: false }),
        0,
      );
      return () => clearTimeout(timer);
    }, []),
  );
  return (
    <ScrollView
      ref={scrollRef}
      style={s.root}
      contentContainerStyle={[
        s.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.inner, { width: contentWidth }]}>
        <View style={s.top}>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={s.user}
            android_ripple={{
              color: 'rgba(255,255,255,.08)',
              borderless: true,
            }}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={s.userCopy}>
              <Text style={s.hello} numberOfLines={1}>
                Merhaba, {displayName}
              </Text>
              <Text style={s.sub} numberOfLines={1}>
                Seviye {game.level} · Kelime Ustası
              </Text>
            </View>
          </Pressable>
          <View style={[s.xpBadge, isLight && s.xpBadgeLight]}>
            <Text style={[s.xpIcon, isLight && s.xpTextLight]}>XP</Text>
            <Text style={[s.xpValue, isLight && s.xpTextLight]}>
              {game.xp.toLocaleString('tr-TR')}
            </Text>
          </View>
        </View>
        <Card
          colors={isLight ? ['#D8F5F0', '#FFFFFF'] : ['#12355B', '#0E6B73']}
          preserveColors
          style={s.hero}
        >
          <View style={s.heroContent}>
            <View style={s.heroTop}>
              <Pill color={C.mint}>KLASİK OYUN</Pill>
            </View>
            <Text style={s.heroTitle} numberOfLines={2}>
              Bölüm {game.classicCompletedLevels.length + 1}'i çözmeye devam et.
            </Text>
            <Text style={s.heroText} numberOfLines={2}>
              Kelimeleri bul, ipuçlarını kullan ve bir sonraki bölümü aç.
            </Text>
            <View style={s.heroProgressHeader}>
              <Text style={s.heroProgressLabel}>KLASİK İLERLEMESİ</Text>
              <Text style={s.heroProgressValue}>{`${classicProgress}%`}</Text>
            </View>
            <View style={s.heroProgress}>
              <Progress
                value={classicProgress}
                color={C.mint}
                trackColor={
                  isLight ? 'rgba(20,32,51,.16)' : 'rgba(255,255,255,.26)'
                }
              />
            </View>
          </View>
        </Card>
        <View style={s.modeList}>
          {modes.map(([title, copy, accent, dark, route]) => (
            <Pressable
              key={title}
              disabled={!route}
              onPress={() => route && navigation.navigate(route)}
              android_ripple={{ color: 'rgba(255,255,255,.08)' }}
              style={({ pressed }) => [s.modePress, pressed && s.pressed]}
            >
              <Card
                colors={
                  isLight && title === 'Klasik Kelime'
                    ? ['#D8F5F0', '#FFFFFF']
                    : isLight
                    ? ['#FFFFFF', '#FFFFFF']
                    : [dark, '#17243B']
                }
                preserveColors
                style={s.modeCard}
              >
                <View style={[s.symbolBox, { backgroundColor: `${accent}20` }]}>
                  {title === 'Klasik Kelime' ? (
                    <Image
                      source={require('../assets/splash-logo.png')}
                      accessibilityLabel="Sözcüko splash görseli"
                      style={s.symbolImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={[
                        s.symbol,
                        {
                          color: title === 'Düello' ? C.coralText : C.goldText,
                        },
                      ]}
                    >
                      {title === 'Düello' ? 'ϟ' : '♛'}
                    </Text>
                  )}
                </View>
                <View style={s.modeCopy}>
                  <Text numberOfLines={1} style={s.tileTitle}>
                    {title}
                  </Text>
                  <Text numberOfLines={2} style={s.tileCopy}>
                    {copy}
                  </Text>
                </View>
                <Text style={s.modeArrow}>{route ? '›' : '•'}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
function Header({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.detail}>{detail}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { alignItems: 'center' },
  inner: { alignItems: 'stretch' },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  userCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  avatar: {
    backgroundColor: C.gold,
    height: 44,
    width: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.ink, fontWeight: '900', fontSize: 14 },
  hello: { color: C.text, fontWeight: '900', fontSize: 16 },
  sub: { color: C.muted, fontSize: 11, marginTop: 4, left: 5 },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 14,
    minWidth: 78,
    justifyContent: 'center',
    flexShrink: 0,
  },
  xpBadgeLight: {
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  xpIcon: {
    color: C.goldText,
    fontSize: 10,
    fontWeight: '900',
    marginRight: 5,
  },
  xpValue: { color: C.goldText, fontWeight: '900', fontSize: 12 },
  xpTextLight: { color: C.ink },
  hero: {
    minHeight: 208,
    width: '100%',
    alignSelf: 'stretch',
    marginHorizontal: 0,
  },
  heroPressable: { width: '100%' },
  heroContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 10,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0,
  },
  heroTitle: {
    color: C.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    marginTop: 14,
  },
  heroText: {
    color: C.heroText,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 8,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  heroAction: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(22,214,196,.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroActionText: {
    color: C.mint,
    fontSize: 10,
    fontWeight: '900',
  },
  heroActionArrow: {
    color: C.mint,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '900',
  },
  heroProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroProgressLabel: {
    color: C.heroMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroProgressValue: { color: C.mintText, fontSize: 12, fontWeight: '900' },
  heroProgress: { marginTop: -2 },
  section: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: C.text,
    fontWeight: '900',
    fontSize: 17,
    flex: 1,
    flexShrink: 1,
  },
  detail: {
    color: C.mintText,
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 100,
    flexShrink: 1,
    textAlign: 'right',
  },
  pressable: { alignSelf: 'stretch' },
  pressed: { opacity: 0.78 },
  continue: {
    minHeight: 80,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  continueBody: { flex: 1, minWidth: 0, marginHorizontal: 12, gap: 7 },
  icon: {
    height: 48,
    width: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(22,214,196,.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    left: 10,
  },
  iconText: { color: C.mint, fontWeight: '900', fontSize: 19 },
  cardTitle: { color: C.text, fontWeight: '900', fontSize: 14, left: 5 },
  arrow: {
    color: C.muted,
    fontSize: 28,
    lineHeight: 30,
    width: 18,
    textAlign: 'right',
    right: 10,
  },
  modeList: { gap: 9, marginTop: 10 },
  modePress: { alignSelf: 'stretch' },
  modeCard: {
    minHeight: 80,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    left: 10,
  },
  symbol: { fontWeight: '900', fontSize: 24, textAlign: 'center' },
  symbolImage: { width: 42, height: 42, borderRadius: 13 },
  modeCopy: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    marginHorizontal: 11,
    left: 5,
  },
  tileTitle: {
    color: C.text,
    fontWeight: '900',
    fontSize: 14,
    flexShrink: 1,
    left: 5,
  },
  tileCopy: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
    flexShrink: 1,
    left: 5,
  },
  modeArrow: {
    color: C.text,
    width: 18,
    textAlign: 'right',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '900',
    flexShrink: 0,
    right: 10,
  },
});
