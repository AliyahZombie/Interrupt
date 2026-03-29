export class MpDrop {
  constructor(
    public x: number,
    public y: number,
    public value: number,
    public spawnTime: number
  ) {}

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(time * 2);
    const scale = 1 + Math.sin(time * 5) * 0.15;
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(4, -4, 12, 0);
    ctx.quadraticCurveTo(4, 4, 0, 12);
    ctx.quadraticCurveTo(-4, 4, -12, 0);
    ctx.quadraticCurveTo(-4, -4, 0, -12);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
  }
}
