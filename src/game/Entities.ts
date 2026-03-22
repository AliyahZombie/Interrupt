export interface GameState {
  player: Player;
  projectiles: Projectile[];
  particles: Particle[];
  tiles: Tile[];
  score: number;
  time: number;
}

export class Tile {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public isFixed: boolean,
    public vx: number = 0,
    public vy: number = 0,
    public mass: number = 100,
    public color: string = '#334155'
  ) {}

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

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(this.x - cameraX - this.width / 2, this.y - cameraY - this.height / 2, this.width, this.height, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Draw an inner border or pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - cameraX - this.width / 2, this.y - cameraY - this.height / 2, this.width, this.height);
    
    // If fixed, draw some "rivets" or anchors
    if (this.isFixed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      const margin = 6;
      const w2 = this.width / 2;
      const h2 = this.height / 2;
      const cx = this.x - cameraX;
      const cy = this.y - cameraY;
      ctx.beginPath();
      ctx.arc(cx - w2 + margin, cy - h2 + margin, 2, 0, Math.PI * 2);
      ctx.arc(cx + w2 - margin, cy - h2 + margin, 2, 0, Math.PI * 2);
      ctx.arc(cx - w2 + margin, cy + h2 - margin, 2, 0, Math.PI * 2);
      ctx.arc(cx + w2 - margin, cy + h2 - margin, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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

export class Projectile {
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

  constructor(
    public x: number,
    public y: number,
    public radius: number,
    public speed: number,
    public hp: number,
    public maxHp: number
  ) {}

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
  constructor(x: number, y: number) {
    super(x, y, 18, 120 + Math.random() * 50, 300, 300, '#ef4444');
  }

  update(dt: number, state: GameState) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > 0) {
      const angle = Math.atan2(dy, dx);
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    }

    if (dist < this.radius + state.player.radius) {
      if (!state.player.isDashing && !(state as any).debugFlags?.godMode) {
        state.player.hp -= 50 * dt;
      }
    }
  }
}

export class RangedEnemy extends BaseEnemy {
  lastShot: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 15, 80 + Math.random() * 40, 100, 100, '#a855f7');
  }

  update(dt: number, state: GameState) {
    const dx = state.player.x - this.x;
    const dy = state.player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    if (dist > 400) {
      this.x += Math.cos(angle) * this.speed * dt;
      this.y += Math.sin(angle) * this.speed * dt;
    } else if (dist < 300) {
      this.x -= Math.cos(angle) * (this.speed * 0.5) * dt;
      this.y -= Math.sin(angle) * (this.speed * 0.5) * dt;
    }

    if (state.time - this.lastShot > 2000) {
      state.projectiles.push(new Projectile(
        this.x, this.y,
        Math.cos(angle) * 400, Math.sin(angle) * 400,
        2000, state.time, 20, false, '#a855f7'
      ));
      this.lastShot = state.time;
    }
  }
}
