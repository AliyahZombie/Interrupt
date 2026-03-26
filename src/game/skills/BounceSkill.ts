import type { GameEngine } from '../Engine';
import { Particle } from '../Entities';
import { Skill } from './Skill';

export class BounceSkill extends Skill {
  constructor() {
    super('bounce', 'BOUNCE', 1, 0, '#eab308', false);
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
          p.color = '#06b6d4';
          p.vx = -p.vx;
          p.vy = -p.vy;
          reflected = true;

          for (let i = 0; i < 5; i++) {
            engine.particles.push(new Particle(
              p.x,
              p.y,
              (Math.random() - 0.5) * 200,
              (Math.random() - 0.5) * 200,
              0,
              500,
              '#06b6d4'
            ));
          }
        }
      }
    }

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      engine.particles.push(new Particle(
        engine.player.x + Math.cos(angle) * reflectRadius,
        engine.player.y + Math.sin(angle) * reflectRadius,
        Math.cos(angle) * 100,
        Math.sin(angle) * 100,
        0,
        300,
        '#eab308'
      ));
    }

    if (reflected) {
      this.currentCooldown = 0;
    } else {
      this.currentCooldown = this.cooldown;
    }
  }
}
