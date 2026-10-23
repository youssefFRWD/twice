// @ts-nocheck -- plain JavaScript in Deno; types come from the npm packages at runtime
// The buyer starts an online payment.
// POST { conversation_id, paid_cents?, use_loops? } -> { client_secret, amount }
// The database checks the approval, the price and the Loops, and works out the fee; this function only asks Stripe to
// charge that amount. The sale counts as paid when Stripe's webhook confirms it (see stripe-webhook).
import { admin, asCaller, caller, handle, json, must, stripe } from '../_shared/stripe.ts'

Deno.serve(
  handle(async req => {
    const user = await caller(req)
    if (!user) return json({ error: 'Sign in first.' }, 401)
    const { conversation_id, paid_cents = null, use_loops = false } = await req.json()
    const db = admin()

    // an earlier attempt that was never paid: cancel it at Stripe so it can't be paid later by mistake
    const earlier = must(await db.from('sales').select('stripe_payment_intent').eq('conversation_id', conversation_id).is('paid_at', null).maybeSingle())
    if (earlier?.stripe_payment_intent) await stripe.paymentIntents.cancel(earlier.stripe_payment_intent).catch(() => {})

    const sale = must(await asCaller(req).rpc('prepare_online_sale', { conv: conversation_id, paid_cents, use_loops }))
    const conv = must(await db.from('conversations').select('items(title)').eq('id', conversation_id).single())

    const intent = await stripe.paymentIntents.create({
      amount: sale.price_cents + sale.buyer_fee_cents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true }, // card, Apple Pay, Google Pay, PayPal... as enabled in Stripe
      transfer_group: `conv-${conversation_id}`,
      description: `twice: ${conv.items?.title ?? 'item'}`,
      metadata: { conversation_id: String(conversation_id), buyer_id: user.id },
    })
    must(await db.from('sales').update({ stripe_payment_intent: intent.id }).eq('conversation_id', conversation_id).is('paid_at', null))
    return json({ client_secret: intent.client_secret, amount: intent.amount })
  }),
)
