-- Profile cover: a colour style or an uploaded photo (stored in the avatars bucket, under the user's folder).
alter table public.profiles
  add column cover_path  text,
  add column cover_style text check (cover_style in ('forest', 'coral', 'sand', 'ink', 'sky', 'plum'));

-- same as before, plus the two cover fields
create or replace function public.get_profile_page(target uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'avatar_path', p.avatar_path,
    'cover_path', p.cover_path,
    'cover_style', p.cover_style,
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

