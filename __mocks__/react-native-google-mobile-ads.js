const createMockAd = (loadedEvent, earnedEvent) => {
  const listeners = new Map();
  return {
    addAdEventListener: jest.fn((event, callback) => {
      listeners.set(event, callback);
      return jest.fn(() => listeners.delete(event));
    }),
    load: jest.fn(() => listeners.get(loadedEvent)?.()),
    show: jest.fn(async () => {
      listeners.get('opened')?.();
      if (earnedEvent)
        listeners.get(earnedEvent)?.({ amount: 1, type: 'test' });
      listeners.get('closed')?.();
    }),
  };
};
const interstitial = createMockAd('loaded');
const rewarded = createMockAd('rewarded_loaded', 'rewarded_earned_reward');

module.exports = {
  AdEventType: {
    LOADED: 'loaded',
    ERROR: 'error',
    OPENED: 'opened',
    CLOSED: 'closed',
  },
  RewardedAdEventType: {
    LOADED: 'rewarded_loaded',
    EARNED_REWARD: 'rewarded_earned_reward',
  },
  AdsConsent: {
    gatherConsent: jest.fn(async () => ({ canRequestAds: true })),
  },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => interstitial),
  },
  RewardedAd: {
    createForAdRequest: jest.fn(() => rewarded),
  },
  MobileAds: jest.fn(() => ({
    initialize: jest.fn(async () => undefined),
  })),
  TestIds: {
    INTERSTITIAL: 'test-interstitial',
    REWARDED: 'test-rewarded',
  },
};
