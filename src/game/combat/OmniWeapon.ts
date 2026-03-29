import { Bullet } from '../Entities';
import type { ProjectileWeapon, WeaponFireContext } from './Weapon';

export class OmniWeapon implements ProjectileWeapon {
  id: ProjectileWeapon['id'] = 'omni';
  type: ProjectileWeapon['type'] = 'projectile';
  name = 'OMNI';
  quality: ProjectileWeapon['quality'] = 'green';

  damage = 50;
  fireIntervalMs = 300;

  private bulletCount = 12;
  private bulletSpeed = 900;
  private bulletLifeMs = 1100;
  private bulletColor = '#22c55e';

  private lastShotAtMs = 0;

  tryFire(ctx: WeaponFireContext): boolean {
    const { timeMs, owner, spawnBullet } = ctx;

    if (timeMs - this.lastShotAtMs <= this.fireIntervalMs) {
      return false;
    }

    const step = (Math.PI * 2) / this.bulletCount;
    for (let i = 0; i < this.bulletCount; i++) {
      const angle = i * step;
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
        { radius: 4 },
      ));
    }

    this.lastShotAtMs = timeMs;
    return true;
  }
}
