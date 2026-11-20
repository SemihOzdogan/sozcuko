-- Aynı kelimeyi bulan oyuncuların puanı farklı olmalıdır.
-- submit_duel_word oda satırını kilitlediği için trigger içindeki kontrol,
-- eşzamanlı iki gönderimde de yalnızca ilk oyuncuya bonus verir.

create or replace function public.apply_duel_word_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_word text := upper(trim(new.word));
  base_points integer;
  word_already_found boolean;
begin
  base_points := case
    when length(normalized_word) >= 6 then 50
    when length(normalized_word) = 5 then 35
    when length(normalized_word) = 4 then 20
    else 10
  end;

  select exists (
    select 1
    from public.duel_events as existing_event
    where existing_event.room_id = new.room_id
      and existing_event.word = normalized_word
  ) into word_already_found;

  new.word := normalized_word;
  new.points := base_points + case
    when word_already_found then 0
    else 20
  end;

  return new;
end;
$$;

drop trigger if exists duel_events_apply_word_score on public.duel_events;

create trigger duel_events_apply_word_score
before insert on public.duel_events
for each row
execute function public.apply_duel_word_score();

