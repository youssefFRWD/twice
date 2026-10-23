-- Contact form: anyone (signed in or not) can write to the twice team. Only the team reads them,
-- in the Supabase dashboard (Table editor -> contact_messages); the app never reads this table.
-- Run in the Supabase SQL Editor after the earlier migrations.

create table public.contact_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  name       text not null check (length(name) between 1 and 80),
  email      text not null check (length(email) between 3 and 200 and email like '%_@_%'),
  message    text not null check (length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- you may only attach your own account id (or none)
create policy "send a contact message" on public.contact_messages for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke all on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
