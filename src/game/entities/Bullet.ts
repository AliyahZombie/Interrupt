import type { EffectKind } from '../effects/types';

export interface BulletOptions {
  radius?: number;
  effectKind?: EffectKind;
  effectDurationMs?: number;
  bouncesRemaining?: number;
  piercesRemaining?: number;
  strokeColor?: string;
  strokeWidthPx?: number;
}

export class Bullet {
  public radius: number;
  public effectKind?: EffectKind;
  public effectDurationMs?: number;
  public bouncesRemaining: number;
  public piercesRemaining: number;
  public hitTargets: WeakSet<object>;
  public strokeColor?: string;
  public strokeWidthPx: number;
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
    this.piercesRemaining = options?.piercesRemaining ?? 0;
    this.hitTargets = new WeakSet();
    this.strokeColor = options?.strokeColor;
    this.strokeWidthPx = options?.strokeWidthPx ?? 2;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const x = this.x - cameraX;
    const y = this.y - cameraY;

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;

    if (this.strokeColor) {
      ctx.strokeStyle = this.strokeColor;
      ctx.lineWidth = this.strokeWidthPx;
      ctx.beginPath();
      ctx.arc(x, y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.closePath();
    }
  }
}
