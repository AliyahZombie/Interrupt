import { Bullet } from '../Entities';
import type { ChargeReleaseContext, ChargeWeapon } from './Weapon';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class ScatterRailgun implements ChargeWeapon {
  id: ChargeWeapon['id'] = 'scatter_railgun';
  type: ChargeWeapon['type'] = 'charge';
  name = 'SCATTER RAILGUN';
  quality: ChargeWeapon['quality'] = 'blue';

  minChargeMs = 200;
  maxChargeMs = 3000;
  minDamage = 50;
  maxDamage = 50;

  private minAimDistance = 10;
  private baseBulletSpeed = 650;
  private bulletSpeedRandomness = 0.35;
  private bulletLifeMs = 1400;
  private bulletFillColor = '#93c5fd';
  private bulletStrokeColor = '#ffffff';

  private minBullets = 5;
  private maxBullets = 20;
  private spreadConeWidthRad = 0.35;
  private spawnOffsetPx = 10;

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
    const bulletCount = Math.round(this.minBullets + (this.maxBullets - this.minBullets) * t);

    const baseAngle = Math.atan2(aimDy, aimDx);
    const ux = aimDx / dist;
    const uy = aimDy / dist;
    const perpX = -uy;
    const perpY = ux;
    for (let i = 0; i < bulletCount; i++) {
      const binT = (i + 0.5 + (Math.random() - 0.5) * 0.8) / bulletCount;
      const centeredT = binT - 0.5;
      const a = baseAngle + centeredT * this.spreadConeWidthRad;
      const offset = centeredT * this.spawnOffsetPx * 2;

      const speedJitter = (Math.random() - 0.5) * this.bulletSpeedRandomness * 2;
      const speed = Math.max(80, this.baseBulletSpeed * (1 + speedJitter));
      spawnBullet(new Bullet(
        owner.x + perpX * offset,
        owner.y + perpY * offset,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        this.bulletLifeMs,
        timeMs,
        this.minDamage,
        true,
        this.bulletFillColor,
        { radius: 6, strokeColor: this.bulletStrokeColor, strokeWidthPx: 2 },
      ));
    }

    return true;
  }
}
