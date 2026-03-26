import type { GameEngine } from '../Engine';
import { Skill } from './Skill';

export class DashSkill extends Skill {
  constructor() {
    super('dash', 'DASH', 3, 0, '#3b82f6', true);
  }

  activate(engine: GameEngine, dx: number, dy: number) {
    if (this.currentCooldown > 0 && !engine.debugFlags.noCooldowns) return;

    let dist = Math.hypot(dx, dy);
    if (dist === 0) {
      if (engine.leftJoystick.active) {
        dx = engine.leftJoystick.x - engine.leftJoystick.originX;
        dy = engine.leftJoystick.y - engine.leftJoystick.originY;
      } else if (engine.rightJoystick.active) {
        dx = engine.rightJoystick.x - engine.rightJoystick.originX;
        dy = engine.rightJoystick.y - engine.rightJoystick.originY;
      } else {
        dx = 1;
        dy = 0;
      }
      dist = Math.hypot(dx, dy);
      if (dist === 0) {
        dx = 1;
        dy = 0;
        dist = 1;
      }
    }

    dx /= dist;
    dy /= dist;

    engine.player.isDashing = true;
    engine.player.dashTimeRemaining = 0.25;
    engine.player.dashDx = dx;
    engine.player.dashDy = dy;
    engine.player.dashSpeed = 1600;

    this.currentCooldown = this.cooldown;
  }
}
