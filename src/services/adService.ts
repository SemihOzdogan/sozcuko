import {
  AdEventType,
  AdsConsent,
  InterstitialAd,
  MobileAds,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import { trackEvent } from './analyticsService';

// Production reklam birimi hazır olduğunda bu değeri AdMob'daki gerçek
// interstitial unit ID ile doldur. Boş bırakılırsa release build reklam
// istemez; böylece test reklamı yanlışlıkla canlıya çıkmaz.
const IOS_PRODUCTION_INTERSTITIAL_AD_UNIT_ID =
  'ca-app-pub-4537184745410870/8710846953';
// AdMob'da ödüllü reklam birimini oluşturduktan sonra bu değeri doldur.
const IOS_PRODUCTION_REWARDED_AD_UNIT_ID =
  'ca-app-pub-4537184745410870/7739391112';
const PRODUCTION_INTERSTITIAL_AD_UNIT_ID =
  Platform.OS === 'ios' ? IOS_PRODUCTION_INTERSTITIAL_AD_UNIT_ID : '';
const PRODUCTION_REWARDED_AD_UNIT_ID =
  Platform.OS === 'ios' ? IOS_PRODUCTION_REWARDED_AD_UNIT_ID : '';
const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : PRODUCTION_INTERSTITIAL_AD_UNIT_ID;
const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : PRODUCTION_REWARDED_AD_UNIT_ID;
const CHECKPOINT_INTERVAL = 5;
const adsConfigured = INTERSTITIAL_AD_UNIT_ID.length > 0;
const rewardedAdsConfigured = REWARDED_AD_UNIT_ID.length > 0;

const interstitial = adsConfigured
  ? InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    })
  : null;
const rewarded = rewardedAdsConfigured
  ? RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    })
  : null;

let loaded = false;
let loading = false;
let listenersAttached = false;
let adsCanRequest = false;
let initializationPromise: Promise<boolean> | null = null;
const loadWaiters = new Set<(isLoaded: boolean) => void>();
const rewardedLoadWaiters = new Set<(isLoaded: boolean) => void>();
let rewardedLoaded = false;
let rewardedLoading = false;
let rewardedListenersAttached = false;
let rewardEarned = false;
let pendingRewardResolver: ((earned: boolean) => void) | null = null;
let rewardedShowInFlight = false;

const getAdErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return 'unknown';
};

const resolveLoadWaiters = (isLoaded: boolean) => {
  loadWaiters.forEach(resolve => resolve(isLoaded));
  loadWaiters.clear();
};

const resolveRewardedLoadWaiters = (isLoaded: boolean) => {
  rewardedLoadWaiters.forEach(resolve => resolve(isLoaded));
  rewardedLoadWaiters.clear();
};

const preload = () => {
  if (interstitial && adsCanRequest && !loading && !loaded) {
    loading = true;
    try {
      interstitial.load();
    } catch {
      loading = false;
    }
  }
};

const attachListeners = () => {
  if (!interstitial || listenersAttached) return;
  listenersAttached = true;

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
    loading = false;
    trackEvent('ad_loaded', { format: 'interstitial' });
    resolveLoadWaiters(true);
  });
  interstitial.addAdEventListener(AdEventType.ERROR, error => {
    loaded = false;
    loading = false;
    console.warn('[ads] interstitial load failed', error);
    trackEvent('ad_failed', {
      format: 'interstitial',
      error: getAdErrorMessage(error),
    });
    resolveLoadWaiters(false);
  });
  interstitial.addAdEventListener(AdEventType.OPENED, () => {
    trackEvent('ad_opened', { format: 'interstitial' });
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    loaded = false;
    loading = false;
    trackEvent('ad_closed', { format: 'interstitial' });
    preload();
  });
};

const preloadRewarded = () => {
  if (rewarded && adsCanRequest && !rewardedLoading && !rewardedLoaded) {
    rewardedLoading = true;
    try {
      rewarded.load();
    } catch {
      rewardedLoading = false;
    }
  }
};

const attachRewardedListeners = () => {
  if (!rewarded || rewardedListenersAttached) return;
  rewardedListenersAttached = true;

  rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewardedLoaded = true;
    rewardedLoading = false;
    trackEvent('ad_loaded', { format: 'rewarded' });
    resolveRewardedLoadWaiters(true);
  });
  rewarded.addAdEventListener(AdEventType.ERROR, error => {
    rewardedLoaded = false;
    rewardedLoading = false;
    console.warn('[ads] rewarded load failed', error);
    trackEvent('ad_failed', {
      format: 'rewarded',
      error: getAdErrorMessage(error),
    });
    resolveRewardedLoadWaiters(false);
    pendingRewardResolver?.(false);
    pendingRewardResolver = null;
  });
  rewarded.addAdEventListener(AdEventType.OPENED, () => {
    trackEvent('ad_opened', { format: 'rewarded' });
  });
  rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
    rewardEarned = true;
    trackEvent('ad_reward_earned', { format: 'rewarded', placement: 'clue' });
  });
  rewarded.addAdEventListener(AdEventType.CLOSED, () => {
    rewardedLoaded = false;
    rewardedLoading = false;
    pendingRewardResolver?.(rewardEarned);
    trackEvent('ad_closed', { format: 'rewarded', rewarded: rewardEarned });
    pendingRewardResolver = null;
    rewardEarned = false;
    preloadRewarded();
  });
};

const waitForLoadedAd = async (timeoutMs = 4000) => {
  if (loaded) return true;
  preload();
  return new Promise<boolean>(resolve => {
    let waiter: ((isLoaded: boolean) => void) | null = null;
    const timeout = setTimeout(() => {
      if (waiter) loadWaiters.delete(waiter);
      resolve(false);
    }, timeoutMs);
    waiter = isLoaded => {
      clearTimeout(timeout);
      resolve(isLoaded);
    };
    loadWaiters.add(waiter);
    preload();
  });
};

export const initializeAds = async () => {
  if (!adsConfigured) return false;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      // Consent must be resolved before the SDK is initialized or an ad is
      // requested. The UMP form is shown only when Google determines it is
      // required for the current user/region.
      try {
        const consentInfo = await AdsConsent.gatherConsent();
        if (!consentInfo.canRequestAds) {
          // Consent may become available on a later attempt; do not cache this
          // failed attempt forever.
          initializationPromise = null;
          return false;
        }
      } catch (error) {
        // UMP errors must not prevent non-personalized ads from loading. The
        // SDK retains the previous consent state and can still serve ads.
        console.warn('[ads] consent gathering failed; continuing', error);
      }

      attachListeners();
      attachRewardedListeners();
      await MobileAds().initialize();
      adsCanRequest = true;
      preload();
      preloadRewarded();
      return true;
    } catch (error) {
      console.warn('[ads] initialization failed', error);
      // Allow a later screen transition/app foreground to retry initialization.
      initializationPromise = null;
      return false;
    }
  })();

  return initializationPromise;
};

const waitForRewardedLoaded = async (timeoutMs = 10000) => {
  if (rewardedLoaded) return true;
  return new Promise<boolean>(resolve => {
    let waiter: ((isLoaded: boolean) => void) | null = null;
    const timeout = setTimeout(() => {
      if (waiter) rewardedLoadWaiters.delete(waiter);
      resolve(false);
    }, timeoutMs);
    waiter = isLoaded => {
      clearTimeout(timeout);
      resolve(isLoaded);
    };
    rewardedLoadWaiters.add(waiter);
    preloadRewarded();
  });
};

export const showRewardedClueAd = async () => {
  if (!rewarded || !rewardedAdsConfigured) return false;
  if (rewardedShowInFlight) return false;
  rewardedShowInFlight = true;
  trackEvent('ad_requested', { format: 'rewarded', placement: 'clue' });
  try {
    const ready = await initializeAds();
    if (!ready || !(await waitForRewardedLoaded())) return false;

    rewardEarned = false;
    return await new Promise<boolean>(resolve => {
      pendingRewardResolver = resolve;
      rewarded.show().catch(() => {
        pendingRewardResolver = null;
        rewardedLoaded = false;
        rewardedLoading = false;
        preloadRewarded();
        resolve(false);
      });
    });
  } finally {
    rewardedShowInFlight = false;
  }
};

export const shouldShowCheckpointAd = (completedLevel: number) =>
  (completedLevel + 1) % CHECKPOINT_INTERVAL === 0;

/**
 * Reklam hazır değilse kullanıcıyı bekletmez; bölüm akışı normal devam eder.
 */
export const showCheckpointAd = async (completedLevel: number) => {
  if (!shouldShowCheckpointAd(completedLevel)) return false;
  const ready = await initializeAds();
  if (!ready || !interstitial) {
    return false;
  }
  if (!(await waitForLoadedAd())) return false;

  trackEvent('ad_requested', {
    format: 'interstitial',
    placement: 'level_checkpoint',
    level: completedLevel,
  });

  loaded = false;
  loading = false;
  try {
    await interstitial.show();
    return true;
  } catch {
    loaded = false;
    loading = false;
    preload();
    return false;
  }
};
