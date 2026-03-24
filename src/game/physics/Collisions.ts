import type { Tile } from '../Entities';

export interface CircleBody {
  x: number;
  y: number;
  radius: number;
}

export interface VelocityBody {
  vx: number;
  vy: number;
}

export const resolveRectRect = (rect1: Tile, rect2: Tile) => {
  const dx = rect1.x - rect2.x;
  const dy = rect1.y - rect2.y;
  const combinedHalfWidths = (rect1.width + rect2.width) / 2;
  const combinedHalfHeights = (rect1.height + rect2.height) / 2;

  if (Math.abs(dx) < combinedHalfWidths && Math.abs(dy) < combinedHalfHeights) {
    const overlapX = combinedHalfWidths - Math.abs(dx);
    const overlapY = combinedHalfHeights - Math.abs(dy);

    let nx = 0;
    let ny = 0;
    let overlap = 0;
    if (overlapX < overlapY) {
      nx = Math.sign(dx) || 1;
      ny = 0;
      overlap = overlapX;
    } else {
      nx = 0;
      ny = Math.sign(dy) || 1;
      overlap = overlapY;
    }

    if (rect1.isFixed && rect2.isFixed) {
      return;
    } else if (rect1.isFixed) {
      rect2.x -= nx * overlap;
      rect2.y -= ny * overlap;
      if (nx !== 0) rect2.vx *= -0.5;
      if (ny !== 0) rect2.vy *= -0.5;
    } else if (rect2.isFixed) {
      rect1.x += nx * overlap;
      rect1.y += ny * overlap;
      if (nx !== 0) rect1.vx *= -0.5;
      if (ny !== 0) rect1.vy *= -0.5;
    } else {
      const totalMass = rect1.mass + rect2.mass;
      const r1Ratio = rect2.mass / totalMass;
      const r2Ratio = rect1.mass / totalMass;

      rect1.x += nx * overlap * r1Ratio;
      rect1.y += ny * overlap * r1Ratio;
      rect2.x -= nx * overlap * r2Ratio;
      rect2.y -= ny * overlap * r2Ratio;

      const v1n = rect1.vx * nx + rect1.vy * ny;
      const v2n = rect2.vx * nx + rect2.vy * ny;
      const dv = v1n - v2n;

      if (dv < 0) {
        const restitution = 0.4;
        const impulse = -(1 + restitution) * dv / (1 / rect1.mass + 1 / rect2.mass);
        rect1.vx += nx * impulse / rect1.mass;
        rect1.vy += ny * impulse / rect1.mass;
        rect2.vx -= nx * impulse / rect2.mass;
        rect2.vy -= ny * impulse / rect2.mass;
      }
    }
  }
};

const hasVelocity = (body: unknown): body is VelocityBody => {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.vx === 'number' && typeof b.vy === 'number';
};

export const resolveCircleRect = (
  circle: CircleBody,
  rect: Tile,
  isProjectile: boolean = false
) => {
  const radius = circle.radius;
  const dx = circle.x - rect.x;
  const dy = circle.y - rect.y;
  const px = Math.max(-rect.width / 2, Math.min(rect.width / 2, dx));
  const py = Math.max(-rect.height / 2, Math.min(rect.height / 2, dy));

  const dist = Math.hypot(dx - px, dy - py);
  if (dist < radius) {
    let nx = dx - px;
    let ny = dy - py;
    let len = Math.hypot(nx, ny);
    let overlap = radius - dist;

    if (len === 0) {
      if (Math.abs(dx) > Math.abs(dy)) {
        nx = Math.sign(dx) || 1;
        ny = 0;
        overlap = radius + rect.width / 2 - Math.abs(dx);
      } else {
        nx = 0;
        ny = Math.sign(dy) || 1;
        overlap = radius + rect.height / 2 - Math.abs(dy);
      }
    } else {
      nx /= len;
      ny /= len;
    }

    if (rect.isFixed) {
      if (!isProjectile) {
        circle.x += nx * overlap;
        circle.y += ny * overlap;
      }
    } else {
      if (!isProjectile) {
        const pushFactor = 0.8;
        circle.x += nx * overlap * pushFactor;
        circle.y += ny * overlap * pushFactor;
        rect.x -= nx * overlap * (1 - pushFactor);
        rect.y -= ny * overlap * (1 - pushFactor);

        rect.vx -= nx * overlap * 60;
        rect.vy -= ny * overlap * 60;
      } else {
        if (hasVelocity(circle)) {
          rect.vx += circle.vx * 0.15;
          rect.vy += circle.vy * 0.15;
        }
      }
    }

    return true;
  }
  return false;
};
