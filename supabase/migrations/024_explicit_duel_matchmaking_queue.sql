-- Bekleyen oda tek başına oyuncunun hâlâ arama yaptığını göstermez.
-- Hızlı eşleşmeyi açık bir kuyrukla ayırır; eski odalar yeni oturumu başlatamaz.

create table if not exists public.duel_matchmaking_queue (
  player_id text primary key,
  room_id uuid not null references public.duel_rooms(id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index if not exists duel_matchmaking_queue_requested_at_idx
  on public.duel_matchmaking_queue (requested_at);

alter table public.duel_matchmaking_queue enable row level security;

drop policy if exists "public can read duel matchmaking queue"
  on public.duel_matchmaking_queue;
create policy "public can read duel matchmaking queue"
  on public.duel_matchmaking_queue for select using (true);

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

  -- Aynı oyuncunun tekrar basması yeni oda açmasın.
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
  returning * into current_room;

  insert into public.duel_matchmaking_queue (player_id, room_id)
  values (trim(p_player_id), current_room.id);

  return current_room;
end;
$$;

create or replace function public.cancel_waiting_duel(
  p_room_id uuid,
  p_player_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.duel_matchmaking_queue
  where player_id = trim(p_player_id)
    and room_id = p_room_id;

  update public.duel_rooms
  set status = 'finished', finished_at = now()
  where id = p_room_id
    and player_one_id = trim(p_player_id)
    and status = 'waiting';
end;
$$;

grant execute on function public.find_or_create_duel_room(text)
  to anon, authenticated;
grant execute on function public.cancel_waiting_duel(uuid, text)
  to anon, authenticated;
