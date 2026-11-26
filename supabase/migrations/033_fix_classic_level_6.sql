insert into public.classic_puzzles (
  level, id, title, clue, letters, words, bonus_words, size, placements, design
)
values (
  5,
  'generated-006',
  'Kelime Bölümü 6',
  'Günlük hayattan kelimeleri bul.',
  '["K","A","L","E","M"]'::jsonb,
  '["KALEM","KALE","ELMA","KEL","MAL","KAM"]'::jsonb,
  '["EL","AL","MA","ALE"]'::jsonb,
  7,
  '{
    "KALEM":[{"row":3,"column":1,"letter":"K"},{"row":3,"column":2,"letter":"A"},{"row":3,"column":3,"letter":"L"},{"row":3,"column":4,"letter":"E"},{"row":3,"column":5,"letter":"M"}],
    "KALE":[{"row":3,"column":1,"letter":"K"},{"row":4,"column":1,"letter":"A"},{"row":5,"column":1,"letter":"L"},{"row":6,"column":1,"letter":"E"}],
    "ELMA":[{"row":3,"column":4,"letter":"E"},{"row":4,"column":4,"letter":"L"},{"row":5,"column":4,"letter":"M"},{"row":6,"column":4,"letter":"A"}],
    "KEL":[{"row":1,"column":3,"letter":"K"},{"row":2,"column":3,"letter":"E"},{"row":3,"column":3,"letter":"L"}],
    "MAL":[{"row":3,"column":5,"letter":"M"},{"row":4,"column":5,"letter":"A"},{"row":5,"column":5,"letter":"L"}],
    "KAM":[{"row":1,"column":3,"letter":"K"},{"row":1,"column":4,"letter":"A"},{"row":1,"column":5,"letter":"M"}]
  }'::jsonb,
  '{"band":"varied","minWordLength":3,"maxWordLength":5,"rarity":"common","isRelief":false,"hintLimit":null,"blockedLetters":[],"specialGoal":"none"}'::jsonb
)
on conflict (level) do update set
  id = excluded.id,
  title = excluded.title,
  clue = excluded.clue,
  letters = excluded.letters,
  words = excluded.words,
  bonus_words = excluded.bonus_words,
  size = excluded.size,
  placements = excluded.placements,
  design = excluded.design;
