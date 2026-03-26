import { Bullet } from '../Bullet';
import type { GameState } from '../GameState';
import { clamp, normalize } from '../math';
import { BaseEnemy } from './BaseEnemy';
import { computeBulletDodge, computeSeparation } from './steering';

export class FlameShooterEnemy extends BaseEnemy {
  lastShot: number = 0;
  fireIntervalMs: number;
  orbitDirection: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  constructor(x: number, y: number, level: number = 1) {
    const lv = Math.max(1, Math.floor(level));
    const baseSpeed = 82 + Math.random() * 38;
    const baseHp = 110;
    const hpScale = 1 + 0.28 * (lv - 1);
    const speedScale = 1 + 0.05 * (lv - 1);
    const maxHp = baseHp * hpScale;
    super(x, y, 15, baseSpeed * speedScale, maxHp, maxHp, lv, '#f97316');
    const rawInterval = 2100 / (1 + 0.15 * (lv - 1));
    this.fireIntervalMs = clamp(rawInterval, 700, 2100);
  }

  update(dt: number, state: GameState) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    let moveX = 0;
    let moveY = 0;

    if (dist > 1e-6) {
      const ux = dx / dist;
      const uy = dy / dist;

      const orbitRadius = 350;
      const orbitBand = 140;
      const radialStrength = clamp((dist - orbitRadius) / orbitBand, -1, 1);

      const tx = -uy * this.orbitDirection;
      const ty = ux * this.orbitDirection;

      moveX += tx * 1.1;
      moveY += ty * 1.1;

      moveX += ux * radialStrength * 0.9;
      moveY += uy * radialStrength * 0.9;
    }

    const sep = computeSeparation(this, state.enemies, 160);
    moveX += sep.x * 2.1;
    moveY += sep.y * 2.1;

    if (state.rules.enemiesDodgeBullets) {
      const dodge = computeBulletDodge(this, state.projectiles, 280, 18);
      moveX += dodge.x * 2.0;
      moveY += dodge.y * 2.0;
    }

    const move = normalize(moveX, moveY);
    this.x += move.x * this.speed * dt;
    this.y += move.y * this.speed * dt;

    if (state.time - this.lastShot > this.fireIntervalMs) {
      const speed = 420;
      state.projectiles.push(new Bullet(
        this.x,
        this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2100,
        state.time,
        18,
        false,
        '#f97316',
        { effectKind: 'BURN', effectDurationMs: 3500 }
      ));
      this.lastShot = state.time;
    }
  }
}
