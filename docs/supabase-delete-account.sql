-- ============================================================================
-- Supabase setup — self-service account deletion (run once in the SQL Editor)
-- · delete_my_account(): a signed-in user deletes their own auth user; their
--   bracket/predictions rows cascade-delete automatically.
-- · deleted_emails + trigger: a deleted email can never sign up again
--   (any insert into auth.users with that email is rejected).
-- ============================================================================

create table if not exists public.deleted_emails (
  email      text primary key,
  deleted_at timestamptz not null default now()
);
alter table public.deleted_emails enable row level security;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare em text;
begin
  select email into em from auth.users where id = auth.uid();
  if em is null then
    raise exception 'not signed in';
  end if;
  insert into public.deleted_emails(email) values (lower(em))
    on conflict do nothing;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.block_deleted_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.deleted_emails where email = lower(new.email)) then
    raise exception 'This email belongs to a deleted account';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_deleted on auth.users;
create trigger trg_block_deleted
  before insert on auth.users
  for each row execute function public.block_deleted_emails();
