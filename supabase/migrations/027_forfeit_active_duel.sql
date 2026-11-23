-- Oyuncu aktif maçtan çıktığında sonuç skorla değil, terk etme kuralıyla belirlenir.
alter table public.duel_rooms
  add column if not exists forfeited_player_id text;

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
      when current_room.forfeited_player_id = loop_player_id then 'lose'
      when current_room.forfeited_player_id = opponent_id then 'win'
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

    return query select loop_player_id, player_score, player_result;
  end loop;

  if not current_room.league_recorded then
    update public.duel_rooms as room
    set league_recorded = true
    where room.id = p_room_id;
  end if;
end;
$$;

create or replace function public.forfeit_duel(
  p_room_id uuid,
  p_player_id text
)
returns table(player_id text, score integer, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.duel_rooms;
begin
  select room.* into current_room
  from public.duel_rooms as room
  where room.id = p_room_id
  for update;

  if current_room.id is null then
    raise exception 'Düello odası bulunamadı';
  end if;

  if current_room.status <> 'playing' then
    return query select * from public.finish_duel(p_room_id);
    return;
  end if;

  if trim(p_player_id) not in (
    current_room.player_one_id,
    current_room.player_two_id
  ) then
    raise exception 'Oyuncu bu düelloda değil';
  end if;

  update public.duel_rooms as room
  set status = 'finished',
      finished_at = now(),
      ends_at = now(),
      forfeited_player_id = trim(p_player_id)
  where room.id = p_room_id
    and room.status = 'playing';

  return query select * from public.finish_duel(p_room_id);
end;
$$;

grant execute on function public.finish_duel(uuid) to anon, authenticated;
grant execute on function public.forfeit_duel(uuid, text) to anon, authenticated;
