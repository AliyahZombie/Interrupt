import type { Difficulty, DifficultyRules } from './Difficulty';
import { getPortalSvgDataUrl } from './assets/portalSvg';

export interface GameState {
  player: Player;
  projectiles: Bullet[];
  particles: Particle[];
  tiles: Tile[];
  enemies: BaseEnemy[];
  score: number;
  time: number;
  difficulty: Difficulty;
  rules: DifficultyRules;
  debugFlags: {
    stopSpawning: boolean;
    godMode: boolean;
    noCooldowns: boolean;
    showWaveDebug: boolean;
  };
}

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const normalize = (x: number, y: number) => {
  const len = Math.hypot(x, y);
  if (len <= 1e-6) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
};

const computeSeparation = (self: BaseEnemy, enemies: BaseEnemy[], range: number) => {
  let sx = 0;
  let sy = 0;
  for (const other of enemies) {
    if (other === self) continue;
    const dx = self.x - other.x;
    const dy = self.y - other.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1e-6 || dist >= range) continue;
    const strength = 1 - dist / range;
    sx += (dx / dist) * strength;
    sy += (dy / dist) * strength;
  }
  return { x: sx, y: sy };
};

const computeBulletDodge = (
  self: BaseEnemy,
  projectiles: Bullet[],
  detectionRange: number,
  extraClearance: number
) => {
  let ax = 0;
  let ay = 0;
  for (const p of projectiles) {
    if (!p.isPlayer) continue;
    const vLen = Math.hypot(p.vx, p.vy);
    if (vLen <= 1e-6) continue;

    const rx = self.x - p.x;
    const ry = self.y - p.y;
    const distToProjectile = Math.hypot(rx, ry);
    if (distToProjectile > detectionRange) continue;

    const dot = (p.vx * rx + p.vy * ry) / vLen;
    if (dot <= 0) continue;

    const crossZ = p.vx * ry - p.vy * rx;
    const perpDist = Math.abs(crossZ) / vLen;
    const clearance = self.radius + extraClearance;
    if (perpDist > clearance) continue;

    let perpX = -p.vy / vLen;
    let perpY = p.vx / vLen;
    if (crossZ < 0) {
      perpX = -perpX;
      perpY = -perpY;
    }

    const threat = (1 - perpDist / clearance) * (1 - distToProjectile / detectionRange);
    ax += perpX * threat;
    ay += perpY * threat;
  }
  return { x: ax, y: ay };
};

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
      // Apply friction (linear deceleration)
      const friction = 800; // pixels per second squared
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
    
    // Rotate slowly over time
    ctx.rotate(time * 2);
    
    // Pulse scale effect
    const scale = 1 + Math.sin(time * 5) * 0.15;
    ctx.scale(scale, scale);

    // Draw curved rhombus
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(4, -4, 12, 0);
    ctx.quadraticCurveTo(4, 4, 0, 12);
    ctx.quadraticCurveTo(-4, 4, -12, 0);
    ctx.quadraticCurveTo(-4, -4, 0, -12);
    
    ctx.fillStyle = '#06b6d4'; // Cyan
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();
  }
}

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

export class Portal {
  radius: number;
  constructor(
    public x: number,
    public y: number,
    public spawnTime: number
  ) {
    this.radius = 34;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    const wobble = 1 + Math.sin(time * 3) * 0.05;
    const size = this.radius * 2.8 * wobble;
    const img = getPortalImage();

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(time * 0.55);

    if (img.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = 0.96;
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.globalAlpha = 1;
    } else {
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * wobble, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

let portalImage: HTMLImageElement | null = null;
function getPortalImage(): HTMLImageElement {
  if (portalImage) return portalImage;
  const img = new Image();
  img.decoding = 'async';
  img.src = getPortalSvgDataUrl();
  portalImage = img;
  return img;
}

export class Particle {
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public life: number,
    public maxLife: number,
    public color: string
  ) {}

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life += dt * 1000;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    ctx.globalAlpha = Math.max(0, 1 - this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - cameraX, this.y - cameraY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

export class Bullet {
  public radius: number;
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public life: number,
    public spawnTime: number,
    public damage: number,
    public isPlayer: boolean,
    public color: string
  ) {
    this.radius = isPlayer ? 5 : 6;
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
    ctx.arc(this.x - cameraX, this.y - cameraY, this.isPlayer ? 5 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
  }
}

export class Player {
  isDashing: boolean = false;
  dashTimeRemaining: number = 0;
  dashDx: number = 0;
  dashDy: number = 0;
  dashSpeed: number = 1600;

  private effects = new Map<EffectKind, ActiveEffect>();

  shield: number = 0;
  maxShield: number = 0;
  shieldRegenDelayMs: number = 3500;
  shieldRegenPerSecond: number = 60;
  lastDamagedAtMs: number = -Infinity;

  constructor(
    public x: number,
    public y: number,
    public radius: number,
    public speed: number,
    public hp: number,
    public maxHp: number
  ) {}

  configureShield(maxShield: number, regenDelayMs: number, regenPerSecond: number) {
    this.maxShield = Math.max(0, maxShield);
    this.shieldRegenDelayMs = Math.max(0, regenDelayMs);
    this.shieldRegenPerSecond = Math.max(0, regenPerSecond);
    this.shield = clamp(this.shield, 0, this.maxShield);
  }

  resetVitals(timeMs: number) {
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.lastDamagedAtMs = timeMs;
    this.effects.clear();
  }

  applyDamage(amount: number, timeMs: number) {
    if (amount <= 0) return;
    this.lastDamagedAtMs = timeMs;

    const shieldAbsorb = Math.min(this.shield, amount);
    this.shield -= shieldAbsorb;
    const remaining = amount - shieldAbsorb;
    if (remaining > 0) {
      this.hp = Math.max(0, this.hp - remaining);
    }
  }

  updateShield(dt: number, timeMs: number) {
    if (this.maxShield <= 0) return;
    if (this.shield >= this.maxShield) return;
    if (timeMs - this.lastDamagedAtMs < this.shieldRegenDelayMs) return;

    this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenPerSecond * dt);
  }

  applyEffect(kind: EffectKind, durationMs: number, timeMs: number) {
    const dur = Math.max(0, durationMs);
    if (dur <= 0) return;
    const existing = this.effects.get(kind);
    if (!existing) {
      this.effects.set(kind, { kind, remainingMs: dur, startedAtMs: timeMs });
      return;
    }
    existing.remainingMs = Math.max(existing.remainingMs, dur);
  }

  hasEffect(kind: EffectKind): boolean {
    const e = this.effects.get(kind);
    return !!e && e.remainingMs > 0;
  }

  getEffectRemainingMs(kind: EffectKind): number {
    const e = this.effects.get(kind);
    return e ? Math.max(0, e.remainingMs) : 0;
  }

  updateEffects(dt: number, timeMs: number) {
    if (this.effects.size === 0) return;

    const dtMs = dt * 1000;
    for (const e of this.effects.values()) {
      e.remainingMs -= dtMs;
    }

    const poison = this.effects.get('POISON');
    if (poison && poison.remainingMs > 0) {
      const dps = 18;
      const next = this.hp - dps * dt;
      const clamped = Math.max(1, next);
      if (clamped < this.hp) {
        this.hp = clamped;
        this.lastDamagedAtMs = timeMs;
      }
    }

    for (const [kind, e] of this.effects) {
      if (e.remainingMs <= 0) {
        this.effects.delete(kind);
      }
    }
  }

  isStunned(): boolean {
    return this.hasEffect('STUN');
  }

  update(dt: number, worldWidth: number, worldHeight: number) {
    if (this.isDashing) {
      this.dashTimeRemaining -= dt;
      this.x += this.dashDx * this.dashSpeed * dt;
      this.y += this.dashDy * this.dashSpeed * dt;

      // Clamp to world bounds
      this.x = Math.max(this.radius, Math.min(worldWidth - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(worldHeight - this.radius, this.y));

      if (this.dashTimeRemaining <= 0) {
        this.isDashing = false;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, screenPx: number, screenPy: number) {
    ctx.shadowColor = this.isDashing ? '#3b82f6' : '#ffffff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(screenPx, screenPy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.isDashing ? '#3b82f6' : '#ffffff';
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;
  }
}

export type EffectKind = 'STUN' | 'POISON';

type ActiveEffect = {
  kind: EffectKind;
  remainingMs: number;
  startedAtMs: number;
};

export abstract class BaseEnemy {
  constructor(
    public x: number,
    public y: number,
    public radius: number,
    public speed: number,
    public hp: number,
    public maxHp: number,
    public color: string
  ) {}

  abstract update(dt: number, state: GameState): void;

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(this.x - cameraX, this.y - cameraY, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;

    // HP Bar
    const hpPercent = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(this.x - cameraX - 15, this.y - cameraY - 25, 30, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(this.x - cameraX - 15, this.y - cameraY - 25, 30 * hpPercent, 4);
  }
}

export class MeleeEnemy extends BaseEnemy {
  swirlDirection: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  vx: number = 0;
  vy: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 18, 120 + Math.random() * 50, 300, 300, '#ef4444');
  }

  update(dt: number, state: GameState) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);

    let moveX = 0;
    let moveY = 0;

    if (dist > 1e-6) {
      const ux = dx / dist;
      const uy = dy / dist;
      moveX += ux;
      moveY += uy;
      moveX += (-uy * this.swirlDirection) * 0.25;
      moveY += (ux * this.swirlDirection) * 0.25;
    }

    const sep = computeSeparation(this, state.enemies, 120);
    moveX += sep.x * 1.6;
    moveY += sep.y * 1.6;

    if (state.rules.enemiesDodgeBullets) {
      const dodge = computeBulletDodge(this, state.projectiles, 260, 18);
      moveX += dodge.x * 2.2;
      moveY += dodge.y * 2.2;
    }

    const forceLen = Math.hypot(moveX, moveY);
    const desiredSpeed = this.speed * clamp(forceLen, 0, 1);
    const dir = forceLen <= 1e-6 ? { x: 0, y: 0 } : { x: moveX / forceLen, y: moveY / forceLen };

    const desiredVx = dir.x * desiredSpeed;
    const desiredVy = dir.y * desiredSpeed;

    const maxAccel = 1800;
    const ax = (desiredVx - this.vx) / Math.max(dt, 1e-6);
    const ay = (desiredVy - this.vy) / Math.max(dt, 1e-6);
    const aLen = Math.hypot(ax, ay);
    const accelScale = aLen > maxAccel ? maxAccel / aLen : 1;
    this.vx += ax * accelScale * dt;
    this.vy += ay * accelScale * dt;

    const damping = 7;
    const dampFactor = Math.exp(-damping * dt);
    this.vx *= dampFactor;
    this.vy *= dampFactor;

    const vLen = Math.hypot(this.vx, this.vy);
    const vMax = this.speed;
    if (vLen > vMax && vLen > 1e-6) {
      this.vx = (this.vx / vLen) * vMax;
      this.vy = (this.vy / vLen) * vMax;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (dist < this.radius + state.player.radius) {
      if (!state.player.isDashing && !state.debugFlags.godMode) {
        state.player.applyDamage(50 * dt * state.rules.playerDamageMultiplier, state.time);
      }
    }
  }
}

export class RangedEnemy extends BaseEnemy {
  lastShot: number = 0;
  orbitDirection: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  constructor(x: number, y: number) {
    super(x, y, 15, 80 + Math.random() * 40, 100, 100, '#a855f7');
  }

  update(dt: number, state: GameState) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    let moveX = 0;
    let moveY = 0;

    if (dist > 1e-6) {
      const ux = dx / dist;
      const uy = dy / dist;

      const orbitRadius = 360;
      const orbitBand = 140;
      const radialStrength = clamp((dist - orbitRadius) / orbitBand, -1, 1);

      const tx = -uy * this.orbitDirection;
      const ty = ux * this.orbitDirection;

      moveX += tx * 1.1;
      moveY += ty * 1.1;

      moveX += ux * radialStrength * 0.9;
      moveY += uy * radialStrength * 0.9;
    }

    const sep = computeSeparation(this, state.enemies, 160);
    moveX += sep.x * 2.1;
    moveY += sep.y * 2.1;

    if (state.rules.enemiesDodgeBullets) {
      const dodge = computeBulletDodge(this, state.projectiles, 280, 18);
      moveX += dodge.x * 2.0;
      moveY += dodge.y * 2.0;
    }

    const move = normalize(moveX, moveY);
    this.x += move.x * this.speed * dt;
    this.y += move.y * this.speed * dt;

    if (state.time - this.lastShot > 2000) {
      state.projectiles.push(new Bullet(
        this.x, this.y,
        Math.cos(angle) * 400, Math.sin(angle) * 400,
        2000, state.time, 20, false, '#a855f7'
      ));
      this.lastShot = state.time;
    }
  }
}
