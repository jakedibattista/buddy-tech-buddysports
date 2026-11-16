// Checks best-effort telemetry forwarding and synchronous SDK failures without external delivery.
import { afterEach, expect, it, vi } from 'vitest';
import { track } from '@vercel/analytics';
vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));
import { trackConversion } from '../src/app/lib/conversionAnalytics';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

it('preserves the event name, properties and SDK options', () => {
  const properties = { store: 'android', location: 'hero' };
  const options = {};
  trackConversion('store_badge_click', properties, options);
  expect(track).toHaveBeenCalledExactlyOnceWith('store_badge_click', properties, options);
});
it('supports an event without properties', () => {
  trackConversion('fixture_event');
  expect(track).toHaveBeenCalledExactlyOnceWith('fixture_event');
});
it('contains an SDK exception so the caller can continue', () => {
  vi.mocked(track).mockImplementationOnce(() => { throw new Error('SDK unavailable'); });
  expect(() => trackConversion('fixture_event')).not.toThrow();
  expect(track).toHaveBeenCalledOnce();
});

it('attributes both conversions after leaving a tagged landing page', async () => {
  vi.resetModules();
  const analytics = await import('../src/app/lib/conversionAnalytics');
  window.history.replaceState(null, '', '/?utm_source=chatgpt.com');
  expect(analytics.captureChatGPTReferral(true)).toBe(true);
  expect(analytics.captureChatGPTReferral(true)).toBe(true);
  window.history.replaceState(null, '', '/partner');
  vi.resetModules();
  const nextPage = await import('../src/app/lib/conversionAnalytics');
  nextPage.trackConversion('store_badge_click', { store: 'app_store' });
  nextPage.trackConversion('partner_lead_received', { tier: 'partner' });
  expect(vi.mocked(track).mock.calls.map(([name]) => name)).toEqual([
    'chatgpt_referral_visit', 'store_badge_click', 'chatgpt_store_badge_click',
    'partner_lead_received', 'chatgpt_partner_lead_received',
  ]);
  expect(track).toHaveBeenNthCalledWith(3, 'chatgpt_store_badge_click', { store: 'app_store' }, undefined);
  expect(track).toHaveBeenNthCalledWith(5, 'chatgpt_partner_lead_received', { tier: 'partner' }, undefined);
});

it('recognizes the exact ChatGPT referrer with storage disabled', async () => {
  vi.resetModules();
  const analytics = await import('../src/app/lib/conversionAnalytics');
  vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://chatgpt.com/');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  expect(analytics.captureChatGPTReferral()).toBe(true);
});

it('leaves unrelated referrals untagged and handles server rendering', async () => {
  vi.resetModules();
  const analytics = await import('../src/app/lib/conversionAnalytics');
  vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://chatgpt.com.example.test/');
  expect(analytics.captureChatGPTReferral()).toBe(false);
  vi.stubGlobal('window', undefined);
  expect(analytics.captureChatGPTReferral()).toBe(false);
  vi.unstubAllGlobals();
});
