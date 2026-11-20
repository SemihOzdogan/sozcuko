-- Hızlı düello eşleşmesini tek transaction içinde yapar.

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

  select room.*
  into matched_room
  from public.duel_rooms as room
  where room.status = 'waiting'
    and room.player_two_id is null
    and room.player_one_id <> trim(p_player_id)
  order by room.created_at asc
  limit 1
  for update skip locked;

  if matched_room.id is not null then
    update public.duel_rooms as room
    set player_two_id = trim(p_player_id),
        status = 'playing',
        started_at = now(),
        ends_at = now() + interval '90 seconds'
    where room.id = matched_room.id
    returning room.* into matched_room;
    return matched_room;
  end if;

  select puzzle.letters
  into selected_letters
  from (
    values
      ('["K","A","L","E","M","İ"]'::jsonb),
      ('["O","Y","U","N","C","U"]'::jsonb),
      ('["D","E","N","İ","Z","L"]'::jsonb),
      ('["B","A","H","A","R","İ"]'::jsonb),
      ('["S","A","R","I","K","A"]'::jsonb)
  ) as puzzle(letters)
  order by random()
  limit 1;

  insert into public.duel_rooms (letters, player_one_id)
  values (selected_letters, trim(p_player_id))
  returning duel_rooms.* into matched_room;

  return matched_room;
end;
$$;

grant execute on function public.find_or_create_duel_room(text)
  to anon, authenticated;

