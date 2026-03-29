import { Bullet } from '../Entities';
import type { ProjectileWeapon, WeaponFireContext } from './Weapon';

export class PierceGun implements ProjectileWeapon {
  id: ProjectileWeapon['id'] = 'pierce_gun';
  type: ProjectileWeapon['type'] = 'projectile';
  name = 'PIERCE GUN';
  quality: ProjectileWeapon['quality'] = 'green';

  damage = 50;
  fireIntervalMs = 150;

  private minAimDistance = 10;
  private bulletSpeed = 1000;
  private bulletLifeMs = 1600;
  private bulletColor = '#22c55e';

  private lastShotAtMs = 0;

  tryFire(ctx: WeaponFireContext): boolean {
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
      { radius: 4, piercesRemaining: -1 },
    ));

    this.lastShotAtMs = timeMs;
    return true;
  }
}
