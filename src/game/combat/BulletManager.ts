import type { DifficultyRules } from '../Difficulty';
import { Credit, Bullet, type BaseEnemy, MeleeEnemy, Particle, type Player, type Tile } from '../Entities';
import { resolveCircleRect } from '../physics/Collisions';

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
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 5) {
            e.hp -= b.damage;
            hit = true;
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
            break;
          }
        }
      } else {
        if (
          !player.isDashing &&
          !debugFlags.godMode &&
          Math.hypot(b.x - player.x, b.y - player.y) < player.radius + 5
        ) {
          player.applyDamage(b.damage * rules.playerDamageMultiplier, timeMs);
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

  collideTiles(tiles: Tile[], particles: Particle[]) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let hitTile = false;
      for (const tile of tiles) {
        if (resolveCircleRect(b, tile, true)) {
          hitTile = true;
          break;
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
        this.bullets.splice(i, 1);
      }
    }
  }
}
