import type { Bullet, Player } from '../Entities';

export interface WeaponFireContext {
  timeMs: number;
  owner: Player;
  aimDx: number;
  aimDy: number;
  spawnBullet: (bullet: Bullet) => void;
}

export interface Weapon {
  id: string;
  name: string;
  damage: number;
  fireIntervalMs: number;
  tryFire(ctx: WeaponFireContext): boolean;
}
