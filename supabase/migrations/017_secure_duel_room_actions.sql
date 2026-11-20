-- Düello odası durum değişikliklerini istemcinin doğrudan PATCH etmesini engeller.

drop policy if exists "public can join duel rooms" on public.duel_rooms;

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
  order by random()
  limit 1;

  if selected_letters is null then
    raise exception 'Klasik puzzle harf seti bulunamadı';
  end if;

  insert into public.duel_rooms (letters, player_one_id, player_two_id, status)
  values (selected_letters, trim(p_player_id), trim(p_opponent_id), 'waiting')
  returning * into created_room;

  return created_room;
end;
$$;

create or replace function public.accept_duel_invitation(
  p_room_id uuid,
  p_player_id text
)
returns public.duel_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  started_room public.duel_rooms;
begin
  update public.duel_rooms as room
  set status = 'playing',
      started_at = now(),
      ends_at = now() + interval '10 seconds'
  where room.id = p_room_id
    and room.status = 'waiting'
    and room.player_two_id = trim(p_player_id)
  returning room.* into started_room;

  if started_room.id is null then
    raise exception 'Düello daveti geçersiz veya süresi dolmuş';
  end if;

  return started_room;
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
  update public.duel_rooms
  set status = 'finished', finished_at = now()
  where id = p_room_id
    and player_one_id = trim(p_player_id)
    and status = 'waiting';
end;
$$;

grant execute on function public.create_duel_invitation(text, text)
  to anon, authenticated;
grant execute on function public.accept_duel_invitation(uuid, text)
  to anon, authenticated;
grant execute on function public.cancel_waiting_duel(uuid, text)
  to anon, authenticated;
