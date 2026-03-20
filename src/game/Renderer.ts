import { ClientEngine } from './ClientEngine';
import { RoomState, PlayerState, EnemyState, ProjectileState, ParticleState, CreditState, TileState } from '../shared/types';

export class Renderer {
  constructor(public canvas: HTMLCanvasElement, public ctx: CanvasRenderingContext2D) {}

  draw(engine: ClientEngine) {
    const { canvas, ctx } = this;

    // Always draw background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!engine.state || !engine.playerId) {
      // Draw some cool background for the menu
      this.drawGrid(0, 0, canvas.width, canvas.height);
      return;
    }

    const state = engine.state;
    const player = state.players[engine.playerId];
    if (!player) return;

    let cameraX = player.x - canvas.width / 2;
    let cameraY = player.y - canvas.height / 2;
    cameraX = Math.max(0, Math.min(state.width - canvas.width, cameraX));
    cameraY = Math.max(0, Math.min(state.height - canvas.height, cameraY));

    const screenPx = player.x - cameraX;
    const screenPy = player.y - cameraY;

    this.drawGrid(cameraX, cameraY, canvas.width, canvas.height);

    // Bounds
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-cameraX, -cameraY, state.width, state.height);
    ctx.restore();

    // Entities
    // Tiles are hidden as requested
    // Object.values(state.tiles).forEach(t => this.drawTile(t, cameraX, cameraY));
    
    Object.values(state.credits).forEach(c => this.drawCredit(c, cameraX, cameraY, performance.now() / 1000));
    Object.values(state.particles).forEach(p => this.drawParticle(p, cameraX, cameraY));
    Object.values(state.enemies).forEach(e => this.drawEnemy(e, cameraX, cameraY));
    Object.values(state.projectiles).forEach(p => this.drawProjectile(p, cameraX, cameraY));

    // Draw other players
    Object.values(state.players).forEach(p => {
      if (p.id !== engine.playerId) {
        this.drawPlayer(p, cameraX, cameraY, false);
      }
    });

    // Draw local player
    this.drawPlayer(player, cameraX, cameraY, true);

    // Regular Aiming Indicator
    if (engine.rightJoystick.active) {
      const dx = engine.rightJoystick.x - engine.rightJoystick.originX;
      const dy = engine.rightJoystick.y - engine.rightJoystick.originY;
      if (Math.hypot(dx, dy) > 10) {
        const angle = Math.atan2(dy, dx);
        const offset = player.radius + 15;
        ctx.save();
        ctx.translate(screenPx, screenPy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(offset + 15, 0);
        ctx.lineTo(offset, -10);
        ctx.lineTo(offset, 10);
        ctx.fillStyle = '#eab308';
        ctx.fill();
        ctx.closePath();
        
        ctx.beginPath();
        ctx.moveTo(offset + 15, 0);
        ctx.lineTo(800, 0);
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
      }
    }

    this.drawUI(engine, player);
  }

  private drawGrid(cameraX: number, cameraY: number, width: number, height: number) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
    ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    const gridSize = 100;
    const offsetX = -cameraX % gridSize;
    const offsetY = -cameraY % gridSize;
    
    ctx.beginPath();
    for (let x = offsetX - gridSize; x < width + gridSize; x += gridSize) {
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let y = offsetY - gridSize; y < height + gridSize; y += gridSize) {
      ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawPlayer(p: PlayerState, cameraX: number, cameraY: number, isLocal: boolean) {
    const { ctx } = this;
    const x = p.x - cameraX;
    const y = p.y - cameraY;

    ctx.save();
    ctx.translate(x, y);
    
    // Draw body
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;
    ctx.fill();
    
    // Draw outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw ID
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(isLocal ? 'YOU' : p.id.slice(0, 4), 0, -p.radius - 10);

    ctx.restore();
  }

  private drawEnemy(e: EnemyState, cameraX: number, cameraY: number) {
    const { ctx } = this;
    const x = e.x - cameraX;
    const y = e.y - cameraY;

    ctx.save();
    ctx.translate(x, y);
    
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 15;
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }

  private drawProjectile(p: ProjectileState, cameraX: number, cameraY: number) {
    const { ctx } = this;
    const x = p.x - cameraX;
    const y = p.y - cameraY;

    ctx.beginPath();
    ctx.arc(x, y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fill();
  }

  private drawParticle(p: ParticleState, cameraX: number, cameraY: number) {
    const { ctx } = this;
    const x = p.x - cameraX;
    const y = p.y - cameraY;

    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(x, y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawCredit(c: CreditState, cameraX: number, cameraY: number, time: number) {
    const { ctx } = this;
    const x = c.x - cameraX;
    const y = c.y - cameraY;

    ctx.save();
    ctx.translate(x, y);
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
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }

  private drawUI(engine: ClientEngine, player: PlayerState) {
    const { canvas, ctx } = this;

    // --- Player HP Bar (Cyberpunk Style) ---
    const hpBarWidth = 300;
    const hpBarHeight = 14;
    const hpBarX = canvas.width / 2 - hpBarWidth / 2;
    const hpBarY = canvas.height - 50;
    const hpPercent = Math.max(0, player.hp / player.maxHp);
    const isLowHp = hpPercent < 0.3;

    ctx.save();
    // Brackets
    ctx.strokeStyle = isLowHp ? '#ef4444' : '#06b6d4';
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    
    ctx.beginPath();
    ctx.moveTo(hpBarX - 10, hpBarY - 4);
    ctx.lineTo(hpBarX - 10, hpBarY + hpBarHeight + 4);
    ctx.lineTo(hpBarX - 2, hpBarY + hpBarHeight + 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hpBarX + hpBarWidth + 10, hpBarY - 4);
    ctx.lineTo(hpBarX + hpBarWidth + 10, hpBarY + hpBarHeight + 4);
    ctx.lineTo(hpBarX + hpBarWidth + 2, hpBarY + hpBarHeight + 4);
    ctx.stroke();

    // Background
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

    // Fill
    ctx.fillStyle = isLowHp ? '#ef4444' : '#22c55e';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

    // Segments
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    const segments = 10;
    for (let i = 1; i < segments; i++) {
      ctx.fillRect(hpBarX + (hpBarWidth / segments) * i - 1, hpBarY, 2, hpBarHeight);
    }

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`SYS.INTEGRITY`, hpBarX, hpBarY - 6);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = isLowHp ? '#ef4444' : '#06b6d4';
    ctx.fillText(`${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp}`, hpBarX + hpBarWidth, hpBarY - 6);
    ctx.restore();

    // Boss Bar hidden as requested

    // Score & Credits
    ctx.textAlign = 'left';
    ctx.font = '24px "JetBrains Mono", monospace, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SCORE: ${player.score}`, 20, 40);
    
    ctx.fillStyle = '#06b6d4';
    ctx.fillText(`CREDITS: ${player.credits}`, 20, 70);

    // Room Info
    ctx.textAlign = 'right';
    ctx.fillStyle = '#eab308';
    ctx.fillText(`ROOM: ${engine.state?.type.toUpperCase()}`, canvas.width - 20, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "JetBrains Mono"';
    ctx.fillText(`PLAYERS: ${Object.keys(engine.state?.players || {}).length}`, canvas.width - 20, 70);

    // Joysticks
    const drawJoystick = (joy: any, color: string) => {
      if (!joy.active) return;
      ctx.beginPath();
      ctx.arc(joy.originX, joy.originY, joy.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, 0.1)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${color}, 0.3)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.closePath();

      ctx.beginPath();
      ctx.arc(joy.x, joy.y, joy.knobRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color}, 0.5)`;
      ctx.fill();
      ctx.closePath();
    };

    drawJoystick(engine.leftJoystick, '255, 255, 255');
    drawJoystick(engine.rightJoystick, '234, 179, 8');
  }
}
