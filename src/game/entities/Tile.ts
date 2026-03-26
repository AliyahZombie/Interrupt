export class Tile {
  kind: TileKind;
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public isFixed: boolean,
    public vx: number = 0,
    public vy: number = 0,
    public mass: number = 100,
    public color: string = '#0b1220',
    kind: TileKind = 'GENERIC'
  ) {
    this.kind = kind;
  }

  update(dt: number) {
    if (!this.isFixed) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const friction = 800;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 0) {
        const newSpeed = Math.max(0, speed - friction * dt);
        this.vx = (this.vx / speed) * newSpeed;
        this.vy = (this.vy / speed) * newSpeed;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, timeSec: number) {
    const x0 = this.x - cameraX - this.width / 2;
    const y0 = this.y - cameraY - this.height / 2;
    const w = this.width;
    const h = this.height;

    const isHorizontal = w >= h;

    const base = this.color;
    const accent = this.kind === 'DOOR'
      ? '#e879f9'
      : this.kind === 'BOUNDS'
        ? '#ef4444'
        : '#06b6d4';

    ctx.save();
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.fill();

    ctx.lineJoin = 'bevel';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.strokeRect(x0 + 3, y0 + 3, w - 6, h - 6);

    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToRgba(accent, 0.18);
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);

    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToRgba(accent, 0.8);
    ctx.shadowColor = hexToRgba(accent, 0.9);
    ctx.shadowBlur = 12;
    const dashA = Math.max(10, Math.min(28, Math.round((isHorizontal ? h : w) * 0.6)));
    const dashB = dashA * 2;
    ctx.setLineDash([dashA, dashB]);
    ctx.lineDashOffset = -((timeSec * 90 + this.x * 0.08 + this.y * 0.08) % (dashA + dashB));

    const inset = 2;
    ctx.beginPath();
    if (isHorizontal) {
      ctx.moveTo(x0 + inset, y0 + inset);
      ctx.lineTo(x0 + w - inset, y0 + inset);
      ctx.moveTo(x0 + inset, y0 + h - inset);
      ctx.lineTo(x0 + w - inset, y0 + h - inset);
    } else {
      ctx.moveTo(x0 + inset, y0 + inset);
      ctx.lineTo(x0 + inset, y0 + h - inset);
      ctx.moveTo(x0 + w - inset, y0 + inset);
      ctx.lineTo(x0 + w - inset, y0 + h - inset);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    const c = Math.max(10, Math.min(22, Math.round(Math.min(w, h) * 0.25)));
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexToRgba(accent, 0.35);
    ctx.beginPath();
    ctx.moveTo(x0 + c, y0 + 1);
    ctx.lineTo(x0 + 1, y0 + c);
    ctx.moveTo(x0 + w - c, y0 + 1);
    ctx.lineTo(x0 + w - 1, y0 + c);
    ctx.moveTo(x0 + w - c, y0 + h - 1);
    ctx.lineTo(x0 + w - 1, y0 + h - c);
    ctx.moveTo(x0 + c, y0 + h - 1);
    ctx.lineTo(x0 + 1, y0 + h - c);
    ctx.stroke();

    if (this.isFixed && this.kind !== 'GENERIC') {
      const p = (timeSec * 0.22 + (this.x + this.y) * 0.00035) % 1;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = accent;
      if (isHorizontal) {
        const slugW = Math.max(22, Math.min(80, Math.round(w * 0.12)));
        const sx = x0 + 6 + (w - 12 - slugW) * p;
        ctx.fillRect(sx, y0 + h * 0.5 - 1, slugW, 2);
      } else {
        const slugH = Math.max(22, Math.min(80, Math.round(h * 0.12)));
        const sy = y0 + 6 + (h - 12 - slugH) * p;
        ctx.fillRect(x0 + w * 0.5 - 1, sy, 2, slugH);
      }
      ctx.globalAlpha = 1;
    }

    if (this.isFixed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      const margin = 7;
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      ctx.beginPath();
      ctx.arc(cx - w / 2 + margin, cy - h / 2 + margin, 2, 0, Math.PI * 2);
      ctx.arc(cx + w / 2 - margin, cy - h / 2 + margin, 2, 0, Math.PI * 2);
      ctx.arc(cx - w / 2 + margin, cy + h / 2 - margin, 2, 0, Math.PI * 2);
      ctx.arc(cx + w / 2 - margin, cy + h / 2 - margin, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export type TileKind = 'WALL' | 'BOUNDS' | 'DOOR' | 'GENERIC';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = h.length === 3
    ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
    : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
