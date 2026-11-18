import LinearGradient from 'react-native-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export const C = {
  bg: '#101729',
  surface: '#17243B',
  raised: '#213452',
  ink: '#081426',
  text: '#FFFDF5',
  muted: '#AAB9CC',
  purple: '#F8C744',
  mint: '#16D6C4',
  gold: '#F8C744',
  coral: '#FF8A4C',
  cream: '#FFF5D8',
};
export const gameFeedback = (kind: 'success' | 'error' | 'tap') => {
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
  return (
    <View style={[s.pill, { backgroundColor: `${color}22` }]}>
      <Text style={[s.pillText, { color }]}>{children}</Text>
    </View>
  );
}
export function Progress({
  value,
  color = C.purple,
}: {
  value: number;
  color?: string;
}) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}
export function Button({
  title,
  color = C.purple,
  onPress,
}: {
  title: string;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: color, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Card({
  colors,
  children,
  style,
}: {
  colors: [string, string];
  children: ReactNode;
  style?: object;
}) {
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
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <LinearGradient colors={colors} style={[s.card, style]}>
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
}: {
  title: string;
  tag: string;
  color: string;
  onBack: () => void;
  minimal?: boolean;
  tagOnly?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={onBack} style={s.back}>
        <Text style={s.backText}>‹</Text>
      </Pressable>
      {minimal ? (
        <View style={{ flex: 1 }} />
      ) : (
        <View style={{ flex: 1 }}>
          {tagOnly ? (
            <Pill color={color}>{tag}</Pill>
          ) : (
            <>
              <Pill color={color}>{tag}</Pill>
              <Text style={s.headerTitle}>{title}</Text>
            </>
          )}
        </View>
      )}
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
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
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
    borderColor: 'rgba(255,255,255,.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { color: C.text, fontSize: 31, lineHeight: 32 },
  headerTitle: { color: C.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
});
