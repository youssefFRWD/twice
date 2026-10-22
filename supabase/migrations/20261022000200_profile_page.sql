-- Profile page: arrondissement, avatar, public/private switch, and reviews between neighbours.
-- Run in the Supabase SQL Editor after the earlier migrations.

-- 1. new profile fields (profiles stay private by default)
alter table public.profiles
  add column arrondissement smallint check (arrondissement between 1 and 20),
  add column avatar_path    text,
  add column is_public      boolean not null default false;

alter table public.profiles
  add constraint profiles_display_name_len check (display_name is null or length(display_name) between 1 and 40);

-- 2. reviews: one person reviewing another, optionally about a listing
create table public.reviews (
  id          bigint generated always as identity primary key,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  item_id     bigint references public.items (id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  body        text not null default '' check (length(body) <= 1000),
  created_at  timestamptz not null default now(),
  check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);
create index reviews_reviewer_idx on public.reviews (reviewer_id, created_at desc);

alter table public.reviews enable row level security;

-- you can read reviews you wrote or received; other people's profiles go through get_profile_page() below
create policy "read own reviews" on public.reviews for select
  using (auth.uid() in (reviewer_id, reviewee_id));
-- you can only review someone you have talked to about a listing
create policy "review conversation partners" on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where (c.buyer_id = reviewer_id and c.seller_id = reviewee_id)
         or (c.seller_id = reviewer_id and c.buyer_id = reviewee_id)
    )
  );
create policy "edit own reviews"   on public.reviews for update using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy "delete own reviews" on public.reviews for delete using (reviewer_id = auth.uid());

revoke all on public.reviews from anon;

-- 3. one call that returns what a viewer is allowed to see on someone's profile.
--    Reviews they received: always. Reviews they wrote: only if the profile is public (or it's you).
create function public.get_profile_page(target uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'avatar_path', p.avatar_path,
    'arrondissement', p.arrondissement,
    'created_at', p.created_at,
    'is_public', p.is_public,
    'received', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'rating', r.rating, 'body', r.body, 'created_at', r.created_at,
        'other', rp.display_name, 'item', i.title) order by r.created_at desc)
      from public.reviews r
      join public.profiles rp on rp.id = r.reviewer_id
      left join public.items i on i.id = r.item_id
      where r.reviewee_id = p.id), '[]'::jsonb),
    'written', case when p.is_public or p.id = auth.uid() then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'rating', r.rating, 'body', r.body, 'created_at', r.created_at,
        'other', rp.display_name, 'item', i.title) order by r.created_at desc)
      from public.reviews r
      join public.profiles rp on rp.id = r.reviewee_id
      left join public.items i on i.id = r.item_id
      where r.reviewer_id = p.id), '[]'::jsonb) end
  )
  from public.profiles p
  where p.id = target
$$;
revoke execute on function public.get_profile_page(uuid) from public, anon;
grant execute on function public.get_profile_page(uuid) to authenticated;

-- 4. profile pictures (path convention: <user id>/<file>); public read so <img> works
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
