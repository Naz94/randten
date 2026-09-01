-- Security follow-up for marketplace social tables.
-- Safe to run after the original social migration was applied manually.

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
