import 'react-native-gesture-handler';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
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
export type RootStackParamList = {
  Home: undefined;
  Classic: undefined;
  Duel: undefined;
  League: undefined;
  Profile: undefined;
  Auth: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
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
  if (isLoading) return null;
  return (
    <GameProvider>
      <NavigationContainer
        theme={{
          ...DarkTheme,
          colors: { ...DarkTheme.colors, background: C.bg },
        }}
      >
        <StatusBar barStyle="light-content" />
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
