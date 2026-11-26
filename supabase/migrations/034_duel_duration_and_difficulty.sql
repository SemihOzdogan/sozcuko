alter table public.duel_rooms
  add column if not exists difficulty text not null default 'normal';

alter table public.duel_rooms
  drop constraint if exists duel_rooms_difficulty_check;

alter table public.duel_rooms
  add constraint duel_rooms_difficulty_check
  check (difficulty in ('easy', 'normal', 'hard'));

create or replace function public.set_duel_duration()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'playing' then
    new.ends_at := now() + interval '60 seconds';
  end if;
  return new;
end;
$$;

drop trigger if exists duel_rooms_set_duration on public.duel_rooms;
create trigger duel_rooms_set_duration
before insert or update of status, ends_at on public.duel_rooms
for each row execute function public.set_duel_duration();

drop function if exists public.create_duel_invitation(text, text);

create or replace function public.create_duel_invitation(
  p_player_id text,
  p_opponent_id text,
  p_difficulty text default 'normal'
)
returns public.duel_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  created_room public.duel_rooms;
  selected_letters jsonb;
  requested_difficulty text := lower(coalesce(nullif(trim(p_difficulty), ''), 'normal'));
begin
  if requested_difficulty not in ('easy', 'normal', 'hard') then
    raise exception 'Geçersiz düello zorluğu';
  end if;
  if nullif(trim(p_player_id), '') is null
    or nullif(trim(p_opponent_id), '') is null
    or trim(p_player_id) = trim(p_opponent_id) then
    raise exception 'Geçerli oyuncular gerekli';
  end if;

  select puzzle.letters into selected_letters
  from public.classic_puzzles as puzzle
  where jsonb_array_length(puzzle.letters) >= 3
    and case requested_difficulty
      when 'easy' then jsonb_array_length(puzzle.letters) <= 5
      when 'normal' then jsonb_array_length(puzzle.letters) = 6
      when 'hard' then jsonb_array_length(puzzle.letters) >= 7
    end
    and not exists (
      select 1 from public.duel_rooms as previous_room
      where previous_room.letters = puzzle.letters
        and (previous_room.player_one_id in (trim(p_player_id), trim(p_opponent_id))
          or previous_room.player_two_id in (trim(p_player_id), trim(p_opponent_id)))
    )
  order by random()
  limit 1;

  if selected_letters is null then
    select puzzle.letters into selected_letters
    from public.classic_puzzles as puzzle
    where jsonb_array_length(puzzle.letters) >= 3
    order by random()
    limit 1;
  end if;
  if selected_letters is null then
    raise exception 'Düello için uygun harf seti kalmadı';
  end if;

  insert into public.duel_rooms
    (letters, player_one_id, player_two_id, mode, status, difficulty)
  values
    (selected_letters, trim(p_player_id), trim(p_opponent_id), 'invitation', 'waiting', requested_difficulty)
  returning * into created_room;
  return created_room;
end;
$$;

grant execute on function public.create_duel_invitation(text, text, text)
  to anon, authenticated;
