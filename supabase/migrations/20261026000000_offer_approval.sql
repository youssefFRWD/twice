-- An accepted offer counts as the seller's approval.
--
-- Offers live in chat messages: an offer is "[[offer]]{json}", and accepting it is "[[offer-reply]]{"to": <offer message
-- id>, "action": "accept"}" sent by the other person. Once that exchange exists in a conversation, both sides have agreed
-- to the sale, so either of them can turn it into an approval (which reserves the item, as a manual approval does).
-- The check reads the messages here, in the database, so an approval can't be claimed without a real accepted offer.

create function public.approve_by_offer(conv bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = conv;
  if c.id is null or auth.uid() not in (c.buyer_id, c.seller_id) then
    raise exception 'not your conversation' using errcode = '42501';
  end if;
  if exists (select 1 from public.sale_approvals where conversation_id = conv and status = 'approved') then
    return; -- already approved
  end if;

  if not exists (
    select 1
    from public.messages o
    join public.messages r on r.conversation_id = o.conversation_id
    where o.conversation_id = conv
      and o.body like '[[offer]]%'
      and r.body like '[[offer-reply]]%'
      and r.sender_id <> o.sender_id                                            -- accepted by the other person
      and r.body ~ ('"action"\s*:\s*"accept"')
      and r.body ~ ('"to"\s*:\s*"?' || o.id::text || '"?\s*[,}]')               -- ...and it answers this offer
  ) then
    raise exception 'there is no accepted offer in this conversation' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.items where id = c.item_id and status = 'active') then
    raise exception 'this item is no longer available' using errcode = 'P0001';
  end if;

  insert into public.sale_approvals (conversation_id, status) values (conv, 'approved')
  on conflict (conversation_id) do update set status = 'approved';
end $$;

revoke execute on function public.approve_by_offer(bigint) from public, anon;
grant execute on function public.approve_by_offer(bigint) to authenticated;
