// Records conversion telemetry without letting an SDK failure interrupt the user's action.
// Carries an allowlisted referral source within the current tab for conversion reporting.
import { track } from '@vercel/analytics';

const referralKey = 'buddy-referral-source';
const legacyChatGPTKey = 'buddy-chatgpt-referral';
const socialSources = ['instagram', 'facebook', 'tiktok', 'youtube'] as const;
type ReferralSource = 'chatgpt' | (typeof socialSources)[number];
let tabSource: ReferralSource | undefined;

function readSource(value: string | null): ReferralSource | undefined {
  if (value === 'chatgpt') return value;
  return socialSources.find(source => source === value);
}

export function captureReferral(): ReferralSource | undefined {
  if (typeof window === 'undefined') return undefined;

  const utm = new URLSearchParams(window.location.search).get('utm_source');
  const referrerHost = document.referrer ? new URL(document.referrer).hostname : '';
  const taggedSource = readSource(utm === 'chatgpt.com' ? 'chatgpt' : utm);
  const incoming = taggedSource ?? (referrerHost === 'chatgpt.com' ? 'chatgpt' : undefined);

  try {
    tabSource ??= readSource(window.sessionStorage.getItem(referralKey));
    if (!tabSource && window.sessionStorage.getItem(legacyChatGPTKey) === '1') tabSource = 'chatgpt';
  } catch {
    // The in-memory source works when browser storage is unavailable.
  }

  if (!incoming || incoming === tabSource) return tabSource;
  tabSource = incoming;
  try {
    window.sessionStorage.setItem(referralKey, incoming);
  } catch {
    // The current page retains the source in memory.
  }
  if (incoming === 'chatgpt') trackConversion('chatgpt_referral_visit');
  else trackConversion('social_referral_visit', { source: incoming });
  return tabSource;
}

export function trackConversion(...args: Parameters<typeof track>): void {
  try {
    track(...args);
    const [name, properties, options] = args;
    if (name !== 'store_badge_click' && name !== 'partner_lead_received') return;

    const source = captureReferral();
    if (source === 'chatgpt') {
      track(`chatgpt_${name}`, properties, options);
    } else if (source) {
      // Vercel Pro allows two properties. Preserve the store choice for download reporting.
      const socialProperties = name === 'store_badge_click' ? { source, store: properties?.store } : { source };
      track(`social_${name}`, socialProperties, options);
    }
  } catch {
    // Downloads, navigation and email draft handoff must still proceed.
  }
}
