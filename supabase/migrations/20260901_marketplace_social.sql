create extension if not exists pgcrypto;

create table if not exists public.saved_listings (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists saved_listings_user_id_created_at_idx
  on public.saved_listings(user_id, created_at desc);

alter table public.saved_listings enable row level security;
revoke all on table public.saved_listings from anon, authenticated;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique (listing_id, buyer_id, seller_id)
);

create index if not exists conversations_buyer_updated_at_idx
  on public.conversations(buyer_id, updated_at desc);
create index if not exists conversations_seller_updated_at_idx
  on public.conversations(seller_id, updated_at desc);

alter table public.conversations enable row level security;
revoke all on table public.conversations from anon, authenticated;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_created_at_idx
  on public.messages(conversation_id, created_at asc);

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;

create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_conversation_updated_at() from public, anon, authenticated;

drop trigger if exists touch_conversation_after_message on public.messages;
create trigger touch_conversation_after_message
after insert on public.messages
for each row execute function public.touch_conversation_updated_at();
