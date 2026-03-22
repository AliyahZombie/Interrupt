import { PlayerState, EnemyState, ProjectileState, CreditState, ParticleState } from '../src/shared/types';
import { Room } from './Room';
import { Skill, DashSkill, BounceSkill } from './Skills';

export abstract class Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;

  constructor(id: string, x: number, y: number, radius: number, color: string) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
  }
}

export class Player extends Entity {
  vx: number = 0;
  vy: number = 0;
  hp: number = 100;
  maxHp: number = 100;
  score: number = 0;
  credits: number = 0;
  skills: Skill[] = [];

  constructor(id: string, x: number, y: number, score: number = 0, credits: number = 0) {
    super(id, x, y, 20, '#3b82f6');
    this.score = score;
    this.credits = credits;
    this.skills.push(new DashSkill()); // Default skill
    this.skills.push(new BounceSkill()); // Second skill
  }

  getState(): PlayerState {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      radius: this.radius,
      hp: this.hp,
      maxHp: this.maxHp,
      color: this.color,
      score: this.score,
      credits: this.credits,
      skills: this.skills.map(s => ({
        name: s.name,
        cooldown: s.cooldown,
        lastUsed: s.lastUsed
      }))
    };
  }
}

export abstract class BaseEnemy extends Entity {
  hp: number;
  maxHp: number;
  type: 'melee' | 'ranged';

  constructor(id: string, type: 'melee' | 'ranged', x: number, y: number, radius: number, hp: number, color: string) {
    super(id, x, y, radius, color);
    this.type = type;
    this.hp = hp;
    this.maxHp = hp;
  }

  abstract update(dt: number, room: Room): void;

  getState(): EnemyState {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      radius: this.radius,
      hp: this.hp,
      maxHp: this.maxHp,
      color: this.color
    };
  }
}

export class MeleeEnemy extends BaseEnemy {
  speed: number = 100;

  constructor(id: string, x: number, y: number) {
    super(id, 'melee', x, y, 15, 50, '#ef4444');
  }

  update(dt: number, room: Room): void {
    let nearestPlayer: Player | null = null;
    let minDist = Infinity;
    for (const player of room.players.values()) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist < minDist) {
        minDist = dist;
        nearestPlayer = player;
      }
    }

    if (nearestPlayer) {
      const angle = Math.atan2(nearestPlayer.y - this.y, nearestPlayer.x - this.x);
      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Damage player if close enough
      if (minDist < this.radius + nearestPlayer.radius) {
        nearestPlayer.hp -= 20 * dt; // 20 damage per second
        if (nearestPlayer.hp <= 0) {
          nearestPlayer.hp = nearestPlayer.maxHp;
          nearestPlayer.x = Math.random() * room.map.width;
          nearestPlayer.y = Math.random() * room.map.height;
          nearestPlayer.score = Math.floor(nearestPlayer.score / 2);
          room.io.to(nearestPlayer.id).emit('playerDied');
        }
      }
    }
  }
}

export class RangedEnemy extends BaseEnemy {
  speed: number = 70;
  optimalDist: number = 300;
  lastShootTime: number = 0;

  constructor(id: string, x: number, y: number) {
    super(id, 'ranged', x, y, 12, 30, '#a855f7');
  }

  update(dt: number, room: Room): void {
    let nearestPlayer: Player | null = null;
    let minDist = Infinity;
    for (const player of room.players.values()) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist < minDist) {
        minDist = dist;
        nearestPlayer = player;
      }
    }

    if (nearestPlayer) {
      const angle = Math.atan2(nearestPlayer.y - this.y, nearestPlayer.x - this.x);
      
      // Move towards optimal distance
      if (minDist > this.optimalDist + 20) {
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
      } else if (minDist < this.optimalDist - 20) {
        this.vx = -Math.cos(angle) * this.speed;
        this.vy = -Math.sin(angle) * this.speed;
      } else {
        this.vx = 0;
        this.vy = 0;
      }
      
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Shoot at player
      const now = Date.now();
      if (now - this.lastShootTime > 1500 && minDist < 400) {
        this.lastShootTime = now;
        const projId = `proj-enemy-${Date.now()}-${Math.random()}`;
        const projSpeed = 250;
        room.projectiles.set(projId, {
          id: projId,
          x: this.x,
          y: this.y,
          vx: Math.cos(angle) * projSpeed,
          vy: Math.sin(angle) * projSpeed,
          radius: 4,
          color: '#a855f7',
          ownerId: this.id
        });
      }
    }
  }

  getState(): EnemyState {
    const state = super.getState();
    state.lastShootTime = this.lastShootTime;
    return state;
  }
}
