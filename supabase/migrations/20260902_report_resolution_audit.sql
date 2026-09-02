alter table public.listing_reports
  add column if not exists resolution text,
  add column if not exists resolution_note text not null default '',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

alter table public.listing_reports
  drop constraint if exists listing_reports_resolution_check;

alter table public.listing_reports
  add constraint listing_reports_resolution_check
  check (
    resolution is null or resolution in (
      'substantiated',
      'unsubstantiated',
      'duplicate',
      'insufficient_evidence'
    )
  );

create table if not exists public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.listing_reports(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('review_started','resolved')),
  resolution text,
  admin_note text not null default '',
  listing_action text not null default 'none' check (listing_action in ('none','suspended')),
  created_at timestamptz not null default now()
);

create index if not exists report_events_report_created_at_idx
  on public.report_events(report_id, created_at desc);
create index if not exists report_events_listing_created_at_idx
  on public.report_events(listing_id, created_at desc);

alter table public.report_events enable row level security;
revoke all on table public.report_events from anon, authenticated;
