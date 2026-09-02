alter table public.listings
  add column if not exists rejection_reason text,
  add column if not exists rejection_note text not null default '';

alter table public.listings
  drop constraint if exists listings_rejection_reason_check;

alter table public.listings
  add constraint listings_rejection_reason_check
  check (
    rejection_reason is null or rejection_reason in (
      'prohibited_item',
      'misleading_information',
      'suspicious_contact_or_payment',
      'duplicate_or_spam',
      'photo_issue',
      'other'
    )
  );

alter table public.moderation_events
  add column if not exists admin_note text not null default '';

alter table public.moderation_events
  drop constraint if exists moderation_events_decision_check;

alter table public.moderation_events
  add constraint moderation_events_decision_check
  check (decision in ('published','pending_review','rejected'));
