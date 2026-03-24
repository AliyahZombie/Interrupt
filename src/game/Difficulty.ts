export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';

export interface DifficultyRules {
  playerDamageMultiplier: number;
  enemiesDodgeBullets: boolean;
}

export const getDifficultyRules = (difficulty: Difficulty): DifficultyRules => {
  switch (difficulty) {
    case 'EASY':
      return { playerDamageMultiplier: 0.5, enemiesDodgeBullets: false };
    case 'HARD':
      return { playerDamageMultiplier: 1.5, enemiesDodgeBullets: true };
    case 'NORMAL':
    default:
      return { playerDamageMultiplier: 1, enemiesDodgeBullets: false };
  }
};
