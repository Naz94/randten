create extension if not exists pgcrypto;

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('published','pending_review')),
  risk_score integer not null check (risk_score between 0 and 100),
  reasons text[] not null default '{}',
  engine_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists moderation_events_listing_id_created_at_idx
  on public.moderation_events(listing_id, created_at desc);

alter table public.moderation_events enable row level security;
revoke all on table public.moderation_events from anon, authenticated;

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('scam','prohibited','counterfeit','misleading','duplicate','other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id, reason)
);

create index if not exists listing_reports_status_created_at_idx
  on public.listing_reports(status, created_at desc);
create index if not exists listing_reports_listing_id_idx
  on public.listing_reports(listing_id);

alter table public.listing_reports enable row level security;
revoke all on table public.listing_reports from anon, authenticated;
