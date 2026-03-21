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
