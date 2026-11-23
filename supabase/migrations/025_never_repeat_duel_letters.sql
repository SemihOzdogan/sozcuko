-- Oyuncuya daha önce gösterilmiş harf seti tekrar verilmesin.
-- duel_rooms geçmişi oyuncunun gördüğü setlerin kaynağı olarak kullanılır.

create or replace function public.find_or_create_duel_room(p_player_id text)
returns public.duel_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.duel_rooms;
  matched_room public.duel_rooms;
  matched_player_id text;
  selected_letters jsonb;
begin
  if p_player_id is null or length(trim(p_player_id)) = 0 then
    raise exception 'Oyuncu kimliği gerekli';
  end if;

  perform pg_advisory_xact_lock(746921);

  delete from public.duel_matchmaking_queue
  where requested_at < now() - interval '30 seconds';

  select room.* into current_room
  from public.duel_matchmaking_queue as queue
  join public.duel_rooms as room on room.id = queue.room_id
  where queue.player_id = trim(p_player_id)
    and room.status = 'waiting'
    and room.mode = 'quick_match';

  if current_room.id is not null then
    return current_room;
  end if;

  select queue.player_id into matched_player_id
  from public.duel_matchmaking_queue as queue
  join public.duel_rooms as room on room.id = queue.room_id
  where queue.player_id <> trim(p_player_id)
    and room.status = 'waiting'
    and room.mode = 'quick_match'
    and not exists (
      select 1
      from public.duel_rooms as previous_room
      where (previous_room.player_one_id = trim(p_player_id)
        or previous_room.player_two_id = trim(p_player_id))
        and previous_room.letters = room.letters
    )
  order by queue.requested_at asc
  limit 1
  for update of queue;

  if matched_player_id is not null then
    select room.* into matched_room
    from public.duel_matchmaking_queue as queue
    join public.duel_rooms as room on room.id = queue.room_id
    where queue.player_id = matched_player_id
    for update of room;

    update public.duel_rooms
    set player_two_id = trim(p_player_id),
        status = 'playing',
        started_at = now(),
        ends_at = now() + interval '10 seconds'
    where id = matched_room.id
    returning * into matched_room;

    delete from public.duel_matchmaking_queue
    where player_id in (matched_player_id, trim(p_player_id));
    return matched_room;
  end if;

  select puzzle.letters into selected_letters
  from public.classic_puzzles as puzzle
  where jsonb_array_length(puzzle.letters) >= 3
    and not exists (
      select 1
      from public.duel_rooms as previous_room
      where (previous_room.player_one_id = trim(p_player_id)
        or previous_room.player_two_id = trim(p_player_id))
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
      where (previous_room.player_one_id = trim(p_player_id)
        or previous_room.player_two_id = trim(p_player_id))
        and previous_room.letters = fallback.letters
    )
    order by random()
    limit 1;
  end if;

  if selected_letters is null then
    raise exception 'Bu oyuncu için yeni harf seti kalmadı';
  end if;

  insert into public.duel_rooms (letters, player_one_id, mode)
  values (selected_letters, trim(p_player_id), 'quick_match')
  returning * into current_room;

  insert into public.duel_matchmaking_queue (player_id, room_id)
  values (trim(p_player_id), current_room.id);

  return current_room;
end;
$$;

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

grant execute on function public.find_or_create_duel_room(text)
  to anon, authenticated;
grant execute on function public.create_duel_invitation(text, text)
  to anon, authenticated;
