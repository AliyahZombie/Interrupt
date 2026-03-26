import type { Weapon, WeaponId } from './Weapon';
import { DefaultWeapon } from './DefaultWeapon';
import { BounceGun } from './BounceGun';

export function createWeaponById(id: WeaponId): Weapon {
  if (id === 'default') return new DefaultWeapon();
  if (id === 'bounce_gun') return new BounceGun();
  const _exhaustive: never = id;
  return _exhaustive;
}
