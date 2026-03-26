import type { Effect } from './Effect';

export function createStunEffect(durationMs: number): Effect {
  return {
    kind: 'STUN',
    remainingMs: durationMs,
    apply: () => {},
  };
}

export function createPoisonEffect(durationMs: number): Effect {
  const dps = 18;
  return {
    kind: 'POISON',
    remainingMs: durationMs,
    apply: (entity, ctx) => {
      const next = entity.hp - dps * ctx.dt;
      const clamped = Math.max(1, next);
      if (clamped < entity.hp) {
        entity.hp = clamped;
        entity.lastDamagedAtMs = ctx.timeMs;
      }
    },
  };
}

export function createPoisonEffectKillable(durationMs: number): Effect {
  const dps = 18;
  return {
    kind: 'POISON',
    remainingMs: durationMs,
    apply: (entity, ctx) => {
      const next = entity.hp - dps * ctx.dt;
      const clamped = Math.max(0, next);
      if (clamped < entity.hp) {
        entity.hp = clamped;
        entity.lastDamagedAtMs = ctx.timeMs;
      }
    },
  };
}

export function createBurnEffect(durationMs: number): Effect {
  const dps = 18;
  return {
    kind: 'BURN',
    remainingMs: durationMs,
    apply: (entity, ctx) => {
      const next = entity.hp - dps * ctx.dt;
      const clamped = Math.max(1, next);
      if (clamped < entity.hp) {
        entity.hp = clamped;
        entity.lastDamagedAtMs = ctx.timeMs;
      }
    },
  };
}

export function createBurnEffectKillable(durationMs: number): Effect {
  const dps = 18;
  return {
    kind: 'BURN',
    remainingMs: durationMs,
    apply: (entity, ctx) => {
      const next = entity.hp - dps * ctx.dt;
      const clamped = Math.max(0, next);
      if (clamped < entity.hp) {
        entity.hp = clamped;
        entity.lastDamagedAtMs = ctx.timeMs;
      }
    },
  };
}

export function createBlindEffect(durationMs: number): Effect {
  return {
    kind: 'BLIND',
    remainingMs: durationMs,
    apply: () => {},
  };
}
