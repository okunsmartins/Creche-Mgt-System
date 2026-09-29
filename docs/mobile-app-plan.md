# Creche Wise — Mobile App Plan (parent app)

*Drafted 2026-09-29. Companion to the web build. This is the plan for the **parent-facing mobile app** that ships to Google Play (and later the App Store), letting a parent interact with the crèche(s) their child attends.*

---

## 1. The one question first: can we build the app and the web app at the same time?

**Short answer: partly — and you should *not* try to build them fully in parallel.**

The mobile app is not a separate product. The smart way to ship it (see §3) is to **wrap the existing web app**, so the app *reuses* the web app's screens, auth, database and business logic. That means:

- **The app depends on the parent-facing web flows being stable.** If we build the native shell around parent screens that are still changing every day, we create constant rework (deep links, layouts, native gestures all break as the web changes).
- **But the *setup* work for mobile has long lead times and can start now in parallel** — it doesn't touch the web code:
  - Google Play Console account + identity verification (Google now requires verified developer identity; this can take days).
  - Apple Developer Program enrolment (if we also want iOS) — review + enrolment can take a week+.
  - Firebase project for push notifications (FCM).
  - App icon, splash screen, store listing copy, screenshots, privacy policy URL.

**Recommendation:**
1. **Now → in parallel:** open the store/developer accounts, set up Firebase, prepare store assets. (No web code touched.)
2. **Finish the web app to a "parent-usable" milestone** (see §2) — this is the critical path.
3. **Then wrap it** into the mobile app (≈2–4 weeks, §4).

So: **do the paperwork/accounts in parallel today, but finish the web parent experience before doing the real app engineering.** Trying to do both engineering efforts at once would roughly double the work and the bugs.

---

## 2. The "parent-usable" web milestone the app depends on

The app is only worth wrapping once a parent can actually *do their business* on the web. That means these web flows must be built and stable first:

- [ ] Parent sign-in (magic-link / password) + link to their child(ren)
- [ ] View child profile, room, key info
- [ ] **See fees / invoices** (net after ECCE/NCS subvention) — *depends on the FEE-06 invoice work in progress*
- [ ] **Pay an invoice** (Stripe/Revolut) + payment history / receipts
- [ ] Notifications feed (messages from the crèche) + attendance visibility
- [ ] Permission slips / consents (already partly built)

Everything above is being built for the web anyway. The app adds **native packaging + push + deep links** on top — not new features.

---

## 3. Architecture decision: how to build it

### Recommended: **Capacitor wrapper of the existing web app** ✅

[Capacitor](https://capacitorjs.com) packages our existing Next.js web app as a native Android/iOS app. It gives us a real, installable Play Store app while **reusing ~100% of the web code, auth, and backend**.

| | **Capacitor (recommended)** | React Native / Expo | PWA only |
|---|---|---|---|
| Reuses existing web app | ✅ Almost entirely | ❌ Rebuild all UI | ✅ |
| On Google Play / App Store | ✅ | ✅ | ❌ (no store presence) |
| Push notifications | ✅ (FCM plugin) | ✅ | ⚠️ limited on iOS |
| Native feel | Good (web UI, native shell) | Best | Web |
| Effort to ship | **Low (2–4 wks)** | High (2–3 months) | Very low |
| Extra codebase to maintain | Thin shell only | Full second app | None |

Given the whole strategy is "fork a proven web stack and move fast," **Capacitor is the clear fit** and matches the earlier Skool Bido mobile decision. React Native would only be worth it if we needed heavy native features (offline-first, complex camera/AR, etc.) — a parent fees/notifications app does not.

### What Capacitor needs from us
- The app points at the deployed web app (crechewise.com), OR bundles the parent web UI and calls the Supabase API directly. Start with the hosted-URL approach for speed.
- **Supabase auth in a native shell:** magic-link sign-in must return to the app via a **deep link** (`crechewise://auth/callback`) — a known, solved pattern.
- **Push:** Firebase Cloud Messaging (Android) + APNs (iOS) via the Capacitor Push plugin; a small `device_tokens` table + a send path from our existing notification code.

---

## 4. Phased delivery (after the web milestone)

**Phase M0 — Accounts & assets (can start NOW, parallel, ~a few hrs of your time + waiting):**
- Google Play Console account + identity verification; (optional) Apple Developer enrolment.
- Firebase project (FCM). App icon + splash + store listing + screenshots.

**Phase M1 — Capacitor shell (~3–5 days):**
- Add Capacitor to the project; Android build wrapping the deployed parent web app.
- App icon/splash, status-bar theming (Creche Wise colours), back-button handling.
- Runs on a real Android device loading the live site.

**Phase M2 — Native auth + deep links (~3–5 days):**
- `crechewise://` deep-link scheme; Supabase magic-link redirect back into the app.
- Persistent sign-in (secure storage), sign-out.

**Phase M3 — Push notifications (~4–6 days):**
- FCM/APNs registration; `device_tokens` table; wire crèche → parent messages + "invoice due" + "payment received" to push.
- Tapping a push deep-links to the right screen (invoice, message).

**Phase M4 — Store submission (~2–4 days + review wait):**
- Data-safety form, privacy policy, content rating, closed testing track → production.
- Google review is usually 1–3 days for a first submission (can be longer for new accounts).

**Total engineering: ≈2–4 weeks** once the web parent flows are stable, plus store-review waiting time.

---

## 5. The multi-crèche design point (important, decide early)

You said parents should "interact with the different crèches" via the app. That implies **one parent account that can span more than one crèche** (e.g. siblings in different settings, or a family that moves crèche).

- Our data already links **parent → child → school** (`parent_student_links` carries `school_id`), so a single parent identity *can* be linked to children across multiple crèches.
- The app then needs a **crèche switcher** (or a combined feed) so the parent sees each child under the right crèche's branding, fees and notifications.
- **Decision to make:** is the parent app **per-crèche** (parent installs and it's tied to one crèche, like the current per-tenant portal) or **account-first** (parent logs in once, sees all their crèches)? The account-first model is the better product and the data already supports it, but it needs the parent web experience to be built account-first too — so **this should be decided before we build the parent web flows in §2**, because the app just mirrors them.

**Recommendation:** build the parent web experience **account-first** (parent logs in → sees all their children across all their crèches), so the app inherits multi-crèche for free.

---

## 6. Costs / prerequisites to be aware of
- Google Play: one-time **$25** developer registration + identity verification.
- Apple (if iOS): **$99/year**.
- Firebase: free tier is fine at launch.
- A verified **privacy policy URL** and **data-safety** disclosure are mandatory for Play (we have a privacy page already).

---

## 7. Bottom line
- **Don't split engineering effort now.** Finish the parent-facing web app first (it's the critical path and the app reuses it).
- **Do start the store accounts + Firebase + assets in parallel today** — they have lead times and don't touch code.
- **Build with Capacitor**, not a separate native app — 2–4 weeks to Play Store after the web milestone.
- **Decide the multi-crèche model (account-first) before building the parent web flows**, so the app gets multi-crèche support automatically.
