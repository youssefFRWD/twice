-- Purchase requests: a buyer asks the seller to approve a sale before paying.
-- A conversation is already one buyer + one item, so each conversation holds at most one request.
-- Flow: buyer asks (pending) -> seller approves or declines -> only an approved buyer can pay.
-- Approving reserves the item: it leaves the store for everyone but the approved buyer,
-- and every other pending request for it is declined. If that buyer cancels, the item goes back on sale.

alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check check (status in ('active', 'reserved', 'sold', 'removed'));

create table public.purchase_requests (
  conversation_id bigint primary key references public.conversations (id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  requested_at    timestamptz not null default now(),
  decided_at      timestamptz
);

alter table public.purchase_requests enable row level security;

-- only the two people in the conversation see the request
create policy "participants read purchase requests" on public.purchase_requests for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

-- only the buyer opens a request, and only for an item that is still on sale
create policy "buyers request purchases" on public.purchase_requests for insert
  with check (
    status = 'pending'
    and exists (
      select 1 from public.conversations c
      join public.items i on i.id = c.item_id
      where c.id = conversation_id and c.buyer_id = auth.uid() and i.status = 'active'
    )
  );

-- either person may update; the trigger below decides which status changes each of them is allowed
create policy "participants update purchase requests" on public.purchase_requests for update
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

-- RLS cannot compare old and new rows, so the allowed transitions live here:
--   seller: pending -> approved | declined
--   buyer:  pending | approved -> cancelled, and declined | cancelled -> pending (ask again, item still on sale)
create function public.purchase_request_transition() returns trigger
language plpgsql set search_path = public as $$
declare
  c public.conversations;
begin
  if new.status = old.status or auth.uid() is null then
    return new;
  end if;
  select * into c from public.conversations where id = new.conversation_id;

  if auth.uid() = c.seller_id and old.status = 'pending' and new.status = 'approved'
     and exists (select 1 from public.items i where i.id = c.item_id and i.status = 'active') then
    new.decided_at := now();
  elsif auth.uid() = c.seller_id and old.status = 'pending' and new.status = 'declined' then
    new.decided_at := now();
  elsif auth.uid() = c.buyer_id and old.status in ('pending', 'approved') and new.status = 'cancelled' then
    new.decided_at := now();
  elsif auth.uid() = c.buyer_id and old.status in ('declined', 'cancelled') and new.status = 'pending'
        and exists (select 1 from public.items i where i.id = c.item_id and i.status = 'active') then
    new.requested_at := now();
    new.decided_at := null;
  else
    raise exception 'purchase request cannot go from % to %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end $$;

create trigger purchase_request_transition
  before update on public.purchase_requests
  for each row execute function public.purchase_request_transition();

revoke execute on function public.purchase_request_transition() from public, anon, authenticated;

-- What a status change does to the item. Runs as the owner because the buyer may not update items.
create function public.purchase_request_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item bigint;
begin
  select c.item_id into item from public.conversations c where c.id = new.conversation_id;

  if new.status = 'approved' and old.status <> 'approved' then
    update public.items set status = 'reserved' where id = item and status = 'active';
    -- runs as the owner, so auth.uid() is still the seller: the transition trigger allows pending -> declined
    update public.purchase_requests r set status = 'declined'
    from public.conversations c
    where r.conversation_id = c.id and c.item_id = item and r.conversation_id <> new.conversation_id and r.status = 'pending';
  elsif old.status = 'approved' and new.status = 'cancelled' then
    update public.items set status = 'active' where id = item and status = 'reserved';
  end if;
  return null;
end $$;

create trigger purchase_request_effects
  after update on public.purchase_requests
  for each row execute function public.purchase_request_effects();

revoke execute on function public.purchase_request_effects() from public, anon, authenticated;

-- the approved buyer keeps seeing their reserved item (to pay and find the seller); nobody else does
create policy "approved buyer sees reserved item" on public.items for select
  using (
    status = 'reserved'
    and exists (
      select 1 from public.conversations c
      join public.purchase_requests r on r.conversation_id = c.id
      where c.item_id = items.id and c.buyer_id = auth.uid() and r.status = 'approved'
    )
  );

-- clients may only write the status (timestamps are set by the database); nobody deletes requests
revoke all on public.purchase_requests from anon;
revoke insert, update, delete, truncate, references, trigger on public.purchase_requests from authenticated;
grant insert (conversation_id, status) on public.purchase_requests to authenticated;
grant update (status) on public.purchase_requests to authenticated;
