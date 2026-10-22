-- Profile tabs: my listings (brand, hide, photos), friends (follows) and account deletion, with their RLS.
-- Run after 20261022000200_profile_page.sql.

-- ---------- 1. listings ----------
alter table public.items add column brand text;

alter table public.items
  add constraint items_brand_len  check (brand is null or length(brand) between 1 and 60),
  add constraint items_title_len  check (length(title) between 1 and 120),
  add constraint items_desc_len   check (length(description) <= 2000),
  add constraint items_price_max  check (price_cents <= 10000000);

-- a seller can hide a listing (status 'hidden'): it stays in their own list but leaves browse/map/search
alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check check (status in ('active', 'hidden', 'sold', 'removed'));

-- sellers may publish active or hidden listings, and later move them between active / hidden / sold.
-- 'removed' is reserved for moderation: sellers can neither set it nor edit a removed listing.
drop policy "sellers insert own" on public.items;
create policy "sellers insert own" on public.items for insert
  with check (seller_id = auth.uid() and status in ('active', 'hidden'));

drop policy "sellers update own" on public.items;
create policy "sellers update own" on public.items for update
  using (seller_id = auth.uid() and status <> 'removed')
  with check (seller_id = auth.uid() and status in ('active', 'hidden', 'sold'));
-- "sellers delete own" (from the first migration) already lets a seller delete their listing.

-- photos: at most 6 per listing, and a photo's file must sit in the seller's own storage folder
alter table public.item_images add constraint item_images_position_range check (position between 0 and 5);

drop policy "sellers manage images" on public.item_images;
create policy "sellers manage images" on public.item_images for all
  using (exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid()))
  with check (
    storage_path like auth.uid()::text || '/%'
    and exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid())
  );

-- ---------- 2. friends: following / followers ----------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;
revoke all on public.follows from anon;

create policy "see own follows"   on public.follows for select using (auth.uid() in (follower_id, followee_id));
create policy "follow as yourself" on public.follows for insert with check (follower_id = auth.uid());
create policy "unfollow as yourself" on public.follows for delete using (follower_id = auth.uid());

-- find people by name (shows only name, picture and area, whatever the privacy setting)
create function public.search_profiles(q text)
returns table (id uuid, display_name text, avatar_path text, arrondissement smallint, i_follow boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_path, p.arrondissement,
         exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from public.profiles p
  where auth.uid() is not null
    and length(trim(q)) >= 2
    and p.id <> auth.uid()
    and strpos(lower(p.display_name), lower(trim(q))) > 0
  order by p.display_name
  limit 10
$$;
revoke execute on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;

-- who you follow and who follows you, with names (profiles themselves stay private)
create function public.get_connections() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'following', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'avatar_path', p.avatar_path,
        'arrondissement', p.arrondissement) order by f.created_at desc)
      from public.follows f join public.profiles p on p.id = f.followee_id
      where f.follower_id = auth.uid()), '[]'::jsonb),
    'followers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'avatar_path', p.avatar_path,
        'arrondissement', p.arrondissement,
        'i_follow', exists (select 1 from public.follows b where b.follower_id = auth.uid() and b.followee_id = p.id))
        order by f.created_at desc)
      from public.follows f join public.profiles p on p.id = f.follower_id
      where f.followee_id = auth.uid()), '[]'::jsonb)
  )
  where auth.uid() is not null
$$;
revoke execute on function public.get_connections() from public, anon;
grant execute on function public.get_connections() to authenticated;

-- ---------- 3. delete my account ----------
-- Removes the auth user; profile, listings, photos rows, swipes, saved items, conversations,
-- messages, reviews and follows go with it through "on delete cascade".
-- (Files in Storage are not cascaded: the app removes them first.)
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
