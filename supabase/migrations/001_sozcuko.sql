create table if not exists public.words (
  word text primary key,
  approved boolean not null default false,
  source text not null default 'manual'
);

create table if not exists public.classic_puzzles (
  level integer primary key,
  id text not null unique,
  title text not null,
  clue text not null,
  letters jsonb not null,
  words jsonb not null,
  bonus_words jsonb not null default '[]'::jsonb,
  size integer not null,
  placements jsonb not null
);

alter table public.words enable row level security;
alter table public.classic_puzzles enable row level security;

create policy "public can read approved words" on public.words
  for select using (approved = true or source = 'tdk-autocomplete');
create policy "public can read puzzles" on public.classic_puzzles
  for select using (true);

create or replace function public.validate_word(input_word text)
returns boolean language sql stable security invoker as $$
  select exists (
    select 1 from public.words
    where upper(word) = upper(input_word)
      and (approved = true or source = 'tdk-autocomplete')
  );
$$;

create or replace function public.find_words(input_letters text, result_limit integer default 100)
returns table(word text) language plpgsql stable security invoker as $$
declare
  candidate record;
  letter text;
  required_count integer;
  available_count integer;
  candidate_valid boolean;
  result_count integer := 0;
begin
  if result_limit <= 0 then
    return;
  end if;
  for candidate in
    select w.word from public.words w
    where (w.approved = true or w.source = 'tdk-autocomplete')
      and length(w.word) between 4 and 6
    order by length(w.word) desc, w.word
  loop
    candidate_valid := true;
    foreach letter in array regexp_split_to_array(upper(candidate.word), '') loop
      select count(*) into required_count
      from regexp_split_to_table(upper(candidate.word), '') as value
      where value = letter;
      select count(*) into available_count
      from regexp_split_to_table(upper(input_letters), '') as value
      where value = letter;
      if required_count > available_count then
        candidate_valid := false;
        exit;
      end if;
    end loop;
    if not candidate_valid then
      continue;
    end if;
    word := candidate.word;
    return next;
    result_count := result_count + 1;
    if result_count >= greatest(0, least(result_limit, 100)) then
      return;
    end if;
  end loop;
end;
$$;

create or replace function public.get_daily_puzzle(requested_date date default current_date)
returns table(date date, puzzle jsonb) language sql stable security invoker as $$
  select requested_date,
    to_jsonb(p) - 'level'
  from public.classic_puzzles p
  order by p.level
  offset (abs(requested_date - date '1970-01-01') % greatest((select count(*) from public.classic_puzzles), 1))
  limit 1;
$$;
