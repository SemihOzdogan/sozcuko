-- finish_duel dönüş kolonu player_id ile tablo kolonlarının çakışmasını önler.
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

  update public.league_players as league_row
  set points = greatest(0, league_row.points + points_delta),
      wins = league_row.wins + case when p_result = 'win' then 1 else 0 end,
      losses = league_row.losses + case when p_result = 'lose' then 1 else 0 end,
      updated_at = now()
  where league_row.player_id = trim(p_player_id)
  returning league_row.* into updated_player;

  return updated_player;
end;
$$;

create or replace function public.finish_duel(p_room_id uuid)
returns table(player_id text, score integer, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.duel_rooms;
  player_score integer;
  opponent_score integer;
  player_result text;
  loop_player_id text;
  opponent_id text;
  player_name text;
begin
  select room.* into current_room
  from public.duel_rooms as room
  where room.id = p_room_id
  for update;

  if current_room.id is null then
    raise exception 'Düello odası bulunamadı';
  end if;

  if current_room.status = 'playing' then
    if current_room.ends_at is not null and current_room.ends_at > now() then
      raise exception 'Düello henüz bitmedi';
    end if;
    update public.duel_rooms as room
    set status = 'finished', finished_at = now()
    where room.id = p_room_id;
    current_room.status := 'finished';
  end if;

  if current_room.player_two_id is null then
    raise exception 'Rakip henüz katılmadı';
  end if;

  foreach loop_player_id in array array[
    current_room.player_one_id,
    current_room.player_two_id
  ] loop
    opponent_id := case
      when loop_player_id = current_room.player_one_id
        then current_room.player_two_id
      else current_room.player_one_id
    end;

    select coalesce(sum(player_event.points), 0)
    into player_score
    from public.duel_events as player_event
    where player_event.room_id = p_room_id
      and player_event.player_id = loop_player_id;

    select coalesce(sum(opponent_event.points), 0)
    into opponent_score
    from public.duel_events as opponent_event
    where opponent_event.room_id = p_room_id
      and opponent_event.player_id = opponent_id;

    player_result := case
      when player_score > opponent_score then 'win'
      when player_score < opponent_score then 'lose'
      else 'draw'
    end;

    if not current_room.league_recorded then
      select coalesce(league_row.display_name, 'Oyuncu')
      into player_name
      from public.league_players as league_row
      where league_row.player_id = loop_player_id;
      perform public.record_league_match(
        loop_player_id,
        player_name,
        player_result
      );
    end if;

    return query select
      loop_player_id,
      player_score,
      player_result;
  end loop;

  if not current_room.league_recorded then
    update public.duel_rooms as room
    set league_recorded = true
    where room.id = p_room_id;
  end if;
end;
$$;

grant execute on function public.finish_duel(uuid)
  to anon, authenticated;

