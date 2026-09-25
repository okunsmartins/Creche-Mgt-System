# Overnight build summary — 2026-09-25

Built autonomously overnight per your "keep building the crèche system" instruction.
Everything below is on branch **`feat/import-wizard`**, each step committed, with
**741 tests passing, type-check clean, lint clean**. No DB migrations were applied
unattended (none were needed for this work — it's app code + pure logic).

## What I built (newest first)

| Commit | What | Tests |
|---|---|---|
| `6dd890b` | **Fee-schedule generator** (`lib/fees/schedule.ts`) — the manager's magic wand: turn a fee (frequency + dates + per-period amount) into the year's dated obligations. Weekly/fortnightly/monthly/annually, month-end clamping. Per-period amount comes from the FEE-05 subvention engine (net after ECCE/NCS). | 8 |
| `1da55b2` | **Room ratio engine** (`lib/ratios/ratio.ts`) — required staff, met/shortfall/spare capacity, severity (ok/at_capacity/breach). Ratio is per-room configurable; reference Irish age-band ratios flagged CONFIRM. | 6 |
| `f72eb7e` | **Import wizard → multi-dataset**: pick Children *or* Staff. Added STAFF_FIELDS + `importStaffAction` (→ teachers, extras → custom_fields, dedupe by name+email). | 12 (import) |
| `918729c` | **Import: template + error report** — downloadable children template; "Download error report (CSV)" of rejected rows + reasons (spec §5.4 steps 1 & 8). | — |
| `ef8c052` | **Import date fix** — ambiguous dates (e.g. 02/11/2022) were mangled by SheetJS coercion. Now CSV parsed as text, XLSX dates read explicitly → ISO. This is why Saoirse failed earlier. | +regression |

(Earlier same session: `bcaf42d` import wizard Phase 1, `40ab70e` import core, `9bcf75f` rebrand.)

## How to review / test in the morning
1. Ask me to **restart the dev server** (it stops when my session is idle): it comes back on `localhost:3000`.
2. Sign in as **`manager@angelsnest.ie`** → **Import** in the sidebar (or `/admin/import`).
3. **Re-run the earlier CSV** (`docs/onboarding/sample-children.csv`): the 4 already-imported children will be skipped as duplicates and **Saoirse Kelly should now import** (the date fix). Try the **Staff** option too, and the **Download error report** button.

## What's next (your call)
- **FEE-06 invoice generation + FEE-01/FEE-04 schema** — wire the fee-schedule generator + subvention into real `invoices`/`fee_schedules` tables. *Needs migrations (I'll write for your review before applying) — I did NOT do this unattended.*
- **Domain rename** students/classes/teachers → children/rooms/staff (+ marketing "school" copy → "crèche"). Pervasive; better with you reviewing.
- **Parents import** — deferred: needs the parent↔child link model (parents are auth-backed profiles).
- **NCS/ECCE UI** — screens to enter CHICK/awards + wire into invoices.
- **Ratio UI** — live room counts using the new ratio engine (needs daily check-in, part of the domain build).

## Notes / honesty
- All new work is **pure logic + tested** or **UI verified by type-check/lint/compile**; the authenticated end-to-end import run is the one thing only you can do (my browser pane isn't signed in as the manager).
- Imported extras (DOB, allergies, Garda-vetting expiry, etc.) currently ride in the `custom_fields` JSONB because `students`/`teachers` don't have dedicated columns yet — that's the domain build. **DOB matters for NCS age eligibility**, so promoting it to a real column is worth doing early.
- Nothing is pushed to a remote (no GitHub remote on this fork yet) and no migrations were applied to the database.
