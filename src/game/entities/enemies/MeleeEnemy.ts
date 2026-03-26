import type { GameState } from '../GameState';
import { clamp } from '../math';
import { BaseEnemy } from './BaseEnemy';
import { computeBulletDodge, computeSeparation } from './steering';

export class MeleeEnemy extends BaseEnemy {
  swirlDirection: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  vx: number = 0;
  vy: number = 0;

  constructor(x: number, y: number, level: number = 1) {
    const lv = Math.max(1, Math.floor(level));
    const baseSpeed = 120 + Math.random() * 50;
    const baseHp = 300;
    const hpScale = 1 + 0.35 * (lv - 1);
    const speedScale = 1 + 0.06 * (lv - 1);
    const maxHp = baseHp * hpScale;
    super(x, y, 18, baseSpeed * speedScale, maxHp, maxHp, lv, '#ef4444');
  }

  update(dt: number, state: GameState) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    let moveX = 0;
    let moveY = 0;

    if (dist > 1e-6) {
      const ux = dx / dist;
      const uy = dy / dist;
      moveX += ux;
      moveY += uy;
      moveX += (-uy * this.swirlDirection) * 0.25;
      moveY += (ux * this.swirlDirection) * 0.25;
    }

    const sep = computeSeparation(this, state.enemies, 120);
    moveX += sep.x * 1.6;
    moveY += sep.y * 1.6;

    if (state.rules.enemiesDodgeBullets) {
      const dodge = computeBulletDodge(this, state.projectiles, 260, 18);
      moveX += dodge.x * 2.2;
      moveY += dodge.y * 2.2;
    }

    const forceLen = Math.hypot(moveX, moveY);
    const desiredSpeed = this.speed * clamp(forceLen, 0, 1);
    const dir = forceLen <= 1e-6 ? { x: 0, y: 0 } : { x: moveX / forceLen, y: moveY / forceLen };

    const desiredVx = dir.x * desiredSpeed;
    const desiredVy = dir.y * desiredSpeed;

    const maxAccel = 1800;
    const ax = (desiredVx - this.vx) / Math.max(dt, 1e-6);
    const ay = (desiredVy - this.vy) / Math.max(dt, 1e-6);
    const aLen = Math.hypot(ax, ay);
    const accelScale = aLen > maxAccel ? maxAccel / aLen : 1;
    this.vx += ax * accelScale * dt;
    this.vy += ay * accelScale * dt;

    const damping = 7;
    const dampFactor = Math.exp(-damping * dt);
    this.vx *= dampFactor;
    this.vy *= dampFactor;

    const vLen = Math.hypot(this.vx, this.vy);
    const vMax = this.speed;
    if (vLen > vMax && vLen > 1e-6) {
      this.vx = (this.vx / vLen) * vMax;
      this.vy = (this.vy / vLen) * vMax;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (dist < this.radius + state.player.radius) {
      if (!state.player.isDashing && !state.debugFlags.godMode) {
        state.player.applyDamage(50 * dt * state.rules.playerDamageMultiplier, state.time);
      }
    }
  }
}
