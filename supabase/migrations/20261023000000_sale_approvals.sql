-- Sale approvals: the seller approves a sale from the conversation with a buyer, and only then can that buyer pay.
-- The buyer does not request anything; they message the seller, and the seller decides in that thread.
-- A conversation is already one buyer + one item, so each conversation holds at most one approval.
-- Approving reserves the item: it leaves the store for everyone but the approved buyer.
-- If the seller withdraws the approval, the item goes back on sale.

alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check check (status in ('active', 'hidden', 'reserved', 'sold', 'removed'));

-- sellers may still edit a reserved listing (the edit form sends its current status back) or mark it sold
drop policy "sellers update own" on public.items;
create policy "sellers update own" on public.items for update
  using (seller_id = auth.uid() and status <> 'removed')
  with check (seller_id = auth.uid() and status in ('active', 'hidden', 'reserved', 'sold'));

create table public.sale_approvals (
  conversation_id bigint primary key references public.conversations (id) on delete cascade,
  status          text not null default 'approved' check (status in ('approved', 'withdrawn')),
  decided_at      timestamptz not null default now()
);

alter table public.sale_approvals enable row level security;

-- only the two people in the conversation see the approval
create policy "participants read sale approvals" on public.sale_approvals for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

-- only the seller approves, and only while the item is still on sale
create policy "sellers approve sales" on public.sale_approvals for insert
  with check (
    status = 'approved'
    and exists (
      select 1 from public.conversations c
      join public.items i on i.id = c.item_id
      where c.id = conversation_id and c.seller_id = auth.uid() and i.status = 'active'
    )
  );

-- only the seller changes it afterwards: withdraw, or approve again while the item is on sale
create policy "sellers update sale approvals" on public.sale_approvals for update
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.seller_id = auth.uid()))
  with check (
    exists (
      select 1 from public.conversations c
      join public.items i on i.id = c.item_id
      where c.id = conversation_id and c.seller_id = auth.uid()
        and (status = 'withdrawn' or i.status = 'active')
    )
  );

-- What a decision does to the item. Runs as the owner so it can update the listing and stamp the time.
create function public.sale_approval_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item bigint;
begin
  select c.item_id into item from public.conversations c where c.id = new.conversation_id;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    update public.items set status = 'reserved' where id = item and status = 'active';
  elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status = 'withdrawn' then
    update public.items set status = 'active' where id = item and status = 'reserved';
  end if;
  return null;
end $$;

create trigger sale_approval_effects
  after insert or update on public.sale_approvals
  for each row execute function public.sale_approval_effects();

create function public.sale_approval_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.decided_at := now();
  return new;
end $$;

create trigger sale_approval_stamp
  before insert or update on public.sale_approvals
  for each row execute function public.sale_approval_stamp();

revoke execute on function public.sale_approval_effects() from public, anon, authenticated;
revoke execute on function public.sale_approval_stamp() from public, anon, authenticated;

-- the approved buyer keeps seeing their reserved item (to pay and find the seller); nobody else does
create policy "approved buyer sees reserved item" on public.items for select
  using (
    status = 'reserved'
    and exists (
      select 1 from public.conversations c
      join public.sale_approvals a on a.conversation_id = c.id
      where c.item_id = items.id and c.buyer_id = auth.uid() and a.status = 'approved'
    )
  );

-- clients may only write the status (the time is set by the database); nobody deletes approvals
revoke all on public.sale_approvals from anon;
revoke insert, update, delete, truncate, references, trigger on public.sale_approvals from authenticated;
grant insert (conversation_id, status) on public.sale_approvals to authenticated;
grant update (status) on public.sale_approvals to authenticated;
