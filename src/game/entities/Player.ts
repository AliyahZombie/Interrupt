import { EffectManager } from '../effects/EffectManager';
import { createPoisonEffect, createStunEffect } from '../effects/effects';
import type { EffectKind } from '../effects/types';
import { clamp } from './math';

export class Player {
  isDashing: boolean = false;
  dashTimeRemaining: number = 0;
  dashDx: number = 0;
  dashDy: number = 0;
  dashSpeed: number = 1600;

  private effectManager = new EffectManager({
    STUN: createStunEffect,
    POISON: createPoisonEffect,
  });

  shield: number = 0;
  maxShield: number = 0;
  shieldRegenDelayMs: number = 3500;
  shieldRegenPerSecond: number = 60;
  lastDamagedAtMs: number = -Infinity;

  constructor(
    public x: number,
    public y: number,
    public radius: number,
    public speed: number,
    public hp: number,
    public maxHp: number
  ) {}

  configureShield(maxShield: number, regenDelayMs: number, regenPerSecond: number) {
    this.maxShield = Math.max(0, maxShield);
    this.shieldRegenDelayMs = Math.max(0, regenDelayMs);
    this.shieldRegenPerSecond = Math.max(0, regenPerSecond);
    this.shield = clamp(this.shield, 0, this.maxShield);
  }

  resetVitals(timeMs: number) {
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.lastDamagedAtMs = timeMs;
    this.effectManager.clear();
  }

  applyDamage(amount: number, timeMs: number) {
    if (amount <= 0) return;
    this.lastDamagedAtMs = timeMs;

    const shieldAbsorb = Math.min(this.shield, amount);
    this.shield -= shieldAbsorb;
    const remaining = amount - shieldAbsorb;
    if (remaining > 0) {
      this.hp = Math.max(0, this.hp - remaining);
    }
  }

  updateShield(dt: number, timeMs: number) {
    if (this.maxShield <= 0) return;
    if (this.shield >= this.maxShield) return;
    if (timeMs - this.lastDamagedAtMs < this.shieldRegenDelayMs) return;

    this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenPerSecond * dt);
  }

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

  isStunned(): boolean {
    return this.hasEffect('STUN');
  }

  update(dt: number, worldWidth: number, worldHeight: number) {
    if (this.isDashing) {
      this.dashTimeRemaining -= dt;
      this.x += this.dashDx * this.dashSpeed * dt;
      this.y += this.dashDy * this.dashSpeed * dt;
      this.x = Math.max(this.radius, Math.min(worldWidth - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(worldHeight - this.radius, this.y));

      if (this.dashTimeRemaining <= 0) {
        this.isDashing = false;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, screenPx: number, screenPy: number) {
    ctx.shadowColor = this.isDashing ? '#3b82f6' : '#ffffff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(screenPx, screenPy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.isDashing ? '#3b82f6' : '#ffffff';
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
  }
}
