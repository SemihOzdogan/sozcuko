export type AnalyticsEvent =
  | 'level_started'
  | 'word_submitted'
  | 'word_solved'
  | 'word_invalid'
  | 'hint_used'
  | 'level_completed'
  | 'duel_started'
  | 'duel_word_submitted'
  | 'duel_finished'
  | 'league_viewed'
  | 'ad_requested'
  | 'ad_loaded'
  | 'ad_failed'
  | 'ad_opened'
  | 'ad_closed'
  | 'ad_reward_earned';

type AnalyticsProperties = Record<string, boolean | number | string | null>;

// Tek giriş noktası: gerçek analitik sağlayıcı daha sonra burada bağlanabilir.
export const trackEvent = (
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
) => {
  if (__DEV__) console.log(`[analytics] ${event}`, properties);
};
