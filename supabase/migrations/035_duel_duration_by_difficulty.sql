create or replace function public.set_duel_duration()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'playing' then
    new.ends_at := now() + case new.difficulty
      when 'easy' then interval '90 seconds'
      when 'hard' then interval '45 seconds'
      else interval '60 seconds'
    end;
  end if;
  return new;
end;
$$;
