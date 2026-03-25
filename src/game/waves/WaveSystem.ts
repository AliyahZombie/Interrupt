import type { Difficulty } from '../Difficulty';
import type { Rect } from '../world/types';

export type WavePhase = 'SPAWNING' | 'WAIT_CLEAR' | 'INTERMISSION';

export interface WaveState {
  index: number;
  phase: WavePhase;
  targetToSpawn: number;
  spawned: number;
  killed: number;
  startedAtMs: number;
  intermissionUntilMs: number;
  skipNextIntermission: boolean;
  cancelIntermissionAfterMs: number;
  forceNextWaveAfterMs: number;
}

export type SpawnKind = 'MELEE' | 'RANGED';

export interface SpawnRequest {
  kind: SpawnKind;
  x: number;
  y: number;
}

export interface WaveUpdateInput {
  timeMs: number;
  difficulty: Difficulty;
  stopSpawning: boolean;
  enemiesAlive: number;
  cameraX: number;
  cameraY: number;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  spawnRect?: Rect;
  rng?: () => number;
}

export interface WaveUpdateOutput {
  spawns: SpawnRequest[];
  clearEnemies: boolean;
  forcedAdvance: boolean;
}

export class WaveSystem {
  state: WaveState;
  private lastSpawnAtMs: number;

  constructor(timeMs: number, private difficulty: Difficulty) {
    this.state = {
      index: 1,
      phase: 'SPAWNING',
      targetToSpawn: 0,
      spawned: 0,
      killed: 0,
      startedAtMs: timeMs,
      intermissionUntilMs: 0,
      skipNextIntermission: false,
      cancelIntermissionAfterMs: 0,
      forceNextWaveAfterMs: 0,
    };
    this.lastSpawnAtMs = timeMs;
    this.startWave(timeMs, 1);
  }

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty;
  }

  reset(timeMs: number, difficulty: Difficulty) {
    this.difficulty = difficulty;
    this.startWave(timeMs, 1);
  }

  onEnemyKilled(count: number = 1) {
    this.state.killed += Math.max(0, count);
  }

  skipCurrentWave(timeMs: number) {
    this.startWave(timeMs, this.state.index + 1);
  }

  update(input: WaveUpdateInput): WaveUpdateOutput {
    this.setDifficulty(input.difficulty);
    if (input.stopSpawning) return { spawns: [], clearEnemies: false, forcedAdvance: false };

    const rng = input.rng ?? Math.random;
    const spawns: SpawnRequest[] = [];
    const waveAgeMs = input.timeMs - this.state.startedAtMs;

    if (this.state.phase === 'INTERMISSION') {
      if (input.timeMs >= this.state.intermissionUntilMs) {
        this.startWave(input.timeMs, this.state.index + 1);
      }
      return { spawns, clearEnemies: false, forcedAdvance: false };
    }

    if (this.state.phase === 'SPAWNING') {
      const spawnIntervalMs = this.computeWaveSpawnIntervalMs();
      const canSpawn = input.timeMs - this.lastSpawnAtMs >= spawnIntervalMs;

      if (this.state.spawned < this.state.targetToSpawn && canSpawn) {
        const req = this.createSpawnRequest(input, rng);
        spawns.push(req);
        this.state.spawned += 1;
        this.lastSpawnAtMs = input.timeMs;
      }

      if (this.state.spawned >= this.state.targetToSpawn) {
        this.state.phase = 'WAIT_CLEAR';
      }

      return { spawns, clearEnemies: false, forcedAdvance: false };
    }

    if (input.enemiesAlive <= 1 && waveAgeMs >= this.state.cancelIntermissionAfterMs) {
      this.state.skipNextIntermission = true;
    }

    if (waveAgeMs >= this.state.forceNextWaveAfterMs) {
      this.startWave(input.timeMs, this.state.index + 1);
      return { spawns, clearEnemies: false, forcedAdvance: true };
    }

    if (input.enemiesAlive === 0) {
      const delayMs = this.state.skipNextIntermission ? 0 : this.computeIntermissionMs();
      this.state.phase = 'INTERMISSION';
      this.state.intermissionUntilMs = input.timeMs + delayMs;
    }

    return { spawns, clearEnemies: false, forcedAdvance: false };
  }

  private getWaveDifficultyMultiplier() {
    if (this.difficulty === 'EASY') return 0.85;
    if (this.difficulty === 'HARD') return 1.25;
    return 1;
  }

  private computeWaveTargetCount(waveIndex: number) {
    const base = 6;
    const perWave = 2;
    const raw = base + (waveIndex - 1) * perWave;
    const scaled = Math.round(raw * this.getWaveDifficultyMultiplier());
    return Math.max(1, scaled);
  }

  private computeWaveSpawnIntervalMs() {
    const base = 650;
    const scaled = base / this.getWaveDifficultyMultiplier();
    return Math.max(320, Math.min(900, Math.round(scaled)));
  }

  private computeIntermissionMs() {
    return 2400;
  }

  private computeCancelIntermissionAfterMs(waveIndex: number) {
    return 20000 + waveIndex * 800;
  }

  private computeForceNextWaveAfterMs(waveIndex: number) {
    return 45000 + waveIndex * 1500;
  }

  private startWave(timeMs: number, waveIndex: number) {
    this.state = {
      index: waveIndex,
      phase: 'SPAWNING',
      targetToSpawn: this.computeWaveTargetCount(waveIndex),
      spawned: 0,
      killed: 0,
      startedAtMs: timeMs,
      intermissionUntilMs: 0,
      skipNextIntermission: false,
      cancelIntermissionAfterMs: this.computeCancelIntermissionAfterMs(waveIndex),
      forceNextWaveAfterMs: this.computeForceNextWaveAfterMs(waveIndex),
    };
    this.lastSpawnAtMs = timeMs;
  }

  private createSpawnRequest(input: WaveUpdateInput, rng: () => number): SpawnRequest {
    const spawnEdge = Math.floor(rng() * 4);
    let x = 0;
    let y = 0;
    const margin = 50;

    if (spawnEdge === 0) {
      x = input.cameraX + rng() * input.viewportWidth;
      y = input.cameraY - margin;
    } else if (spawnEdge === 1) {
      x = input.cameraX + input.viewportWidth + margin;
      y = input.cameraY + rng() * input.viewportHeight;
    } else if (spawnEdge === 2) {
      x = input.cameraX + rng() * input.viewportWidth;
      y = input.cameraY + input.viewportHeight + margin;
    } else {
      x = input.cameraX - margin;
      y = input.cameraY + rng() * input.viewportHeight;
    }

    const wave = this.state.index;
    const waveRangedBase = 0.2 + wave * 0.03;
    const rangedChance = Math.max(0.2, Math.min(0.6, waveRangedBase + (this.difficulty === 'HARD' ? 0.05 : 0)));
    const kind: SpawnKind = rng() < rangedChance ? 'RANGED' : 'MELEE';
    const spawnRadius = kind === 'MELEE' ? 18 : 15;

    const clamp = (value: number, min: number, max: number) => {
      return Math.max(min, Math.min(max, value));
    };
    const clampSafe = (value: number, min: number, max: number, fallback: number) => {
      if (min > max) return fallback;
      return clamp(value, min, max);
    };

    if (input.spawnRect) {
      const r = input.spawnRect;
      const minX = r.x + spawnRadius;
      const maxX = r.x + r.width - spawnRadius;
      const minY = r.y + spawnRadius;
      const maxY = r.y + r.height - spawnRadius;
      x = clampSafe(x, minX, maxX, r.x + r.width / 2);
      y = clampSafe(y, minY, maxY, r.y + r.height / 2);
    } else {
      x = clampSafe(x, spawnRadius, input.worldWidth - spawnRadius, input.worldWidth / 2);
      y = clampSafe(y, spawnRadius, input.worldHeight - spawnRadius, input.worldHeight / 2);
    }
    return { kind, x, y };
  }
}
