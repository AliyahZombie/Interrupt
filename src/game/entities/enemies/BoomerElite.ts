import { Bullet } from '../Bullet';
import type { GameState } from '../GameState';
import { clamp, normalize } from '../math';
import { BaseEnemy } from './BaseEnemy';
import { computeBulletDodge, computeSeparation } from './steering';

export class BoomerElite extends BaseEnemy {
  lastShot: number = 0;
  fireIntervalMs: number;
  orbitDirection: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  constructor(x: number, y: number, level: number = 1) {
    const lv = Math.max(1, Math.floor(level));
    const baseSpeed = 108 + Math.random() * 45;
    const speedScale = 1 + 0.06 * (lv - 1);
    super(x, y, 16, baseSpeed * speedScale, 1, 1, lv, '#22c55e');
    const rawInterval = 1700 / (1 + 0.1 * (lv - 1));
    this.fireIntervalMs = clamp(rawInterval, 850, 1700);
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

      const orbitRadius = 300;
      const orbitBand = 120;
      const radialStrength = clamp((dist - orbitRadius) / orbitBand, -1, 1);

      const tx = -uy * this.orbitDirection;
      const ty = ux * this.orbitDirection;

      moveX += tx * 1.15;
      moveY += ty * 1.15;

      moveX += ux * radialStrength * 0.95;
      moveY += uy * radialStrength * 0.95;
    }

    const sep = computeSeparation(this, state.enemies, 170);
    moveX += sep.x * 2.2;
    moveY += sep.y * 2.2;

    if (state.rules.enemiesDodgeBullets) {
      const dodge = computeBulletDodge(this, state.projectiles, 300, 20);
      moveX += dodge.x * 2.0;
      moveY += dodge.y * 2.0;
    }

    const move = normalize(moveX, moveY);
    this.x += move.x * this.speed * dt;
    this.y += move.y * this.speed * dt;

    if (state.time - this.lastShot > this.fireIntervalMs) {
      const speed = 360;
      const blindMs = 3000 + 350 * (this.level - 1);
      state.projectiles.push(new Bullet(
        this.x,
        this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2400,
        state.time,
        12,
        false,
        '#22c55e',
        { radius: 8, effectKind: 'BLIND', effectDurationMs: blindMs }
      ));
      this.lastShot = state.time;
    }
  }

  override draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    super.draw(ctx, cameraX, cameraY);

    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    ctx.save();
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.strokeText('BOOMER', sx, sy);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('BOOMER', sx, sy);
    ctx.restore();
  }
}
