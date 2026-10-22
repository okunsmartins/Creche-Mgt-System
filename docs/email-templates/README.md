# Login emails (Supabase Auth): setup for all of crechewise.com

These steps apply **platform-wide**. Every crèche, parent, staff member and portal
owner on crechewise.com shares one Supabase Auth project (`xpbavfutfejlfbmnntyl`),
so the settings below are done **once** and cover every tenant. Nothing here is
per-crèche.

## Why

- Without custom SMTP, Supabase sends login emails from `noreply@mail.app.supabase.io`.
  Its built-in mailer has a very low hourly limit and only delivers to the project
  team's own addresses, so real parents may never get their emails.
- Password-reset links used the PKCE `?code=` flow. That only works in the same
  browser that requested the reset. It also breaks when Outlook "Safe Links"
  pre-opens the link and uses it up.
  The reset template now points at **`/auth/confirm`**. That page verifies the link
  only when the person clicks a button, so it works on any device or browser.

## 1. Send login emails through Resend (custom SMTP)

1. Resend → API Keys → **Create API key**. Name it `supabase-auth-smtp` and give it
   *Sending access*. Paste the key only into Supabase.
2. Supabase (project **xpbavfutfejlfbmnntyl**) → Authentication → Emails →
   **SMTP Settings** → Enable custom SMTP:

   | Field        | Value                                            |
   | ------------ | ------------------------------------------------ |
   | Sender email | same as `EMAIL_FROM_ADDRESS` in Vercel           |
   | Sender name  | `Creche Wise`                                    |
   | Host         | `smtp.resend.com`                                |
   | Port         | `465`                                            |
   | Username     | `resend`                                         |
   | Password     | the Resend key from step 1                       |

3. Authentication → **Rate Limits** → set "emails sent per hour" to about **100**.

## 2. Paste the branded templates

Supabase → Authentication → Emails → **Templates**:

| Template        | Subject                                  | Body (paste the whole file) |
| --------------- | ---------------------------------------- | --------------------------- |
| Reset Password  | `Reset your Creche Wise password`        | `reset-password.html`       |
| Confirm signup  | `Confirm your email for Creche Wise`     | `confirm-signup.html`       |

⚠️ Paste the reset template only **after** the PR adding `/auth/confirm` is deployed,
otherwise the new links would land on a missing page.

## 3. Check URL configuration (already correct as of 2026-10-22)

Authentication → URL Configuration:

- Site URL `https://crechewise.com`
- Redirect URLs `https://crechewise.com/**`, `https://www.crechewise.com/**` and
  `https://creche-mgt-system.vercel.app/**`

## 4. Test

1. In an incognito window, go to crechewise.com/forgot-password and enter a test account's email.
2. Open the email **on a different device or browser** (e.g. your phone).
3. Expect a teddy-branded email from Creche Wise. "Reset my password" opens
   crechewise.com/auth/confirm, then "Set my new password", then the new-password
   form, then sign in.
4. Click the same link again. Expect "This reset link has expired or has already been used".
