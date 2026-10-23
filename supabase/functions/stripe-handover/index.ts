// @ts-nocheck -- plain JavaScript in Deno; types come from the npm packages at runtime
// Buyer or seller taps "Handover done" on a sale paid online.
// POST { conversation_id, use_loops? } -> the sale
// The database records the confirmation (and the seller's Loops, if they remove their fee). Once both have confirmed,
// this pays the seller. Calling it again on a completed sale retries a payout that failed.
import { asCaller, caller, handle, json, must, payout } from '../_shared/stripe.ts'

Deno.serve(
  handle(async req => {
    const user = await caller(req)
    if (!user) return json({ error: 'Sign in first.' }, 401)
    const { conversation_id, use_loops = false } = await req.json()
    const sale = must(await asCaller(req).rpc('confirm_handover', { conv: conversation_id, use_loops }))
    return json(sale.completed_at ? await payout(conversation_id) : sale)
  }),
)
