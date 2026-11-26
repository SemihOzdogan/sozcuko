import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Linking } from 'react-native';
import {
  loadSession,
  sessionFromCallback,
  deleteAccount as removeAccount,
  signOut as clearSession,
  type AuthSession,
} from './services/authService';

type AuthState = {
  session: AuthSession | null;
  isLoading: boolean;
  setSession: (session: AuthSession | null) => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadSession()
      .then(value => {
        if (!active) return;
        setSession(value);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    const handleUrl = (event: { url: string }) => {
      sessionFromCallback(event.url)
        .then(value => value && setSession(value))
        .catch(() => undefined);
    };
    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL()
      .then(url => url && handleUrl({ url }))
      .catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const value = useMemo(
    () => ({
      session,
      isLoading,
      setSession,
      logout: async () => {
        await clearSession();
        setSession(null);
      },
      deleteAccount: async () => {
        if (!session) throw new Error('Oturum açmış kullanıcı bulunamadı.');
        await removeAccount(session);
        setSession(null);
      },
    }),
    [session, isLoading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider eksik');
  return value;
}
