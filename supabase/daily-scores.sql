-- Global stats for the Daily Rift. Run this once in the Supabase SQL editor.
-- Stores only an anonymous random player id, the Daily number and the score.

create table if not exists public.daily_scores (
  id bigint generated always as identity primary key,
  day integer not null check (day > 0),
  player_id uuid not null,
  score integer not null check (score between 0 and 100),
  created_at timestamptz not null default now(),
  -- One score per player per Daily.
  unique (day, player_id)
);

alter table public.daily_scores enable row level security;
grant insert on public.daily_scores to anon;

-- Anyone may submit a score, but only for today's Daily (give or take a day for time zones).
-- Daily #1 was 2026-11-11.
drop policy if exists "Submit today's score" on public.daily_scores;
create policy "Submit today's score"
  on public.daily_scores
  for insert
  to anon
  with check (
    (date '2026-11-11' + (day - 1)) between current_date - 1 and current_date + 1
  );

-- No select policy: individual rows stay private. Players only get totals through this function.
create or replace function public.daily_stats(p_day integer, p_score integer)
returns table (players integer, beaten integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer as players,
    (count(*) filter (where score < p_score))::integer as beaten
  from public.daily_scores
  where day = p_day;
$$;

revoke all on function public.daily_stats(integer, integer) from public;
grant execute on function public.daily_stats(integer, integer) to anon;
