# Market Validation Pack — Irish Primary-School Payments/Attendance SaaS

**Status:** Pre-build validation. Goal is to find a wedge against the incumbent (Aladdin) or kill/pivot the head-on school play cheaply — *before* investing in the multi-tenant foundations.

**Decision rule:** Do not write further multi-tenant code until ~8 principals have indicated a real, paid-for wedge exists. The temporary `/admin/rls-spike` page and the multi-tenant work are paused pending validation.

---

## 1. Market brief (desk research, June 2026)

**Headline:** Aladdin is used by ~90% of Irish primary schools daily, and already bundles payments, attendance **and** Tusla reporting as integrated add-ons. This is a near-monopoly MIS that schools open every morning.

- **The "attendance → Tusla" wedge is already taken.** Aladdin tracks the 20-day absence threshold, integrates with OLCS, and produces the Student Absence Reports schools upload to Tusla. (Correction to an earlier suggestion — this is an incumbent strength, not a gap.)
- **Crowded payments field beyond Aladdin:** Way2Pay (Three Ireland), Easy Payments Plus, Payzone, Primary Sites (Stripe-based). Some bank/telco-backed and on government frameworks.
- **TAM small and shrinking:** ~3,089 primary schools; Department of Education says enrolments are set to fall significantly.
- **Procurement gatekeeper:** schools steered toward framework-approved suppliers via the Education Procurement Service (EPS) and Schools Procurement Unit (SPU). Off-framework = friction; getting on-framework = slow tender.

**Verdict:** Head-on national payments/attendance SaaS for Irish primary schools is discouraging on desk evidence. Three narrow openings to test before abandon/commit:
1. The ~10% not on Aladdin (~300 schools) — who/why.
2. A specific job Aladdin does badly (only principals/secretaries know).
3. An adjacent buyer with the same problem and no Aladdin (after-school clubs, childcare, GAA/sports clubs, grinds schools) — the payment engine isn't school-specific.

**Sources:** aladdin.ie; way2pay.org; payzone.ie/school-payments; easypaymentsplus.com; primarysites.ie; gov.ie primary enrolment figures (ETBI ~3,089); Irish Times (May 2026) enrolment decline; tusla.ie absence reporting; educationprocurementservice.ie; spu.ie.

---

## 2. Validation interview guide

**Goal:** disconfirm fast — hunt for a wedge or a clear no. Don't pitch; learn.
**Who:** 8–10 conversations. Mix of principals (budget holder, on board of management) and school secretaries (real daily user). Include ≥2 schools NOT on Aladdin.
**How:** 20–25 min, no demo, listen 80%. Ask about past behaviour and real money, not hypotheticals.

**1. Current state:** How do parents pay today (system)? How is attendance taken / Tusla returns done? What do you pay, to whom?
**2. Pain:** Most frustrating part of collecting money / chasing? What went wrong last term? One admin task you'd wave away? (If on Aladdin) what does it do badly / what do you work around?
**3. Switching reality:** Who decides — you, board, secretary, patron body? What did your last tool adoption actually take? What would have to be true to move? (Listen for "nothing.")
**4. Money:** Would you pay to fix this or is it just an annoyance? What's it worth per year? Whose budget?
**5. Wedge probes (only if pain surfaced):** (Non-Aladdin) why not Aladdin? Would a best-in-class single-job tool be worth a separate login, or must it be in one system?

**Go / kill criteria (decide before starting):**
- 🟢 Go-ish: ≥3 schools name the same specific, painful, paid-for job Aladdin does badly AND a realistic path to buying.
- 🔴 Kill/pivot: "Aladdin already does this / it's fine / board would never switch" heard 6+ times → head-on school play dead; pivot to adjacent buyer or different problem.

---

## 3. Demo accounts setup

Shared demo password (throwaway): `SchoolDemo2026!`. Generic domain `schooldemo.ie` (not real — fine because accounts are auto-confirmed, so no email is sent). Rotate/disable after each validation round.

**Step 1 — Supabase → Authentication → Users → Add user** (tick "Auto Confirm User", password `SchoolDemo2026!`):
- `principal@schooldemo.ie`
- `teacher@schooldemo.ie`
- `parent@schooldemo.ie`

**Step 2 — run in SQL editor:**

```sql
-- Names + school on the demo profiles
UPDATE public.profiles SET
  school_id  = '00000000-0000-0000-0000-000000000001',
  first_name = 'Demo',
  last_name  = CASE email
    WHEN 'principal@schooldemo.ie' THEN 'Principal'
    WHEN 'teacher@schooldemo.ie'   THEN 'Teacher'
    WHEN 'parent@schooldemo.ie'    THEN 'Parent'
  END
WHERE email IN ('principal@schooldemo.ie','teacher@schooldemo.ie','parent@schooldemo.ie');

-- Roles
INSERT INTO public.user_roles (user_id, role_id, school_id)
SELECT u.id, r.id, '00000000-0000-0000-0000-000000000001'
FROM auth.users u
JOIN public.roles r ON (
  (u.email = 'principal@schooldemo.ie' AND r.name = 'school_admin') OR
  (u.email = 'teacher@schooldemo.ie'   AND r.name = 'teacher')      OR
  (u.email = 'parent@schooldemo.ie'    AND r.name = 'parent')
)
ON CONFLICT (user_id, role_id, school_id) DO NOTHING;

-- Teacher record linked to the demo teacher's login
INSERT INTO public.teachers (school_id, first_name, last_name, email, is_active, profile_id)
SELECT '00000000-0000-0000-0000-000000000001','Demo','Teacher',
       'teacher@schooldemo.ie', TRUE, u.id
FROM auth.users u
WHERE u.email = 'teacher@schooldemo.ie'
  AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.email='teacher@schooldemo.ie');

-- Give the demo teacher Junior Infants (already has attendance data to view)
UPDATE public.classes
SET teacher_id = (SELECT id FROM public.teachers WHERE email='teacher@schooldemo.ie')
WHERE id = '10000000-0000-0000-0000-000000000001';

-- Link the demo parent to a pupil (Aoife Murphy, Junior Infants)
INSERT INTO public.parent_student_links (parent_id, student_id, school_id, relationship, is_active)
SELECT u.id, '20000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000001','parent', TRUE
FROM auth.users u
WHERE u.email='parent@schooldemo.ie'
  AND NOT EXISTS (SELECT 1 FROM public.parent_student_links l
                  WHERE l.parent_id=u.id AND l.student_id='20000000-0000-0000-0000-000000000001');

-- Verify (expect 3 rows, each with a school_id and a role)
SELECT p.email, p.first_name, p.last_name, p.school_id, r.name AS role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id=p.id
JOIN public.roles r ON r.id=ur.role_id
WHERE p.email LIKE '%@schooldemo.ie';
```

**Pre-send checklist:** confirm Stripe is in test mode (so card `4242 4242 4242 4242` works, no real charges); rotate/disable demo accounts after the round; note the in-app branding still says "Scoil Bhríde" (acceptable as a labelled sample school for now; neutral rebrand is a later task).

---

## 4. Outreach email template

**Subject:** Quick favour — a school payments & attendance tool I've built (logins inside)

Dear [Principal's name],

My name is [Your name]. I've built an online payments and attendance system for Irish primary schools, and before taking it further I'd really value honest feedback from someone who runs a school day-to-day.

No sales pitch — I'd just love for you to click around and tell me whether it's useful or whether it duplicates what you already have. **It's a demonstration with made-up sample data, not a live system, and no real payments are taken** — so please feel free to click anything; nothing is real and nothing can break.

**What it currently does**

For parents: pay online by card for trips, books and the voluntary contribution · pay with or without an account · pay by instalments · automatic receipts.

For the school office: one dashboard for activities, recurring programmes, orders and payments · generate a payment link for any item · issue refunds · see who has/hasn't paid · reconciliation and exportable reports.

For teachers: take the daily roll (present / late / absent) with notes.

Oversight & compliance: per-pupil attendance summaries with attendance % · weekly/monthly attendance trends · whole-school overview and CSV export · audit log and admin roles.

**Try it here:** https://primary-school-payments-portal.vercel.app/login

Three logins so you can see each side (password is the same for all three: **SchoolDemo2026!**):

| Role | Email | What you'll see |
|---|---|---|
| Principal / Admin | principal@schooldemo.ie | The full office dashboard |
| Teacher | teacher@schooldemo.ie | Roll-taking + attendance reports |
| Parent | parent@schooldemo.ie | The parent payment view |

To test a payment, use the demo card **4242 4242 4242 4242**, any future expiry date, and any 3-digit security code (it's a test card — no money moves).

**A few quick questions** — just reply Yes/No beside each:

1. Do you currently use Aladdin (or another system) for parent payments? (Yes/No — which one?)
2. Do you collect payments from parents online today? (Yes/No)
3. Is collecting and chasing payments a time drain for your office? (Yes/No)
4. Do you use software to prepare your Tusla attendance returns? (Yes/No)
5. Is attendance reporting / Tusla returns a pain point? (Yes/No)
6. Would the school consider adding or switching to a new tool if it clearly saved time? (Yes/No)
7. Who decides on something like this — you, the board of management, or both?
8. Do you currently pay for payments/attendance software? (Yes/No — roughly how much a year?)
9. After trying it, is there a feature you wish it included? (Yes/No — please note it)
10. Would you be open to a 15-minute call? (Yes/No)

Thank you so much — even a one-line reply would be a real help.

Kind regards,
[Your name] · [Phone] · [Email]

---

## 4b. Parent test email template

Demo parent login: `parent@schooldemo.ie` / `SchoolDemo2026!` (linked to sample pupil Aoife Murphy, Junior Infants). Test card `4242 4242 4242 4242`, any future expiry, any CVC. Receipts go to the demo address (won't deliver) — repoint to the tester's real email if a real receipt is wanted.

**Subject:** Could you test our new school payment app? (5 minutes — demo login inside)

Hi [Parent's name],

I'm testing a new online system that lets parents pay the school and keep track of everything in one place, and I'd really value a parent's-eye view before it goes further. It's a **demo with pretend data — no real money is taken**, so please click around freely; nothing is real and you can't break anything.

**What it lets you do as a parent**
- **Pay by card** for school activities — trips, books, uniforms, the voluntary contribution
- **Pay for after-school clubs and programmes** (e.g. GAA, coding, Irish dancing) and enrol your child
- **Spread the cost** — pay in instalments where the school allows it
- **See your child and what's due** in one place, and your full payment history
- **Get an email receipt** automatically after every payment
- **No account needed if you prefer** — there's also a "Pay as a guest" option using your child's pupil code

**Your demo login**
- Website: **https://primary-school-payments-portal.vercel.app/login**
- Email: **parent@schooldemo.ie**
- Password: **SchoolDemo2026!**

(This demo parent is linked to a sample pupil, **Aoife Murphy** in Junior Infants.)

**How to try it — about 5 minutes**
1. Open the link above and sign in with the details provided.
2. Have a look at the dashboard — you'll see your child and the items available to pay.
3. Pick any activity and go to pay. When asked for card details, use this **test card** (not a real card, nothing is charged):
   - Card number: **4242 4242 4242 4242**
   - Expiry: **any future date** (e.g. 12/30) · Security code: **any 3 digits** (e.g. 123)
4. Complete the payment — you'll see a confirmation and an emailed receipt.
5. **Optional:** sign out and try the **"Pay as a guest"** button on the homepage to see the no-login way to pay.

**A couple of quick questions afterwards (reply in a line or two):**
1. Was it easy to find what to pay and to pay it? (Yes/No)
2. Anything confusing or anything you'd want added?
3. Would you prefer this to how the school collects money now?

Thank you so much — your feedback would be a real help.

[Your name]

---

## 5. Response tracker (fill in as replies arrive)

| School | On Aladdin? | Pays online now? | Payments a pain? | Tusla a pain? | Would switch? | Decider | Pays/yr | Wedge feature requested | Call? |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |
