import { Player, Projectile, BaseEnemy, MeleeEnemy, RangedEnemy, Particle, GameState, Credit, Tile } from './Entities';
import { Skill, DashSkill, BounceSkill } from './Skills';
import { Renderer } from './Renderer';
import { Difficulty, DifficultyRules, getDifficultyRules } from './Difficulty';

type WavePhase = 'SPAWNING' | 'WAIT_CLEAR' | 'INTERMISSION';

interface WaveState {
  index: number;
  phase: WavePhase;
  targetToSpawn: number;
  spawned: number;
  killed: number;
  startedAtMs: number;
  intermissionUntilMs: number;
  skipNextIntermission: boolean;
  cancelIntermissionAfterMs: number;
  forceNextWaveAfterMs: number;
}

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
  renderer: Renderer;
  animationFrameId: number = 0;

  world = { width: 3000, height: 3000 };
  player = new Player(1500, 1500, 20, 300, 500, 500);
  
  leftJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  rightJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  skillJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 40, knobRadius: 20, touchId: null };
  
  skills: (Skill | null)[] = [new DashSkill(), new BounceSkill(), null]; // 3 Skill slots
  activeSkillIndex: number | null = null;
  
  projectiles: Projectile[] = [];
  enemies: BaseEnemy[] = [];
  particles: Particle[] = [];
  credits: Credit[] = [];
  tiles: Tile[] = [];

  
  lastTime: number = performance.now();
  lastShot: number = 0;
  score: number = 0;
  collectedCredits: number = 0;
  gameStarted: boolean = false;
  gameOver: boolean = false;

  difficulty: Difficulty = 'NORMAL';
  rules: DifficultyRules = getDifficultyRules('NORMAL');

  debugFlags = {
    stopSpawning: false,
    godMode: false,
    noCooldowns: false,
    showWaveDebug: false,
  };

  wave: WaveState = {
    index: 1,
    phase: 'SPAWNING',
    targetToSpawn: 0,
    spawned: 0,
    killed: 0,
    startedAtMs: performance.now(),
    intermissionUntilMs: 0,
    skipNextIntermission: false,
    cancelIntermissionAfterMs: 0,
    forceNextWaveAfterMs: 0,
  };

  lastWaveSpawnAtMs: number = 0;

  onStateChange?: (state: 'START' | 'PLAYING' | 'GAME_OVER') => void;
  onScoreChange?: (score: number, credits: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.canvas, this.ctx);
    
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

  setDifficulty(difficulty: Difficulty) {
    this.difficulty = difficulty;
    this.rules = getDifficultyRules(difficulty);
    this.configureShieldForDifficulty();
  }

  private getWaveDifficultyMultiplier() {
    if (this.difficulty === 'EASY') return 0.85;
    if (this.difficulty === 'HARD') return 1.25;
    return 1;
  }

  private configureShieldForDifficulty() {
    if (this.difficulty === 'EASY') {
      this.player.configureShield(200, 2500, 95);
      return;
    }
    if (this.difficulty === 'HARD') {
      this.player.configureShield(110, 4200, 55);
      return;
    }
    this.player.configureShield(150, 3500, 70);
  }

  private computeWaveTargetCount(waveIndex: number) {
    const base = 6;
    const perWave = 2;
    const raw = base + (waveIndex - 1) * perWave;
    const scaled = Math.round(raw * this.getWaveDifficultyMultiplier());
    return Math.max(1, scaled);
  }

  private computeWaveSpawnIntervalMs() {
    const base = 650;
    const scaled = base / this.getWaveDifficultyMultiplier();
    return Math.max(320, Math.min(900, Math.round(scaled)));
  }

  private computeIntermissionMs() {
    return 2400;
  }

  private computeCancelIntermissionAfterMs(waveIndex: number) {
    return 20000 + waveIndex * 800;
  }

  private computeForceNextWaveAfterMs(waveIndex: number) {
    return 45000 + waveIndex * 1500;
  }

  private startWave(timeMs: number, waveIndex: number) {
    this.wave = {
      index: waveIndex,
      phase: 'SPAWNING',
      targetToSpawn: this.computeWaveTargetCount(waveIndex),
      spawned: 0,
      killed: 0,
      startedAtMs: timeMs,
      intermissionUntilMs: 0,
      skipNextIntermission: false,
      cancelIntermissionAfterMs: this.computeCancelIntermissionAfterMs(waveIndex),
      forceNextWaveAfterMs: this.computeForceNextWaveAfterMs(waveIndex),
    };
    this.lastWaveSpawnAtMs = timeMs;
  }

  private spawnWaveEnemy(cameraX: number, cameraY: number) {
    const spawnEdge = Math.floor(Math.random() * 4);
    let ex = 0;
    let ey = 0;
    const margin = 50;

    if (spawnEdge === 0) {
      ex = cameraX + Math.random() * this.canvas.width;
      ey = cameraY - margin;
    } else if (spawnEdge === 1) {
      ex = cameraX + this.canvas.width + margin;
      ey = cameraY + Math.random() * this.canvas.height;
    } else if (spawnEdge === 2) {
      ex = cameraX + Math.random() * this.canvas.width;
      ey = cameraY + this.canvas.height + margin;
    } else {
      ex = cameraX - margin;
      ey = cameraY + Math.random() * this.canvas.height;
    }

    ex = Math.max(0, Math.min(this.world.width, ex));
    ey = Math.max(0, Math.min(this.world.height, ey));

    const wave = this.wave.index;
    const waveRangedBase = 0.2 + wave * 0.03;
    const rangedChance = Math.max(0.2, Math.min(0.6, waveRangedBase + (this.difficulty === 'HARD' ? 0.05 : 0)));

    if (Math.random() < rangedChance) {
      this.enemies.push(new RangedEnemy(ex, ey));
    } else {
      this.enemies.push(new MeleeEnemy(ex, ey));
    }
  }

  private updateWaves(timeMs: number, cameraX: number, cameraY: number) {
    if (this.debugFlags.stopSpawning) return;

    const waveAgeMs = timeMs - this.wave.startedAtMs;
    const alive = this.enemies.length;

    if (this.wave.phase === 'INTERMISSION') {
      if (timeMs >= this.wave.intermissionUntilMs) {
        this.startWave(timeMs, this.wave.index + 1);
      }
      return;
    }

    if (this.wave.phase === 'SPAWNING') {
      const spawnIntervalMs = this.computeWaveSpawnIntervalMs();
      const canSpawn = timeMs - this.lastWaveSpawnAtMs >= spawnIntervalMs;

      if (this.wave.spawned < this.wave.targetToSpawn && canSpawn) {
        this.spawnWaveEnemy(cameraX, cameraY);
        this.wave.spawned += 1;
        this.lastWaveSpawnAtMs = timeMs;
      }

      if (this.wave.spawned >= this.wave.targetToSpawn) {
        this.wave.phase = 'WAIT_CLEAR';
      }

      return;
    }

    if (alive <= 1 && waveAgeMs >= this.wave.cancelIntermissionAfterMs) {
      this.wave.skipNextIntermission = true;
    }

    if (waveAgeMs >= this.wave.forceNextWaveAfterMs) {
      this.enemies = [];
      this.startWave(timeMs, this.wave.index + 1);
      return;
    }

    if (alive === 0) {
      const delayMs = this.wave.skipNextIntermission ? 0 : this.computeIntermissionMs();
      this.wave.phase = 'INTERMISSION';
      this.wave.intermissionUntilMs = timeMs + delayMs;
    }
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
    const now = performance.now();

    this.configureShieldForDifficulty();
    this.player.resetVitals(now);
    this.player.x = this.world.width / 2;
    this.player.y = this.world.height / 2;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.credits = [];
    this.tiles = [];
    
    this.score = 0;
    this.collectedCredits = 0;
    this.gameOver = false;
    this.lastTime = now;
    this.skills.forEach(s => { if (s) s.currentCooldown = 0; });
    this.onScoreChange?.(this.score, this.collectedCredits);

    this.startWave(now, 1);
  }

  startGame(difficulty?: Difficulty) {
    if (difficulty) {
      this.setDifficulty(difficulty);
    }
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
        const skill = this.skills[i];
        if (skill && (skill.currentCooldown <= 0 || this.debugFlags.noCooldowns)) {
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

  loop(time: number) {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (this.gameStarted && !this.gameOver) {
      this.update(dt, time);
    }
    this.renderer.draw(this);

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  update(dt: number, time: number) {
    if (this.debugFlags.noCooldowns) {
      this.skills.forEach(skill => {
        if (skill) skill.currentCooldown = 0;
      });
    }

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
              this.wave.killed += 1;
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
        if (!this.player.isDashing && !this.debugFlags.godMode && Math.hypot(p.x - this.player.x, p.y - this.player.y) < this.player.radius + 5) {
          this.player.applyDamage(p.damage * this.rules.playerDamageMultiplier, time);
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
    this.updateWaves(time, cameraX, cameraY);

    this.player.updateShield(dt, time);

    const stateObj: GameState = {
      player: this.player,
      projectiles: this.projectiles,
      particles: this.particles,
      tiles: this.tiles,
      score: this.score,
      time: time,
      debugFlags: this.debugFlags,
      difficulty: this.difficulty,
      rules: this.rules,
      enemies: this.enemies,
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

    // --- TILE COLLISIONS ---
    const resolveRectRect = (rect1: Tile, rect2: Tile) => {
      const dx = rect1.x - rect2.x;
      const dy = rect1.y - rect2.y;
      const combinedHalfWidths = (rect1.width + rect2.width) / 2;
      const combinedHalfHeights = (rect1.height + rect2.height) / 2;

      if (Math.abs(dx) < combinedHalfWidths && Math.abs(dy) < combinedHalfHeights) {
        const overlapX = combinedHalfWidths - Math.abs(dx);
        const overlapY = combinedHalfHeights - Math.abs(dy);

        let nx = 0, ny = 0, overlap = 0;
        if (overlapX < overlapY) {
          nx = Math.sign(dx) || 1;
          ny = 0;
          overlap = overlapX;
        } else {
          nx = 0;
          ny = Math.sign(dy) || 1;
          overlap = overlapY;
        }

        if (rect1.isFixed && rect2.isFixed) {
          return;
        } else if (rect1.isFixed) {
          rect2.x -= nx * overlap;
          rect2.y -= ny * overlap;
          if (nx !== 0) rect2.vx *= -0.5;
          if (ny !== 0) rect2.vy *= -0.5;
        } else if (rect2.isFixed) {
          rect1.x += nx * overlap;
          rect1.y += ny * overlap;
          if (nx !== 0) rect1.vx *= -0.5;
          if (ny !== 0) rect1.vy *= -0.5;
        } else {
          const totalMass = rect1.mass + rect2.mass;
          const r1Ratio = rect2.mass / totalMass;
          const r2Ratio = rect1.mass / totalMass;
          
          rect1.x += nx * overlap * r1Ratio;
          rect1.y += ny * overlap * r1Ratio;
          rect2.x -= nx * overlap * r2Ratio;
          rect2.y -= ny * overlap * r2Ratio;
          
          const v1n = rect1.vx * nx + rect1.vy * ny;
          const v2n = rect2.vx * nx + rect2.vy * ny;
          const dv = v1n - v2n;
          
          if (dv < 0) {
            const restitution = 0.4;
            const impulse = -(1 + restitution) * dv / (1/rect1.mass + 1/rect2.mass);
            rect1.vx += nx * impulse / rect1.mass;
            rect1.vy += ny * impulse / rect1.mass;
            rect2.vx -= nx * impulse / rect2.mass;
            rect2.vy -= ny * impulse / rect2.mass;
          }
        }
      }
    };

    const resolveCircleRect = (circle: any, rect: Tile, isProjectile: boolean = false) => {
      const radius = circle.radius ?? 5; // Fallback for projectiles
      const dx = circle.x - rect.x;
      const dy = circle.y - rect.y;
      const px = Math.max(-rect.width / 2, Math.min(rect.width / 2, dx));
      const py = Math.max(-rect.height / 2, Math.min(rect.height / 2, dy));
      
      const dist = Math.hypot(dx - px, dy - py);
      if (dist < radius) {
        let nx = dx - px;
        let ny = dy - py;
        let len = Math.hypot(nx, ny);
        let overlap = radius - dist;
        
        if (len === 0) {
          if (Math.abs(dx) > Math.abs(dy)) {
            nx = Math.sign(dx) || 1; ny = 0;
            overlap = radius + rect.width / 2 - Math.abs(dx);
          } else {
            nx = 0; ny = Math.sign(dy) || 1;
            overlap = radius + rect.height / 2 - Math.abs(dy);
          }
        } else {
          nx /= len;
          ny /= len;
        }
        
        if (rect.isFixed) {
          if (!isProjectile) {
            circle.x += nx * overlap;
            circle.y += ny * overlap;
          }
        } else {
          if (!isProjectile) {
            const pushFactor = 0.8; // Circle gets pushed more, tile gets pushed less
            circle.x += nx * overlap * pushFactor;
            circle.y += ny * overlap * pushFactor;
            rect.x -= nx * overlap * (1 - pushFactor);
            rect.y -= ny * overlap * (1 - pushFactor);
            
            // Give it a velocity kick so it slides
            rect.vx -= nx * overlap * 60;
            rect.vy -= ny * overlap * 60;
          } else {
            // Projectile hits movable tile
            if (circle.vx !== undefined && circle.vy !== undefined) {
              rect.vx += circle.vx * 0.15;
              rect.vy += circle.vy * 0.15;
            }
          }
        }
        return true;
      }
      return false;
    };

    // Update tiles
    for (const tile of this.tiles) {
      tile.update(dt);
      tile.x = Math.max(tile.width / 2, Math.min(this.world.width - tile.width / 2, tile.x));
      tile.y = Math.max(tile.height / 2, Math.min(this.world.height - tile.height / 2, tile.y));
    }

    // Tile vs Tile
    for (let i = 0; i < this.tiles.length; i++) {
      for (let j = i + 1; j < this.tiles.length; j++) {
        resolveRectRect(this.tiles[i], this.tiles[j]);
      }
    }

    // Player vs Tiles
    for (const tile of this.tiles) {
      resolveCircleRect(this.player, tile);
    }

    // Enemies vs Tiles
    for (const enemy of this.enemies) {
      for (const tile of this.tiles) {
        resolveCircleRect(enemy, tile);
      }
    }

    // Projectiles vs Tiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let hitTile = false;
      for (const tile of this.tiles) {
        if (resolveCircleRect(p, tile, true)) {
          hitTile = true;
          break;
        }
      }
      if (hitTile) {
        for(let k=0; k<3; k++) {
          this.particles.push(new Particle(
            p.x, p.y,
            (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200,
            0, 200, p.color
          ));
        }
        this.projectiles.splice(i, 1);
      }
    }

    if (this.player.hp <= 0 && !this.gameOver) {
      this.gameOver = true;
      this.onStateChange?.('GAME_OVER');
    }
  }
}
