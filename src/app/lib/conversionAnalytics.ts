// Records conversion telemetry without letting an SDK failure interrupt the user's action.
// Keeps a tab-scoped ChatGPT referral marker for store clicks and confirmed partner inquiries.
import { track } from '@vercel/analytics';

const chatgptReferralKey = 'buddy-chatgpt-referral';
let referredByChatGPT = false;
const chatgptConversionEvents: Record<string, string> = {
  store_badge_click: 'chatgpt_store_badge_click',
  partner_lead_received: 'chatgpt_partner_lead_received',
};

export function captureChatGPTReferral(reportVisit = false): boolean {
  if (typeof window === 'undefined') return false;

  const utmSource = new URLSearchParams(window.location.search).get('utm_source');
  const referrerHost = document.referrer ? new URL(document.referrer).hostname : '';
  const fromChatGPT = utmSource === 'chatgpt.com' || referrerHost === 'chatgpt.com';
  try {
    referredByChatGPT ||= window.sessionStorage.getItem(chatgptReferralKey) === '1';
    if (fromChatGPT) window.sessionStorage.setItem(chatgptReferralKey, '1');
  } catch {
    // The in-memory flag still works if browser storage is unavailable.
  }

  if (reportVisit && fromChatGPT && !referredByChatGPT) {
    trackConversion('chatgpt_referral_visit');
  }
  referredByChatGPT ||= fromChatGPT;
  return referredByChatGPT;
}

export function trackConversion(...args: Parameters<typeof track>): void {
  try {
    track(...args);
    const [name, properties, options] = args;
    if (Object.hasOwn(chatgptConversionEvents, name) && captureChatGPTReferral()) {
      track(chatgptConversionEvents[name], properties, options);
    }
  } catch {
    // Downloads, navigation and email draft handoff must still proceed.
  }
}
