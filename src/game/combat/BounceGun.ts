import { Bullet, type Player } from '../Entities';
import type { Weapon, WeaponFireContext } from './Weapon';

export class BounceGun implements Weapon {
  id: Weapon['id'] = 'bounce_gun';
  name = 'BOUNCE GUN';

  damage = 25;
  fireIntervalMs = 100;

  private minAimDistance = 10;
  private bulletSpeed = 1000;
  private bulletLifeMs = 1500;
  private bulletColor = '#06b6d4';
  private maxBounces = 3;

  private lastShotAtMs = 0;

  tryFire(ctx: WeaponFireContext) {
    const { timeMs, owner, aimDx, aimDy, spawnBullet } = ctx;

    if (timeMs - this.lastShotAtMs <= this.fireIntervalMs) {
      return false;
    }

    const dist = Math.hypot(aimDx, aimDy);
    if (dist <= this.minAimDistance) {
      return false;
    }

    const angle = Math.atan2(aimDy, aimDx);
    spawnBullet(new Bullet(
      owner.x,
      owner.y,
      Math.cos(angle) * this.bulletSpeed,
      Math.sin(angle) * this.bulletSpeed,
      this.bulletLifeMs,
      timeMs,
      this.damage,
      true,
      this.bulletColor,
      { bouncesRemaining: this.maxBounces },
    ));

    this.lastShotAtMs = timeMs;
    return true;
  }
}
