import { Bullet } from '../Bullet';
import type { GameState } from '../GameState';
import { clamp, normalize } from '../math';
import { BaseEnemy } from './BaseEnemy';
import { computeSeparation } from './steering';
import type { Language } from '../../../i18n/translations';

export class TankElite extends BaseEnemy {
  lastShot: number = 0;
  fireIntervalMs: number;
  lastMeleeHitMs: number = -Infinity;

  constructor(x: number, y: number, level: number = 1) {
    const lv = Math.max(1, Math.floor(level));
    const baseSpeed = 95 + Math.random() * 20;
    const baseHp = 2000;
    const hpScale = 1 + 0.45 * (lv - 1);
    const speedScale = 1 + 0.04 * (lv - 1);
    const maxHp = baseHp * hpScale;
    super(x, y, 32, baseSpeed * speedScale, maxHp, maxHp, lv, '#94a3b8');
    const rawInterval = 2800 / (1 + 0.08 * (lv - 1));
    this.fireIntervalMs = clamp(rawInterval, 1700, 2800);
  }

  update(dt: number, state: GameState) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    const chase = normalize(dx, dy);
    const sep = computeSeparation(this, state.enemies, 180);
    const move = normalize(chase.x + sep.x * 1.8, chase.y + sep.y * 1.8);

    this.x += move.x * this.speed * dt;
    this.y += move.y * this.speed * dt;

    const now = state.time;
    const overlap = dist < this.radius + state.player.radius;
    if (overlap && !state.player.isDashing && !state.debugFlags.godMode) {
      const cooldownMs = 900;
      if (now - this.lastMeleeHitMs >= cooldownMs) {
        this.lastMeleeHitMs = now;

        const fallbackDir = Math.hypot(move.x, move.y) > 1e-6 ? move : { x: 1, y: 0 };
        const ux = dist <= 1e-6 ? fallbackDir.x : dx / dist;
        const uy = dist <= 1e-6 ? fallbackDir.y : dy / dist;

        const durationSec = 0.22;
        const knockbackDist = clamp(220 + 25 * (this.level - 1), 220, 420);
        const knockbackSpeed = clamp(knockbackDist / durationSec, 820, 1150);
        state.player.startKnockback({ dx: ux, dy: uy, speed: knockbackSpeed, durationSec });

        const stunMs = 850 + 140 * (this.level - 1);
        state.player.applyEffect('STUN', stunMs, now);
        state.player.applyDamage(35 * state.rules.playerDamageMultiplier, now);
      }
    }

    if (dist > 160 && now - this.lastShot > this.fireIntervalMs) {
      const angle = Math.atan2(dy, dx);
      const speed = 720;
      const stunMs = 1100 + 120 * (this.level - 1);
      state.projectiles.push(new Bullet(
        this.x,
        this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        1900,
        now,
        46,
        false,
        '#cbd5e1',
        { radius: 16, effectKind: 'STUN', effectDurationMs: stunMs }
      ));
      this.lastShot = now;
    }
  }

  override draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, language: Language = 'en') {
    void language;
    super.draw(ctx, cameraX, cameraY);

    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    ctx.save();
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.strokeText('TANK', sx, sy);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('TANK', sx, sy);
    ctx.restore();
  }
}
