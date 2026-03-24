import type { GameEngine, JoystickData } from './Engine';

export class Renderer {
  constructor(public canvas: HTMLCanvasElement, public ctx: CanvasRenderingContext2D) {}

  draw(engine: GameEngine) {
    const { canvas, ctx } = this;

    // Always draw background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!engine.gameStarted) {
      // Draw some cool background for the menu
      this.drawGrid(engine, 0, 0);
      return;
    }

    let cameraX = engine.player.x - canvas.width / 2;
    let cameraY = engine.player.y - canvas.height / 2;
    cameraX = Math.max(0, Math.min(engine.world.width - canvas.width, cameraX));
    cameraY = Math.max(0, Math.min(engine.world.height - canvas.height, cameraY));

    const screenPx = engine.player.x - cameraX;
    const screenPy = engine.player.y - cameraY;

    this.drawGrid(engine, cameraX, cameraY);

    // Bounds
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-cameraX, -cameraY, engine.world.width, engine.world.height);
    ctx.restore();

    // Entities
    engine.credits.forEach(c => c.draw(ctx, cameraX, cameraY, performance.now() / 1000));
    engine.particles.forEach(p => p.draw(ctx, cameraX, cameraY));
    engine.enemies.forEach(e => e.draw(ctx, cameraX, cameraY));
    engine.projectiles.forEach(p => p.draw(ctx, cameraX, cameraY));

    if (!engine.gameOver) {
      engine.player.draw(ctx, screenPx, screenPy);

      // Skill Aiming Indicator
      if (engine.activeSkillIndex !== null && engine.skillJoystick.active) {
        const skill = engine.skills[engine.activeSkillIndex];
        if (skill && skill.isDirectional) {
          const dx = engine.skillJoystick.x - engine.skillJoystick.originX;
          const dy = engine.skillJoystick.y - engine.skillJoystick.originY;
          const dist = Math.hypot(dx, dy);
          if (dist > 10) {
            const angle = Math.atan2(dy, dx);
            ctx.save();
            ctx.translate(screenPx, screenPy);
            ctx.rotate(angle);
            
            ctx.beginPath();
            ctx.moveTo(20, -10);
            ctx.lineTo(150, -30);
            ctx.lineTo(150, 30);
            ctx.lineTo(20, 10);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(150, 0);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            
            ctx.restore();
          }
        }
      }
      // Regular Aiming Indicator
      else if (engine.rightJoystick.active) {
        const dx = engine.rightJoystick.x - engine.rightJoystick.originX;
        const dy = engine.rightJoystick.y - engine.rightJoystick.originY;
        if (Math.hypot(dx, dy) > 10) {
          const angle = Math.atan2(dy, dx);
          const offset = engine.player.radius + 15;
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
    }

    this.drawUI(engine);
  }

  private drawGrid(engine: GameEngine, cameraX: number, cameraY: number) {
    const { canvas, ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
    ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    const gridSize = 100;
    const offsetX = -cameraX % gridSize;
    const offsetY = -cameraY % gridSize;
    
    ctx.beginPath();
    for (let x = offsetX - gridSize; x < canvas.width + gridSize; x += gridSize) {
      ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for (let y = offsetY - gridSize; y < canvas.height + gridSize; y += gridSize) {
      ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawUI(engine: GameEngine) {
    const { canvas, ctx } = this;
    if (engine.gameOver) return;

    const player = engine.player;

    if (player.maxShield > 0) {
      const barWidth = 300;
      const barHeight = 10;
      const barX = canvas.width / 2 - barWidth / 2;
      const hpBarY = canvas.height - 50;
      const barY = hpBarY - 22;

      const shieldPercent = Math.max(0, Math.min(1, player.shield / player.maxShield));
      const isLowShield = shieldPercent < 0.25;

      ctx.save();
      ctx.strokeStyle = isLowShield ? '#eab308' : '#06b6d4';
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(barX - 10, barY - 4);
      ctx.lineTo(barX - 10, barY + barHeight + 4);
      ctx.lineTo(barX - 2, barY + barHeight + 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(barX + barWidth + 10, barY - 4);
      ctx.lineTo(barX + barWidth + 10, barY + barHeight + 4);
      ctx.lineTo(barX + barWidth + 2, barY + barHeight + 4);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = isLowShield ? '#eab308' : '#06b6d4';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(barX, barY, barWidth * shieldPercent, barHeight);

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const segments = 12;
      for (let i = 1; i < segments; i++) {
        ctx.fillRect(barX + (barWidth / segments) * i - 1, barY, 2, barHeight);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('AUX.SHIELD', barX, barY - 6);

      ctx.textAlign = 'right';
      ctx.fillStyle = isLowShield ? '#eab308' : '#06b6d4';
      ctx.fillText(`${Math.ceil(Math.max(0, player.shield))} / ${player.maxShield}`, barX + barWidth, barY - 6);
      ctx.restore();
    }

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

    // --- Boss Bar (Cyberpunk Style) ---
    /*
    const boss = engine.enemies.reduce((prev, current) => (prev && prev.maxHp > current.maxHp) ? prev : current, null as any);
    if (boss && boss.maxHp >= 300) {
      const bossBarWidth = canvas.width * 0.5;
      const bossBarHeight = 18;
      const bossBarX = canvas.width / 2 - bossBarWidth / 2;
      const bossBarY = 40;
      const bossHpPercent = Math.max(0, boss.hp / boss.maxHp);

      ctx.save();
      // Danger Brackets
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(bossBarX - 15, bossBarY + bossBarHeight + 8);
      ctx.lineTo(bossBarX - 15, bossBarY - 8);
      ctx.lineTo(bossBarX + 20, bossBarY - 8);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bossBarX + bossBarWidth + 15, bossBarY + bossBarHeight + 8);
      ctx.lineTo(bossBarX + bossBarWidth + 15, bossBarY - 8);
      ctx.lineTo(bossBarX + bossBarWidth - 20, bossBarY - 8);
      ctx.stroke();

      // Background
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(20, 0, 0, 0.8)';
      ctx.fillRect(bossBarX, bossBarY, bossBarWidth, bossBarHeight);

      // Fill
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      ctx.fillRect(bossBarX, bossBarY, bossBarWidth * bossHpPercent, bossBarHeight);

      // Segments
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      const bossSegments = 20;
      for (let i = 1; i < bossSegments; i++) {
        ctx.fillRect(bossBarX + (bossBarWidth / bossSegments) * i - 1, bossBarY, 2, bossBarHeight);
      }

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.font = 'bold 16px "JetBrains Mono", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`⚠ WARNING: ELITE THREAT DETECTED ⚠`, canvas.width / 2, bossBarY - 12);
      ctx.restore();
    }
    */

    // Score & Credits
    ctx.textAlign = 'left';
    ctx.font = '24px "JetBrains Mono", monospace, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SCORE: ${engine.score}`, 20, 40);
    
    ctx.fillStyle = '#06b6d4';
    ctx.fillText(`CREDITS: ${engine.collectedCredits}`, 20, 70);

    if (engine.debugFlags.showWaveDebug) {
      const wave = engine.waveSystem.state;
      const now = performance.now();
      const waveAgeSec = Math.max(0, (now - wave.startedAtMs) / 1000);
      const phase = wave.phase;
      const intermissionLeftSec = phase === 'INTERMISSION'
        ? Math.max(0, (wave.intermissionUntilMs - now) / 1000)
        : 0;

      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 12px "JetBrains Mono", monospace, sans-serif';
      ctx.fillStyle = '#06b6d4';
      const x = canvas.width - 20;
      let y = 20;
      const lh = 16;

      ctx.fillText(`WAVE ${wave.index}`, x, y); y += lh;
      ctx.fillText(`PHASE: ${phase}`, x, y); y += lh;
      ctx.fillText(`SPAWNED: ${wave.spawned}/${wave.targetToSpawn}`, x, y); y += lh;
      ctx.fillText(`KILLED: ${wave.killed}  ALIVE: ${engine.enemies.length}`, x, y); y += lh;
      ctx.fillText(`AGE: ${waveAgeSec.toFixed(1)}s`, x, y); y += lh;
      if (phase === 'INTERMISSION') {
        ctx.fillText(`NEXT IN: ${intermissionLeftSec.toFixed(1)}s`, x, y);
      }
      ctx.restore();
    }

    // Faint right joystick base
    const rightJoyX = canvas.width - 150;
    const rightJoyY = canvas.height - 150;
    ctx.beginPath();
    ctx.arc(rightJoyX, rightJoyY, 60, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Skill Slots
    for (let i = 0; i < 3; i++) {
      const pos = engine.getSkillPos(i);
      const skill = engine.skills[i];
      const radius = 35;

      // Slot Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (skill) {
        // Skill Icon/Name
        ctx.fillStyle = skill.color;
        ctx.font = 'bold 12px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(skill.name, pos.x, pos.y);

        // Cooldown Overlay
        if (skill.currentCooldown > 0) {
          const cdRatio = skill.currentCooldown / skill.cooldown;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.arc(pos.x, pos.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdRatio);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px "JetBrains Mono"';
          ctx.fillText(Math.ceil(skill.currentCooldown).toString(), pos.x, pos.y);
        }
      } else {
        // Empty Slot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '24px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', pos.x, pos.y);
      }
    }

    // Joysticks
    const drawJoystick = (joy: JoystickData, color: string) => {
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
    
    if (engine.activeSkillIndex !== null && engine.skillJoystick.active) {
      ctx.beginPath();
      ctx.arc(engine.skillJoystick.x, engine.skillJoystick.y, engine.skillJoystick.knobRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
    }
  }
}
