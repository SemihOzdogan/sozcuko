import 'react-native-gesture-handler';
import {
  createNavigationContainerRef,
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Alert,
  AppState,
  BackHandler,
  StatusBar,
  useColorScheme,
} from 'react-native';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { ClassicScreen } from './src/screens/ClassicScreen';
import { DuelScreen } from './src/screens/DuelScreen';
import { LeagueScreen } from './src/screens/LeagueScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { GameProvider } from './src/gameState';
import { C } from './src/ui';
import { AuthProvider, useAuth } from './src/authState';
import { AuthScreen } from './src/screens/AuthScreen';
import {
  ensureLeaguePlayer,
  markLeaguePlayerOffline,
  touchLeaguePlayer,
} from './src/services/leagueService';
import { getDuelPlayerId } from './src/services/duelService';
import { fetchIncomingDuelInvitation } from './src/services/duelService';
import {
  configureLocalNotifications,
  showDuelInvitationNotification,
  subscribeToNotificationPress,
} from './src/services/localNotificationService';
import { initializeAds } from './src/services/adService';
export type RootStackParamList = {
  Home: undefined;
  Classic: undefined;
  Duel: { invitationId?: string } | undefined;
  League: undefined;
  Profile: undefined;
  Auth: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
function AuthenticatedApp() {
  const { isLoading } = useAuth();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === 'light';
  useEffect(() => {
    initializeAds().catch(() => undefined);
  }, []);
  if (isLoading) return null;
  return (
    <GameProvider>
      <PresenceTracker />
      <AndroidBackHandler />
      <NavigationContainer
        ref={navigationRef}
        theme={{
          ...(isLight ? DefaultTheme : DarkTheme),
          colors: {
            ...(isLight ? DefaultTheme.colors : DarkTheme.colors),
            background: isLight ? '#F4F7FB' : '#101729',
            card: isLight ? '#FFFFFF' : '#17243B',
            text: isLight ? '#142033' : '#FFFDF5',
            border: isLight ? 'rgba(20,32,51,.12)' : 'rgba(255,255,255,.08)',
          },
        }}
      >
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            gestureEnabled: false,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Classic" component={ClassicScreen} />
          <Stack.Screen name="Duel" component={DuelScreen} />
          <Stack.Screen name="League" component={LeagueScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GameProvider>
  );
}

function AndroidBackHandler() {
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!navigationRef.isReady()) return false;
        const route = navigationRef.getCurrentRoute();
        if (route?.name !== 'Home' && navigationRef.canGoBack()) {
          navigationRef.goBack();
          return true;
        }
        if (route?.name === 'Home') {
          Alert.alert('Oyundan çık', 'Oyundan çıkmak istiyor musun?', [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Çıkış',
              style: 'destructive',
              onPress: () => BackHandler.exitApp(),
            },
          ]);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, []);
  return null;
}

function PresenceTracker() {
  const { session } = useAuth();
  const displayName =
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split('@')[0] ||
    'Oyuncu';

  useEffect(() => {
    let active = true;
    let playerId: string | null = null;
    let requestInFlight = false;
    let lastInvitationId: string | null = null;
    let presenceActive = true;

    const touchPresence = async () => {
      if (!active || requestInFlight || AppState.currentState !== 'active')
        return;
      requestInFlight = true;
      try {
        playerId ??= await getDuelPlayerId(session?.user?.id);
        if (!active || !presenceActive) return;
        await ensureLeaguePlayer(playerId, displayName);
        if (!active || !presenceActive) return;
        await touchLeaguePlayer(playerId, displayName);
      } catch {
        // Presence is best-effort; network errors must not block the app.
      } finally {
        requestInFlight = false;
      }
    };

    const checkInvitations = async (notify = true) => {
      if (!active || !playerId || AppState.currentState !== 'active') return;
      try {
        const invitation = await fetchIncomingDuelInvitation(playerId);
        if (invitation && invitation.id !== lastInvitationId) {
          lastInvitationId = invitation.id;
          if (notify) await showDuelInvitationNotification(invitation.id);
        }
      } catch {
        // Invitation polling is best-effort.
      }
    };

    const initialize = async () => {
      await touchPresence();
      // Uygulama açılırken daha önce oluşturulmuş daveti yeni sanıp
      // kullanıcıya tekrar notification göstermeyelim. Duel ekranı bu daveti
      // yine de gösterir; yalnızca yeni gelen davetler bildirim üretir.
      await checkInvitations(false);
    };
    initialize();
    const interval = setInterval(() => {
      touchPresence();
      checkInvitations();
    }, 15_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        presenceActive = true;
        touchPresence();
        checkInvitations();
      } else {
        presenceActive = false;
        if (playerId) {
          markLeaguePlayerOffline(playerId).catch(() => undefined);
        }
      }
    });
    const notificationSubscription = subscribeToNotificationPress(roomId => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Duel', roomId ? { invitationId: roomId } : undefined);
      }
    });

    return () => {
      active = false;
      presenceActive = false;
      clearInterval(interval);
      subscription.remove();
      notificationSubscription();
      if (playerId) {
        markLeaguePlayerOffline(playerId).catch(() => undefined);
      }
    };
  }, [displayName, session?.user?.id]);

  return null;
}
