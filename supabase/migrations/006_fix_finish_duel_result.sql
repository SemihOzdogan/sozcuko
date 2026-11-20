-- finish_duel returns a player_id column, so duel_events.player_id must be
-- qualified to avoid PostgreSQL's ambiguous column reference error.
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
  current_player text;
  opponent text;
  player_name text;
begin
  select * into current_room
  from public.duel_rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    raise exception 'Düello odası bulunamadı';
  end if;

  if current_room.status = 'playing' then
    if current_room.ends_at is not null and current_room.ends_at > now() then
      raise exception 'Düello henüz bitmedi';
    end if;
    update public.duel_rooms
    set status = 'finished', finished_at = now()
    where id = p_room_id;
    current_room.status := 'finished';
  end if;

  if current_room.player_two_id is null then
    raise exception 'Rakip henüz katılmadı';
  end if;

  foreach current_player in array array[current_room.player_one_id, current_room.player_two_id] loop
    opponent := case
      when current_player = current_room.player_one_id then current_room.player_two_id
      else current_room.player_one_id
    end;

    select coalesce(sum(player_event.points), 0) into player_score
    from public.duel_events as player_event
    where player_event.room_id = p_room_id
      and player_event.player_id = current_player;

    select coalesce(sum(opponent_event.points), 0) into opponent_score
    from public.duel_events as opponent_event
    where opponent_event.room_id = p_room_id
      and opponent_event.player_id = opponent;

    player_result := case
      when player_score > opponent_score then 'win'
      when player_score < opponent_score then 'lose'
      else 'draw'
    end;

    if not current_room.league_recorded then
      select coalesce(display_name, 'Oyuncu') into player_name
      from public.league_players
      where league_players.player_id = current_player;
      perform public.record_league_match(current_player, player_name, player_result);
    end if;

    return query select
      current_player as player_id,
      player_score as score,
      player_result as result;
  end loop;

  if not current_room.league_recorded then
    update public.duel_rooms set league_recorded = true where id = p_room_id;
  end if;
end;
$$;

grant execute on function public.finish_duel(uuid)
  to anon, authenticated;
