alter table public.classic_puzzles
  add column if not exists design jsonb not null default '{}'::jsonb;
