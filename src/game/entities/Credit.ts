export class Credit {
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

    ctx.fillStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();
  }
}
