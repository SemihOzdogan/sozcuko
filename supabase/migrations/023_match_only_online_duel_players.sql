-- Hızlı eşleşme, kapanmış uygulamalardan kalan eski odalara bağlanmamalı.
-- Sadece presence kaydı son 45 saniyede güncellenen oyuncular eşleşebilir.

create or replace function public.find_or_create_duel_room(p_player_id text)
returns public.duel_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_room public.duel_rooms;
  selected_letters jsonb;
begin
  if p_player_id is null or length(trim(p_player_id)) = 0 then
    raise exception 'Oyuncu kimliği gerekli';
  end if;

  perform pg_advisory_xact_lock(746921);

  update public.duel_rooms
  set status = 'finished', finished_at = now()
  where status = 'waiting'
    and created_at < now() - interval '30 seconds';

  select room.* into matched_room
  from public.duel_rooms as room
  where room.status = 'waiting'
    and room.mode = 'quick_match'
    and room.player_two_id is null
    and room.player_one_id <> trim(p_player_id)
    and room.created_at >= now() - interval '30 seconds'
    and exists (
      select 1
      from public.league_players as player
      where player.player_id = room.player_one_id
        and player.updated_at >= now() - interval '45 seconds'
    )
  order by room.created_at desc
  limit 1
  for update;

  if matched_room.id is not null then
    update public.duel_rooms as room
    set player_two_id = trim(p_player_id),
        status = 'playing',
        started_at = now(),
        ends_at = now() + interval '10 seconds'
    where room.id = matched_room.id
    returning room.* into matched_room;
    return matched_room;
  end if;

  select puzzle.letters into selected_letters
  from public.classic_puzzles as puzzle
  where jsonb_array_length(puzzle.letters) >= 3
  order by random()
  limit 1;

  if selected_letters is null then
    select letters into selected_letters
    from (
      values
        ('["K","A","L","E","M","İ"]'::jsonb),
        ('["O","Y","U","N","C","U"]'::jsonb),
        ('["D","E","N","İ","Z","L"]'::jsonb),
        ('["B","A","H","A","R","İ"]'::jsonb),
        ('["S","A","R","I","K","A"]'::jsonb)
    ) as fallback(letters)
    order by random()
    limit 1;
  end if;

  insert into public.duel_rooms (letters, player_one_id, mode)
  values (selected_letters, trim(p_player_id), 'quick_match')
  returning duel_rooms.* into matched_room;

  return matched_room;
end;
$$;

grant execute on function public.find_or_create_duel_room(text)
  to anon, authenticated;
