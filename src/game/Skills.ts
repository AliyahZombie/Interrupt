import { GameEngine } from './Engine';
import { Particle } from './Entities';

export abstract class Skill {
  constructor(
    public id: string,
    public name: string,
    public cooldown: number, // in seconds
    public currentCooldown: number = 0,
    public color: string,
    public isDirectional: boolean = false
  ) {}

  // The core logic of the skill
  abstract activate(engine: GameEngine, dx: number, dy: number): void;

  update(dt: number) {
    if (this.currentCooldown > 0) {
      this.currentCooldown -= dt;
      if (this.currentCooldown < 0) this.currentCooldown = 0;
    }
  }
}

export class DashSkill extends Skill {
  constructor() {
    super('dash', 'DASH', 3, 0, '#3b82f6', true); // Blue color for Dash
  }

  activate(engine: GameEngine, dx: number, dy: number) {
    if (this.currentCooldown > 0 && !engine.debugFlags.noCooldowns) return;

    // Determine dash direction
    let dist = Math.hypot(dx, dy);
    if (dist === 0) {
      // 1. Prioritize movement joystick
      if (engine.leftJoystick.active) {
        dx = engine.leftJoystick.x - engine.leftJoystick.originX;
        dy = engine.leftJoystick.y - engine.leftJoystick.originY;
      } 
      // 2. Fallback to aiming joystick
      else if (engine.rightJoystick.active) {
         dx = engine.rightJoystick.x - engine.rightJoystick.originX;
         dy = engine.rightJoystick.y - engine.rightJoystick.originY;
      } else {
         dx = 1; dy = 0;
      }
      dist = Math.hypot(dx, dy);
      if (dist === 0) { dx = 1; dy = 0; dist = 1; }
    }

    dx /= dist;
    dy /= dist;

    // Start dash state
    engine.player.isDashing = true;
    engine.player.dashTimeRemaining = 0.25; // 0.25 seconds dash
    engine.player.dashDx = dx;
    engine.player.dashDy = dy;
    engine.player.dashSpeed = 1600; // 1600 px/s * 0.25s = 400px

    // Start cooldown
    this.currentCooldown = this.cooldown;
  }
}

export class BounceSkill extends Skill {
  constructor() {
    super('bounce', 'BOUNCE', 1, 0, '#eab308', false); // 1 second cooldown, yellow color, not directional
  }

  activate(engine: GameEngine, dx: number, dy: number) {
    if (this.currentCooldown > 0 && !engine.debugFlags.noCooldowns) return;

    let reflected = false;
    const reflectRadius = engine.player.radius + 20;
    
    for (const p of engine.projectiles) {
      if (!p.isPlayer) {
        const dist = Math.hypot(p.x - engine.player.x, p.y - engine.player.y);
        if (dist <= reflectRadius + p.radius) {
          p.isPlayer = true;
          p.color = '#06b6d4'; // Change to player bullet color
          p.vx = -p.vx;
          p.vy = -p.vy;
          reflected = true;
          
          for (let i = 0; i < 5; i++) {
            engine.particles.push(new Particle(
              p.x, p.y,
              (Math.random() - 0.5) * 200,
              (Math.random() - 0.5) * 200,
              0, 500, '#06b6d4'
            ));
          }
        }
      }
    }

    // Visual effect for bounce activation
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      engine.particles.push(new Particle(
        engine.player.x + Math.cos(angle) * reflectRadius,
        engine.player.y + Math.sin(angle) * reflectRadius,
        Math.cos(angle) * 100,
        Math.sin(angle) * 100,
        0, 300, '#eab308'
      ));
    }

    if (reflected) {
      this.currentCooldown = 0;
    } else {
      this.currentCooldown = this.cooldown; // 1 second
    }
  }
}
