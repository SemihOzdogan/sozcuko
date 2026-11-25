import LinearGradient from 'react-native-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  ActivityIndicator,
  AccessibilityInfo,
  Appearance,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
  DynamicColorIOS,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const adaptive = (dark: string, light: string) =>
  DynamicColorIOS({ dark, light }) as unknown as string;

export const C = {
  bg: adaptive('#101729', '#F4F7FB'),
  surface: adaptive('#17243B', '#FFFFFF'),
  raised: adaptive('#213452', '#E8EEF7'),
  ink: '#081426',
  text: adaptive('#FFFDF5', '#142033'),
  muted: adaptive('#AAB9CC', '#52627A'),
  purple: '#F8C744',
  mint: '#16D6C4',
  mintText: adaptive('#16D6C4', '#087F76'),
  gold: '#F8C744',
  goldText: adaptive('#F8C744', '#8A5D00'),
  coral: '#FF8A4C',
  coralText: adaptive('#FF8A4C', '#B44A1E'),
  homeClassicStart: adaptive('#123B52', '#FFFFFF'),
  homeClassicEnd: adaptive('#17243B', '#FFFFFF'),
  homeDuelStart: adaptive('#4A2B26', '#FFFFFF'),
  homeDuelEnd: adaptive('#17243B', '#FFFFFF'),
  homeLeagueStart: adaptive('#3B321E', '#FFFFFF'),
  homeLeagueEnd: adaptive('#17243B', '#FFFFFF'),
  cream: adaptive('#FFF5D8', '#5C4310'),
  heroText: adaptive('#D7E9EC', '#123B52'),
  heroMuted: adaptive('#A8E7E0', '#0D756F'),
  border: adaptive('rgba(255,255,255,.08)', 'rgba(20,32,51,.12)'),
};
export const UI_TOKENS = {
  surface: { base: C.bg, raised: C.surface, elevated: C.raised },
  text: { primary: C.text, muted: C.muted, inverse: C.ink },
  action: { primary: C.purple, success: C.mint, danger: C.coral },
  feedback: { success: C.mint, error: '#FF9B83', warning: C.gold },
  motion: { press: 70, fast: 150, base: 280, panel: 350 },
} as const;
const HAPTICS_KEY = '@sozcuko/haptics-enabled';
const THEME_KEY = '@sozcuko/theme-mode';
let hapticsEnabled = true;
let reduceMotionEnabled = false;
export const loadHapticsEnabled = async () => {
  const value = await AsyncStorage.getItem(HAPTICS_KEY);
  if (value !== null) hapticsEnabled = value !== 'false';
  return hapticsEnabled;
};
void loadHapticsEnabled();
void AccessibilityInfo.isReduceMotionEnabled().then(value => {
  reduceMotionEnabled = value;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
  reduceMotionEnabled = value;
});
export const getHapticsEnabled = () => hapticsEnabled;
export const setHapticsEnabled = (enabled: boolean) => {
  hapticsEnabled = enabled;
  AsyncStorage.setItem(HAPTICS_KEY, String(enabled)).catch(() => undefined);
};
export const loadThemeMode = async () => {
  const value = await AsyncStorage.getItem(THEME_KEY);
  if (value === 'light' || value === 'dark') Appearance.setColorScheme(value);
  return value === 'light' || value === 'dark' ? value : 'system';
};
export const setThemeMode = async (mode: 'light' | 'dark') => {
  Appearance.setColorScheme(mode);
  await AsyncStorage.setItem(THEME_KEY, mode);
};
void loadThemeMode();
export const gameFeedback = (kind: 'success' | 'error' | 'tap') => {
  if (!hapticsEnabled || reduceMotionEnabled) return;
  if (kind === 'success') Vibration.vibrate([0, 18, 45, 18]);
  else if (kind === 'error') Vibration.vibrate([0, 45]);
  else Vibration.vibrate(12);
};
export function Pill({
  children,
  color = C.mint,
}: {
  children: ReactNode;
  color?: string;
}) {
  const colorScheme = useColorScheme();
  const textColor =
    colorScheme === 'light' && color === C.mint
      ? C.mintText
      : colorScheme === 'light' && color === C.gold
        ? C.goldText
        : colorScheme === 'light' && color === C.coral
          ? C.coralText
          : color;
  return (
    <View style={[s.pill, { backgroundColor: `${color}22` }]}> 
      <Text style={[s.pillText, { color: textColor }]}>{children}</Text>
    </View>
  );
}
export function Progress({
  value,
  color = UI_TOKENS.action.primary,
  trackColor,
}: {
  value: number;
  color?: string;
  trackColor?: string;
}) {
  const isLight = useColorScheme() === 'light';
  return (
    <View
      style={[
        s.track,
        {
          backgroundColor:
            trackColor ??
            (isLight ? 'rgba(20,32,51,.14)' : 'rgba(255,255,255,.15)'),
        },
      ]}
    >
      <View style={[s.fill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}
export function Button({
  title,
  color = UI_TOKENS.action.primary,
  onPress,
  disabled = false,
  loading = false,
}: {
  title: string;
  color?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: color, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        pressed && !disabled && !loading && s.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={C.ink} />
      ) : (
        <Text style={s.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}
export function Card({
  colors,
  children,
  style,
  preserveColors = false,
}: {
  colors: [string, string];
  children: ReactNode;
  style?: object;
  preserveColors?: boolean;
}) {
  const colorScheme = useColorScheme();
  const resolvedColors: [string, string] =
    colorScheme === 'light' && !preserveColors ? [C.surface, C.raised] : colors;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);
  return (
    <Animated.View
      style={{ alignSelf: 'stretch', opacity, transform: [{ translateY }] }}
    >
      <LinearGradient
        colors={resolvedColors}
        style={[s.card, { alignSelf: 'stretch', minWidth: 0 }, style]}
      >
        {children}
      </LinearGradient>
    </Animated.View>
  );
}
export function BackHeader({
  title,
  tag,
  color,
  onBack,
  minimal = false,
  tagOnly = false,
  rightContent,
}: {
  title: string;
  tag: string;
  color: string;
  onBack: () => void;
  minimal?: boolean;
  tagOnly?: boolean;
  rightContent?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={onBack} style={s.back}>
        <Text style={s.backText}>‹</Text>
      </Pressable>
      {minimal ? (
        <View style={{ flex: 1, minWidth: 0 }} />
      ) : (
        <View style={{ flex: 1, minWidth: 0 }}>
          {tagOnly ? (
            <View style={s.headerTagFrame}>
              <Text
                style={[
                  s.headerTagText,
                  { color: color === C.mint ? C.mintText : color },
                ]}
              >
                {tag}
              </Text>
            </View>
          ) : (
            <>
              <Pill color={color}>{tag}</Pill>
              <Text style={s.headerTitle}>{title}</Text>
            </>
          )}
        </View>
      )}
      {rightContent}
    </View>
  );
}
const s = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  track: {
    height: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,.15)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 8 },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: {
    color: C.ink,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  buttonPressed: { transform: [{ scale: 0.96 }] },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    height: 42,
    width: 42,
    borderRadius: 14,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { color: C.text, fontSize: 31, lineHeight: 32 },
  headerTitle: { color: C.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  headerTagFrame: {
    alignSelf: 'flex-start',
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
