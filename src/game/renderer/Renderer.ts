import type { GameEngine } from '../Engine';
import type { JoystickData } from '../EngineTypes';
import { translate } from '../../i18n/translate';

export class Renderer {
  private navStartedAtSec: number | null = null;

  constructor(public canvas: HTMLCanvasElement, public ctx: CanvasRenderingContext2D) {}

  draw(engine: GameEngine) {
    const { canvas, ctx } = this;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!engine.gameStarted) {
      this.drawGrid(0, 0);
      return;
    }

    let cameraX = engine.player.x - canvas.width / 2;
    let cameraY = engine.player.y - canvas.height / 2;
    cameraX = Math.max(0, Math.min(engine.world.width - canvas.width, cameraX));
    cameraY = Math.max(0, Math.min(engine.world.height - canvas.height, cameraY));

    const screenPx = engine.player.x - cameraX;
    const screenPy = engine.player.y - cameraY;

    this.drawGrid(cameraX, cameraY);

    if (engine.debugFlags.showWaveDebug) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-cameraX, -cameraY, engine.world.width, engine.world.height);
      ctx.restore();
    }

    const t = performance.now() / 1000;
    const nowMs = t * 1000;

    this.navStartedAtSec = null;

    engine.tiles.forEach(tile => tile.draw(ctx, cameraX, cameraY, t));

    engine.portals.forEach(p => p.draw(ctx, cameraX, cameraY, t));
    engine.healthPickups.forEach(h => h.draw(ctx, cameraX, cameraY, t));
    engine.weaponDrops.forEach(w => w.draw(ctx, cameraX, cameraY, t));
    engine.credits.forEach(c => c.draw(ctx, cameraX, cameraY, t));
    engine.particles.forEach(p => p.draw(ctx, cameraX, cameraY));
    engine.enemies.forEach(e => e.draw(ctx, cameraX, cameraY, engine.language ?? 'en'));

    this.drawSlashArcs(engine, cameraX, cameraY, nowMs);

    for (const projectile of engine.projectiles) {
      if (!projectile.isPlayer) {
        projectile.draw(ctx, cameraX, cameraY);
      }
    }

    if (!engine.gameOver) {
      engine.player.draw(ctx, screenPx, screenPy);

      this.drawPlayerEffects(engine, screenPx, screenPy, t);

      this.drawBlindOverlay(engine, screenPx, screenPy, t);

      for (const projectile of engine.projectiles) {
        if (projectile.isPlayer) {
          projectile.draw(ctx, cameraX, cameraY);
        }
      }

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
      } else if (engine.rightJoystick.active) {
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

    this.drawUI(engine, t);
  }

  private drawSlashArcs(engine: GameEngine, cameraX: number, cameraY: number, nowMs: number) {
    const { ctx } = this;
    if (!engine.slashArcs || engine.slashArcs.length === 0) return;

    for (const a of engine.slashArcs) {
      const age = nowMs - a.startedAtMs;
      if (age < 0 || age > a.durationMs) continue;

      const t = Math.max(0, Math.min(1, age / a.durationMs));
      const alpha = (1 - t) * (1 - t);

      const x = a.x - cameraX;
      const y = a.y - cameraY;
      const start = a.angleRad - a.halfAngleRad;
      const end = a.angleRad + a.halfAngleRad;

      ctx.save();
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';

      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18 * alpha;

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * alpha})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(x, y, a.radius, start, end);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, a.radius, start, end);
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawBlindOverlay(engine: GameEngine, screenPx: number, screenPy: number, timeSec: number) {
    const { canvas, ctx } = this;
    const player = engine.player;
    const remainingMs = player.getEffectRemainingMs('BLIND');
    if (remainingMs <= 0) return;

    const durMs = 3000;
    const strength = clamp(remainingMs / durMs, 0, 1);
    const eased = strength * strength;

    const baseRadius = Math.min(canvas.width, canvas.height) * 0.22;
    const minRadius = Math.min(canvas.width, canvas.height) * 0.12;
    const holeR = clamp(baseRadius - eased * (baseRadius - minRadius), minRadius, baseRadius);

    ctx.save();

    const dim = 0.45 + 0.45 * eased;
    ctx.fillStyle = 'rgba(0, 0, 0, ' + dim + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'destination-out';
    const feather = holeR * 0.65;
    const grad = ctx.createRadialGradient(screenPx, screenPy, holeR * 0.45, screenPx, screenPy, holeR + feather);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screenPx, screenPy, holeR + feather, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';

    const cyan = '#00f0ff';
    const pulse = 0.65 + 0.35 * Math.sin(timeSec * 6.5);
    ctx.save();
    ctx.strokeStyle = withAlpha(cyan, 0.35 + 0.25 * pulse);
    ctx.lineWidth = 2;
    ctx.shadowColor = cyan;
    ctx.shadowBlur = 16;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -timeSec * 120;
    ctx.beginPath();
    ctx.arc(screenPx, screenPy, holeR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = '#ffffff';
    const lineH = 3;
    const drift = (timeSec * 120) % (lineH * 6);
    for (let y = -lineH * 6 + drift; y < canvas.height + lineH * 6; y += lineH * 6) {
      ctx.fillRect(0, y, canvas.width, lineH);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    const grains = Math.floor((canvas.width * canvas.height) / 8000);
    const seed = timeSec * 31.7;
    for (let i = 0; i < grains; i++) {
      const x = rand01(i * 19.1 + seed) * canvas.width;
      const y = rand01(i * 7.3 + seed * 1.7) * canvas.height;
      if (Math.hypot(x - screenPx, y - screenPy) < holeR * 0.9) continue;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();

    ctx.restore();
  }

  private drawCyberGuidance(params: {
    start: { x: number; y: number };
    path: { x: number; y: number }[];
    cameraX: number;
    cameraY: number;
    timeSec: number;
    revealSec: number;
  }) {
    const { ctx } = this;
    const { start, path, cameraX, cameraY, timeSec, revealSec } = params;
    const fullPath: { x: number; y: number }[] = [start];
    for (const p of path) {
      const last = fullPath[fullPath.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 4) continue;
      fullPath.push(p);
    }

    const maxDist = 720;
    const revealSpeed = 1500;
    const revealLen = Math.max(0, Math.min(maxDist, revealSec * revealSpeed));
    const renderPath = this.buildClampedPath(fullPath, revealLen);

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    const primary = '#00f0ff';
    const whiteHot = '#ffffff';
    const dashOffset = -(timeSec * 120);
    const pulse = 0.7 + 0.3 * Math.sin(timeSec * 4);

    ctx.beginPath();
    const ringSize = 12 + 2 * pulse;
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = primary;

    const bracketGap = 6;
    ctx.moveTo(start.x - ringSize, start.y - ringSize / 2);
    ctx.lineTo(start.x - ringSize, start.y + ringSize / 2);
    ctx.lineTo(start.x - ringSize + bracketGap, start.y + ringSize / 2);
    ctx.moveTo(start.x - ringSize, start.y - ringSize / 2);
    ctx.lineTo(start.x - ringSize + bracketGap, start.y - ringSize / 2);

    ctx.moveTo(start.x + ringSize, start.y - ringSize / 2);
    ctx.lineTo(start.x + ringSize, start.y + ringSize / 2);
    ctx.lineTo(start.x + ringSize - bracketGap, start.y + ringSize / 2);
    ctx.moveTo(start.x + ringSize, start.y - ringSize / 2);
    ctx.lineTo(start.x + ringSize - bracketGap, start.y - ringSize / 2);
    ctx.stroke();

    if (renderPath.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(renderPath[0].x, renderPath[0].y);
      for (let i = 1; i < renderPath.length; i++) {
        ctx.lineTo(renderPath[i].x, renderPath[i].y);
      }
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.lineWidth = 10;
      ctx.strokeStyle = primary;
      ctx.globalAlpha = 0.16 * pulse;
      ctx.shadowBlur = 14;
      ctx.shadowColor = primary;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(renderPath[0].x, renderPath[0].y);
      for (let i = 1; i < renderPath.length; i++) {
        ctx.lineTo(renderPath[i].x, renderPath[i].y);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.strokeStyle = primary;
      ctx.setLineDash([18, 22]);
      ctx.lineDashOffset = dashOffset;
      ctx.stroke();
      ctx.setLineDash([]);

      this.drawChevrons(renderPath, timeSec, whiteHot);
    }

    ctx.restore();
  }

  private buildClampedPath(points: { x: number; y: number }[], maxLen: number): { x: number; y: number }[] {
    if (points.length === 0) return [];
    const out: { x: number; y: number }[] = [points[0]];
    let remaining = maxLen;
    for (let i = 0; i < points.length - 1 && remaining > 0; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen <= 1e-6) continue;
      if (segLen <= remaining) {
        out.push(b);
        remaining -= segLen;
        continue;
      }
      const t = remaining / segLen;
      out.push({ x: a.x + dx * t, y: a.y + dy * t });
      remaining = 0;
    }
    return out;
  }

  private drawChevrons(path: { x: number; y: number }[], timeSec: number, color: string) {
    const { ctx } = this;
    const spacing = 120;
    const size = 7;
    const flowSpeed = 120;
    const baseDist = (timeSec * flowSpeed) % spacing;

    ctx.fillStyle = color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;

    let curDist = 0;
    let nextDist = baseDist;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen <= 1e-6) continue;
      const angle = Math.atan2(dy, dx);

      while (nextDist <= curDist + segLen) {
        const d = nextDist - curDist;
        const t = d / segLen;
        const cx = a.x + dx * t;
        const cy = a.y + dy * t;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-size, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(-size, size);
        ctx.fill();
        ctx.restore();

        nextDist += spacing;
      }

      curDist += segLen;
    }

    ctx.shadowBlur = 0;
  }

  private drawGrid(cameraX: number, cameraY: number) {
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
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = offsetY - gridSize; y < canvas.height + gridSize; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawUI(engine: GameEngine, timeSec: number) {
    const { canvas, ctx } = this;
    if (engine.gameOver) return;

    this.drawMinimap(engine, timeSec);

    const player = engine.player;
    const language = engine.language ?? 'en';

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
      ctx.fillText(translate(language, 'hud.auxShield'), barX, barY - 6);

      ctx.textAlign = 'right';
      ctx.fillStyle = isLowShield ? '#eab308' : '#06b6d4';
      ctx.fillText(`${Math.ceil(Math.max(0, player.shield))} / ${player.maxShield}`, barX + barWidth, barY - 6);
      ctx.restore();
    }

    const hpBarWidth = 300;
    const hpBarHeight = 14;
    const hpBarX = canvas.width / 2 - hpBarWidth / 2;
    const hpBarY = canvas.height - 50;
    const hpPercent = Math.max(0, player.hp / player.maxHp);
    const isLowHp = hpPercent < 0.3;

    ctx.save();
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

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

    ctx.fillStyle = isLowHp ? '#ef4444' : '#22c55e';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercent, hpBarHeight);

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    const segments = 10;
    for (let i = 1; i < segments; i++) {
      ctx.fillRect(hpBarX + (hpBarWidth / segments) * i - 1, hpBarY, 2, hpBarHeight);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(translate(language, 'hud.sysIntegrity'), hpBarX, hpBarY - 6);

    ctx.textAlign = 'right';
    ctx.fillStyle = isLowHp ? '#ef4444' : '#06b6d4';
    ctx.fillText(`${Math.ceil(Math.max(0, player.hp))} / ${player.maxHp}`, hpBarX + hpBarWidth, hpBarY - 6);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.font = '24px "JetBrains Mono", monospace, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${translate(language, 'hud.score')}: ${engine.score}`, 20, 40);

    ctx.fillStyle = '#06b6d4';
    ctx.fillText(`${translate(language, 'hud.credits')}: ${engine.collectedCredits}`, 20, 70);

    const statuses: Array<{ label: string; color: string; remainingMs: number }> = [];
    const blindLeft = player.getEffectRemainingMs('BLIND');
    if (blindLeft > 0) statuses.push({ label: translate(language, 'status.blind'), color: '#00f0ff', remainingMs: blindLeft });
    const stunLeft = player.getEffectRemainingMs('STUN');
    if (stunLeft > 0) statuses.push({ label: translate(language, 'status.stun'), color: '#eab308', remainingMs: stunLeft });
    const poisonLeft = player.getEffectRemainingMs('POISON');
    if (poisonLeft > 0) statuses.push({ label: translate(language, 'status.poison'), color: '#22c55e', remainingMs: poisonLeft });
    const burnLeft = player.getEffectRemainingMs('BURN');
    if (burnLeft > 0) statuses.push({ label: translate(language, 'status.burn'), color: '#f97316', remainingMs: burnLeft });

    if (statuses.length > 0) {
      ctx.save();
      ctx.font = 'bold 12px "JetBrains Mono", monospace, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let y = 90;
      for (const s of statuses) {
        ctx.fillStyle = s.color;
        ctx.fillText(`${s.label}: ${(s.remainingMs / 1000).toFixed(1)}S`, 20, y);
        y += 18;
      }
      ctx.restore();
    }

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

      ctx.fillText(`WAVE ${wave.index}`, x, y);
      y += lh;
      ctx.fillText(`PHASE: ${phase}`, x, y);
      y += lh;
      ctx.fillText(`SPAWNED: ${wave.spawned}/${wave.targetToSpawn}`, x, y);
      y += lh;
      ctx.fillText(`KILLED: ${wave.killed}  ALIVE: ${engine.enemies.length}`, x, y);
      y += lh;
      ctx.fillText(`AGE: ${waveAgeSec.toFixed(1)}s`, x, y);
      y += lh;
      if (phase === 'INTERMISSION') {
        ctx.fillText(`NEXT IN: ${intermissionLeftSec.toFixed(1)}s`, x, y);
      }
      ctx.restore();
    }

    const rightJoyX = canvas.width - 150;
    const rightJoyY = canvas.height - 150;
    ctx.beginPath();
    ctx.arc(rightJoyX, rightJoyY, 60, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const pos = engine.getSkillPos(i);
      const skill = engine.skills[i];
      const radius = 35;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (skill) {
        ctx.fillStyle = skill.color;
        ctx.font = 'bold 12px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const skillName = skill.id === 'dash'
          ? translate(language, 'skill.dash')
          : skill.id === 'bounce'
            ? translate(language, 'skill.bounce')
            : skill.name;
        ctx.fillText(skillName, pos.x, pos.y);

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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '24px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', pos.x, pos.y);
      }
    }

    const activeWeapon = engine.weaponSlots[engine.activeWeaponIndex];
    if (engine.rightJoystick.active && activeWeapon?.type === 'charge' && engine.rightChargeStartedAtMs !== null) {
      const nowMs = performance.now();
      const chargeMs = Math.max(0, nowMs - engine.rightChargeStartedAtMs);
      const minMs = activeWeapon.minChargeMs;
      const maxMs = Math.max(1, activeWeapon.maxChargeMs);
      const ratio = clamp(chargeMs / maxMs, 0, 1);
      const ready = chargeMs >= minMs;

      const ox = engine.rightJoystick.originX;
      const oy = engine.rightJoystick.originY;
      const r = engine.rightJoystick.radius + 14;
      const col = ready ? '#22c55e' : '#ef4444';

      ctx.save();
      ctx.lineWidth = 6;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(col, 0.92);
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(ox, oy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();

      ctx.restore();
    }

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

  private drawMinimap(engine: GameEngine, timeSec: number) {
    const { canvas, ctx } = this;

    if (canvas.width < 360 || canvas.height < 260) return;

    const mm = engine.getMinimapData();
    const boxSize = clamp(Math.round(Math.min(230, canvas.width * 0.28, canvas.height * 0.34)), 120, 240);
    const margin = canvas.width < 520 ? 12 : 18;
    const box = { x: canvas.width - boxSize - margin, y: margin, w: boxSize, h: boxSize };
    const padding = boxSize < 150 ? 10 : 14;
    const chamfer = boxSize < 150 ? 10 : 14;

    const transform = computeMinimapTransform(mm.rooms, mm.corridors, box, padding);
    if (!transform) return;

    ctx.save();

    drawChamferedPath(ctx, box, chamfer);
    ctx.fillStyle = 'rgba(6, 10, 18, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.clip();

    const scanY = box.y + ((timeSec * 42) % box.h);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.fillRect(box.x, scanY, box.w, 8);

    ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
    for (const c of mm.corridors) {
      const r = transform.toScreenRect(c);
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    for (let i = 0; i < mm.rooms.length; i++) {
      const room = mm.rooms[i];
      const r = transform.toScreenRect(room.rect);
      const visited = mm.visitedRoomIndices.has(i);

      const { fill, stroke } = getRoomMinimapColors(room.kind, visited);
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    const targetKind = computeTargetRoomKind(mm.objectiveStage);
    const targetRoom = mm.rooms.find(r => r.kind === targetKind);
    if (targetRoom) {
      const pulse = 0.55 + 0.45 * Math.sin(timeSec * 5.0);
      const r = transform.toScreenRect(targetRoom.rect);
      const c = getStageColor(mm.objectiveStage);
      ctx.save();
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -(timeSec * 30);
      ctx.shadowBlur = 10;
      ctx.shadowColor = c;
      ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      ctx.restore();
    }

    if (mm.objectivePos) {
      const obj = transform.toScreen(mm.objectivePos.x, mm.objectivePos.y);
      const col = getStageColor(mm.objectiveStage);
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 6.2);
      const size = 4 + pulse * 2.5;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10 * pulse;
      ctx.beginPath();
      ctx.moveTo(obj.x, obj.y - size);
      ctx.lineTo(obj.x + size, obj.y);
      ctx.lineTo(obj.x, obj.y + size);
      ctx.lineTo(obj.x - size, obj.y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    const p = transform.toScreen(mm.player.x, mm.player.y);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x + 4, p.y + 4);
    ctx.lineTo(p.x - 4, p.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();

    const language = engine.language ?? 'en';

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = 'bold 10px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(translate(language, 'hud.sysMap'), box.x + 10, box.y + 8);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowBlur = 14;
    ctx.font = 'bold 11px "JetBrains Mono", monospace, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const worldLabel = translate(language, 'hud.worldIndex', { index: mm.worldIndex + 1 });
    ctx.fillText(worldLabel, box.x, box.y - 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(worldLabel, box.x, box.y - 4);
    ctx.restore();

    ctx.save();
    drawCornerAccents(ctx, box, chamfer);
    ctx.restore();
  }

  private drawPlayerEffects(engine: GameEngine, screenPx: number, screenPy: number, timeSec: number) {
    const { ctx } = this;
    const player = engine.player;

    const hasStun = player.hasEffect('STUN');
    const hasPoison = player.hasEffect('POISON');
    const hasBurn = player.hasEffect('BURN');
    if (!hasStun && !hasPoison && !hasBurn) return;

    ctx.save();
    ctx.translate(screenPx, screenPy);

    const r = player.radius;
    const w = r * 2.2;
    const h = r * 2.2;

    if (hasPoison) {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 4.2);
      const green = '#39ff14';

      ctx.save();
      ctx.globalAlpha = 0.22 + 0.22 * pulse;
      ctx.strokeStyle = green;
      ctx.lineWidth = 2;
      ctx.shadowColor = green;
      ctx.shadowBlur = 14;

      const pad = 8 + 2.5 * pulse;
      const chamfer = 8;
      drawChamferedRect(ctx, -w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, chamfer);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#b026ff';
      const count = 6;
      for (let i = 0; i < count; i++) {
        const pTime = timeSec + i * 1.37;
        const speed = 26 + (i % 3) * 6;
        const travel = h + 30;
        const y = h / 2 + 10 - ((pTime * speed) % travel);
        const x = (-w / 2) + (w / count) * i + (rand01(i * 29.7 + timeSec * 0.7) - 0.5) * 10;
        const a = clamp((y - (-h / 2 - 12)) / travel, 0, 1);
        ctx.globalAlpha = a * 0.75;
        const s = 2 + (i % 2) * 2;
        ctx.fillRect(x, y, s, s);
      }
      ctx.restore();
    }

    if (hasBurn) {
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5.1 + 2.2);
      const ember = '#fb923c';
      const hot = '#f97316';

      ctx.save();
      ctx.globalAlpha = 0.18 + 0.18 * pulse;
      ctx.strokeStyle = hot;
      ctx.lineWidth = 2;
      ctx.shadowColor = ember;
      ctx.shadowBlur = 18;

      const pad = 9 + 3.0 * pulse;
      const chamfer = 8;
      drawChamferedRect(ctx, -w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, chamfer);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      const count = 9;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + timeSec * 2.0;
        const rr = r + 10 + 4 * Math.sin(timeSec * 6.0 + i * 1.1);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        ctx.globalAlpha = 0.35 + 0.25 * pulse;
        ctx.fillStyle = i % 2 === 0 ? ember : hot;
        ctx.fillRect(x - 1, y - 1, 3, 3);
      }
      ctx.restore();
    }

    if (hasStun) {
      const cyan = '#00f0ff';
      const yellow = '#fcee0a';
      const flicker = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeSec * 22.0 + 1.7));

      ctx.save();
      ctx.strokeStyle = withAlpha(cyan, 0.75 * flicker);
      ctx.lineWidth = 2;
      ctx.shadowColor = cyan;
      ctx.shadowBlur = 12;

      const offset = 10;
      const chamfer = 7;
      const leg = Math.max(12, w * 0.35);
      ctx.beginPath();
      ctx.moveTo(-w / 2 - offset, -h / 2 - offset + leg);
      ctx.lineTo(-w / 2 - offset, -h / 2 - offset + chamfer);
      ctx.lineTo(-w / 2 - offset + chamfer, -h / 2 - offset);
      ctx.lineTo(-w / 2 - offset + leg, -h / 2 - offset);

      ctx.moveTo(w / 2 + offset, h / 2 + offset - leg);
      ctx.lineTo(w / 2 + offset, h / 2 + offset - chamfer);
      ctx.lineTo(w / 2 + offset - chamfer, h / 2 + offset);
      ctx.lineTo(w / 2 + offset - leg, h / 2 + offset);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = withAlpha(yellow, 0.85 * flicker);
      ctx.lineWidth = 1.5;
      ctx.shadowColor = yellow;
      ctx.shadowBlur = 10;

      const seed = Math.floor(timeSec * 15);
      let cx = -w / 2 - 6;
      let cy = (-h / 2) + h * (0.2 + 0.6 * Math.abs(Math.sin(seed * 12.3)));
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let i = 1; i <= 3; i++) {
        cx += (w + 12) / 3;
        cy += Math.sin(seed * i * 7.1) * 12;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

type MiniRect = { x: number; y: number; w: number; h: number };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeMinimapTransform(
  rooms: { rect: { x: number; y: number; width: number; height: number } }[],
  corridors: { x: number; y: number; width: number; height: number }[],
  box: MiniRect,
  padding: number,
): {
  toScreen: (wx: number, wy: number) => { x: number; y: number };
  toScreenRect: (r: { x: number; y: number; width: number; height: number }) => MiniRect;
} | null {
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  for (const r of rooms) rects.push(r.rect);
  for (const c of corridors) rects.push(c);
  if (rects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  const worldW = Math.max(1, maxX - minX);
  const worldH = Math.max(1, maxY - minY);
  const availW = Math.max(1, box.w - padding * 2);
  const availH = Math.max(1, box.h - padding * 2);
  const scale = Math.min(availW / worldW, availH / worldH);

  const mapW = worldW * scale;
  const mapH = worldH * scale;
  const offsetX = box.x + padding + (availW - mapW) / 2;
  const offsetY = box.y + padding + (availH - mapH) / 2;

  return {
    toScreen: (wx, wy) => ({
      x: offsetX + (wx - minX) * scale,
      y: offsetY + (wy - minY) * scale,
    }),
    toScreenRect: (r) => ({
      x: offsetX + (r.x - minX) * scale,
      y: offsetY + (r.y - minY) * scale,
      w: Math.max(1, r.width * scale),
      h: Math.max(1, r.height * scale),
    }),
  };
}

function getStageColor(stage: 'HUB' | 'COMBAT' | 'REWARD' | 'PORTAL'): string {
  if (stage === 'COMBAT') return '#ff003c';
  if (stage === 'REWARD') return '#fcee0a';
  return '#b026ff';
}

function computeTargetRoomKind(stage: 'COMBAT' | 'REWARD' | 'PORTAL'): 'COMBAT' | 'REWARD' | 'PORTAL' {
  if (stage === 'COMBAT') return 'COMBAT';
  if (stage === 'REWARD') return 'REWARD';
  return 'PORTAL';
}

function getRoomMinimapColors(kind: 'HUB' | 'COMBAT' | 'REWARD' | 'PORTAL', visited: boolean): { fill: string; stroke: string } {
  const base = kind === 'HUB' ? '#00f0ff' : getStageColor(kind);
  if (!visited) {
    return {
      fill: 'rgba(0, 240, 255, 0.04)',
      stroke: 'rgba(0, 240, 255, 0.18)',
    };
  }
  if (kind === 'HUB') {
    return { fill: 'rgba(0, 240, 255, 0.10)', stroke: withAlpha(base, 0.75) };
  }
  if (kind === 'COMBAT') {
    return { fill: 'rgba(255, 0, 60, 0.12)', stroke: withAlpha(base, 0.75) };
  }
  if (kind === 'REWARD') {
    return { fill: 'rgba(252, 238, 10, 0.10)', stroke: withAlpha(base, 0.78) };
  }
  return { fill: 'rgba(176, 38, 255, 0.10)', stroke: withAlpha(base, 0.78) };
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawChamferedPath(ctx: CanvasRenderingContext2D, box: MiniRect, chamfer: number) {
  ctx.beginPath();
  ctx.moveTo(box.x + chamfer, box.y);
  ctx.lineTo(box.x + box.w, box.y);
  ctx.lineTo(box.x + box.w, box.y + box.h - chamfer);
  ctx.lineTo(box.x + box.w - chamfer, box.y + box.h);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.lineTo(box.x, box.y + chamfer);
  ctx.closePath();
}

function drawChamferedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, chamfer: number) {
  const c = clamp(chamfer, 0, Math.min(w, h) * 0.25);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function rand01(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function drawCornerAccents(ctx: CanvasRenderingContext2D, box: MiniRect, chamfer: number) {
  const len = 12;
  const gap = 4;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(0, 240, 255, 0.65)';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(box.x - gap, box.y + chamfer + len);
  ctx.lineTo(box.x - gap, box.y + chamfer - gap * 0.4);
  ctx.lineTo(box.x + chamfer - gap * 0.4, box.y - gap);
  ctx.lineTo(box.x + chamfer + len, box.y - gap);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(box.x + box.w + gap, box.y + box.h - chamfer - len);
  ctx.lineTo(box.x + box.w + gap, box.y + box.h - chamfer + gap * 0.4);
  ctx.lineTo(box.x + box.w - chamfer + gap * 0.4, box.y + box.h + gap);
  ctx.lineTo(box.x + box.w - chamfer - len, box.y + box.h + gap);
  ctx.stroke();

  ctx.shadowBlur = 0;
}
