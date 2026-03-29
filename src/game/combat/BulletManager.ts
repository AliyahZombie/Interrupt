import type { DifficultyRules } from '../Difficulty';
import { Credit, Bullet, type BaseEnemy, MeleeEnemy, Particle, type Player, type Tile } from '../Entities';
import { type CircleBody, getCircleRectCollisionInfo, resolveCircleRect } from '../physics/Collisions';

export type TileCandidateProvider = (circle: CircleBody) => readonly number[];

export interface BulletManagerHitContext {
  timeMs: number;
  rules: DifficultyRules;
  debugFlags: {
    godMode: boolean;
  };
  player: Player;
  enemies: BaseEnemy[];
  particles: Particle[];
  credits: Credit[];

  onEnemyKilled: (enemy: BaseEnemy) => void;
}

export class BulletManager {
  private bullets: Bullet[] = [];

  get all() {
    return this.bullets;
  }

  reset() {
    this.bullets = [];
  }

  spawn(bullet: Bullet) {
    this.bullets.push(bullet);
  }

  updateAndCollideActors(dt: number, ctx: BulletManagerHitContext) {
    const { timeMs, enemies, player, particles, credits, debugFlags, rules, onEnemyKilled } = ctx;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);

      if (timeMs - b.spawnTime > b.life) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      if (b.isPlayer) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (b.hitTargets.has(e)) {
            continue;
          }
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.radius) {
            b.hitTargets.add(e);
            e.hp -= b.damage;
            if (b.effectKind && b.effectDurationMs && b.effectDurationMs > 0) {
              e.applyEffect(b.effectKind, b.effectDurationMs, timeMs);
            }
            for (let k = 0; k < 5; k++) {
              particles.push(new Particle(
                b.x,
                b.y,
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 400,
                0,
                300 + Math.random() * 200,
                e.color,
              ));
            }
            if (e.hp <= 0) {
              enemies.splice(j, 1);
              onEnemyKilled(e);
              if (Math.random() < 0.4) {
                credits.push(new Credit(e.x, e.y, 10, timeMs));
              }
            }

            if (b.piercesRemaining === 0) {
              hit = true;
              break;
            }
            if (b.piercesRemaining > 0) {
              b.piercesRemaining -= 1;
              if (b.piercesRemaining === 0) {
                hit = true;
                break;
              }
            }
          }
        }
      } else {
        if (
          !player.isDashing &&
          !debugFlags.godMode &&
          Math.hypot(b.x - player.x, b.y - player.y) < player.radius + b.radius
        ) {
          player.applyDamage(b.damage * rules.playerDamageMultiplier, timeMs);
          if (b.effectKind && b.effectDurationMs && b.effectDurationMs > 0) {
            player.applyEffect(b.effectKind, b.effectDurationMs, timeMs);
          }
          hit = true;
          for (let k = 0; k < 5; k++) {
            particles.push(new Particle(
              b.x,
              b.y,
              (Math.random() - 0.5) * 400,
              (Math.random() - 0.5) * 400,
              0,
              300 + Math.random() * 200,
              '#ffffff',
            ));
          }
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }
  }

  collideTiles(tiles: Tile[], particles: Particle[], getCandidates?: TileCandidateProvider) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const candidateIndices = getCandidates ? getCandidates(b) : undefined;
      let hitTile = false;
      let bounced = false;

      if (b.isPlayer && b.bouncesRemaining > 0) {
        if (candidateIndices) {
          for (const tileIdx of candidateIndices) {
            const tile = tiles[tileIdx];
            if (!tile.isFixed) continue;
            const info = getCircleRectCollisionInfo(b, tile);
            if (!info) continue;

            b.x += info.nx * (info.overlap + 0.5);
            b.y += info.ny * (info.overlap + 0.5);

            if (Math.abs(info.nx) > 0.5) b.vx *= -1;
            if (Math.abs(info.ny) > 0.5) b.vy *= -1;
            b.bouncesRemaining -= 1;

            hitTile = true;
            bounced = true;
            break;
          }
        } else {
          for (const tile of tiles) {
            if (!tile.isFixed) continue;
            const info = getCircleRectCollisionInfo(b, tile);
            if (!info) continue;

            b.x += info.nx * (info.overlap + 0.5);
            b.y += info.ny * (info.overlap + 0.5);

            if (Math.abs(info.nx) > 0.5) b.vx *= -1;
            if (Math.abs(info.ny) > 0.5) b.vy *= -1;
            b.bouncesRemaining -= 1;

            hitTile = true;
            bounced = true;
            break;
          }
        }
      }

      if (!hitTile) {
        if (candidateIndices) {
          for (const tileIdx of candidateIndices) {
            const tile = tiles[tileIdx];
            if (resolveCircleRect(b, tile, true)) {
              hitTile = true;
              break;
            }
          }
        } else {
          for (const tile of tiles) {
            if (resolveCircleRect(b, tile, true)) {
              hitTile = true;
              break;
            }
          }
        }
      }
      if (hitTile) {
        for (let k = 0; k < 3; k++) {
          particles.push(new Particle(
            b.x,
            b.y,
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200,
            0,
            200,
            b.color,
          ));
        }
        if (!bounced) {
          this.bullets.splice(i, 1);
        }
      }
    }
  }
}
