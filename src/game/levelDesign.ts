export type LevelBand =
  | 'tutorial'
  | 'varied'
  | 'five-letter'
  | 'mixed-five-six'
  | 'advanced'
  | 'mixed';

export type LevelDesign = {
  band: LevelBand;
  minWordLength: number;
  maxWordLength: number;
  rarity: 'common' | 'varied' | 'less-common' | 'mixed';
  isRelief: boolean;
  hintLimit: number | null;
  blockedLetters: string[];
  specialGoal: 'none' | 'timed' | 'limited-moves' | 'blocked-letters';
};

export const getLevelDesign = (level: number): LevelDesign => {
  const section = level + 1;
  const isRelief = section > 1 && section % 10 === 0;
  const base = {
    isRelief,
    blockedLetters: [],
    specialGoal: 'none' as const,
  };

  if (section <= 5)
    return {
      ...base,
      band: 'tutorial',
      minWordLength: 3,
      maxWordLength: 4,
      rarity: 'common',
      hintLimit: null,
    };
  if (section <= 10)
    return {
      ...base,
      band: 'varied',
      minWordLength: 4,
      maxWordLength: 4,
      rarity: 'common',
      hintLimit: null,
    };
  if (section <= 20)
    return {
      ...base,
      band: 'five-letter',
      minWordLength: 5,
      maxWordLength: 5,
      rarity: isRelief ? 'varied' : 'less-common',
      hintLimit: null,
    };
  if (section <= 35)
    return {
      ...base,
      band: 'mixed-five-six',
      minWordLength: 5,
      maxWordLength: 6,
      rarity: isRelief ? 'varied' : 'less-common',
      hintLimit: null,
      specialGoal: isRelief ? 'none' : 'limited-moves',
    };
  if (section <= 50)
    return {
      ...base,
      band: 'advanced',
      minWordLength: 6,
      maxWordLength: 7,
      rarity: isRelief ? 'varied' : 'less-common',
      hintLimit: null,
      specialGoal: isRelief ? 'none' : 'limited-moves',
    };
  return {
    ...base,
    band: 'mixed',
    minWordLength: 3,
    maxWordLength: 7,
    rarity: 'mixed',
    hintLimit: null,
    specialGoal: isRelief ? 'none' : 'blocked-letters',
  };
};
