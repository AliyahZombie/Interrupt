import type { BaseEnemy } from '../Entities';
import type { MeleeAttackContext, MeleeWeapon } from './Weapon';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class KnifeWeapon implements MeleeWeapon {
  id: MeleeWeapon['id'] = 'knife';
  type: MeleeWeapon['type'] = 'melee';
  name = 'KNIFE';

  damage = 100;
  attackIntervalMs = 500;
  rangePx = 100;
  arcRadiusPx = 100;
  arcHalfAngleRad = Math.PI / 4;

  private lastAttackAtMs = -Infinity;

  tryAttack(ctx: MeleeAttackContext): boolean {
    const { timeMs, owner, enemies, applyDamageToEnemy, spawnSlashArc } = ctx;

    if (timeMs - this.lastAttackAtMs < this.attackIntervalMs) {
      return false;
    }

    const target = this.findNearestEnemyInRange(enemies, owner.x, owner.y, this.rangePx);
    if (!target) {
      return false;
    }

    const dx = target.x - owner.x;
    const dy = target.y - owner.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.0001) {
      return false;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;
    const angleRad = Math.atan2(dirY, dirX);

    const toHit: BaseEnemy[] = [];
    for (const e of enemies) {
      const ex = e.x - owner.x;
      const ey = e.y - owner.y;
      const ed = Math.hypot(ex, ey);
      if (ed <= 0.0001) continue;
      if (ed > this.arcRadiusPx + e.radius) continue;
      const nx = ex / ed;
      const ny = ey / ed;
      const dot = clamp(nx * dirX + ny * dirY, -1, 1);
      const diff = Math.acos(dot);
      if (diff <= this.arcHalfAngleRad) {
        toHit.push(e);
      }
    }

    if (toHit.length === 0) {
      toHit.push(target);
    }

    spawnSlashArc({
      x: owner.x,
      y: owner.y,
      radius: this.arcRadiusPx,
      angleRad,
      halfAngleRad: this.arcHalfAngleRad,
    });

    for (const e of toHit) {
      applyDamageToEnemy(e, this.damage, timeMs);
    }

    this.lastAttackAtMs = timeMs;
    return true;
  }

  private findNearestEnemyInRange(enemies: BaseEnemy[], x: number, y: number, rangePx: number): BaseEnemy | null {
    let best: BaseEnemy | null = null;
    let bestD2 = rangePx * rangePx;
    for (const e of enemies) {
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }
}
