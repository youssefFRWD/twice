-- Let people pick a town around Paris as well: 1-20 are the arrondissements, 21+ the banlieue (see src/areas.js).
alter table public.profiles drop constraint if exists profiles_arrondissement_check;
alter table public.profiles
  add constraint profiles_arrondissement_check check (arrondissement between 1 and 60);
