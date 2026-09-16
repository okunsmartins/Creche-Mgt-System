# Mobile App Plan (Skool Bido)

_Last updated: 2026-09-12 · Status: **planned, not started**_

Give parents a downloadable **Skool Bido** app on the **App Store** and **Google Play**, on top of
the existing Next.js + Supabase web platform — without rebuilding the product.

## Guiding decision: web-first

The mobile app is a **distribution channel on the same backend**, not a rewrite. Marketing the web
app proceeds on schedule (week of **2026-09-15**); the app is built in parallel and ships weeks
later. **Nothing about the web launch waits on the app.** Parents can already use the responsive site
in a mobile browser today.

## Recommended path (in order)

1. **PWA now (~2–4 days)** — web app manifest + service worker + install prompt so parents can "Add
   to Home Screen" on iOS/Android immediately. Bridges the gap before the stores.
2. **Capacitor wrapper (~3–5 weeks total)** — wrap the **existing** web front-end in a native shell
   (a WebView) to produce real App Store + Google Play apps. Reuses ~95% of the current code: one
   codebase, one backend (Supabase + Next.js API routes + Stripe/Revolut).
3. **Do not** attempt a React Native rewrite now — 3–4+ months for little near-term gain while a
   working web app already exists. Revisit only if native UX demands it later.

## How the mobile app and web app interact (Capacitor model)

One codebase, one backend, two delivery surfaces:

```
   [ Web browser ]              [ iOS / Android app ]
   skoolbido.com                native shell (Capacitor)
        │                          │  (WebView runs the same UI)
        └──────────┬───────────────┘
                   ▼
     Same backend: Next.js API routes + Supabase + Stripe/Revolut
```

- **UI** — the app renders the *same* React front-end; screens are not rewritten.
- **Auth / data** — the app uses the same Supabase auth and the same APIs. A parent signs in with
  their account, which is already tied to a school, so **the app resolves the school from the parent's
  profile** — no subdomains inside the app (cleaner than the web's per-school subdomain routing).
- **One app for all schools** — parents find/select their school on first use. **Never** build
  per-school apps (unmaintainable).
- **Payments** — Stripe/Revolut hosted checkout opens in an in-app browser and deep-links back on
  success. School fees/activities are **real-world services**, so **Apple does not require its 30%
  in-app-purchase system** (IAP applies to digital content only); external Stripe/Revolut payment is
  allowed.
- **Content strategy** — bundle the app shell and call the live APIs (feels native, some offline
  resilience, avoids the "it's just a website" rejection), rather than loading the remote URL raw.

## Step-by-step

### Phase 0 — PWA (~2–4 days)

1. Add a web app manifest (name, icons, theme colour, `display: standalone`).
2. Add a service worker (offline shell + caching).
3. Add an "Install app" prompt.
   → Parents can "Add to Home Screen" immediately.

### Phase 1 — Capacitor foundation (~1 week)

4. Add Capacitor; generate the iOS + Android projects.
5. Bundle the app shell; point API calls at the live backend.
6. App icons, splash screens, and a deep-link scheme (so payment redirects return into the app).
7. Run on simulator/emulator, then a real device.

### Phase 2 — Native features (~1 week)

8. **Push notifications** — APNs (iOS) + FCM (Android) + backend to store device tokens and send on
   events (new message, payment due, report ready). _This is the main net-new backend work._
9. Camera / file picker for homework uploads.
10. Biometric / secure token storage for fast login.
11. Handle Stripe/Revolut checkout in the in-app browser with return deep-links.

### Phase 3 — Store prep & submission (~1–2 weeks, mostly waiting)

12. Enroll: **Apple Developer Program ($99/yr)** + **Google Play ($25 one-time)**.
13. Store listings: screenshots, descriptions, **privacy policy**, data-safety / privacy-nutrition
    forms, and **in-app account deletion** (Apple requires it when sign-up exists).
14. Build signing; upload to **TestFlight** (iOS) / **internal testing** (Android).
15. Submit for review — Google: hours–2 days; Apple: 1–3 days and can bounce.

**Total: ~3–5 weeks** of focused effort to be live in both stores. The long pole is Apple review +
account setup, not development. The PWA covers the gap meanwhile.

## Gotchas to plan for

- **Apple Guideline 4.2 ("minimum functionality")** rejects bare web wrappers — the Phase-2 native
  features (push, camera, biometric, offline) are what make it pass. Do not skip them.
- **In-app account deletion** is mandatory for Apple if users can register.
- **Push notifications** are the one genuine piece of new backend work; everything else reuses what
  already exists.

## Costs

| Item | Cost |
| --- | --- |
| Apple Developer Program | $99 / year |
| Google Play Developer | $25 one-time |
| Development | ~3–5 weeks focused effort |

## Related

- Per-school subdomain routing (web): see the domain-setup notes.
- Payments architecture (Stripe Connect direct charges, Revolut) — see
  [implementation-status.md](implementation-status.md).
