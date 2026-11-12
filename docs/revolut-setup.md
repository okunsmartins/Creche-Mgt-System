# Revolut payments: setup and testing

Revolut is a **required** payment option on Creche Wise. Parents can pay invoices, late fees and extras with
Revolut, and the money goes straight into the **crèche's own Revolut Business account**. The platform is never the
merchant and never uses a platform Revolut key for parent payments.

## How it works

1. **Crèche admin** opens **Payments → Payment setup** (`/admin/payments/connect`).
2. They paste **one thing**: a Revolut **API key** made in the API Console (`r_test_…` for Sandbox, `r_prod_…` for live).
3. Creche Wise then automatically:
   - checks the key with Revolut (a wrong key gives a clear error);
   - creates the webhook `https://crechewise.com/api/webhooks/revolut` on **their** Revolut account. Any older
     Creche Wise webhook there is replaced, so re-saving never creates duplicates (Revolut allows 10 at most);
   - stores the key and the signing secret Revolut returns, both encrypted (`ENCRYPTION_KEY`).
4. Parents now see **"Pay with Revolut"** next to **"Pay by card"** on `/parent/invoices` and `/parent/late-fees`,
   or only the Revolut button if the crèche has no Stripe. Activity/programme orders already had the Card/Revolut choice.
5. Revolut's hosted checkout takes the payment (Revolut Pay or card). The webhook then marks the invoice paid
   through the same shared code as Stripe (`lib/fees/record-payment.ts`): it's safe to retry, overpayments are
   flagged, and the parent gets a receipt email.

**Disconnect** removes our webhook from their account and clears the stored keys.

## Platform settings (Vercel, creche-mgt-system project)

| Variable | Test (now) | Live (go-live) |
|---|---|---|
| `REVOLUT_API_BASE_URL` | unset, which defaults to `https://sandbox-merchant.revolut.com/api/1.0` | `https://merchant.revolut.com/api/1.0` |
| `ENCRYPTION_KEY` | **must be set** (encrypts crèche keys) | same value. Never change it, or saved keys can't be read |

The admin page shows a **Test mode** badge while the base URL is the sandbox. Crèche keys must match the mode:
a Sandbox key in test mode, a Production key in live mode.

## Getting the API key (Revolut changed this in 2026)

Revolut no longer shows Merchant API keys in the Revolut Business dashboard (**Settings → APIs** only links to the
console now). All keys are made in the **API Console**: <https://developer.revolut.com/console>.

- **Sign in** with the crèche's Revolut Business account. The API Console uses Revolut's normal sign-in
  (`sso.revolut.com`), even for Sandbox. The quickest way in is the **QR code**, scanned with the Revolut app.
  The text-message code can be slow or rate-limited.
- **Switch account** (top right) to **Sandbox** or **Production**. They're separate accounts with separate keys.
- **API keys → New**: choose **Merchant** only, set **Orders** and **Webhooks** to **Write**, then create it.
- **Copy the key immediately**: Revolut shows a key without signing keys **only once**.
- **Use a Merchant-only key.** Business permissions (Accounts, Transfers, Webhooks, …) make Revolut require Ed25519
  request signing in Production, which Creche Wise doesn't do. Merchant-only keys need no signing. Sandbox
  accounts come with a pre-generated full-access key. It works in Sandbox, where signing is optional, but don't
  copy that pattern to Production.
- A sandbox account you create by hand at sandbox-business.revolut.com is **not** linked to the API Console. It
  has no keys. Use the Sandbox account the API Console creates for you.

Sources: [Set up test environment](https://developer.revolut.com/docs/guides/merchant/test-and-go-live/set-up-test-environment),
[Get started with the API Console](https://developer.revolut.com/docs/guides/api-console/get-started),
[Create an API key](https://developer.revolut.com/docs/guides/api-console/create-key),
[Signing requirements](https://developer.revolut.com/docs/guides/api-console/signing-requirements).

## Test it (sandbox)

1. Open the API Console, sign in, and switch to the **Sandbox** account.
2. **API keys → New → Merchant**, with **Orders** and **Webhooks** set to **Write**. Create it, then copy the `r_test_…` key.
   Paste it **only** into Creche Wise, never in chat.
3. As the Angels Nest admin: **Payment setup → Revolut Business → paste → Connect Revolut**. It should show "Connected".
4. As the test parent (Incognito), go to **Fees & Invoices**, then **Pay with Revolut**. On Revolut's sandbox checkout,
   pay with test card **4929 4205 7359 5709** (any future expiry, any CVV).
5. Expect:
   - you're redirected back with "Payment received";
   - the invoice shows **Paid**;
   - the test parent gets the "Payment received" email.
