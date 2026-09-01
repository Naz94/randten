alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_is_admin_idx
  on public.profiles(is_admin)
  where is_admin = true;

-- Admin authorization is checked server-side with the service-role client.
-- No public RLS policy exposes or grants moderator powers.
