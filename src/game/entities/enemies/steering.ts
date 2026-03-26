import type { Bullet } from '../Bullet';
import type { BaseEnemy } from './BaseEnemy';

export function computeSeparation(self: BaseEnemy, enemies: BaseEnemy[], range: number) {
  let sx = 0;
  let sy = 0;
  for (const other of enemies) {
    if (other === self) continue;
    const dx = self.x - other.x;
    const dy = self.y - other.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1e-6 || dist >= range) continue;
    const strength = 1 - dist / range;
    sx += (dx / dist) * strength;
    sy += (dy / dist) * strength;
  }
  return { x: sx, y: sy };
}

export function computeBulletDodge(
  self: BaseEnemy,
  projectiles: Bullet[],
  detectionRange: number,
  extraClearance: number
) {
  let ax = 0;
  let ay = 0;
  for (const p of projectiles) {
    if (!p.isPlayer) continue;
    const vLen = Math.hypot(p.vx, p.vy);
    if (vLen <= 1e-6) continue;

    const rx = self.x - p.x;
    const ry = self.y - p.y;
    const distToProjectile = Math.hypot(rx, ry);
    if (distToProjectile > detectionRange) continue;

    const dot = (p.vx * rx + p.vy * ry) / vLen;
    if (dot <= 0) continue;

    const crossZ = p.vx * ry - p.vy * rx;
    const perpDist = Math.abs(crossZ) / vLen;
    const clearance = self.radius + extraClearance;
    if (perpDist > clearance) continue;

    let perpX = -p.vy / vLen;
    let perpY = p.vx / vLen;
    if (crossZ < 0) {
      perpX = -perpX;
      perpY = -perpY;
    }

    const threat = (1 - perpDist / clearance) * (1 - distToProjectile / detectionRange);
    ax += perpX * threat;
    ay += perpY * threat;
  }
  return { x: ax, y: ay };
}
