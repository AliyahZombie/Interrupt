import type { Weapon, WeaponId } from './Weapon';
import { DefaultWeapon } from './DefaultWeapon';
import { BounceGun } from './BounceGun';
import { KnifeWeapon } from './KnifeWeapon';
import { BowWeapon } from './BowWeapon';

export function createWeaponById(id: WeaponId): Weapon {
  switch (id) {
    case 'default':
      return new DefaultWeapon();
    case 'bounce_gun':
      return new BounceGun();
    case 'knife':
      return new KnifeWeapon();
    case 'bow':
      return new BowWeapon();
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
