import { Bullet } from '../Bullet';
import type { GameState } from '../GameState';
import { clamp, normalize } from '../math';
import { BaseEnemy } from './BaseEnemy';
import { computeBulletDodge, computeSeparation } from './steering';

export class RangedEnemy extends BaseEnemy {
  lastShot: number = 0;
  fireIntervalMs: number;
  orbitDirection: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  constructor(x: number, y: number, level: number = 1) {
    const lv = Math.max(1, Math.floor(level));
    const baseSpeed = 80 + Math.random() * 40;
    const baseHp = 100;
    const hpScale = 1 + 0.3 * (lv - 1);
    const speedScale = 1 + 0.05 * (lv - 1);
    const maxHp = baseHp * hpScale;
    super(x, y, 15, baseSpeed * speedScale, maxHp, maxHp, lv, '#a855f7');
    const rawInterval = 2000 / (1 + 0.14 * (lv - 1));
    this.fireIntervalMs = clamp(rawInterval, 650, 2000);
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

      const orbitRadius = 360;
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
      state.projectiles.push(new Bullet(
        this.x, this.y,
        Math.cos(angle) * 400, Math.sin(angle) * 400,
        2000, state.time, 20, false, '#a855f7'
      ));
      this.lastShot = state.time;
    }
  }
}
