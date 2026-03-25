import type { EffectKind } from './types';

export type EffectUpdateContext = {
  dt: number;
  timeMs: number;
};

export type Effect = {
  kind: EffectKind;
  remainingMs: number;
  apply: (entity: { hp: number; lastDamagedAtMs: number }, ctx: EffectUpdateContext) => void;
};
