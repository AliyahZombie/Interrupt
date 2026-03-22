import { Player } from './Entities';
import { Room } from './Room';

export abstract class Skill {
  name: string;
  cooldown: number; // in milliseconds
  lastUsed: number = 0;

  constructor(name: string, cooldown: number) {
    this.name = name;
    this.cooldown = cooldown;
  }

  canActivate(now: number): boolean {
    return now - this.lastUsed >= this.cooldown;
  }

  abstract activate(player: Player, room: Room, aimX: number, aimY: number): void;
}

export class DashSkill extends Skill {
  constructor() {
    super('Dash', 3000); // 3 seconds cooldown
  }

  activate(player: Player, room: Room, aimX: number, aimY: number): void {
    const now = Date.now();
    if (!this.canActivate(now)) return;
    this.lastUsed = now;

    const dashDistance = 150;
    
    // If no aim, dash in movement direction or default to right
    let dx = aimX;
    let dy = aimY;
    if (dx === 0 && dy === 0) {
      if (player.vx !== 0 || player.vy !== 0) {
        const len = Math.hypot(player.vx, player.vy);
        dx = player.vx / len;
        dy = player.vy / len;
      } else {
        dx = 1;
        dy = 0;
      }
    }

    player.x += dx * dashDistance;
    player.y += dy * dashDistance;

    // Constrain to map
    player.x = Math.max(player.radius, Math.min(room.map.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(room.map.height - player.radius, player.y));

    // Spawn particles
    for (let i = 0; i < 10; i++) {
      const pId = `part-${Date.now()}-${Math.random()}`;
      room.particles.set(pId, {
        id: pId,
        x: player.x - dx * (Math.random() * dashDistance),
        y: player.y - dy * (Math.random() * dashDistance),
        radius: Math.random() * 3 + 1,
        color: '#3b82f6',
        alpha: 1
      });
    }
  }
}

export class BounceSkill extends Skill {
  constructor() {
    super('Bounce', 1000); // 1 second cooldown
  }

  activate(player: Player, room: Room, aimX: number, aimY: number): void {
    const now = Date.now();
    if (!this.canActivate(now)) return;
    
    let reflected = false;
    const reflectRadius = player.radius + 10;
    
    for (const [id, proj] of room.projectiles.entries()) {
      if (proj.ownerId === player.id) continue;
      
      const dist = Math.hypot(player.x - proj.x, player.y - proj.y);
      if (dist <= reflectRadius + proj.radius) {
        reflected = true;
        
        // Reflect projectile
        if (aimX !== 0 || aimY !== 0) {
          const speed = Math.hypot(proj.vx, proj.vy);
          proj.vx = aimX * speed;
          proj.vy = aimY * speed;
        } else {
          proj.vx = -proj.vx;
          proj.vy = -proj.vy;
        }
        
        proj.ownerId = player.id;
        proj.color = player.color;
      }
    }
    
    if (reflected) {
      this.lastUsed = 0; // No cooldown
    } else {
      this.lastUsed = now; // 1 second cooldown
    }
    
    // Spawn particles
    const numParticles = 20;
    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * Math.PI * 2;
      const pId = `part-${Date.now()}-${Math.random()}`;
      room.particles.set(pId, {
        id: pId,
        x: player.x + Math.cos(angle) * reflectRadius,
        y: player.y + Math.sin(angle) * reflectRadius,
        radius: 2,
        color: reflected ? '#10b981' : '#9ca3af', // Green if reflected, gray if missed
        alpha: 1
      });
    }
  }
}
