-- twice: database schema for Supabase.
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Intended for an empty project.

create extension if not exists postgis;

-- ---------- profiles (one per auth user) ----------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role         text check (role in ('buyer', 'seller')),
  home_label   text,
  home_lat     double precision,
  home_lon     double precision,
  created_at   timestamptz not null default now()
);

-- create the profile automatically when someone signs up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- categories ----------
create table public.categories (
  id    text primary key,
  label text not null
);

-- ---------- items (listings) ----------
create table public.items (
  id          bigint generated always as identity primary key,
  seller_id   uuid references public.profiles (id) on delete cascade,  -- null for sample listings
  seller_name text,                                                    -- display name for sample listings
  category_id text not null references public.categories (id),
  title       text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  condition   text not null check (condition in ('Like new', 'Very good', 'Good', 'Fair')),
  address     text not null,
  lat         double precision not null,
  lon         double precision not null,
  location    geography(point, 4326) generated always as (st_makepoint(lon, lat)::geography) stored,
  status      text not null default 'active' check (status in ('active', 'sold', 'removed')),
  created_at  timestamptz not null default now()
);
create index items_location_idx on public.items using gist (location);
create index items_category_idx on public.items (category_id);
create index items_seller_idx   on public.items (seller_id);

-- ---------- item images (files live in Storage bucket "item-images") ----------
create table public.item_images (
  id           bigint generated always as identity primary key,
  item_id      bigint not null references public.items (id) on delete cascade,
  storage_path text not null,
  position     smallint not null default 0
);
create index item_images_item_idx on public.item_images (item_id);

-- ---------- swipes: every save/pass a user makes ----------
create table public.swipes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    bigint not null references public.items (id) on delete cascade,
  direction  text not null check (direction in ('save', 'pass')),
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------- saved items ----------
create table public.saved_items (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    bigint not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index saved_items_item_idx on public.saved_items (item_id);

-- ---------- conversations + messages ----------
create table public.conversations (
  id         bigint generated always as identity primary key,
  item_id    bigint not null references public.items (id) on delete cascade,
  buyer_id   uuid not null references public.profiles (id) on delete cascade,
  seller_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, buyer_id),
  check (buyer_id <> seller_id)
);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (length(body) between 1 and 4000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------- item views (feeds "most visited places") ----------
create table public.item_views (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    bigint not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index item_views_user_idx on public.item_views (user_id, created_at desc);

-- most visited areas per user (the item address is the place label shown in the app)
create view public.most_visited_places with (security_invoker = true) as
  select v.user_id, i.address as place, count(*) as visits
  from public.item_views v
  join public.items i on i.id = v.item_id
  group by v.user_id, i.address;

-- ---------- row level security ----------
alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.items         enable row level security;
alter table public.item_images   enable row level security;
alter table public.swipes        enable row level security;
alter table public.saved_items   enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.item_views    enable row level security;

-- profiles: you see and edit your own
create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());

-- categories: public read
create policy "categories are public" on public.categories for select using (true);

-- items: anyone can browse active listings; sellers manage their own
create policy "browse active items" on public.items for select using (status = 'active' or seller_id = auth.uid());
create policy "sellers insert own"  on public.items for insert with check (seller_id = auth.uid());
create policy "sellers update own"  on public.items for update using (seller_id = auth.uid());
create policy "sellers delete own"  on public.items for delete using (seller_id = auth.uid());

create policy "images are public"     on public.item_images for select using (true);
create policy "sellers manage images" on public.item_images for all
  using (exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid()))
  with check (exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid()));

-- swipes, saved items, views: strictly your own rows
create policy "own swipes"      on public.swipes      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own saved items" on public.saved_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own views"       on public.item_views  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- conversations / messages: only the two people in the thread
create policy "participants read conversations" on public.conversations for select
  using (auth.uid() in (buyer_id, seller_id));
create policy "buyers start conversations" on public.conversations for insert
  with check (buyer_id = auth.uid());
create policy "participants read messages" on public.messages for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "participants send messages" on public.messages for insert
  with check (sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));
create policy "participants mark read" on public.messages for update
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)));

-- ---------- storage bucket for photos (path convention: <user id>/<file>) ----------
insert into storage.buckets (id, name, public) values ('item-images', 'item-images', true)
on conflict (id) do nothing;
create policy "sellers upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sellers delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
