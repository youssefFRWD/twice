-- Let people read the profile of anyone they are in a conversation with, so chats show real names.
drop policy if exists "read conversation partner profiles" on public.profiles;
create policy "read conversation partner profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.conversations c
      where (c.buyer_id = auth.uid() and c.seller_id = profiles.id)
         or (c.seller_id = auth.uid() and c.buyer_id = profiles.id)
    )
  );
