-- Preferred language and currency, saved on the profile so they follow the user across devices.
-- Optional: the app works without these columns and falls back to the choice stored on the device.
alter table public.profiles
  add column language text check (language ~ '^[a-z]{2,3}$'),
  add column currency text check (currency ~ '^[A-Z]{3}$');
