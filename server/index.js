const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, 'data');
const seedPuzzles = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'puzzles.json'), 'utf8'),
);
const words = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'words.json'), 'utf8'),
);
const normalize = value =>
  String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR');
const blockedPuzzleWords = new Set(['ADIL', 'AHFAT', 'AHFATT', 'SEDALI']);
const isGameWord = word =>
  /^[A-ZÇĞİÖŞÜÂÎÛ]{3,7}$/u.test(word) &&
  !blockedPuzzleWords.has(word) &&
  !/(?:ILMEK|ILME|MAK|MEK|LEŞMEK|LEŞME|TIRMAK|TIRMA)$/u.test(word);
const acceptedWords = words
  .filter(item => item.approved === true || item.source === 'tdk-autocomplete')
  .map(item => normalize(item.word))
  .filter(isGameWord);
const commonWords = new Set([
  'ABA',
  'ADA',
  'AĞA',
  'AİLE',
  'AKIL',
  'ALAN',
  'ANNE',
  'ARABA',
  'ARI',
  'ARKA',
  'AŞK',
  'ATEŞ',
  'AYAK',
  'BAHÇE',
  'BAHAR',
  'BALIK',
  'BABA',
  'BEŞ',
  'BİLGİ',
  'BİNA',
  'BİZ',
  'BOŞ',
  'BUZ',
  'ÇAY',
  'ÇOCUK',
  'ÇORAP',
  'DAĞ',
  'DERS',
  'DOST',
  'EL',
  'ELMA',
  'EV',
  'GECE',
  'GÖL',
  'GÖZ',
  'GÜN',
  'GÜNEŞ',
  'HAVA',
  'HAYAT',
  'İKİ',
  'İNSAN',
  'İŞ',
  'KAPI',
  'KALEM',
  'KALP',
  'KARA',
  'KAR',
  'KEDİ',
  'KELİME',
  'KİTAP',
  'KOL',
  'KUŞ',
  'MASA',
  'MAVİ',
  'MEKTUP',
  'MİSAFİR',
  'OKUL',
  'OYUN',
  'PARA',
  'SAAT',
  'SABAH',
  'SES',
  'SÖZ',
  'SU',
  'TAŞ',
  'TOP',
  'YAZ',
  'YOL',
]);
const levelDesign = level => {
  const section = level + 1;
  const isRelief = section > 1 && section % 10 === 0;
  if (section <= 5)
    return {
      band: 'tutorial',
      minWordLength: 3,
      maxWordLength: 4,
      rarity: 'common',
      isRelief,
      hintLimit: null,
      blockedLetters: [],
      specialGoal: 'none',
    };
  if (section <= 10)
    return {
      band: 'varied',
      minWordLength: 4,
      maxWordLength: 4,
      rarity: 'common',
      isRelief,
      hintLimit: null,
      blockedLetters: [],
      specialGoal: 'none',
    };
  if (section <= 20)
    return {
      band: 'five-letter',
      minWordLength: 5,
      maxWordLength: 5,
      rarity: isRelief ? 'varied' : 'less-common',
      isRelief,
      hintLimit: null,
      blockedLetters: [],
      specialGoal: 'none',
    };
  if (section <= 35)
    return {
      band: 'mixed-five-six',
      minWordLength: 5,
      maxWordLength: 6,
      rarity: isRelief ? 'varied' : 'less-common',
      isRelief,
      hintLimit: null,
      blockedLetters: [],
      specialGoal: isRelief ? 'none' : 'limited-moves',
    };
  if (section <= 50)
    return {
      band: 'advanced',
      minWordLength: 6,
      maxWordLength: 7,
      rarity: isRelief ? 'varied' : 'less-common',
      isRelief,
      hintLimit: null,
      blockedLetters: [],
      specialGoal: isRelief ? 'none' : 'limited-moves',
    };
  return {
    band: 'mixed',
    minWordLength: 3,
    maxWordLength: 7,
    rarity: 'mixed',
    isRelief,
    hintLimit: null,
    blockedLetters: [],
    specialGoal: isRelief ? 'none' : 'blocked-letters',
  };
};
const findabilityScore = word =>
  (commonWords.has(word) ? 2 : 0) - Math.max(0, word.length - 5);
const shuffled = values => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};
const canBuild = (word, letters) => {
  const available = [...letters].reduce(
    (counts, letter) => counts.set(letter, (counts.get(letter) || 0) + 1),
    new Map(),
  );
  return [...word].every(letter => {
    const count = available.get(letter) || 0;
    if (!count) return false;
    available.set(letter, count - 1);
    return true;
  });
};
const placement = (word, row, column, direction) =>
  [...word].map((letter, index) =>
    direction === 'horizontal'
      ? { row, column: column + index, letter }
      : { row: row + index, column, letter },
  );
const curatedCampaignPuzzles = {
  5: {
    id: 'generated-006',
    title: 'Kelime Bölümü 6',
    clue: 'Günlük hayattan kelimeleri bul.',
    letters: ['K', 'A', 'L', 'E', 'M'],
    words: ['KALEM', 'KALE', 'ELMA', 'KEL', 'MAL', 'KAM'],
    bonusWords: ['EL', 'AL', 'MA', 'ALE'],
    size: 7,
    placements: {
      KALEM: placement('KALEM', 3, 1, 'horizontal'),
      KALE: placement('KALE', 3, 1, 'vertical'),
      ELMA: placement('ELMA', 3, 4, 'vertical'),
      KEL: placement('KEL', 1, 3, 'vertical'),
      MAL: placement('MAL', 3, 5, 'vertical'),
      KAM: placement('KAM', 1, 3, 'horizontal'),
    },
  },
};
const createGeneratedPuzzles = targetCount => {
  const generated = [];
  const usedBases = new Set();
  const basePool = shuffled(
    [...acceptedWords].sort(
      (a, b) => findabilityScore(b) - findabilityScore(a),
    ),
  );
  const candidatePool = shuffled(acceptedWords);
  let lastBase = '';
  for (const base of basePool) {
    const level = generated.length;
    if (level >= targetCount || usedBases.has(base)) continue;
    const curatedPuzzle = curatedCampaignPuzzles[level];
    if (curatedPuzzle) {
      generated.push({
        ...curatedPuzzle,
        design: {
          ...levelDesign(level),
          minWordLength: 3,
          maxWordLength: 5,
        },
      });
      usedBases.add(base);
      continue;
    }
    const design = levelDesign(level);
    if (
      base.length < design.minWordLength ||
      base.length > design.maxWordLength
    )
      continue;
    // Common words are preferred in the first bands by the pool ordering;
    // do not hard-filter them, otherwise a sparse dictionary can end the
    // campaign before the later difficulty bands are generated.
    const selected = [];
    const usedColumns = new Set();
    const verticalTarget = Math.min(3, 2 + Math.floor(level / 20));
    const row = 3 + (level % 3);
    const startColumn = level % 2;
    const availableColumn = index =>
      !usedColumns.has(index) &&
      [...usedColumns].every(existing => Math.abs(existing - index) > 1);
    for (const candidate of candidatePool) {
      if (
        candidate === base ||
        candidate.length < design.minWordLength ||
        candidate.length > design.maxWordLength ||
        !canBuild(candidate, base)
      )
        continue;
      const index = [...candidate].findIndex((letter, candidateIndex) => {
        const baseIndex = [...base].findIndex(
          (baseLetter, index) =>
            baseLetter === letter &&
            startColumn + index <= 8 &&
            availableColumn(index),
        );
        return (
          baseIndex >= 0 &&
          candidateIndex <= row &&
          row - candidateIndex + candidate.length - 1 <= 8
        );
      });
      if (index < 0) continue;
      const letter = candidate[index];
      const column = [...base].findIndex(
        (baseLetter, baseIndex) =>
          baseLetter === letter &&
          startColumn + baseIndex <= 8 &&
          availableColumn(baseIndex),
      );
      if (column < 0) continue;
      selected.push({ word: candidate, wordIndex: index, column });
      usedColumns.add(column);
      if (selected.length === verticalTarget) break;
    }
    if (selected.length < 2) continue;
    const placements = {
      [base]: placement(base, row, startColumn, 'horizontal'),
    };
    selected.forEach(item => {
      placements[item.word] = placement(
        item.word,
        row - item.wordIndex,
        item.column + startColumn,
        'vertical',
      );
    });
    const selectedWords = [base, ...selected.map(item => item.word)];
    const bonusWords = acceptedWords
      .filter(
        word =>
          word !== base &&
          !selectedWords.includes(word) &&
          canBuild(word, base),
      )
      .slice(0, 3);
    generated.push({
      id: `generated-${String(level + 1).padStart(3, '0')}`,
      title: `Kelime Bölümü ${level + 1}`,
      clue: 'Kesişen kelimeleri bul.',
      letters: [...base],
      words: selectedWords,
      bonusWords,
      size: 9,
      placements,
      design,
    });
    usedBases.add(base);
    lastBase = base;
  }
  return generated;
};
const puzzles = createGeneratedPuzzles(100);
const dailyPuzzles = seedPuzzles;
const getDailyDate = () => new Date().toISOString().slice(0, 10);
const getDailyPuzzle = requestedDate => {
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(requestedDate ?? '')
    ? requestedDate
    : getDailyDate();
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  return {
    date,
    puzzle: dailyPuzzles[Math.abs(dayNumber) % dailyPuzzles.length],
  };
};
const json = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(body));
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (request.method !== 'GET')
    return json(response, 405, { error: 'method_not_allowed' });
  if (url.pathname === '/api/v1/puzzles/classic') {
    const level = Number(url.searchParams.get('level') ?? 0);
    const puzzle = puzzles[level];
    return puzzle
      ? json(response, 200, { data: { puzzle, totalPuzzles: puzzles.length } })
      : json(response, 404, { error: 'puzzle_not_found' });
  }
  if (url.pathname === '/api/v1/daily/puzzle') {
    return json(response, 200, {
      data: getDailyPuzzle(url.searchParams.get('date')),
    });
  }
  if (url.pathname === '/api/v1/words/validate') {
    const word = normalize(url.searchParams.get('word'));
    return json(response, 200, {
      data: {
        valid:
          !blockedPuzzleWords.has(word) &&
          words.some(
            item =>
              normalize(item.word) === word &&
              (item.approved === true || item.source === 'tdk-autocomplete'),
          ),
      },
    });
  }
  if (url.pathname === '/api/v1/words/find') {
    const letters = normalize(url.searchParams.get('letters'));
    const requestedTake = Number(url.searchParams.get('take') ?? 100);
    const take = Number.isFinite(requestedTake)
      ? Math.max(0, Math.min(requestedTake, 100))
      : 100;
    const results = words
      .filter(
        item =>
          isGameWord(normalize(item.word)) &&
          [...normalize(item.word)].every(
            (letter, index, all) =>
              all.filter(value => value === letter).length <=
              [...letters].filter(value => value === letter).length,
          ),
      )
      .sort((a, b) => b.word.length - a.word.length)
      .slice(0, take)
      .map(item => ({ word: item.word }));
    return json(response, 200, { data: { results } });
  }
  return json(response, 404, { error: 'not_found' });
});

server.listen(process.env.PORT || 8787, () =>
  console.log('Sözcüko API: http://localhost:8787'),
);
