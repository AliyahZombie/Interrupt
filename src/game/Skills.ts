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
    if (this.currentCooldown > 0) return;

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
