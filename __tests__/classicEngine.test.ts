import {
  createClassicEngineState,
  submitClassicWord,
} from '../src/game/classicEngine';
import type { ClassicPuzzle } from '../src/game/classicPuzzles';

const puzzle: ClassicPuzzle = {
  id: 'level-6',
  title: 'Bölüm 6',
  clue: '',
  letters: ['K', 'A', 'L', 'E', 'M'],
  words: ['KALEM'],
  bonusWords: [],
  size: 1,
  placements: {
    KALEM: [{ row: 0, column: 0, letter: 'K' }],
  },
};

describe('classic word submission', () => {
  it('accepts a target even when the puzzle payload uses different casing', () => {
    const result = submitClassicWord(
      {
        ...puzzle,
        words: ['kalem'],
        placements: { kalem: puzzle.placements.KALEM },
      },
      createClassicEngineState(),
      'kalem',
      false,
    );

    expect(result.kind).toBe('target');
    if (result.kind !== 'target') throw new Error('Expected target word');
    expect(result.complete).toBe(true);
  });
});
