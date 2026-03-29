import type { MeleeAttackContext, MeleeWeapon } from './Weapon';

export class ElectromagneticGenerator implements MeleeWeapon {
  id: MeleeWeapon['id'] = 'em_generator';
  type: MeleeWeapon['type'] = 'melee';
  name = 'ELECTROMAGNETIC GENERATOR';
  quality: MeleeWeapon['quality'] = 'blue';

  damage = 100;
  attackIntervalMs = 1000;
  rangePx = 200;
  arcRadiusPx = 200;
  arcHalfAngleRad = Math.PI;

  private ringRadiusPx = 200;
  private ringDurationMs = 1000;
  private ringThicknessPx = 14;

  private lastAttackAtMs = -Infinity;

  tryAttack(ctx: MeleeAttackContext): boolean {
    const { timeMs, owner, spawnExpandingRing } = ctx;

    if (timeMs - this.lastAttackAtMs < this.attackIntervalMs) {
      return false;
    }

    spawnExpandingRing({
      x: owner.x,
      y: owner.y,
      maxRadius: this.ringRadiusPx,
      durationMs: this.ringDurationMs,
      color: '#ffffff',
      thicknessPx: this.ringThicknessPx,
      damage: this.damage,
      stunMinMs: 500,
      stunMaxMs: 800,
    });

    this.lastAttackAtMs = timeMs;
    return true;
  }
}
