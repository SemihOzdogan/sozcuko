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
  /^[A-ZÇĞİÖŞÜÂÎÛ]{4,6}$/u.test(word) &&
  !blockedPuzzleWords.has(word) &&
  !/(?:ILMEK|ILME|MAK|MEK|LEŞMEK|LEŞME|TIRMAK|TIRMA)$/u.test(word);
const acceptedWords = words
  .filter(item => item.approved === true || item.source === 'tdk-autocomplete')
  .map(item => normalize(item.word))
  .filter(isGameWord);
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
const createGeneratedPuzzles = targetCount => {
  const generated = [];
  const usedBases = new Set(seedPuzzles.map(puzzle => puzzle.words[0]));
  const basePool = shuffled(
    acceptedWords.filter(word => word.length >= 5 && word.length <= 6),
  );
  const candidatePool = shuffled(acceptedWords);
  let lastBase = seedPuzzles.at(-1)?.words[0] ?? '';
  for (const base of basePool) {
    if (generated.length >= targetCount || usedBases.has(base)) continue;
    if (generated.length % 2 === 0 && !/[ÇĞİÖŞÜ]/u.test(base)) continue;
    if (
      lastBase &&
      (base[0] === lastBase[0] || base.slice(0, 2) === lastBase.slice(0, 2))
    )
      continue;
    const selected = [];
    const usedColumns = new Set();
    const verticalTarget = Math.min(3, 2 + Math.floor(generated.length / 20));
    const row = 3 + (generated.length % 3);
    const startColumn = generated.length % 2;
    const availableColumn = index =>
      !usedColumns.has(index) &&
      [...usedColumns].every(existing => Math.abs(existing - index) > 1);
    for (const candidate of candidatePool) {
      if (
        candidate === base ||
        candidate.length < 4 ||
        candidate.length > 4 ||
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
      id: `generated-${String(generated.length + 5).padStart(3, '0')}`,
      title: `Kelime Bölümü ${generated.length + 5}`,
      clue: 'Kesişen kelimeleri bul.',
      letters: [...base],
      words: selectedWords,
      bonusWords,
      size: 9,
      placements,
    });
    usedBases.add(base);
    lastBase = base;
  }
  return generated;
};
const puzzles = [...seedPuzzles, ...createGeneratedPuzzles(96)].slice(0, 100);
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
