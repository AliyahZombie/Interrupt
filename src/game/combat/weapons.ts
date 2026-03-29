import type { Weapon, WeaponId } from './Weapon';
import { DefaultWeapon } from './DefaultWeapon';
import { BounceGun } from './BounceGun';
import { KnifeWeapon } from './KnifeWeapon';
import { BowWeapon } from './BowWeapon';
import { PierceGun } from './PierceGun';
import { OmniWeapon } from './OmniWeapon';
import { ElectromagneticGenerator } from './ElectromagneticGenerator';
import { ScatterRailgun } from './ScatterRailgun';

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
    case 'pierce_gun':
      return new PierceGun();
    case 'omni':
      return new OmniWeapon();
    case 'em_generator':
      return new ElectromagneticGenerator();
    case 'scatter_railgun':
      return new ScatterRailgun();
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
