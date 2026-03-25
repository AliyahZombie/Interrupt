import { Player, Bullet, BaseEnemy, MeleeEnemy, RangedEnemy, Particle, GameState, Credit, Tile, HealthPickup, Portal } from './Entities';
import type { EffectKind } from './Entities';
import { Skill, DashSkill, BounceSkill } from './Skills';
import { Renderer } from './Renderer';
import { Difficulty, DifficultyRules, getDifficultyRules } from './Difficulty';
import { resolveCircleRect, resolveRectRect } from './physics/Collisions';
import { WaveSystem } from './waves/WaveSystem';
import { BulletManager } from './combat/BulletManager';
import type { Weapon } from './combat/Weapon';
import { DefaultWeapon } from './combat/DefaultWeapon';
import { DungeonManager, createDefaultWorldSizing } from './world';
import type { DungeonNavigationPath } from './world/DungeonManager';
import type { DungeonStage } from './world/DungeonManager';
import type { Rect, WorldLayout } from './world/types';

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

  healthPickups: HealthPickup[] = [];
  portals: Portal[] = [];
  
  leftJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  rightJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  skillJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 40, knobRadius: 20, touchId: null };
  
  skills: (Skill | null)[] = [new DashSkill(), new BounceSkill(), null]; // 3 Skill slots
  activeSkillIndex: number | null = null;
  
  private bulletManager = new BulletManager();
  weapon: Weapon = new DefaultWeapon();

  get projectiles(): Bullet[] {
    return this.bulletManager.all;
  }

  spawnBullet(bullet: Bullet) {
    this.bulletManager.spawn(bullet);
  }

  applyPlayerEffect(kind: EffectKind, durationMs: number) {
    const now = performance.now();
    this.player.applyEffect(kind, durationMs, now);
  }

  skipCurrentWave() {
    const now = performance.now();
    const stage = this.dungeon.getStage();
    if (stage === 'COMBAT' && !this.isCombatRoomFinished()) {
      this.combatWavesCleared = Math.min(this.combatWaveTarget, this.combatWavesCleared + 1);
    }
    this.waveSystem.skipCurrentWave(now);
  }

  enemies: BaseEnemy[] = [];
  particles: Particle[] = [];
  credits: Credit[] = [];
  tiles: Tile[] = [];

  navigationPath: DungeonNavigationPath | null = null;

  private dungeon: DungeonManager;
  private layout: WorldLayout;
  private doorToReward: Tile | null = null;
  private doorToPortal: Tile | null = null;

  private combatWaveTarget: number = 0;
  private combatWavesCleared: number = 0;

  private visitedRoomIndices = new Set<number>();

  
  lastTime: number = performance.now();
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

  waveSystem: WaveSystem;

  get wave() {
    return this.waveSystem.state;
  }

  onStateChange?: (state: 'START' | 'PLAYING' | 'GAME_OVER') => void;
  onScoreChange?: (score: number, credits: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.canvas, this.ctx);
    this.waveSystem = new WaveSystem(performance.now(), this.difficulty);

    const sizing = createDefaultWorldSizing(() => ({ width: this.canvas.width, height: this.canvas.height }));
    this.dungeon = new DungeonManager(sizing);
    this.layout = this.dungeon.getLayout();
    
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
    this.waveSystem.setDifficulty(difficulty);
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
    this.bulletManager.reset();
    this.particles = [];
    this.credits = [];
    this.tiles = [];
    this.healthPickups = [];
    this.portals = [];

    this.navigationPath = null;
    this.dungeon.resetRun();
    this.layout = this.dungeon.getLayout();
    this.doorToReward = null;
    this.doorToPortal = null;
    this.combatWaveTarget = 0;
    this.combatWavesCleared = 0;
    this.visitedRoomIndices.clear();
    
    this.score = 0;
    this.collectedCredits = 0;
    this.gameOver = false;
    this.lastTime = now;
    this.skills.forEach(s => { if (s) s.currentCooldown = 0; });
    this.onScoreChange?.(this.score, this.collectedCredits);

    this.waveSystem.reset(now, this.difficulty);
    this.buildWorld(now);
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

    if (this.player.isStunned()) {
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

    this.player.updateEffects(dt, time);

    const stunned = this.player.isStunned();
    if (stunned) {
      this.player.isDashing = false;
      this.player.dashTimeRemaining = 0;
    }

    // Player movement
    if (!stunned && this.player.isDashing) {
      this.updateDashWithCollisions(dt);
      // Visual effect: Particles along the dash path
      this.particles.push(new Particle(
        this.player.x, this.player.y, 
        (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, 
        0, 300, '#3b82f6'
      ));
    } else if (!stunned && this.leftJoystick.active) {
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
    if (!stunned && this.rightJoystick.active) {
      const dx = this.rightJoystick.x - this.rightJoystick.originX;
      const dy = this.rightJoystick.y - this.rightJoystick.originY;

      this.weapon.tryFire({
        timeMs: time,
        owner: this.player,
        aimDx: dx,
        aimDy: dy,
        spawnBullet: (bullet) => this.spawnBullet(bullet),
      });
    }

    this.bulletManager.updateAndCollideActors(dt, {
      timeMs: time,
      rules: this.rules,
      debugFlags: this.debugFlags,
      player: this.player,
      enemies: this.enemies,
      particles: this.particles,
      credits: this.credits,
      onEnemyKilled: (enemy) => {
        this.waveSystem.onEnemyKilled(1);
        this.score += enemy instanceof MeleeEnemy ? 10 : 20;
        this.onScoreChange?.(this.score, this.collectedCredits);
      },
    });

    // Enemies
    let cameraX = this.player.x - this.canvas.width / 2;
    let cameraY = this.player.y - this.canvas.height / 2;

    const prevPhase = this.waveSystem.state.phase;
    const stage = this.dungeon.getStage();
    const stopSpawningForStage = stage !== 'COMBAT' || this.isCombatRoomFinished();
    const spawnRect = stage === 'COMBAT' && !this.isCombatRoomFinished() ? this.dungeon.getCombatRect() : undefined;

    const waveOut = this.waveSystem.update({
      timeMs: time,
      difficulty: this.difficulty,
      stopSpawning: this.debugFlags.stopSpawning || stopSpawningForStage,
      enemiesAlive: this.enemies.length,
      cameraX,
      cameraY,
      viewportWidth: this.canvas.width,
      viewportHeight: this.canvas.height,
      worldWidth: this.world.width,
      worldHeight: this.world.height,
      spawnRect,
    });

    if (stage === 'COMBAT') {
      if (waveOut.forcedAdvance) {
        this.combatWavesCleared = Math.min(this.combatWaveTarget, this.combatWavesCleared + 1);
      } else if (prevPhase === 'WAIT_CLEAR' && this.waveSystem.state.phase === 'INTERMISSION') {
        this.combatWavesCleared += 1;
      }
    }

    for (const s of waveOut.spawns) {
      const enemyLevel = this.computeSpawnEnemyLevel({
        worldIndex: this.dungeon.getWorldIndex(),
        waveIndex: this.waveSystem.state.index,
        rng: Math.random,
      });
      if (s.kind === 'RANGED') {
        this.enemies.push(new RangedEnemy(s.x, s.y, enemyLevel));
      } else {
        this.enemies.push(new MeleeEnemy(s.x, s.y, enemyLevel));
      }
    }

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

    if (stage === 'REWARD') {
      for (let i = this.healthPickups.length - 1; i >= 0; i--) {
        const h = this.healthPickups[i];
        const dist = Math.hypot(this.player.x - h.x, this.player.y - h.y);
        if (dist < this.player.radius + h.radius) {
          this.player.hp = this.player.maxHp;
          this.healthPickups.splice(i, 1);
          this.dungeon.setHealCollected();
          this.unlockDoorToPortal();
           this.navigationPath = this.dungeon.getNavigationPath(this.player.x, this.player.y);
          for (let k = 0; k < 6; k++) {
            this.particles.push(new Particle(
              h.x,
              h.y,
              (Math.random() - 0.5) * 260,
              (Math.random() - 0.5) * 260,
              0,
              320,
              '#22c55e',
            ));
          }
        }
      }
    }

    let portalTouched = false;
    for (const p of this.portals) {
      const dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (dist < this.player.radius + p.radius) {
        portalTouched = true;
        break;
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

    this.bulletManager.collideTiles(this.tiles, this.particles);

    const combatFinished = this.isCombatRoomFinished();
    if (stage === 'COMBAT' && combatFinished && !this.dungeon.isCombatCleared()) {
      this.dungeon.setCombatCleared();
      this.unlockDoorToReward();
      this.navigationPath = this.dungeon.getNavigationPath(this.player.x, this.player.y);
    }

    this.dungeon.updateStage(this.player.x, this.player.y);
    this.navigationPath = this.dungeon.getNavigationPath(this.player.x, this.player.y);

    this.updateVisitedRooms(this.player.x, this.player.y);

    if (this.dungeon.getStage() === 'PORTAL' && portalTouched) {
      this.advanceWorld(time);
    }

    if (this.player.hp <= 0 && !this.gameOver) {
      this.gameOver = true;
      this.onStateChange?.('GAME_OVER');
    }
  }

  private buildWorld(nowMs: number) {
    this.layout = this.dungeon.getLayout();
    this.world.width = this.layout.bounds.width;
    this.world.height = this.layout.bounds.height;

    this.enemies = [];
    this.bulletManager.reset();
    this.particles = [];
    this.credits = [];
    this.healthPickups = [];
    this.portals = [];

    const combat = this.dungeon.getCombatRect();
    const reward = this.dungeon.getRewardRect();
    const portal = this.dungeon.getPortalRect();

    this.player.x = combat.x + combat.width * 0.35;
    this.player.y = combat.y + combat.height / 2;

    const { tiles, doorToReward, doorToPortal } = this.createDungeonTiles();
    this.tiles = tiles;
    this.doorToReward = doorToReward;
    this.doorToPortal = doorToPortal;

    const rewardCenterX = reward.x + reward.width / 2;
    const rewardCenterY = reward.y + reward.height / 2;
    this.healthPickups.push(new HealthPickup(rewardCenterX, rewardCenterY, nowMs));

    const portalCenterX = portal.x + portal.width / 2;
    const portalCenterY = portal.y + portal.height / 2;
    this.portals.push(new Portal(portalCenterX, portalCenterY, nowMs));

    this.combatWaveTarget = Math.max(1, this.layout.combatWaveCount);
    this.combatWavesCleared = 0;

    this.visitedRoomIndices.clear();
    this.updateVisitedRooms(this.player.x, this.player.y);
    this.waveSystem.reset(nowMs, this.difficulty);
  }

  getMinimapData(): {
    bounds: { width: number; height: number };
    rooms: WorldLayout['rooms'];
    corridors: WorldLayout['corridors'];
    visitedRoomIndices: ReadonlySet<number>;
    player: { x: number; y: number };
    objectivePos: { x: number; y: number } | null;
    objectiveStage: DungeonStage;
  } {
    const stage = this.dungeon.getStage();
    const combatCleared = this.dungeon.isCombatCleared();
    const healCollected = this.dungeon.isHealCollected();

    const reward = this.dungeon.getRewardRect();
    const portal = this.dungeon.getPortalRect();

    const rewardCenter = { x: reward.x + reward.width / 2, y: reward.y + reward.height / 2 };
    const portalCenter = { x: portal.x + portal.width / 2, y: portal.y + portal.height / 2 };

    let objectiveStage: DungeonStage = stage;
    let objectivePos: { x: number; y: number } | null = null;

    if (stage === 'COMBAT') {
      objectiveStage = combatCleared ? 'REWARD' : 'COMBAT';
      objectivePos = combatCleared ? rewardCenter : null;
    } else if (stage === 'REWARD') {
      objectiveStage = healCollected ? 'PORTAL' : 'REWARD';
      if (healCollected) {
        objectivePos = this.portals[0] ? { x: this.portals[0].x, y: this.portals[0].y } : portalCenter;
      } else {
        objectivePos = this.healthPickups[0] ? { x: this.healthPickups[0].x, y: this.healthPickups[0].y } : rewardCenter;
      }
    } else {
      objectiveStage = 'PORTAL';
      objectivePos = this.portals[0] ? { x: this.portals[0].x, y: this.portals[0].y } : portalCenter;
    }

    return {
      bounds: { width: this.layout.bounds.width, height: this.layout.bounds.height },
      rooms: this.layout.rooms,
      corridors: this.layout.corridors,
      visitedRoomIndices: this.visitedRoomIndices,
      player: { x: this.player.x, y: this.player.y },
      objectivePos,
      objectiveStage,
    };
  }

  private advanceWorld(nowMs: number) {
    this.dungeon.advanceWorld();
    this.navigationPath = null;
    this.buildWorld(nowMs);
  }

  private createDungeonTiles(): { tiles: Tile[]; doorToReward: Tile; doorToPortal: Tile } {
    const thickness = 70;
    const tiles: Tile[] = [];

    const combat = this.dungeon.getCombatRect();
    const reward = this.dungeon.getRewardRect();
    const portal = this.dungeon.getPortalRect();
    const corridor1 = this.layout.corridors[0];
    const corridor2 = this.layout.corridors[1];

    tiles.push(...createOuterBoundsTiles(this.layout.bounds.width, this.layout.bounds.height, thickness));

    const combatOpenings = buildRoomOpenings(combat, corridor1);
    const rewardOpenings = {
      ...buildRoomOpenings(reward, corridor1),
      ...buildRoomOpenings(reward, corridor2),
    };
    const portalOpenings = buildRoomOpenings(portal, corridor2);

    tiles.push(...createRoomWallTiles(combat, thickness, combatOpenings));
    tiles.push(...createRoomWallTiles(reward, thickness, rewardOpenings));
    tiles.push(...createRoomWallTiles(portal, thickness, portalOpenings));

    tiles.push(...createCorridorWallTiles(corridor1, thickness));
    tiles.push(...createCorridorWallTiles(corridor2, thickness));

    const doorWidth = 90;
    const door1 = createDoorTile(corridor1, doorWidth, detectCorridorEdge(combat, corridor1));
    const door2 = createDoorTile(corridor2, doorWidth, detectCorridorEdge(reward, corridor2));

    tiles.push(door1);
    tiles.push(door2);

    return { tiles, doorToReward: door1, doorToPortal: door2 };
  }

  private unlockDoorToReward() {
    if (!this.doorToReward) return;
    const door = this.doorToReward;
    this.tiles = this.tiles.filter(t => t !== door);
    this.doorToReward = null;
  }

  private unlockDoorToPortal() {
    if (!this.doorToPortal) return;
    const door = this.doorToPortal;
    this.tiles = this.tiles.filter(t => t !== door);
    this.doorToPortal = null;
  }

  private updateDashWithCollisions(dt: number) {
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 240);
      this.player.update(step, this.world.width, this.world.height);
      let hitWall = false;
      for (const tile of this.tiles) {
        if (resolveCircleRect(this.player, tile)) {
          hitWall = true;
        }
      }
      if (hitWall) {
        this.player.isDashing = false;
        this.player.dashTimeRemaining = 0;
        break;
      }
      remaining -= step;
      if (!this.player.isDashing) break;
    }
  }

  private isCombatRoomFinished(): boolean {
    if (this.dungeon.getStage() !== 'COMBAT') return false;
    if (this.combatWaveTarget <= 0) return false;
    if (this.combatWavesCleared < this.combatWaveTarget) return false;
    return this.enemies.length === 0;
  }

  private computeSpawnEnemyLevel(params: {
    worldIndex: number;
    waveIndex: number;
    rng: () => number;
  }): number {
    const worldIndex = Math.max(0, Math.floor(params.worldIndex));
    const waveIndex = Math.max(1, Math.floor(params.waveIndex));

    if (worldIndex <= 0) return 1;

    const maxLevel = Math.min(1 + worldIndex, 8);
    const rawChance = 0.08 + worldIndex * 0.05 + (waveIndex - 1) * 0.01;
    const stepChance = Math.max(0, Math.min(0.4, rawChance));

    let level = 1;
    for (let next = 2; next <= maxLevel; next++) {
      if (params.rng() < stepChance) {
        level = next;
      } else {
        break;
      }
    }
    return level;
  }

  private updateVisitedRooms(playerX: number, playerY: number) {
    const rooms = this.layout.rooms;
    for (let i = 0; i < rooms.length; i++) {
      const rect = rooms[i].rect;
      if (pointInRect(playerX, playerY, rect)) {
        this.visitedRoomIndices.add(i);
      }
    }
  }
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function createOuterBoundsTiles(worldW: number, worldH: number, thickness: number): Tile[] {
  const halfT = thickness / 2;
  return [
    new Tile(worldW / 2, halfT, worldW, thickness, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
    new Tile(worldW / 2, worldH - halfT, worldW, thickness, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
    new Tile(halfT, worldH / 2, thickness, worldH, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
    new Tile(worldW - halfT, worldH / 2, thickness, worldH, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
  ];
}

function createCorridorWallTiles(rect: Rect, thickness: number): Tile[] {
  const halfT = thickness / 2;
  if (rect.width >= rect.height) {
    const top = new Tile(rect.x + rect.width / 2, rect.y - halfT, rect.width, thickness, true, 0, 0, 100, '#0b1220', 'WALL');
    const bottom = new Tile(rect.x + rect.width / 2, rect.y + rect.height + halfT, rect.width, thickness, true, 0, 0, 100, '#0b1220', 'WALL');
    return [top, bottom];
  }
  const left = new Tile(rect.x - halfT, rect.y + rect.height / 2, thickness, rect.height, true, 0, 0, 100, '#0b1220', 'WALL');
  const right = new Tile(rect.x + rect.width + halfT, rect.y + rect.height / 2, thickness, rect.height, true, 0, 0, 100, '#0b1220', 'WALL');
  return [left, right];
}

function createRoomWallTiles(
  rect: Rect,
  thickness: number,
  openings: {
    north?: { x: number; width: number };
    south?: { x: number; width: number };
    west?: { y: number; height: number };
    east?: { y: number; height: number };
  },
): Tile[] {
  const tiles: Tile[] = [];
  const halfT = thickness / 2;

  const northY = rect.y - halfT;
  const southY = rect.y + rect.height + halfT;

  const northOpening = openings.north;
  if (!northOpening) {
    tiles.push(new Tile(rect.x + rect.width / 2, northY, rect.width, thickness, true, 0, 0, 100, '#0b1220', 'WALL'));
  } else {
    const leftW = Math.max(0, northOpening.x - rect.x - northOpening.width / 2);
    const rightW = Math.max(0, rect.x + rect.width - (northOpening.x + northOpening.width / 2));
    if (leftW > 0) {
      tiles.push(new Tile(rect.x + leftW / 2, northY, leftW, thickness, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
    if (rightW > 0) {
      tiles.push(new Tile(rect.x + rect.width - rightW / 2, northY, rightW, thickness, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
  }

  const southOpening = openings.south;
  if (!southOpening) {
    tiles.push(new Tile(rect.x + rect.width / 2, southY, rect.width, thickness, true, 0, 0, 100, '#0b1220', 'WALL'));
  } else {
    const leftW = Math.max(0, southOpening.x - rect.x - southOpening.width / 2);
    const rightW = Math.max(0, rect.x + rect.width - (southOpening.x + southOpening.width / 2));
    if (leftW > 0) {
      tiles.push(new Tile(rect.x + leftW / 2, southY, leftW, thickness, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
    if (rightW > 0) {
      tiles.push(new Tile(rect.x + rect.width - rightW / 2, southY, rightW, thickness, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
  }

  const westX = rect.x - halfT;
  const eastX = rect.x + rect.width + halfT;

  const westOpening = openings.west;
  if (!westOpening) {
    tiles.push(new Tile(westX, rect.y + rect.height / 2, thickness, rect.height, true, 0, 0, 100, '#0b1220', 'WALL'));
  } else {
    const topH = Math.max(0, westOpening.y - rect.y - westOpening.height / 2);
    const bottomH = Math.max(0, rect.y + rect.height - (westOpening.y + westOpening.height / 2));
    if (topH > 0) {
      tiles.push(new Tile(westX, rect.y + topH / 2, thickness, topH, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
    if (bottomH > 0) {
      tiles.push(new Tile(westX, rect.y + rect.height - bottomH / 2, thickness, bottomH, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
  }

  const eastOpening = openings.east;
  if (!eastOpening) {
    tiles.push(new Tile(eastX, rect.y + rect.height / 2, thickness, rect.height, true, 0, 0, 100, '#0b1220', 'WALL'));
  } else {
    const topH = Math.max(0, eastOpening.y - rect.y - eastOpening.height / 2);
    const bottomH = Math.max(0, rect.y + rect.height - (eastOpening.y + eastOpening.height / 2));
    if (topH > 0) {
      tiles.push(new Tile(eastX, rect.y + topH / 2, thickness, topH, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
    if (bottomH > 0) {
      tiles.push(new Tile(eastX, rect.y + rect.height - bottomH / 2, thickness, bottomH, true, 0, 0, 100, '#0b1220', 'WALL'));
    }
  }

  return tiles;
}

function detectCorridorEdge(room: Rect, corridor: Rect): 'NORTH' | 'SOUTH' | 'WEST' | 'EAST' {
  const eps = 1e-3;
  if (Math.abs(corridor.x - (room.x + room.width)) < eps) return 'EAST';
  if (Math.abs(corridor.x + corridor.width - room.x) < eps) return 'WEST';
  if (Math.abs(corridor.y - (room.y + room.height)) < eps) return 'SOUTH';
  return 'NORTH';
}

function buildRoomOpenings(
  room: Rect,
  corridor: Rect,
): { north?: { x: number; width: number }; south?: { x: number; width: number }; west?: { y: number; height: number }; east?: { y: number; height: number } } {
  const edge = detectCorridorEdge(room, corridor);
  const cx = corridor.x + corridor.width / 2;
  const cy = corridor.y + corridor.height / 2;
  if (edge === 'EAST') return { east: { y: cy, height: corridor.height } };
  if (edge === 'WEST') return { west: { y: cy, height: corridor.height } };
  if (edge === 'SOUTH') return { south: { x: cx, width: corridor.width } };
  return { north: { x: cx, width: corridor.width } };
}

function createDoorTile(
  corridor: Rect,
  doorThickness: number,
  nearRoomEdge: 'NORTH' | 'SOUTH' | 'WEST' | 'EAST',
): Tile {
  const horizontal = corridor.width >= corridor.height;
  if (horizontal) {
    const y = corridor.y + corridor.height / 2;
    const x = nearRoomEdge === 'EAST'
      ? corridor.x + doorThickness / 2
      : corridor.x + corridor.width - doorThickness / 2;
    return new Tile(x, y, doorThickness, corridor.height - 20, true, 0, 0, 100, '#0b1220', 'DOOR');
  }
  const x = corridor.x + corridor.width / 2;
  const y = nearRoomEdge === 'SOUTH'
    ? corridor.y + doorThickness / 2
    : corridor.y + corridor.height - doorThickness / 2;
  return new Tile(x, y, corridor.width - 20, doorThickness, true, 0, 0, 100, '#0b1220', 'DOOR');
}
