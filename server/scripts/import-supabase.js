const fs = require('node:fs');
const path = require('node:path');

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !secretKey) {
  throw new Error('SUPABASE_URL ve SUPABASE_SECRET_KEY gerekli.');
}

const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};
const post = async (table, body) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
};

const dataDir = path.join(__dirname, '..', 'data');
const words = JSON.parse(fs.readFileSync(path.join(dataDir, 'words.json'), 'utf8'))
  .map(item => ({ word: item.word, approved: item.approved === true, source: item.source || 'manual' }));
const mapPuzzle = (puzzle, level) => ({
    level,
    id: puzzle.id,
    title: puzzle.title,
    clue: puzzle.clue,
    letters: puzzle.letters,
    words: puzzle.words,
    bonus_words: puzzle.bonusWords || [],
    size: puzzle.size,
    placements: puzzle.placements,
  });

const loadPuzzles = async () => {
  const localApiUrl = process.env.LOCAL_API_URL || 'http://127.0.0.1:8787/api/v1';
  try {
    const firstResponse = await fetch(`${localApiUrl}/puzzles/classic?level=0`);
    if (!firstResponse.ok) throw new Error('local API unavailable');
    const firstPayload = await firstResponse.json();
    const total = firstPayload.data?.totalPuzzles ?? 100;
    const payloads = await Promise.all(
      Array.from({ length: total }, (_, level) =>
        level === 0
          ? Promise.resolve(firstPayload)
          : fetch(`${localApiUrl}/puzzles/classic?level=${level}`).then(response => response.json()),
      ),
    );
    return payloads.map((payload, level) => mapPuzzle(payload.data.puzzle, level));
  } catch {
    console.warn('Local API bulunamadı; yalnızca seed bulmacalar aktarılıyor.');
    return JSON.parse(fs.readFileSync(path.join(dataDir, 'puzzles.json'), 'utf8'))
      .map(mapPuzzle);
  }
};

(async () => {
  for (let index = 0; index < words.length; index += 500)
    await post('words', words.slice(index, index + 500));
  const puzzles = await loadPuzzles();
  await post('classic_puzzles', puzzles);
  console.log(`${words.length} kelime ve ${puzzles.length} klasik bölüm Supabase'e aktarıldı.`);
})();
