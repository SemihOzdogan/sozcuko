create table if not exists public.player_progress (
  player_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  classic_score integer not null default 0 check (classic_score >= 0),
  classic_words integer not null default 0 check (classic_words >= 0),
  classic_completed_levels jsonb not null default '[]'::jsonb,
  classic_clue_uses jsonb not null default '{}'::jsonb,
  classic_clue_words jsonb not null default '{}'::jsonb,
  duel_wins integer not null default 0 check (duel_wins >= 0),
  league_points integer not null default 0 check (league_points >= 0),
  league_wins integer not null default 0 check (league_wins >= 0),
  league_losses integer not null default 0 check (league_losses >= 0),
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;

drop policy if exists "players can read their progress" on public.player_progress;
create policy "players can read their progress"
  on public.player_progress for select
  using (auth.uid() = player_id);

drop policy if exists "players can insert their progress" on public.player_progress;
create policy "players can insert their progress"
  on public.player_progress for insert
  with check (auth.uid() = player_id);

drop policy if exists "players can update their progress" on public.player_progress;
create policy "players can update their progress"
  on public.player_progress for update
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create or replace function public.set_player_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_progress_updated_at on public.player_progress;
create trigger player_progress_updated_at
before update on public.player_progress
for each row execute function public.set_player_progress_updated_at();

create or replace function public.merge_player_progress(
  p_player_id uuid,
  p_xp integer,
  p_classic_score integer,
  p_classic_words integer,
  p_classic_completed_levels jsonb,
  p_classic_clue_uses jsonb,
  p_classic_clue_words jsonb,
  p_duel_wins integer,
  p_league_points integer,
  p_league_wins integer,
  p_league_losses integer
)
returns public.player_progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  merged public.player_progress;
begin
  if auth.uid() is null or auth.uid() <> p_player_id then
    raise exception 'player progress belongs to another user';
  end if;

  insert into public.player_progress (
    player_id,
    xp,
    classic_score,
    classic_words,
    classic_completed_levels,
    classic_clue_uses,
    classic_clue_words,
    duel_wins,
    league_points,
    league_wins,
    league_losses
  ) values (
    p_player_id,
    greatest(p_xp, 0),
    greatest(p_classic_score, 0),
    greatest(p_classic_words, 0),
    coalesce(p_classic_completed_levels, '[]'::jsonb),
    coalesce(p_classic_clue_uses, '{}'::jsonb),
    coalesce(p_classic_clue_words, '{}'::jsonb),
    greatest(p_duel_wins, 0),
    greatest(p_league_points, 0),
    greatest(p_league_wins, 0),
    greatest(p_league_losses, 0)
  )
  on conflict (player_id) do update set
    xp = greatest(player_progress.xp, excluded.xp),
    classic_score = greatest(player_progress.classic_score, excluded.classic_score),
    classic_words = greatest(player_progress.classic_words, excluded.classic_words),
    classic_completed_levels = (
      select coalesce(jsonb_agg(level_value order by (level_value #>> '{}')::integer), '[]'::jsonb)
      from (
        select distinct value as level_value
        from jsonb_array_elements(player_progress.classic_completed_levels || excluded.classic_completed_levels)
      ) levels
    ),
    classic_clue_uses = (
      select coalesce(jsonb_object_agg(key, to_jsonb(greatest(
        coalesce((player_progress.classic_clue_uses ->> key)::integer, 0),
        coalesce((excluded.classic_clue_uses ->> key)::integer, 0)
      ))), '{}'::jsonb)
      from (
        select key from jsonb_object_keys(player_progress.classic_clue_uses)
        union
        select key from jsonb_object_keys(excluded.classic_clue_uses)
      ) clue_keys
    ),
    classic_clue_words = player_progress.classic_clue_words || excluded.classic_clue_words,
    duel_wins = greatest(player_progress.duel_wins, excluded.duel_wins),
    league_points = greatest(player_progress.league_points, excluded.league_points),
    league_wins = greatest(player_progress.league_wins, excluded.league_wins),
    league_losses = greatest(player_progress.league_losses, excluded.league_losses)
  returning * into merged;

  return merged;
end;
$$;

grant execute on function public.merge_player_progress(
  uuid, integer, integer, integer, jsonb, jsonb, jsonb,
  integer, integer, integer, integer
) to authenticated;
