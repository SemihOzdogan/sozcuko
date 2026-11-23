-- Hızlı eşleşme kuyruğundaki oyuncuya doğrudan davet gönderilemesin.

create or replace function public.create_duel_invitation(
  p_player_id text,
  p_opponent_id text
)
returns public.duel_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  created_room public.duel_rooms;
  selected_letters jsonb;
begin
  if nullif(trim(p_player_id), '') is null
    or nullif(trim(p_opponent_id), '') is null
    or trim(p_player_id) = trim(p_opponent_id) then
    raise exception 'Geçerli oyuncular gerekli';
  end if;

  if exists (
    select 1
    from public.duel_matchmaking_queue
    where player_id = trim(p_opponent_id)
  ) then
    raise exception 'Bu oyuncu hızlı eşleşme arıyor';
  end if;

  select puzzle.letters into selected_letters
  from public.classic_puzzles as puzzle
  where jsonb_array_length(puzzle.letters) >= 3
    and not exists (
      select 1
      from public.duel_rooms as previous_room
      where (previous_room.player_one_id in (trim(p_player_id), trim(p_opponent_id))
        or previous_room.player_two_id in (trim(p_player_id), trim(p_opponent_id)))
        and previous_room.letters = puzzle.letters
    )
  order by random()
  limit 1;

  if selected_letters is null then
    select fallback.letters into selected_letters
    from (
      values
        ('["K","A","L","E","M","İ"]'::jsonb),
        ('["O","Y","U","N","C","U"]'::jsonb),
        ('["D","E","N","İ","Z","L"]'::jsonb),
        ('["B","A","H","A","R","İ"]'::jsonb),
        ('["S","A","R","I","K","A"]'::jsonb),
        ('["T","A","R","İ","H","İ"]'::jsonb),
        ('["G","Ü","N","E","Ş","İ"]'::jsonb),
        ('["Ç","İ","Ç","E","K","L"]'::jsonb)
    ) as fallback(letters)
    where not exists (
      select 1
      from public.duel_rooms as previous_room
      where (previous_room.player_one_id in (trim(p_player_id), trim(p_opponent_id))
        or previous_room.player_two_id in (trim(p_player_id), trim(p_opponent_id)))
        and previous_room.letters = fallback.letters
    )
    order by random()
    limit 1;
  end if;

  if selected_letters is null then
    raise exception 'Bu oyuncular için yeni harf seti kalmadı';
  end if;

  insert into public.duel_rooms
    (letters, player_one_id, player_two_id, mode, status)
  values
    (selected_letters, trim(p_player_id), trim(p_opponent_id), 'invitation', 'waiting')
  returning * into created_room;

  return created_room;
end;
$$;

grant execute on function public.create_duel_invitation(text, text)
  to anon, authenticated;
