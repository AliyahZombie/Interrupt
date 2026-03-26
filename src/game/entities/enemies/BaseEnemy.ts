import type { GameState } from '../GameState';
import { EffectManager } from '../../effects/EffectManager';
import { createBlindEffect, createBurnEffectKillable, createPoisonEffectKillable, createStunEffect } from '../../effects/effects';
import type { EffectKind } from '../../effects/types';
import type { Language } from '../../../i18n/translations';

export abstract class BaseEnemy {
  lastDamagedAtMs: number = -Infinity;

  private effectManager = new EffectManager({
    STUN: createStunEffect,
    POISON: createPoisonEffectKillable,
    BURN: createBurnEffectKillable,
    BLIND: createBlindEffect,
  });

  constructor(
    public x: number,
    public y: number,
    public radius: number,
    public speed: number,
    public hp: number,
    public maxHp: number,
    public level: number,
    public color: string
  ) {}

  abstract update(dt: number, state: GameState): void;

  applyEffect(kind: EffectKind, durationMs: number, timeMs: number) {
    void timeMs;
    this.effectManager.applyEffect(kind, durationMs);
  }

  hasEffect(kind: EffectKind): boolean {
    return this.effectManager.has(kind);
  }

  getEffectRemainingMs(kind: EffectKind): number {
    return this.effectManager.getRemainingMs(kind);
  }

  updateEffects(dt: number, timeMs: number) {
    this.effectManager.update({ dt, timeMs }, this);
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, language?: Language) {
    void language;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
    const hpPercent = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(this.x - cameraX - 15, this.y - cameraY - 25, 30, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(this.x - cameraX - 15, this.y - cameraY - 25, 30 * hpPercent, 4);

    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    ctx.save();
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = sy - this.radius - 10;
    const text = `LV${this.level}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeText(text, sx, labelY);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(text, sx, labelY);
    ctx.restore();
  }
}
