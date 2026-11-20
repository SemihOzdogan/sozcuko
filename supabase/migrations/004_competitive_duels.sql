alter table public.duel_rooms
  add column if not exists finished_at timestamptz,
  add column if not exists league_recorded boolean not null default false;

create unique index if not exists duel_events_room_player_word_idx
  on public.duel_events (room_id, player_id, word);

drop policy if exists "public can create duel events" on public.duel_events;

create or replace function public.submit_duel_word(
  p_room_id uuid,
  p_player_id text,
  p_word text
)
returns public.duel_events
language plpgsql
security definer
set search_path = public
as $$
declare
  current_room public.duel_rooms;
  normalized_word text := upper(trim(p_word));
  event public.duel_events;
  required_letter text;
  required_count integer;
  available_count integer;
begin
  select * into current_room
  from public.duel_rooms
  where id = p_room_id
  for update;

  if current_room.id is null then
    raise exception 'Düello odası bulunamadı';
  end if;

  if current_room.status <> 'playing' then
    raise exception 'Düello aktif değil';
  end if;

  if current_room.ends_at is not null and current_room.ends_at <= now() then
    raise exception 'Düello süresi doldu';
  end if;

  if p_player_id is null
    or (
      p_player_id <> current_room.player_one_id
      and (current_room.player_two_id is null
        or p_player_id <> current_room.player_two_id)
    ) then
    raise exception 'Oyuncu bu düelloda değil';
  end if;

  if normalized_word = '' or length(normalized_word) < 3 then
    raise exception 'Geçersiz kelime';
  end if;

  if not exists (
    select 1 from public.words
    where upper(word) = normalized_word
      and (approved = true or source = 'tdk-autocomplete')
  ) then
    raise exception 'Kelime sözlükte bulunamadı';
  end if;

  foreach required_letter in array regexp_split_to_array(normalized_word, '') loop
    select count(*) into required_count
    from regexp_split_to_table(normalized_word, '') as value
    where value = required_letter;
    select count(*) into available_count
    from jsonb_array_elements_text(current_room.letters) as value
    where upper(value) = required_letter;
    if required_count > available_count then
      raise exception 'Kelime bu turun harfleriyle oluşturulamıyor';
    end if;
  end loop;

  insert into public.duel_events (room_id, player_id, word, points)
  values (
    p_room_id,
    p_player_id,
    normalized_word,
    case
      when length(normalized_word) >= 6 then 50
      when length(normalized_word) = 5 then 35
      when length(normalized_word) = 4 then 20
      else 10
    end
  )
  on conflict (room_id, player_id, word) do nothing
  returning * into event;

  if event.id is null then
    raise exception 'Bu kelimeyi zaten buldun';
  end if;

  return event;
end;
$$;

grant execute on function public.submit_duel_word(uuid, text, text)
  to anon, authenticated;

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
