import { Player, Projectile, BaseEnemy, MeleeEnemy, RangedEnemy, Particle, GameState, Credit } from './Entities';
import { Skill, DashSkill } from './Skills';

export interface JoystickData {
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
  radius: number;
  knobRadius: number;
  touchId: number | null;
}

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  animationFrameId: number = 0;

  world = { width: 3000, height: 3000 };
  player = new Player(1500, 1500, 20, 300, 500, 500);
  
  leftJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  rightJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  skillJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 40, knobRadius: 20, touchId: null };
  
  skills: (Skill | null)[] = [new DashSkill(), null, null]; // 3 Skill slots
  activeSkillIndex: number | null = null;
  
  projectiles: Projectile[] = [];
  enemies: BaseEnemy[] = [];
  particles: Particle[] = [];
  credits: Credit[] = [];
  
  lastTime: number = performance.now();
  lastShot: number = 0;
  lastSpawn: number = 0;
  score: number = 0;
  collectedCredits: number = 0;
  gameStarted: boolean = false;
  gameOver: boolean = false;

  onStateChange?: (state: 'START' | 'PLAYING' | 'GAME_OVER') => void;
  onScoreChange?: (score: number, credits: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.loop = this.loop.bind(this);

    window.addEventListener('resize', this.handleResize);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);

    this.handleResize();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    cancelAnimationFrame(this.animationFrameId);
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  resetGame() {
    this.player.hp = this.player.maxHp;
    this.player.x = this.world.width / 2;
    this.player.y = this.world.height / 2;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.credits = [];
    this.score = 0;
    this.collectedCredits = 0;
    this.gameOver = false;
    this.lastTime = performance.now();
    this.skills.forEach(s => { if (s) s.currentCooldown = 0; });
    this.onScoreChange?.(this.score, this.collectedCredits);
  }

  startGame() {
    this.gameStarted = true;
    this.resetGame();
    this.onStateChange?.('PLAYING');
  }

  getSkillPos(index: number) {
    const rightJoyX = this.canvas.width - 150;
    const rightJoyY = this.canvas.height - 150;
    if (index === 0) return { x: rightJoyX - 130, y: rightJoyY + 30 };
    if (index === 1) return { x: rightJoyX - 100, y: rightJoyY - 80 };
    if (index === 2) return { x: rightJoyX + 10, y: rightJoyY - 130 };
    return { x: 0, y: 0 };
  }

  handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    if (!this.gameStarted || this.gameOver) {
      return;
    }

    // Check Skill Buttons
    for (let i = 0; i < 3; i++) {
      const pos = this.getSkillPos(i);
      const dist = Math.hypot(e.clientX - pos.x, e.clientY - pos.y);
      if (dist <= 40) {
        if (this.skills[i] && this.skills[i]!.currentCooldown <= 0) {
          this.activeSkillIndex = i;
          this.skillJoystick.active = true;
          this.skillJoystick.originX = pos.x;
          this.skillJoystick.originY = pos.y;
          this.skillJoystick.x = e.clientX;
          this.skillJoystick.y = e.clientY;
          this.skillJoystick.touchId = e.pointerId;
        }
        return; // Consume event
      }
    }

    if (e.clientX < window.innerWidth / 2 && !this.leftJoystick.active) {
      this.leftJoystick.active = true;
      this.leftJoystick.originX = e.clientX;
      this.leftJoystick.originY = e.clientY;
      this.leftJoystick.x = e.clientX;
      this.leftJoystick.y = e.clientY;
      this.leftJoystick.touchId = e.pointerId;
    } else if (e.clientX >= window.innerWidth / 2 && !this.rightJoystick.active) {
      this.rightJoystick.active = true;
      this.rightJoystick.originX = e.clientX;
      this.rightJoystick.originY = e.clientY;
      this.rightJoystick.x = e.clientX;
      this.rightJoystick.y = e.clientY;
      this.rightJoystick.touchId = e.pointerId;
    }
  }

  handlePointerMove(e: PointerEvent) {
    e.preventDefault();
    if (this.activeSkillIndex !== null && this.skillJoystick.touchId === e.pointerId) {
      const dx = e.clientX - this.skillJoystick.originX;
      const dy = e.clientY - this.skillJoystick.originY;
      const distance = Math.hypot(dx, dy);
      if (distance > this.skillJoystick.radius) {
        this.skillJoystick.x = this.skillJoystick.originX + (dx / distance) * this.skillJoystick.radius;
        this.skillJoystick.y = this.skillJoystick.originY + (dy / distance) * this.skillJoystick.radius;
      } else {
        this.skillJoystick.x = e.clientX;
        this.skillJoystick.y = e.clientY;
      }
      return;
    }

    if (this.leftJoystick.active && this.leftJoystick.touchId === e.pointerId) {
      const dx = e.clientX - this.leftJoystick.originX;
      const dy = e.clientY - this.leftJoystick.originY;
      const distance = Math.hypot(dx, dy);
      if (distance > this.leftJoystick.radius) {
        this.leftJoystick.x = this.leftJoystick.originX + (dx / distance) * this.leftJoystick.radius;
        this.leftJoystick.y = this.leftJoystick.originY + (dy / distance) * this.leftJoystick.radius;
      } else {
        this.leftJoystick.x = e.clientX;
        this.leftJoystick.y = e.clientY;
      }
    } else if (this.rightJoystick.active && this.rightJoystick.touchId === e.pointerId) {
      const dx = e.clientX - this.rightJoystick.originX;
      const dy = e.clientY - this.rightJoystick.originY;
      const distance = Math.hypot(dx, dy);
      if (distance > this.rightJoystick.radius) {
        this.rightJoystick.x = this.rightJoystick.originX + (dx / distance) * this.rightJoystick.radius;
        this.rightJoystick.y = this.rightJoystick.originY + (dy / distance) * this.rightJoystick.radius;
      } else {
        this.rightJoystick.x = e.clientX;
        this.rightJoystick.y = e.clientY;
      }
    }
  }

  handlePointerUp(e: PointerEvent) {
    e.preventDefault();
    if (this.activeSkillIndex !== null && this.skillJoystick.touchId === e.pointerId) {
      const dx = this.skillJoystick.x - this.skillJoystick.originX;
      const dy = this.skillJoystick.y - this.skillJoystick.originY;
      this.skills[this.activeSkillIndex]!.activate(this, dx, dy);
      
      this.activeSkillIndex = null;
      this.skillJoystick.active = false;
      this.skillJoystick.touchId = null;
    }
    if (this.leftJoystick.touchId === e.pointerId) {
      this.leftJoystick.active = false;
      this.leftJoystick.touchId = null;
    }
    if (this.rightJoystick.touchId === e.pointerId) {
      this.rightJoystick.active = false;
      this.rightJoystick.touchId = null;
    }
  }

  spawnEnemy(cameraX: number, cameraY: number, time: number) {
    if (time - this.lastSpawn > 1500) {
      const spawnEdge = Math.floor(Math.random() * 4);
      let ex = 0, ey = 0;
      const margin = 50;
      
      if (spawnEdge === 0) { ex = cameraX + Math.random() * this.canvas.width; ey = cameraY - margin; }
      else if (spawnEdge === 1) { ex = cameraX + this.canvas.width + margin; ey = cameraY + Math.random() * this.canvas.height; }
      else if (spawnEdge === 2) { ex = cameraX + Math.random() * this.canvas.width; ey = cameraY + this.canvas.height + margin; }
      else { ex = cameraX - margin; ey = cameraY + Math.random() * this.canvas.height; }

      ex = Math.max(0, Math.min(this.world.width, ex));
      ey = Math.max(0, Math.min(this.world.height, ey));

      if (Math.random() > 0.6) {
        this.enemies.push(new RangedEnemy(ex, ey));
      } else {
        this.enemies.push(new MeleeEnemy(ex, ey));
      }
      this.lastSpawn = time;
    }
  }

  loop(time: number) {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (this.gameStarted && !this.gameOver) {
      this.update(dt, time);
    }
    this.draw();

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  update(dt: number, time: number) {
    // Update Skills
    this.skills.forEach(skill => {
      if (skill) skill.update(dt);
    });

    // Player movement
    if (this.player.isDashing) {
      this.player.update(dt, this.world.width, this.world.height);
      // Visual effect: Particles along the dash path
      this.particles.push(new Particle(
        this.player.x, this.player.y, 
        (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, 
        0, 300, '#3b82f6'
      ));
    } else if (this.leftJoystick.active) {
      const dx = this.leftJoystick.x - this.leftJoystick.originX;
      const dy = this.leftJoystick.y - this.leftJoystick.originY;
      const distance = Math.hypot(dx, dy);
      if (distance > 0) {
        const normalizedDistance = Math.min(distance / this.leftJoystick.radius, 1);
        const vx = (dx / distance) * this.player.speed * normalizedDistance;
        const vy = (dy / distance) * this.player.speed * normalizedDistance;
        this.player.x += vx * dt;
        this.player.y += vy * dt;

        this.player.x = Math.max(this.player.radius, Math.min(this.world.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.world.height - this.player.radius, this.player.y));
      }
    }

    // Shooting
    if (this.rightJoystick.active && time - this.lastShot > 150) {
      const dx = this.rightJoystick.x - this.rightJoystick.originX;
      const dy = this.rightJoystick.y - this.rightJoystick.originY;
      const dist = Math.hypot(dx, dy);
      
      if (dist > 10) {
        const angle = Math.atan2(dy, dx);
        this.projectiles.push(new Projectile(
          this.player.x, this.player.y,
          Math.cos(angle) * 1000, Math.sin(angle) * 1000,
          1500, time, 50, true, '#eab308'
        ));
        this.lastShot = time;
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      
      if (time - p.spawnTime > p.life) {
        this.projectiles.splice(i, 1);
        continue;
      }

      let hit = false;
      if (p.isPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + 5) {
            e.hp -= p.damage;
            hit = true;
            for(let k=0; k<5; k++) {
              this.particles.push(new Particle(
                p.x, p.y,
                (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400,
                0, 300 + Math.random() * 200, e.color
              ));
            }
            if (e.hp <= 0) {
              this.enemies.splice(j, 1);
              this.score += (e instanceof MeleeEnemy ? 10 : 20);
              this.onScoreChange?.(this.score, this.collectedCredits);
              // Drop credit (40% chance)
              if (Math.random() < 0.4) {
                this.credits.push(new Credit(e.x, e.y, 10, time));
              }
            }
            break;
          }
        }
      } else {
        if (!this.player.isDashing && Math.hypot(p.x - this.player.x, p.y - this.player.y) < this.player.radius + 5) {
          this.player.hp -= p.damage;
          hit = true;
          for(let k=0; k<5; k++) {
            this.particles.push(new Particle(
              p.x, p.y,
              (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400,
              0, 300 + Math.random() * 200, '#ffffff'
            ));
          }
        }
      }

      if (hit) {
        this.projectiles.splice(i, 1);
      }
    }

    // Enemies
    let cameraX = this.player.x - this.canvas.width / 2;
    let cameraY = this.player.y - this.canvas.height / 2;
    this.spawnEnemy(cameraX, cameraY, time);

    const stateObj: GameState = {
      player: this.player,
      projectiles: this.projectiles,
      particles: this.particles,
      score: this.score,
      time: time,
    };

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      this.enemies[i].update(dt, stateObj);
    }

    // Credits
    for (let i = this.credits.length - 1; i >= 0; i--) {
      const c = this.credits[i];
      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy);

      // Magnetic pull if close
      if (dist < 150) {
        const pullSpeed = 400 * (1 - dist / 150);
        c.x += (dx / dist) * pullSpeed * dt;
        c.y += (dy / dist) * pullSpeed * dt;
      }

      // Collect
      if (dist < this.player.radius + 15) {
        this.collectedCredits += c.value;
        this.onScoreChange?.(this.score, this.collectedCredits);
        this.credits.splice(i, 1);
        for(let k=0; k<3; k++) {
          this.particles.push(new Particle(
            c.x, c.y,
            (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200,
            0, 200, '#06b6d4'
          ));
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    if (this.player.hp <= 0 && !this.gameOver) {
      this.gameOver = true;
      this.onStateChange?.('GAME_OVER');
    }
  }

  draw() {
    const { ctx, canvas } = this;

    if (!this.gameStarted) {
      return;
    }

    let cameraX = this.player.x - canvas.width / 2;
    let cameraY = this.player.y - canvas.height / 2;
    cameraX = Math.max(0, Math.min(this.world.width - canvas.width, cameraX));
    cameraY = Math.max(0, Math.min(this.world.height - canvas.height, cameraY));

    const screenPx = this.player.x - cameraX;
    const screenPy = this.player.y - cameraY;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
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

    // Bounds
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-cameraX, -cameraY, this.world.width, this.world.height);
    ctx.restore();

    // Entities
    this.credits.forEach(c => c.draw(ctx, cameraX, cameraY, performance.now() / 1000));
    this.particles.forEach(p => p.draw(ctx, cameraX, cameraY));
    this.enemies.forEach(e => e.draw(ctx, cameraX, cameraY));
    this.projectiles.forEach(p => p.draw(ctx, cameraX, cameraY));

    if (!this.gameOver) {
      this.player.draw(ctx, screenPx, screenPy);

      // Skill Aiming Indicator
      if (this.activeSkillIndex !== null && this.skillJoystick.active) {
        const skill = this.skills[this.activeSkillIndex];
        if (skill && skill.isDirectional) {
          const dx = this.skillJoystick.x - this.skillJoystick.originX;
          const dy = this.skillJoystick.y - this.skillJoystick.originY;
          if (Math.hypot(dx, dy) > 10) {
            const angle = Math.atan2(dy, dx);
            ctx.save();
            ctx.translate(screenPx, screenPy);
            ctx.rotate(angle);
            
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.fillRect(this.player.radius + 10, -15, 200, 30);
            
            ctx.restore();
          }
        }
      }
      // Regular Aiming Indicator
      else if (this.rightJoystick.active) {
        const dx = this.rightJoystick.x - this.rightJoystick.originX;
        const dy = this.rightJoystick.y - this.rightJoystick.originY;
        if (Math.hypot(dx, dy) > 10) {
          const angle = Math.atan2(dy, dx);
          const offset = this.player.radius + 15;
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

    // UI
    if (!this.gameOver) {
      const barWidth = 300;
      const barHeight = 20;
      const barX = canvas.width / 2 - barWidth / 2;
      const barY = 20;
      
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(barX, barY, barWidth * Math.max(0, this.player.hp / this.player.maxHp), barHeight);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px "JetBrains Mono", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(Math.max(0, this.player.hp))} / ${this.player.maxHp}`, canvas.width / 2, barY + barHeight / 2);

      ctx.textAlign = 'left';
      ctx.font = '24px "JetBrains Mono", monospace, sans-serif';
      ctx.fillText(`SCORE: ${this.score}`, 20, 40);
      
      ctx.fillStyle = '#06b6d4';
      ctx.fillText(`CREDITS: ${this.collectedCredits}`, 20, 70);

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
        const pos = this.getSkillPos(i);
        const skill = this.skills[i];
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

      drawJoystick(this.leftJoystick, '255, 255, 255');
      drawJoystick(this.rightJoystick, '234, 179, 8');
      
      if (this.activeSkillIndex !== null && this.skillJoystick.active) {
        ctx.beginPath();
        ctx.arc(this.skillJoystick.x, this.skillJoystick.y, this.skillJoystick.knobRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
      }
    }
  }
}
