import type { BaseEnemy, Bullet, Player } from '../Entities';

export type WeaponId = 'default' | 'bounce_gun' | 'knife' | 'bow';

export type WeaponType = 'projectile' | 'melee' | 'charge';

export interface WeaponFireContext {
  timeMs: number;
  owner: Player;
  aimDx: number;
  aimDy: number;
  spawnBullet: (bullet: Bullet) => void;
}

export interface MeleeAttackContext {
  timeMs: number;
  owner: Player;
  enemies: BaseEnemy[];
  applyDamageToEnemy: (enemy: BaseEnemy, damage: number, timeMs: number) => void;
  spawnSlashArc: (params: {
    x: number;
    y: number;
    radius: number;
    angleRad: number;
    halfAngleRad: number;
  }) => void;
}

export interface ChargeReleaseContext {
  timeMs: number;
  owner: Player;
  aimDx: number;
  aimDy: number;
  chargeMs: number;
  spawnBullet: (bullet: Bullet) => void;
}

export interface WeaponBase {
  id: WeaponId;
  type: WeaponType;
  name: string;
}

export interface ProjectileWeapon extends WeaponBase {
  type: 'projectile';
  damage: number;
  fireIntervalMs: number;
  tryFire(ctx: WeaponFireContext): boolean;
}

export interface MeleeWeapon extends WeaponBase {
  type: 'melee';
  damage: number;
  attackIntervalMs: number;
  rangePx: number;
  arcRadiusPx: number;
  arcHalfAngleRad: number;
  tryAttack(ctx: MeleeAttackContext): boolean;
}

export interface ChargeWeapon extends WeaponBase {
  type: 'charge';
  minChargeMs: number;
  maxChargeMs: number;
  minDamage: number;
  maxDamage: number;
  tryRelease(ctx: ChargeReleaseContext): boolean;
}

export type Weapon = ProjectileWeapon | MeleeWeapon | ChargeWeapon;
