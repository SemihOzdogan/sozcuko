-- İstemci skorunu finish_duel ile aynı server-side puan kaynağına bağlar.

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
  base_points integer;
  word_already_found boolean;
begin
  select room.* into current_room
  from public.duel_rooms as room
  where room.id = p_room_id
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
    or (p_player_id <> current_room.player_one_id
      and (current_room.player_two_id is null
        or p_player_id <> current_room.player_two_id)) then
    raise exception 'Oyuncu bu düelloda değil';
  end if;
  if normalized_word = '' or length(normalized_word) < 3 then
    raise exception 'Geçersiz kelime';
  end if;
  if not exists (
    select 1 from public.words as dictionary_word
    where upper(dictionary_word.word) = normalized_word
      and (dictionary_word.approved = true
        or dictionary_word.source = 'tdk-autocomplete')
  ) then
    raise exception 'Kelime sözlükte bulunamadı';
  end if;

  foreach required_letter in array regexp_split_to_array(normalized_word, '') loop
    select count(*) into required_count
    from regexp_split_to_table(normalized_word, '') as word_letter
    where word_letter = required_letter;
    select count(*) into available_count
    from jsonb_array_elements_text(current_room.letters) as room_letter
    where upper(room_letter) = required_letter;
    if required_count > available_count then
      raise exception 'Kelime bu turun harfleriyle oluşturulamıyor';
    end if;
  end loop;

  base_points := case
    when length(normalized_word) >= 6 then 50
    when length(normalized_word) = 5 then 35
    when length(normalized_word) = 4 then 20
    else 10
  end;

  select exists (
    select 1
    from public.duel_events as existing_event
    where existing_event.room_id = p_room_id
      and existing_event.word = normalized_word
  ) into word_already_found;

  insert into public.duel_events (room_id, player_id, word, points)
  values (
    p_room_id,
    p_player_id,
    normalized_word,
    base_points + case when word_already_found then 0 else 20 end
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
