-- Some profiles have no display name, so conversations could not show who you are talking to.
-- Fill any blank name from the part of the email before the @ (what the sign-up trigger does for new accounts).
update public.profiles p
set display_name = left(split_part(u.email, '@', 1), 40)
from auth.users u
where u.id = p.id
  and (p.display_name is null or btrim(p.display_name) = '')
  and length(split_part(u.email, '@', 1)) > 0;
