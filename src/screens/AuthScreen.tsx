import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  appleAuth,
  AppleButton,
} from '@invertase/react-native-apple-authentication';
import { useAuth } from '../authState';
import {
  signInWithAppleIdToken,
  signInWithGoogleIdToken,
  signInWithPassword,
  signUpWithPassword,
} from '../services/authService';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config';
import { BackHeader, C } from '../ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

export function AuthScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Auth'>) {
  const { setSession } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState<
    'email' | 'google' | 'apple' | null
  >(null);
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
    });
  }, []);
  const handleGoogleLogin = async () => {
    try {
      setLoadingAction('google');
      if (Platform.OS === 'android')
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      await GoogleSignin.signOut().catch(() => undefined);
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') return;
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens.idToken?.trim();
      if (!idToken)
        throw new Error(
          'Google ID token alınamadı. Google iOS client ayarını kontrol et.',
        );
      const session = await signInWithGoogleIdToken(
        idToken,
        tokens.accessToken,
      );
      setSession(session);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Google ile giriş başlatılamadı.',
      );
    } finally {
      setLoadingAction(null);
    }
  };
  const handleAppleLogin = async () => {
    try {
      setLoadingAction('apple');
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      if (!response.identityToken)
        throw new Error('Apple identity token alınamadı.');
      const session = await signInWithAppleIdToken(
        response.identityToken,
        response.nonce,
      );
      setSession(session);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Apple ile giriş başlatılamadı.',
      );
    } finally {
      setLoadingAction(null);
    }
  };
  const submit = async () => {
    setError('');
    if (!email.trim() || password.length < 6 || (registering && !name.trim())) {
      setError(
        registering
          ? 'Adını, geçerli e-postanı ve en az 6 karakterli şifreni gir.'
          : 'Geçerli e-posta ve en az 6 karakterli şifre gir.',
      );
      return;
    }
    try {
      setLoadingAction('email');
      const session = registering
        ? await signUpWithPassword(email.trim(), password, name.trim())
        : await signInWithPassword(email.trim(), password);
      if (session?.access_token) {
        setSession(session);
      } else
        setError(
          'Kayıt başarılı. E-postanı doğruladıktan sonra giriş yapabilirsin.',
        );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bir hata oluştu.');
    } finally {
      setLoadingAction(null);
    }
  };
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BackHeader
        title="Hesabın"
        tag="HESAP"
        color={C.gold}
        onBack={navigation.goBack}
      />
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.logo}>
          <Text style={s.logoText}>Aa</Text>
        </View>
        <Text style={s.brand}>SÖZCÜKO</Text>
        <Text style={s.title}>
          {registering ? 'Kelime dünyasına katıl' : 'Tekrar hoş geldin'}
        </Text>
        <Text style={s.copy}>
          {registering
            ? 'İlerlemeni kaydet, her cihazda kaldığın yerden devam et.'
            : 'Serin ve başarıların seni bekliyor.'}
        </Text>
        {registering && (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Adın"
            placeholderTextColor={C.muted}
            style={s.input}
            autoCapitalize="words"
          />
        )}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor={C.muted}
          style={s.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor={C.muted}
          style={s.input}
          secureTextEntry
        />
        {!!error && <Text style={s.error}>{error}</Text>}
        <Pressable
          onPress={submit}
          disabled={loadingAction !== null}
          style={({ pressed }) => [s.primary, pressed && s.pressed]}
        >
          {loadingAction === 'email' ? (
            <ActivityIndicator color={C.ink} />
          ) : (
            <Text style={s.primaryText}>
              {registering ? 'KAYIT OL' : 'GİRİŞ YAP'}
            </Text>
          )}
        </Pressable>
        <View style={s.or}>
          <View style={s.line} />
          <Text style={s.orText}>veya</Text>
          <View style={s.line} />
        </View>
        <View style={s.socialRow}>
          <Pressable
            onPress={handleGoogleLogin}
            disabled={loadingAction !== null}
            style={({ pressed }) => [s.googleButton, pressed && s.pressed]}
          >
            <GoogleMark />
            <Text style={s.googleText}>Google ile devam et</Text>
          </Pressable>
          {Platform.OS === 'ios' ? (
            <AppleButton
              buttonType={AppleButton.Type.CONTINUE}
              buttonStyle={AppleButton.Style.BLACK}
              cornerRadius={17}
              style={s.appleButton}
              testID="continue-with-apple"
              onPress={handleAppleLogin}
            />
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            setRegistering(value => !value);
            setError('');
          }}
        >
          <Text style={s.switch}>
            {registering
              ? 'Zaten hesabın var mı? Giriş yap'
              : 'Hesabın yok mu? Kayıt ol'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleMark() {
  return (
    <Svg
      viewBox="0 0 120 120"
      width={23}
      height={23}
      accessibilityLabel="Google logosu"
    >
      <Path
        d="M117.6 61.3636c0-4.2545-.3818-8.3454-1.0909-12.2727H60v23.2091h32.2909c-1.3909 7.5-5.6182 13.8545-11.9727 18.1091v15.0545h19.3909C111.0545 95.0182 117.6 79.6364 117.6 61.3636Z"
        fill="#4285F4"
      />
      <Path
        d="M60 120c16.2 0 29.7818-5.3727 39.7091-14.5364L80.3182 90.4091c-5.3728 3.6-12.2455 5.7273-20.3182 5.7273-15.6273 0-28.8545-10.5546-33.5727-24.7364H6.3818v15.5454C16.2545 106.5545 36.5455 120 60 120Z"
        fill="#34A853"
      />
      <Path
        d="M26.4273 71.4C25.2273 67.8 24.5455 63.9545 24.5455 60s.6818-7.8 1.8818-11.4V33.0545H6.3818C2.3182 41.1545 0 50.3182 0 60s2.3182 18.8455 6.3818 26.9455L26.4273 71.4Z"
        fill="#FBBC05"
      />
      <Path
        d="M60 23.8636c8.8091 0 16.7182 3.0273 22.9364 8.9728l17.2091-17.2091C89.7545 5.9455 76.1727 0 60 0 36.5455 0 16.2545 13.4455 6.3818 33.0545L26.4273 48.6C31.1455 34.4182 44.3727 23.8636 60 23.8636Z"
        fill="#EA4335"
      />
    </Svg>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 23,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  logoText: { color: C.ink, fontSize: 28, fontWeight: '900' },
  brand: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  title: {
    color: C.text,
    fontSize: 29,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 28,
  },
  copy: {
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 9,
    marginBottom: 26,
  },
  input: {
    height: 54,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 17,
    color: C.text,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  primary: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryText: { color: C.ink, fontWeight: '900', fontSize: 13 },
  pressed: { opacity: 0.78 },
  error: { color: '#FF9B83', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  or: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 22,
  },
  line: { height: 1, backgroundColor: 'rgba(255,255,255,.12)', flex: 1 },
  orText: { color: C.muted, fontSize: 12 },
  gmailMark: {
    width: 24,
    height: 22,
    position: 'relative',
    justifyContent: 'center',
  },
  gmailM: {
    color: '#EA4335',
    fontSize: 21,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: -2,
  },
  gmailBlue: {
    position: 'absolute',
    left: 2,
    bottom: 0,
    width: 5,
    height: 3,
    backgroundColor: '#4285F4',
  },
  gmailYellow: {
    position: 'absolute',
    left: 9,
    bottom: 0,
    width: 5,
    height: 3,
    backgroundColor: '#FBBC05',
  },
  gmailGreen: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    width: 5,
    height: 3,
    backgroundColor: '#34A853',
  },
  socialRow: { gap: 11, marginTop: 4 },
  googleButton: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  googleText: { color: '#202124', fontSize: 14, fontWeight: '800' },
  appleButton: {
    width: '100%',
    height: 54,
    borderRadius: 17,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  appleMark: { color: '#FFFFFF', fontSize: 23, lineHeight: 24 },
  appleText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  switch: {
    color: C.mint,
    textAlign: 'center',
    fontWeight: '800',
    marginTop: 24,
    fontSize: 13,
  },
});
