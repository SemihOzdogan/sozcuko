import {
  AdEventType,
  InterstitialAd,
  MobileAds,
  TestIds,
} from 'react-native-google-mobile-ads';

// Test reklamı kullanıyoruz. AdMob'daki gerçek reklam birimi hazır olduğunda
// yalnızca bu sabit production reklam kimliğiyle değiştirilmelidir.
const INTERSTITIAL_AD_UNIT_ID = TestIds.INTERSTITIAL;
const CHECKPOINT_INTERVAL = 5;

const interstitial = InterstitialAd.createForAdRequest(
  INTERSTITIAL_AD_UNIT_ID,
  { requestNonPersonalizedAdsOnly: true },
);

let initialized = false;
let loaded = false;
let loading = false;
let listenersAttached = false;

const preload = () => {
  if (!loading && !loaded) {
    loading = true;
    interstitial.load();
  }
};

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
    loading = false;
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    loaded = false;
    loading = false;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    loaded = false;
    loading = false;
    preload();
  });
};

export const initializeAds = async () => {
  if (initialized) return;
  initialized = true;
  attachListeners();
  await MobileAds().initialize();
  preload();
};

export const shouldShowCheckpointAd = (completedLevel: number) =>
  (completedLevel + 1) % CHECKPOINT_INTERVAL === 0;

/**
 * Reklam hazır değilse kullanıcıyı bekletmez; bölüm akışı normal devam eder.
 */
export const showCheckpointAd = async (completedLevel: number) => {
  if (!shouldShowCheckpointAd(completedLevel)) return false;
  await initializeAds();
  if (!loaded) {
    preload();
    return false;
  }

  loaded = false;
  loading = false;
  try {
    await interstitial.show();
    return true;
  } catch {
    preload();
    return false;
  }
};
