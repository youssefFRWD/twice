// @ts-nocheck -- plain JavaScript in Deno; types come from the npm packages at runtime
// Sellers connect a Stripe Express account to be paid for online sales.
// POST { action: 'link' }   -> { url } to Stripe's onboarding (creates the account the first time)
// POST { action: 'status' } -> { connected, payouts_enabled } (also refreshes what Twice has stored)
import { admin, caller, handle, json, must, payoutsReady, siteUrl, stripe } from '../_shared/stripe.ts'

Deno.serve(
  handle(async req => {
    const user = await caller(req)
    if (!user) return json({ error: 'Sign in first.' }, 401)
    const { action = 'link' } = await req.json().catch(() => ({}))
    const db = admin()
    let account = must(await db.from('seller_accounts').select('*').eq('user_id', user.id).maybeSingle())

    if (action === 'status') {
      if (!account) return json({ connected: false, payouts_enabled: false })
      const ready = payoutsReady(await stripe.accounts.retrieve(account.stripe_account_id))
      if (ready !== account.payouts_enabled) {
        must(await db.from('seller_accounts').update({ payouts_enabled: ready, updated_at: new Date().toISOString() }).eq('user_id', user.id))
      }
      return json({ connected: true, payouts_enabled: ready })
    }

    if (!account) {
      const created = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        business_type: 'individual',
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { user_id: user.id },
      })
      account = must(await db.from('seller_accounts').insert({ user_id: user.id, stripe_account_id: created.id }).select().single())
    }
    const link = await stripe.accountLinks.create({
      account: account.stripe_account_id,
      type: 'account_onboarding',
      refresh_url: `${siteUrl()}/#profile`,
      return_url: `${siteUrl()}/#profile`,
    })
    return json({ url: link.url })
  }),
)
