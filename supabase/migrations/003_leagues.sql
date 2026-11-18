create table if not exists public.league_players (
  player_id text primary key,
  display_name text not null default 'Oyuncu',
  points integer not null default 0 check (points >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.league_players enable row level security;

drop policy if exists "public can read league players" on public.league_players;
drop policy if exists "public can create league players" on public.league_players;
drop policy if exists "public can update league players" on public.league_players;

create policy "public can read league players" on public.league_players
  for select using (true);

create policy "public can create league players" on public.league_players
  for insert with check (true);

create policy "public can update league players" on public.league_players
  for update using (true) with check (true);

grant select, insert, update on table public.league_players
  to anon, authenticated;

create or replace function public.record_league_match(
  p_player_id text,
  p_display_name text,
  p_result text
)
returns public.league_players
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_player public.league_players;
  points_delta integer;
begin
  if p_player_id is null or length(trim(p_player_id)) = 0 then
    raise exception 'Oyuncu kimliği gerekli';
  end if;

  if p_result not in ('win', 'lose', 'draw') then
    raise exception 'Geçersiz maç sonucu';
  end if;

  points_delta := case p_result
    when 'win' then 25
    when 'draw' then 5
    else -15
  end;

  insert into public.league_players (player_id, display_name)
  values (trim(p_player_id), coalesce(nullif(trim(p_display_name), ''), 'Oyuncu'))
  on conflict (player_id) do update
    set display_name = excluded.display_name,
        updated_at = now();

  update public.league_players
  set points = greatest(0, points + points_delta),
      wins = wins + case when p_result = 'win' then 1 else 0 end,
      losses = losses + case when p_result = 'lose' then 1 else 0 end,
      updated_at = now()
  where player_id = trim(p_player_id)
  returning * into updated_player;

  return updated_player;
end;
$$;

grant execute on function public.record_league_match(text, text, text)
  to anon, authenticated;
