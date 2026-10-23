// @ts-nocheck -- plain JavaScript in Deno; types come from the npm packages at runtime
// Shared setup for the Stripe Edge Functions. The Stripe secret key only ever lives here, as a Supabase secret.
//
// Secrets (supabase secrets set ...): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, optionally STRIPE_CONNECT_WEBHOOK_SECRET,
// and SITE_URL (where sellers come back to after Stripe onboarding). SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import Stripe from 'npm:stripe@22.6.2'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

export { Stripe }
export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { httpClient: Stripe.createFetchHttpClient() })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
export const siteUrl = () => (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Answers CORS preflight and turns thrown errors into a JSON error the app can show. */
export const handle = fn => async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    return await fn(req)
  } catch (e) {
    console.error(e)
    return json({ error: e?.message ?? 'Something went wrong' }, 400)
  }
}

/** Service-role client: bypasses RLS. Only used for bookkeeping the function has already checked. */
export const admin = () => createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })

/** Acts as the signed-in caller, so database functions see auth.uid() and every RLS rule applies. */
export const asCaller = req =>
  createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })

export async function caller(req) {
  const { data } = await asCaller(req).auth.getUser()
  return data.user ?? null
}

/** Throws the database's own message, so rule violations reach the app as readable errors. */
export const must = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

/** A seller can be paid once Stripe has activated transfers to their account. */
export const payoutsReady = account => account.capabilities?.transfers === 'active' && !!account.details_submitted

/**
 * Pays the seller (price minus their fee) once a sale paid online is completed. Safe to call again: it does nothing
 * when the payout already exists, and Stripe's idempotency key stops a double transfer.
 */
export async function payout(conversationId) {
  const db = admin()
  const sale = must(await db.from('sales').select('*, conversations(seller_id)').eq('conversation_id', conversationId).single())
  if (sale.method !== 'online' || !sale.completed_at || sale.transfer_id) return sale

  const account = must(await db.from('seller_accounts').select('stripe_account_id').eq('user_id', sale.conversations.seller_id).single())
  const intent = await stripe.paymentIntents.retrieve(sale.stripe_payment_intent)
  const transfer = await stripe.transfers.create(
    {
      amount: sale.price_cents - sale.seller_fee_cents,
      currency: 'eur',
      destination: account.stripe_account_id,
      transfer_group: `conv-${conversationId}`,
      source_transaction: intent.latest_charge, // pays out once the buyer's charge is available
      metadata: { conversation_id: String(conversationId) },
    },
    { idempotencyKey: `payout-${conversationId}` },
  )
  return must(await db.from('sales').update({ transfer_id: transfer.id }).eq('conversation_id', conversationId).select().single())
}
