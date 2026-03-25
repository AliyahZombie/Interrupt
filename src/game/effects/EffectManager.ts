import type { Effect, EffectUpdateContext } from './Effect';
import type { EffectKind } from './types';

type EffectFactory = (durationMs: number) => Effect;

export class EffectManager {
  private effects = new Map<EffectKind, Effect>();
  private readonly factories: Record<EffectKind, EffectFactory>;

  constructor(factories: Record<EffectKind, EffectFactory>) {
    this.factories = factories;
  }

  clear() {
    this.effects.clear();
  }

  has(kind: EffectKind): boolean {
    const e = this.effects.get(kind);
    return !!e && e.remainingMs > 0;
  }

  getRemainingMs(kind: EffectKind): number {
    const e = this.effects.get(kind);
    return e ? Math.max(0, e.remainingMs) : 0;
  }

  applyEffect(kind: EffectKind, durationMs: number) {
    const dur = Math.max(0, durationMs);
    if (dur <= 0) return;

    const existing = this.effects.get(kind);
    if (existing) {
      existing.remainingMs = Math.max(existing.remainingMs, dur);
      return;
    }

    const effect = this.factories[kind](dur);
    this.effects.set(kind, effect);
  }

  update(ctx: EffectUpdateContext, entity: { hp: number; lastDamagedAtMs: number }) {
    if (this.effects.size === 0) return;

    const dtMs = ctx.dt * 1000;
    for (const e of this.effects.values()) {
      e.remainingMs -= dtMs;
    }

    for (const e of this.effects.values()) {
      if (e.remainingMs > 0) {
        e.apply(entity, ctx);
      }
    }

    for (const [kind, e] of this.effects) {
      if (e.remainingMs <= 0) {
        this.effects.delete(kind);
      }
    }
  }
}
