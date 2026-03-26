import type { Difficulty, DifficultyRules } from '../Difficulty';
import type { Bullet } from './Bullet';
import type { BaseEnemy } from './enemies/BaseEnemy';
import type { Particle } from './Particle';
import type { Player } from './Player';
import type { Tile } from './Tile';

export interface GameState {
  player: Player;
  projectiles: Bullet[];
  particles: Particle[];
  tiles: Tile[];
  enemies: BaseEnemy[];
  score: number;
  time: number;
  difficulty: Difficulty;
  rules: DifficultyRules;
  debugFlags: {
    stopSpawning: boolean;
    godMode: boolean;
    noCooldowns: boolean;
    showWaveDebug: boolean;
  };
}
