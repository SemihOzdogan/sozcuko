export type PuzzlePlacement = { row: number; column: number; letter: string };

export type ClassicPuzzle = {
  id: string;
  title: string;
  clue: string;
  letters: string[];
  words: string[];
  bonusWords: string[];
  size: number;
  placements: Record<string, PuzzlePlacement[]>;
};

// Bölüm ve kelime verisi yalnızca API’den gelir; uygulamaya gömülü puzzle yoktur.
