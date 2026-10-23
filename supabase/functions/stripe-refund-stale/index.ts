// @ts-nocheck -- plain JavaScript in Deno; types come from the npm packages at runtime
// Refunds online sales the buyer never confirmed receiving within 14 days, and puts the items back on sale.
// Run it once a day with a Supabase cron job (Integrations > Cron), calling this function with the service role key:
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// Sales the buyer already confirmed are never refunded here; only the seller's confirmation is missing then.
import { admin, handle, json, must, stripe } from '../_shared/stripe.ts'

const DAYS = 14

Deno.serve(
  handle(async req => {
    if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) return json({ error: 'Not allowed.' }, 401)
    const db = admin()
    const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString()
    const stale = must(
      await db
        .from('sales')
        .select('conversation_id, stripe_payment_intent')
        .eq('method', 'online')
        .not('paid_at', 'is', null)
        .is('buyer_done_at', null)
        .is('completed_at', null)
        .lt('paid_at', cutoff),
    )
    for (const s of stale) {
      await stripe.refunds.create({ payment_intent: s.stripe_payment_intent }, { idempotencyKey: `stale-${s.conversation_id}` })
      must(await db.rpc('refund_sale', { conv: s.conversation_id }))
    }
    return json({ refunded: stale.length })
  }),
)
