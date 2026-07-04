-- ============================================================================
-- Supabase setup — predictions table
-- ----------------------------------------------------------------------------
-- Run this ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → paste all of this → Run.
-- It creates the table that stores each user's predictions and turns on
-- Row Level Security so a user can only ever see or change their OWN rows.
-- ============================================================================

create table if not exists public.predictions (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  match_id   text        not null,
  home_score int         not null,
  away_score int         not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.predictions enable row level security;

drop policy if exists "read own predictions"   on public.predictions;
drop policy if exists "insert own predictions" on public.predictions;
drop policy if exists "update own predictions" on public.predictions;
drop policy if exists "delete own predictions" on public.predictions;

create policy "read own predictions" on public.predictions
  for select using (auth.uid() = user_id);

create policy "insert own predictions" on public.predictions
  for insert with check (auth.uid() = user_id);

create policy "update own predictions" on public.predictions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own predictions" on public.predictions
  for delete using (auth.uid() = user_id);
