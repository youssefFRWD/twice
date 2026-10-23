-- Real online payments with Stripe Connect.
--
-- Sellers connect a Stripe account (Express) to be paid. The buyer pays price + 5% online; Stripe holds the money on
-- the Twice account until both people tap "Handover done", then Twice transfers price - 5% to the seller.
-- A sale paid online but not handed over within 14 days is refunded. Cash keeps working without Stripe or fees.
--
-- Stripe itself is only called from the Edge Functions in supabase/functions (they hold the secret key). This
-- migration keeps the bookkeeping: which sale is waiting for which payment, and what to undo when one fails.

-- ---------- sellers' Stripe accounts (written only by the Edge Functions) ----------
create table public.seller_accounts (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text not null unique,
  payouts_enabled   boolean not null default false,
  updated_at        timestamptz not null default now()
);
alter table public.seller_accounts enable row level security;
create policy "own seller account" on public.seller_accounts for select using (user_id = auth.uid());
revoke all on public.seller_accounts from anon;
revoke insert, update, delete, truncate, references, trigger on public.seller_accounts from authenticated;

-- ---------- sales paid online ----------
alter table public.sales drop constraint sales_method_check;
alter table public.sales add constraint sales_method_check check (method in ('online', 'card', 'apple', 'paypal', 'cash'));
alter table public.sales
  add column stripe_payment_intent text unique,
  add column paid_at     timestamptz, -- online: set by the Stripe webhook; cash: set when the buyer reserves
  add column transfer_id text;        -- the seller's payout, once the handover is done
update public.sales set paid_at = created_at where paid_at is null;

alter table public.loop_events drop constraint loop_events_reason_check;
alter table public.loop_events add constraint loop_events_reason_check check (reason in ('sale', 'fee_waiver', 'boost', 'refund'));

-- ---------- functions ----------

/** Whether the seller in this conversation can be paid online (has finished Stripe onboarding). Participants only. */
create function public.can_pay_online(conv bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select a.payouts_enabled
    from public.conversations c
    join public.seller_accounts a on a.user_id = c.seller_id
    where c.id = conv and auth.uid() in (c.buyer_id, c.seller_id)
  ), false)
$$;

/**
 * Cash only now: the buyer reserves and pays the seller in person, so there is no fee.
 * Online payments go through prepare_online_sale and Stripe instead.
 */
create or replace function public.pay_sale(conv bigint, pay_method text, paid_cents integer default null, use_loops boolean default false)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  listed integer;
  price integer;
  s public.sales;
begin
  if pay_method <> 'cash' then
    raise exception 'online payments go through Stripe' using errcode = '22023';
  end if;
  select * into c from public.conversations where id = conv;
  if c.id is null or c.buyer_id <> auth.uid() then
    raise exception 'not your conversation' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sale_approvals a where a.conversation_id = conv and a.status = 'approved') then
    raise exception 'the seller has not approved this sale' using errcode = '42501';
  end if;
  if exists (select 1 from public.sales where conversation_id = conv and paid_at is not null) then
    raise exception 'this sale is already paid' using errcode = '23505';
  end if;
  perform public.release_unpaid_sale(conv); -- an online attempt that was never completed

  select price_cents into listed from public.items where id = c.item_id;
  price := coalesce(paid_cents, listed);
  if price <= 0 or price > listed then
    raise exception 'the price must be above 0 and at most the listing price' using errcode = '22023';
  end if;

  insert into public.sales (conversation_id, method, price_cents, buyer_fee_cents, seller_fee_cents, paid_at)
  values (conv, 'cash', price, 0, 0, now())
  returning * into s;
  return s;
end $$;

/**
 * Called by the stripe-checkout Edge Function on behalf of the buyer, before the payment is created.
 * Checks everything, spends the buyer's Loops if they chose to remove their fee, and records the sale as waiting for
 * payment. Calling it again (e.g. the buyer changed their mind about Loops) replaces the earlier unpaid attempt.
 */
create function public.prepare_online_sale(conv bigint, paid_cents integer default null, use_loops boolean default false)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  listed integer;
  price integer;
  fee integer;
  waive boolean := false;
  s public.sales;
begin
  select * into c from public.conversations where id = conv;
  if c.id is null or c.buyer_id <> auth.uid() then
    raise exception 'not your conversation' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sale_approvals a where a.conversation_id = conv and a.status = 'approved') then
    raise exception 'the seller has not approved this sale' using errcode = '42501';
  end if;
  if not exists (select 1 from public.seller_accounts a where a.user_id = c.seller_id and a.payouts_enabled) then
    raise exception 'the seller cannot receive online payments yet' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.sales where conversation_id = conv and paid_at is not null) then
    raise exception 'this sale is already paid' using errcode = '23505';
  end if;
  perform public.release_unpaid_sale(conv);

  select price_cents into listed from public.items where id = c.item_id;
  price := coalesce(paid_cents, listed);
  if price < 50 or price > listed then -- Stripe's minimum charge is 0.50 euros
    raise exception 'the price must be at least 0.50 euros and at most the listing price' using errcode = '22023';
  end if;

  fee := round(price * 0.05)::integer;
  if use_loops and fee > 0 then
    perform public.spend_loops(auth.uid(), 500, 'fee_waiver', conv, c.item_id);
    waive := true;
  end if;

  insert into public.sales (conversation_id, method, price_cents, buyer_fee_cents, seller_fee_cents, buyer_fee_waived)
  values (conv, 'online', price, case when waive then 0 else fee end, fee, waive)
  returning * into s;
  return s;
end $$;

/** Drops a sale that was never paid, giving back any Loops spent on its fee. */
create function public.release_unpaid_sale(conv bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.sales;
  buyer uuid;
begin
  select * into s from public.sales where conversation_id = conv and paid_at is null for update;
  if s.conversation_id is null then
    return;
  end if;
  select buyer_id into buyer from public.conversations where id = conv;
  if s.buyer_fee_waived then
    insert into public.loop_events (user_id, amount, reason, conversation_id) values (buyer, 500, 'refund', conv);
  end if;
  delete from public.sales where conversation_id = conv;
end $$;

/**
 * Undoes a paid sale after Stripe refunded it (the buyer never got the item): Loops spent on fees come back, the sale is
 * removed, and the approval is withdrawn so the item goes back on sale.
 */
create function public.refund_sale(conv bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.sales;
  c public.conversations;
begin
  select * into s from public.sales where conversation_id = conv for update;
  if s.conversation_id is null or s.completed_at is not null then
    return;
  end if;
  select * into c from public.conversations where id = conv;
  if s.buyer_fee_waived then
    insert into public.loop_events (user_id, amount, reason, conversation_id) values (c.buyer_id, 500, 'refund', conv);
  end if;
  if s.seller_fee_waived then
    insert into public.loop_events (user_id, amount, reason, conversation_id) values (c.seller_id, 500, 'refund', conv);
  end if;
  delete from public.sales where conversation_id = conv;
  update public.sale_approvals set status = 'withdrawn' where conversation_id = conv; -- puts the item back on sale
end $$;

/** As before, but an online sale must actually be paid before anyone can confirm the handover. */
create or replace function public.confirm_handover(conv bigint, use_loops boolean default false)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  s public.sales;
  recent integer;
begin
  select * into c from public.conversations where id = conv;
  select * into s from public.sales where conversation_id = conv for update;
  if c.id is null or auth.uid() not in (c.buyer_id, c.seller_id) then
    raise exception 'not your conversation' using errcode = '42501';
  end if;
  if s.conversation_id is null or s.paid_at is null then
    raise exception 'the buyer has not paid yet' using errcode = 'P0001';
  end if;

  if auth.uid() = c.buyer_id and s.buyer_done_at is null then
    update public.sales set buyer_done_at = now() where conversation_id = conv;
  elsif auth.uid() = c.seller_id and s.seller_done_at is null then
    if use_loops and s.seller_fee_cents > 0 then
      perform public.spend_loops(auth.uid(), 500, 'fee_waiver', conv, c.item_id);
      update public.sales set seller_fee_cents = 0, seller_fee_waived = true where conversation_id = conv;
    end if;
    update public.sales set seller_done_at = now() where conversation_id = conv;
  end if;

  select * into s from public.sales where conversation_id = conv;
  if s.buyer_done_at is not null and s.seller_done_at is not null and s.completed_at is null then
    update public.items set status = 'sold' where id = c.item_id;

    select count(*) into recent
    from public.sales s2
    join public.conversations c2 on c2.id = s2.conversation_id
    where c2.buyer_id = c.buyer_id and c2.seller_id = c.seller_id
      and s2.loops_awarded and s2.completed_at > now() - interval '30 days';

    if s.price_cents >= 500 and recent < 2 then
      insert into public.loop_events (user_id, amount, reason, conversation_id, item_id)
      values (c.buyer_id, 50, 'sale', conv, c.item_id), (c.seller_id, 50, 'sale', conv, c.item_id);
      update public.sales set completed_at = now(), loops_awarded = true where conversation_id = conv;
    else
      update public.sales set completed_at = now() where conversation_id = conv;
    end if;
    select * into s from public.sales where conversation_id = conv;
  end if;
  return s;
end $$;

-- ---------- permissions ----------
revoke execute on function public.can_pay_online(bigint), public.prepare_online_sale(bigint, integer, boolean) from public, anon;
grant execute on function public.can_pay_online(bigint), public.prepare_online_sale(bigint, integer, boolean) to authenticated;
-- only the Edge Functions (service role) and the functions above may release or refund sales
revoke execute on function public.release_unpaid_sale(bigint), public.refund_sale(bigint) from public, anon, authenticated;
grant execute on function public.release_unpaid_sale(bigint), public.refund_sale(bigint) to service_role;
