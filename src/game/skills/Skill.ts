import type { GameEngine } from '../Engine';

export abstract class Skill {
  constructor(
    public id: string,
    public name: string,
    public cooldown: number,
    public currentCooldown: number = 0,
    public color: string,
    public isDirectional: boolean = false
  ) {}

  abstract activate(engine: GameEngine, dx: number, dy: number): void;

  update(dt: number) {
    if (this.currentCooldown > 0) {
      this.currentCooldown -= dt;
      if (this.currentCooldown < 0) this.currentCooldown = 0;
    }
  }
}
