-- ============================================================================
-- Supabase setup — brackets table (run once: SQL Editor → paste → Run)
-- Stores each user's one-and-only bracket. There is deliberately NO update or
-- delete policy: once saved, a bracket is permanent — even through the API.
-- ============================================================================

create table if not exists public.brackets (
  user_id  uuid        primary key references auth.users(id) on delete cascade,
  picks    jsonb       not null,
  saved_at timestamptz not null default now()
);

alter table public.brackets enable row level security;

drop policy if exists "read own bracket"   on public.brackets;
drop policy if exists "insert own bracket" on public.brackets;

create policy "read own bracket" on public.brackets
  for select using (auth.uid() = user_id);

create policy "insert own bracket" on public.brackets
  for insert with check (auth.uid() = user_id);
