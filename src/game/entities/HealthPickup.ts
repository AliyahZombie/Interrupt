export class HealthPickup {
  radius: number;
  constructor(
    public x: number,
    public y: number,
    public spawnTime: number
  ) {
    this.radius = 18;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    const pulse = 1 + Math.sin(time * 4) * 0.08;
    const r = this.radius * pulse;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(time * 1.25);

    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, 0);
    ctx.lineTo(r * 0.6, 0);
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(0, r * 0.6);
    ctx.stroke();

    ctx.restore();
  }
}
