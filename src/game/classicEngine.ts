import type { ClassicPuzzle, PuzzlePlacement } from './classicPuzzles';
export const normalizeTurkishWord = (value: string): string =>
  value.trim().toLocaleUpperCase('tr-TR');

export type ClassicEngineState = {
  solvedWords: string[];
  bonusWords: string[];
  revealedCells: Record<string, string>;
};

export type SubmitWordResult =
  | {
      kind: 'target';
      word: string;
      state: ClassicEngineState;
      complete: boolean;
    }
  | { kind: 'bonus'; word: string; state: ClassicEngineState }
  | { kind: 'duplicate'; word: string; state: ClassicEngineState }
  | { kind: 'invalid'; word: string; state: ClassicEngineState };

export const createClassicEngineState = (): ClassicEngineState => ({
  solvedWords: [],
  bonusWords: [],
  revealedCells: {},
});

const revealPlacement = (
  cells: Record<string, string>,
  placement: PuzzlePlacement[],
): Record<string, string> => {
  const next = { ...cells };
  placement.forEach(slot => {
    next[`${slot.row}:${slot.column}`] = slot.letter;
  });
  return next;
};

export const submitClassicWord = (
  puzzle: ClassicPuzzle,
  state: ClassicEngineState,
  rawWord: string,
  isValidBonusWord: boolean,
): SubmitWordResult => {
  const word = normalizeTurkishWord(rawWord);
  if (!word) return { kind: 'invalid', word, state };

  if (state.solvedWords.includes(word) || state.bonusWords.includes(word)) {
    return { kind: 'duplicate', word, state };
  }

  const targetWord = puzzle.words.find(
    puzzleWord => normalizeTurkishWord(puzzleWord) === word,
  );
  if (targetWord) {
    const nextSolvedWords = [...state.solvedWords, word];
    const nextState = {
      solvedWords: nextSolvedWords,
      bonusWords: state.bonusWords,
      revealedCells: revealPlacement(
        state.revealedCells,
        puzzle.placements[targetWord] ?? puzzle.placements[word] ?? [],
      ),
    };
    return {
      kind: 'target',
      word,
      state: nextState,
      complete: nextSolvedWords.length === puzzle.words.length,
    };
  }

  if (puzzle.bonusWords.includes(word) || isValidBonusWord) {
    return {
      kind: 'bonus',
      word,
      state: { ...state, bonusWords: [...state.bonusWords, word] },
    };
  }

  return { kind: 'invalid', word, state };
};

export const validateClassicPuzzle = (puzzle: ClassicPuzzle): string[] => {
  const errors: string[] = [];
  const cells = new Map<string, string>();
  puzzle.words.forEach(word => {
    const placement = puzzle.placements[word];
    if (!placement || placement.length !== word.length) {
      errors.push(`${word}: placement uzunluğu kelimeyle eşleşmiyor`);
      return;
    }
    placement.forEach((slot, index) => {
      if (
        slot.row < 0 ||
        slot.column < 0 ||
        slot.row >= puzzle.size ||
        slot.column >= puzzle.size
      ) {
        errors.push(`${word}: ızgara sınırı dışında`);
      }
      if (slot.letter !== word[index])
        errors.push(`${word}: ${index}. harf placement ile eşleşmiyor`);
      const key = `${slot.row}:${slot.column}`;
      const existing = cells.get(key);
      if (existing && existing !== slot.letter)
        errors.push(`${key}: çakışan harfler (${existing}/${slot.letter})`);
      cells.set(key, slot.letter);
    });
  });
  return errors;
};

export const assertClassicPuzzlesValid = (puzzles: ClassicPuzzle[]): void => {
  const errors = puzzles.flatMap(puzzle =>
    validateClassicPuzzle(puzzle).map(error => `${puzzle.id}: ${error}`),
  );
  if (errors.length > 0)
    console.error(
      `[ClassicEngine] Geçersiz puzzle verisi: ${errors.join('; ')}`,
    );
};
