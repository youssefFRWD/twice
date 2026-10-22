-- Tighten row level security.
-- The initial migration already turned RLS on for every table and added basic policies.
-- This migration closes the gaps found in review. Not yet applied.

-- 1. profiles: make the ownership check explicit on update, so a row can never be re-pointed at another user.
drop policy "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2. profiles: let people in a conversation see each other's display name, and nothing else.
--    A view (owned by the database owner, so it bypasses RLS) exposes only id + display_name,
--    and only for the people you share a conversation with. Home location and role stay private.
create view public.conversation_partners as
  select p.id, p.display_name
  from public.profiles p
  where exists (
    select 1 from public.conversations c
    where (c.buyer_id = auth.uid() and c.seller_id = p.id)
       or (c.seller_id = auth.uid() and c.buyer_id = p.id)
  );
revoke all on public.conversation_partners from anon, authenticated;
grant select on public.conversation_partners to authenticated;

-- 3. items: a seller must not be able to hand a listing to someone else.
drop policy "sellers update own" on public.items;
create policy "sellers update own" on public.items for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- 4. conversations: the seller on the row must be the real seller of an active item.
--    Before, a buyer could name any user as "seller" and open a thread with them.
drop policy "buyers start conversations" on public.conversations;
create policy "buyers start conversations" on public.conversations for insert
  with check (
    buyer_id = auth.uid()
    and seller_id = (select i.seller_id from public.items i where i.id = item_id and i.status = 'active')
  );

-- 5. messages: only the recipient can mark a message read, and nothing else about it can change.
--    Before, either person could rewrite the body or the sender of any message in the thread.
drop policy "participants mark read" on public.messages;
create policy "recipient marks read" on public.messages for update
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    )
  )
  with check (sender_id <> auth.uid());
revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;

-- 6. Defence in depth at the permission layer (RLS stays the main guard).
--    Signed-out visitors may only read listings, photos and categories.
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke select on public.profiles, public.swipes, public.saved_items,
                 public.conversations, public.messages, public.item_views,
                 public.most_visited_places from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 7. The sign-up trigger function should not be callable by clients.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
