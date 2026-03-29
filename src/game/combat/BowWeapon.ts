import { Bullet } from '../Entities';
import type { ChargeReleaseContext, ChargeWeapon } from './Weapon';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class BowWeapon implements ChargeWeapon {
  id: ChargeWeapon['id'] = 'bow';
  type: ChargeWeapon['type'] = 'charge';
  name = 'BOW';
  quality: ChargeWeapon['quality'] = 'white';

  minChargeMs = 1000;
  maxChargeMs = 3000;
  minDamage = 200;
  maxDamage = 600;

  private minAimDistance = 10;
  private projectileSpeed = 1100;
  private projectileLifeMs = 1800;
  private projectileColor = '#ffffff';
  private arrowCount = 3;
  private arrowOffsetPx = 14;

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
    const isFullCharge = capped >= this.maxChargeMs;

    const ux = aimDx / dist;
    const uy = aimDy / dist;
    const perpX = -uy;
    const perpY = ux;
    const vx = ux * this.projectileSpeed;
    const vy = uy * this.projectileSpeed;

    const mid = (this.arrowCount - 1) / 2;
    for (let i = 0; i < this.arrowCount; i++) {
      const offset = (i - mid) * this.arrowOffsetPx;
      spawnBullet(new Bullet(
        owner.x + perpX * offset,
        owner.y + perpY * offset,
        vx,
        vy,
        this.projectileLifeMs,
        timeMs,
        damage,
        true,
        this.projectileColor,
        { radius: 4, piercesRemaining: isFullCharge ? -1 : 0 }
      ));
    }

    return true;
  }
}
