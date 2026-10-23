// @ts-nocheck -- plain JavaScript in Deno; types come from the npm packages at runtime
// Stripe calls this when something happens to a payment or a seller's account. It is the only thing that marks an online
// sale as paid. Point two webhook endpoints at it in the Stripe dashboard:
//   - your account:       payment_intent.succeeded, payment_intent.canceled   (secret: STRIPE_WEBHOOK_SECRET)
//   - connected accounts: account.updated                                     (secret: STRIPE_CONNECT_WEBHOOK_SECRET)
// It must be deployed without JWT verification (see supabase/config.toml): Stripe proves itself with the signature.
import { Stripe, admin, must, payoutsReady, stripe } from '../_shared/stripe.ts'

const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')].filter(Boolean)
const crypto = Stripe.createSubtleCryptoProvider()

async function verify(body, signature) {
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, crypto)
    } catch {
      /* try the next endpoint's secret */
    }
  }
  return null
}

Deno.serve(async req => {
  const event = await verify(await req.text(), req.headers.get('stripe-signature') ?? '')
  if (!event) return new Response('Bad signature', { status: 400 })
  const db = admin()

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object
      const sale = must(await db.from('sales').select('conversation_id, paid_at').eq('stripe_payment_intent', intent.id).maybeSingle())
      if (!sale) {
        // a replaced or abandoned attempt that still got paid: give the money back
        await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `orphan-${intent.id}` })
      } else if (!sale.paid_at) {
        must(await db.from('sales').update({ paid_at: new Date().toISOString() }).eq('stripe_payment_intent', intent.id))
      }
    } else if (event.type === 'payment_intent.canceled') {
      const sale = must(await db.from('sales').select('conversation_id').eq('stripe_payment_intent', event.data.object.id).is('paid_at', null).maybeSingle())
      if (sale) must(await db.rpc('release_unpaid_sale', { conv: sale.conversation_id }))
    } else if (event.type === 'account.updated') {
      const account = event.data.object
      must(await db.from('seller_accounts').update({ payouts_enabled: payoutsReady(account), updated_at: new Date().toISOString() }).eq('stripe_account_id', account.id))
    }
  } catch (e) {
    console.error(e)
    return new Response('Retry later', { status: 500 }) // Stripe retries failed deliveries
  }
  return new Response('ok')
})
