-- Önceki migration uygulanmadan kaydedilmiş düello olaylarını düzeltir.
-- Aynı kelimenin ilk kaydı +20 hız bonusu alır; sonraki kayıtlar temel puanda kalır.

with ranked_events as (
  select
    id,
    row_number() over (
      partition by room_id, upper(trim(word))
      order by created_at asc, id asc
    ) as word_rank
  from public.duel_events
), scored_events as (
  select
    duel_event.id,
    (
      case
        when length(upper(trim(duel_event.word))) >= 6 then 50
        when length(upper(trim(duel_event.word))) = 5 then 35
        when length(upper(trim(duel_event.word))) = 4 then 20
        else 10
      end
      + case when ranked_event.word_rank = 1 then 20 else 0 end
    ) as points
  from public.duel_events as duel_event
  join ranked_events as ranked_event on ranked_event.id = duel_event.id
)
update public.duel_events as duel_event
set points = scored_event.points
from scored_events as scored_event
where scored_event.id = duel_event.id;

-- 008'in trigger'ı daha önce uygulanmadıysa burada da kurulur.
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
      and upper(trim(existing_event.word)) = normalized_word
  ) into word_already_found;

  new.word := normalized_word;
  new.points := base_points + case when word_already_found then 0 else 20 end;
  return new;
end;
$$;

drop trigger if exists duel_events_apply_word_score on public.duel_events;
create trigger duel_events_apply_word_score
before insert on public.duel_events
for each row
execute function public.apply_duel_word_score();

