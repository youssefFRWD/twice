# Online payments (Stripe Connect)

Buyers pay online through Stripe. Twice holds the money until buyer and seller both tap **Handover done**, then pays the seller the price minus 5%. Twice keeps 5% from each side. Sales paid online but not handed over within 14 days are refunded. Cash sales don't use Stripe and have no fee.

The Stripe **secret** key only lives in these Edge Functions, never in the app.

| Function | Called by | What it does |
|---|---|---|
| `stripe-connect` | Seller, from their profile | Creates their Stripe Express account and returns the onboarding link; reports whether payouts are ready |
| `stripe-checkout` | Buyer, at checkout | Has the database check the approval and work out the amount (fee, Loops), then creates the Stripe payment |
| `stripe-webhook` | Stripe | Marks a sale paid when Stripe confirms it; releases cancelled attempts; refunds payments for replaced attempts; updates sellers' payout status |
| `stripe-handover` | Buyer or seller, in the conversation | Records "Handover done"; when both have confirmed, transfers the seller's money |
| `stripe-refund-stale` | Daily cron job | Refunds online sales the buyer hasn't confirmed after 14 days and puts the items back on sale |

## Setup (test mode first)

1. **Stripe account.** Create one at stripe.com and switch on **Connect** (Connect → Get started, choose "Platform or marketplace", Express accounts). Stay in **test mode**.

2. **Apply the database migrations**, including `20261025000000_stripe_payments.sql`:
   ```sh
   supabase db push
   ```

3. **Secrets for the functions** (Stripe → Developers → API keys):
   ```sh
   supabase secrets set STRIPE_SECRET_KEY=sk_test_... SITE_URL=https://your-twice-site.example
   ```

4. **Deploy the functions:**
   ```sh
   supabase functions deploy stripe-connect stripe-checkout stripe-handover stripe-refund-stale
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

5. **Webhooks** (Stripe → Developers → Webhooks), both pointing to `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`:
   - *Events from your account*: `payment_intent.succeeded`, `payment_intent.canceled`. Save its signing secret as `STRIPE_WEBHOOK_SECRET`.
   - *Events from connected accounts*: `account.updated`. Save its signing secret as `STRIPE_CONNECT_WEBHOOK_SECRET`.
   ```sh
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
   ```

6. **Daily refunds.** In Supabase → Integrations → Cron, add a daily job that calls the `stripe-refund-stale` function with the header `Authorization: Bearer <service role key>`.

7. **App.** In `.env.local`, add the **publishable** key and restart the dev server:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

8. **Payment methods.** In Stripe → Settings → Payment methods, turn on the ones you want (cards are on by default; Apple Pay, Google Pay and PayPal can be enabled there). The checkout shows whatever is enabled.

## Trying it

1. Seller: Profile → listings → **Set up payouts**, and fill in Stripe's test onboarding (Stripe shows test values to use).
2. Buyer: message the seller, both write, seller taps **Approve sale**.
3. Buyer: **Buy** → **Online** → **Continue to payment** → pay with the test card `4242 4242 4242 4242`, any future date, any CVC.
4. Both tap **Handover done**. The seller's payout appears in Stripe → Connect → the seller's account.

Before going live: swap in the live keys and webhook secrets, and complete Stripe's business verification for Twice.
