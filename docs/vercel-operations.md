# Vercel operations

BuddySports is a public marketing and inquiry site. Keep Firebase athlete data and
mobile entitlement provisioning outside this project.

Use the [shared platform guide](https://github.com/jakedibattista/puck-buddy/blob/main/docs/vercel-platform.md)
for both websites and the account review. The [October 20 release receipt](2026-10-20-vercel-release.md)
records tested commits, deployment and live verification separately from this contract.

## Partner receipt and notification contract

`POST /api/partner-inquiries` accepts same-origin JSON with a version-4 UUID,
`api`, `custom` or `partner` tier, name, email, organization and message. Required
fields and lengths are checked on both sides. The server caps the entire body at
16 KiB. A Vercel Firewall rule limits this exact POST path to five requests per IP
per 60 seconds. It does not rate-limit browsing or the authenticated retry route.

The private store `buddy-sports-partner-inquiries` in `iad1` is connected only to
production. `BLOB_STORE_ID` and Vercel OIDC provide short-lived server credentials;
no private-store credential or record URL is returned to the browser. Production
uses `partner-inquiries/receipts/{uuid}.json`, `pending/{uuid}.json` and
`notified/{uuid}.json`. Use the Vercel storage console to inspect receipts.
There is no public receipt-list or receipt-read API.

A successful response means a receipt and notification outbox item were stored.
It does not mean inbox delivery. Notification starts after the response and uses
the existing owner-approved SMTP sender with fixed recipient `jake@buddyllc.app`.
The validated inquiry email is Reply-To; the message is plain text. The server
requires TLS. Credentials are sensitive production-only Vercel variables:
`PARTNER_SMTP_HOST`, `PARTNER_SMTP_PORT`, `PARTNER_SMTP_USER` and
`PARTNER_SMTP_PASSWORD`. Replacing the sender requires owner authorization.

An hourly Vercel cron (`17 * * * *`, UTC) calls `/api/partner-inquiries/retry`.
Its bearer credential must exactly match the sensitive production `CRON_SECRET`.
Each run retries at most ten pending records. A private
`partner-inquiries/retry-cursor.json` checkpoint advances the scan before email
delivery, so failures on one page do not keep later receipts waiting. The scan
wraps after the last page and restarts if a stored cursor cannot be listed.
Successful SMTP acceptance is recorded before removing the outbox item. The queue is at-least-once: if SMTP
accepts mail but writing its marker fails, a later retry can send a duplicate.
Use the UUID reference to identify duplicates. Failed attempts retain the receipt
and outbox; logs contain only an operational label and UUID, never contact fields,
messages or mail-provider errors. SMTP acceptance does not prove final inbox placement.

No production credentials or production store are connected to preview. Local
browser tests mock the receipt endpoint and never send mail. Missing storage
configuration returns 503 and leaves the form details available for retry or email.

## Domains and search

`buddysports.app` is the primary origin. `buddyllc.app` has a Vercel-managed 308
redirect, which preserves paths and queries, including action-link parameters.
Public page layouts declare their own canonical routes. Artwork export routes
remain reachable but use `noindex,nofollow` and do not inherit the home canonical.

In Web Analytics, compare `chatgpt_referral_visit` with
`chatgpt_store_badge_click` and `chatgpt_partner_lead_received`. The site uses
the `utm_source=chatgpt.com` tag or the exact `chatgpt.com` referrer and keeps a
flag in the current tab so it survives navigation. The original conversion events
continue to report sitewide totals. Store clicks measure intent to download.
Lead events measure successful receipt storage. These events add no raw referral
URL or inquiry details to their custom properties.

For organic social links, use `https://buddysports.app/puckbuddy?utm_source=instagram`
for downloads or `https://buddysports.app/partner?utm_source=instagram#contact`
for inquiries. Substitute `facebook`, `tiktok` or `youtube` for the matching
channel. Instagram’s automatic `utm_source=ig` also reports as `instagram`.
A recognized tag takes precedence over a stored source. The website
reports `social_referral_visit`, `social_store_badge_click` and
`social_partner_lead_received` in standard Web Analytics. Drill into `source`
for a channel breakdown. Store clicks also carry `store`. Arrival events count
a recognized source entering or replacing the source in the current tab, and
are not unique visitors. The partner event requires a successful receipt.

## Release checks

The Vercel project requires the GitHub Actions `quality` check on the deployed
commit before production alias assignment. The workflow includes repository
conventions, lint, type checking, coverage budgets, asset auditing, build and
local browser behavior. A ready build is not proof of promotion. Do not force
promotion past a failed, missing, queued or timed-out check. Check the deployment
commit and production alias after promotion; manual administrator overrides remain
possible in Vercel.

## GitHub Quality scope

Verified Markdown-only changes run repository conventions and the CI scope tests.
Runtime, asset and configuration changes run the existing hosted build, coverage
and browser checks. Vercel continues to use the same GitHub check.
