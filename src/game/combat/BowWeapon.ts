import { Bullet } from '../Entities';
import type { ChargeReleaseContext, ChargeWeapon } from './Weapon';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class BowWeapon implements ChargeWeapon {
  id: ChargeWeapon['id'] = 'bow';
  type: ChargeWeapon['type'] = 'charge';
  name = 'BOW';

  minChargeMs = 1000;
  maxChargeMs = 3000;
  minDamage = 200;
  maxDamage = 600;

  private minAimDistance = 10;
  private projectileSpeed = 1100;
  private projectileLifeMs = 1800;
  private projectileColor = '#ffffff';

  tryRelease(ctx: ChargeReleaseContext): boolean {
    const { timeMs, owner, aimDx, aimDy, chargeMs, spawnBullet } = ctx;

    const dist = Math.hypot(aimDx, aimDy);
    if (dist <= this.minAimDistance) {
      return false;
    }
    if (chargeMs < this.minChargeMs) {
      return false;
    }

    const capped = Math.min(chargeMs, this.maxChargeMs);
    const t = clamp((capped - this.minChargeMs) / (this.maxChargeMs - this.minChargeMs), 0, 1);
    const damage = this.minDamage + (this.maxDamage - this.minDamage) * t;

    const angle = Math.atan2(aimDy, aimDx);
    spawnBullet(new Bullet(
      owner.x,
      owner.y,
      Math.cos(angle) * this.projectileSpeed,
      Math.sin(angle) * this.projectileSpeed,
      this.projectileLifeMs,
      timeMs,
      damage,
      true,
      this.projectileColor,
      { radius: 4 }
    ));

    return true;
  }
}
