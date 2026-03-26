import type { EffectKind } from '../effects/types';

export interface BulletOptions {
  radius?: number;
  effectKind?: EffectKind;
  effectDurationMs?: number;
  bouncesRemaining?: number;
}

export class Bullet {
  public radius: number;
  public effectKind?: EffectKind;
  public effectDurationMs?: number;
  public bouncesRemaining: number;
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public life: number,
    public spawnTime: number,
    public damage: number,
    public isPlayer: boolean,
    public color: string,
    options?: BulletOptions
  ) {
    this.radius = options?.radius ?? (isPlayer ? 5 : 6);
    this.effectKind = options?.effectKind;
    this.effectDurationMs = options?.effectDurationMs;
    this.bouncesRemaining = options?.bouncesRemaining ?? 0;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
  }
}
