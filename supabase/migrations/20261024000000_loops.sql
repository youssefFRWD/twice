-- Loops: Twice's reward points, and the 5% fee they can remove.
--
-- Fee:   5% from the buyer and 5% from the seller on every sale paid in the app (no fee on cash).
-- Earn:  +50 Loops each for buyer and seller when both confirm the handover.
--        No Loops for sales under 5 euros, and the same two people earn together at most twice in 30 days.
-- Spend: 500 Loops removes your own 5% fee on one sale (buyer at payment, seller at handover).
--        300 Loops boosts one of your listings to the top of Discover for 24 hours.
-- Loops are not money: they are never paid out or transferred. Clients can only read them; every change goes through
-- the functions below, which run as the owner and check who is calling.

-- ---------- ledger ----------
create table public.loop_events (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  amount          integer not null check (amount <> 0),
  reason          text not null check (reason in ('sale', 'fee_waiver', 'boost')),
  conversation_id bigint references public.conversations (id) on delete set null,
  item_id         bigint references public.items (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index loop_events_user_idx on public.loop_events (user_id);

alter table public.loop_events enable row level security;
create policy "own loop events" on public.loop_events for select using (user_id = auth.uid());

-- ---------- sales: one per conversation, created when the buyer pays ----------
create table public.sales (
  conversation_id   bigint primary key references public.conversations (id) on delete cascade,
  method            text not null check (method in ('card', 'apple', 'paypal', 'cash')),
  price_cents       integer not null check (price_cents > 0),
  buyer_fee_cents   integer not null check (buyer_fee_cents >= 0),  -- what the buyer actually pays on top
  seller_fee_cents  integer not null check (seller_fee_cents >= 0), -- what is kept from the seller
  buyer_fee_waived  boolean not null default false,
  seller_fee_waived boolean not null default false,
  buyer_done_at     timestamptz,
  seller_done_at    timestamptz,
  completed_at      timestamptz,
  loops_awarded     boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table public.sales enable row level security;
create policy "participants read sales" on public.sales for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

-- ---------- boosts ----------
alter table public.items add column boosted_until timestamptz;

-- sellers write their listings column by column, so nobody can set boosted_until (or anything else) directly
revoke insert, update on public.items from authenticated;
grant insert (seller_id, seller_name, category_id, title, brand, description, price_cents, condition, address, lat, lon, status)
  on public.items to authenticated;
grant update (category_id, title, brand, description, price_cents, condition, address, lat, lon, status)
  on public.items to authenticated;

-- ---------- approvals can't be withdrawn once the buyer has paid ----------
drop policy "sellers update sale approvals" on public.sale_approvals;
create policy "sellers update sale approvals" on public.sale_approvals for update
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.seller_id = auth.uid()))
  with check (
    not exists (select 1 from public.sales s where s.conversation_id = sale_approvals.conversation_id)
    and exists (
      select 1 from public.conversations c
      join public.items i on i.id = c.item_id
      where c.id = conversation_id and c.seller_id = auth.uid()
        and (sale_approvals.status = 'withdrawn' or i.status = 'active')
    )
  );

-- the buyer keeps seeing the item after the sale completes, so the conversation keeps its title
drop policy "approved buyer sees reserved item" on public.items;
create policy "approved buyer sees reserved item" on public.items for select
  using (status in ('reserved', 'sold') and public.is_approved_buyer(id));

-- ---------- functions ----------

/** The signed-in user's balance. */
create function public.my_loops() returns integer
language sql stable set search_path = public as $$
  select coalesce(sum(amount), 0)::integer from public.loop_events where user_id = auth.uid()
$$;

/** Takes Loops from someone, or fails if they don't have enough. Internal: only the functions below call it. */
create function public.spend_loops(who uuid, cost integer, why text, conv bigint, listing bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('loops:' || who::text)); -- two spends at once can't both pass the check
  if (select coalesce(sum(amount), 0) from public.loop_events where user_id = who) < cost then
    raise exception 'not enough Loops' using errcode = 'P0001';
  end if;
  insert into public.loop_events (user_id, amount, reason, conversation_id, item_id) values (who, -cost, why, conv, listing);
end $$;

/**
 * The buyer pays (in this prototype the payment itself is simulated). Needs the seller's approval.
 * paid_cents is the agreed price from an accepted offer, or null for the listing price; it can't exceed the listing price.
 */
create function public.pay_sale(conv bigint, pay_method text, paid_cents integer default null, use_loops boolean default false)
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
  if exists (select 1 from public.sales where conversation_id = conv) then
    raise exception 'this sale is already paid' using errcode = '23505';
  end if;
  if pay_method not in ('card', 'apple', 'paypal', 'cash') then
    raise exception 'unknown payment method' using errcode = '22023';
  end if;

  select price_cents into listed from public.items where id = c.item_id;
  price := coalesce(paid_cents, listed);
  if price <= 0 or price > listed then
    raise exception 'the price must be above 0 and at most the listing price' using errcode = '22023';
  end if;

  fee := case when pay_method = 'cash' then 0 else round(price * 0.05)::integer end;
  if use_loops and fee > 0 then
    perform public.spend_loops(auth.uid(), 500, 'fee_waiver', conv, c.item_id);
    waive := true;
  end if;

  insert into public.sales (conversation_id, method, price_cents, buyer_fee_cents, seller_fee_cents, buyer_fee_waived)
  values (conv, pay_method, price, case when waive then 0 else fee end, fee, waive)
  returning * into s;
  return s;
end $$;

/**
 * Buyer or seller confirms the handover. The seller may spend 500 Loops here to remove their fee.
 * When both have confirmed, the item is sold and each earns 50 Loops (if the sale qualifies).
 */
create function public.confirm_handover(conv bigint, use_loops boolean default false)
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
  if s.conversation_id is null then
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

/** Spends 300 Loops to put one of your listings at the top of Discover for 24 hours. Returns when the boost ends. */
create function public.boost_listing(listing bigint) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  it public.items;
  ends timestamptz := now() + interval '24 hours';
begin
  select * into it from public.items where id = listing for update;
  if it.id is null or it.seller_id <> auth.uid() then
    raise exception 'not your listing' using errcode = '42501';
  end if;
  if it.status <> 'active' then
    raise exception 'only listings on sale can be boosted' using errcode = 'P0001';
  end if;
  if it.boosted_until > now() then
    raise exception 'this listing is already boosted' using errcode = 'P0001';
  end if;
  perform public.spend_loops(auth.uid(), 300, 'boost', null, listing);
  update public.items set boosted_until = ends where id = listing;
  return ends;
end $$;

-- ---------- permissions ----------
revoke all on public.loop_events, public.sales from anon;
revoke insert, update, delete, truncate, references, trigger on public.loop_events, public.sales from authenticated;
grant select on public.loop_events, public.sales to authenticated;

revoke execute on function public.spend_loops(uuid, integer, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.my_loops(), public.pay_sale(bigint, text, integer, boolean),
  public.confirm_handover(bigint, boolean), public.boost_listing(bigint) from public, anon;
grant execute on function public.my_loops(), public.pay_sale(bigint, text, integer, boolean),
  public.confirm_handover(bigint, boolean), public.boost_listing(bigint) to authenticated;
