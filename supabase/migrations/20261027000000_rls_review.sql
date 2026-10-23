-- RLS review after approvals, Loops and Stripe payments.
-- The earlier migrations each added their own policies; this one closes the gaps that appeared once they were combined.

-- 1. items: once a buyer has a sale on a listing, the seller can no longer move it around by hand.
--    Before, a seller could set a reserved (even already paid) listing back to 'active' or 'hidden' and sell it twice.
--    With a sale on the listing the status must stay 'reserved', or be 'sold' once the handover has completed
--    (the edit form sends the current status back, so ordinary edits still work).
drop policy "sellers update own" on public.items;
create policy "sellers update own" on public.items for update
  using (seller_id = auth.uid() and status <> 'removed')
  with check (
    seller_id = auth.uid()
    and status in ('active', 'hidden', 'reserved', 'sold')
    and (
      not exists (
        select 1 from public.conversations c
        join public.sales s on s.conversation_id = c.id
        where c.item_id = items.id
      )
      or status = 'reserved'
      or (status = 'sold' and exists (
        select 1 from public.conversations c
        join public.sales s on s.conversation_id = c.id
        where c.item_id = items.id and s.completed_at is not null
      ))
    )
  );

-- 2. sales: participants read the sale, but not Stripe's internal payment id.
--    The app reads everything else (see the sales(...) select in src/api.js).
revoke select on public.sales from authenticated;
grant select (conversation_id, method, price_cents, buyer_fee_cents, seller_fee_cents, buyer_fee_waived,
              seller_fee_waived, buyer_done_at, seller_done_at, completed_at, loops_awarded, created_at,
              paid_at, transfer_id)
  on public.sales to authenticated;

-- 3. seller_accounts: the app only needs to know whether payouts are on; the Stripe account id stays server side.
revoke select on public.seller_accounts from authenticated;
grant select (user_id, payouts_enabled, updated_at) on public.seller_accounts to authenticated;
