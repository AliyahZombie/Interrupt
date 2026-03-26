import type { Bullet, Player } from '../Entities';

export type WeaponId = 'default' | 'bounce_gun';

export interface WeaponFireContext {
  timeMs: number;
  owner: Player;
  aimDx: number;
  aimDy: number;
  spawnBullet: (bullet: Bullet) => void;
}

export interface Weapon {
  id: WeaponId;
  name: string;
  damage: number;
  fireIntervalMs: number;
  tryFire(ctx: WeaponFireContext): boolean;
}
