import {
  BaseEnemy,
  BoomerElite,
  Bullet,
  Credit,
  FlameShooterEnemy,
  HealthPickup,
  InteractableManager,
  MeleeEnemy,
  Particle,
  Player,
  PoisonShooterEnemy,
  Portal,
  RangedEnemy,
  TankElite,
  Tile,
  WeaponDrop,
} from '../Entities';
import type { EffectKind } from '../effects/types';
import { BounceSkill, DashSkill, Skill } from '../Skills';
import { Renderer } from '../Renderer';
import { getDifficultyRules } from '../Difficulty';
import type { Difficulty, DifficultyRules } from '../Difficulty';
import { resolveCircleRect, resolveRectRect } from '../physics/Collisions';
import { BulletManager } from '../combat/BulletManager';
import { DefaultWeapon } from '../combat/DefaultWeapon';
import type { Weapon, WeaponId } from '../combat/Weapon';
import { createWeaponById } from '../combat/weapons';
import { WaveSystem } from '../waves/WaveSystem';
import { DungeonManager, createDefaultWorldSizing } from '../world';
import type { DungeonNavigationPath, DungeonStage } from '../world/DungeonManager';
import type { WorldLayout } from '../world/types';
import type { JoystickData } from '../EngineTypes';
import type { GameState } from '../entities/GameState';
import { clamp } from '../entities/math';
import {
  buildRoomOpenings,
  createCorridorWallTiles,
  createDoorTile,
  createOuterBoundsTiles,
  createRoomWallTiles,
  detectCorridorEdge,
  pointInRect,
} from './dungeonTiles';
import { computeSpawnEnemyLevel } from './spawnLevels';

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderer: Renderer;
  animationFrameId: number = 0;

  world = { width: 3000, height: 3000 };
  player = new Player(1500, 1500, 20, 300, 500, 500);

  healthPickups: HealthPickup[] = [];
  portals: Portal[] = [];
  weaponDrops: WeaponDrop[] = [];
  private interactables = new InteractableManager();

  leftJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  rightJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  skillJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 40, knobRadius: 20, touchId: null };

  skills: (Skill | null)[] = [new DashSkill(), new BounceSkill(), null];
  activeSkillIndex: number | null = null;

  private bulletManager = new BulletManager();
  weaponSlots: Array<Weapon | null> = [new DefaultWeapon(), null];
  activeWeaponIndex: 0 | 1 = 0;

  get projectiles(): Bullet[] {
    return this.bulletManager.all;
  }

  get nearbyInteractables() {
    return this.interactables.getOverlappingEntries(this.player.x, this.player.y, this.player.radius);
  }

  getWeaponSlots(): Array<{ id: WeaponId; name: string } | null> {
    return this.weaponSlots.map(w => w ? ({ id: w.id, name: w.name }) : null);
  }

  switchWeapon(index: 0 | 1) {
    if (index === this.activeWeaponIndex) return;
    if (!this.weaponSlots[index]) return;
    this.activeWeaponIndex = index;
  }

  pickupWeapon(weaponId: WeaponId, nowMs: number) {
    const newWeapon = createWeaponById(weaponId);

    const emptyIdx = this.weaponSlots.findIndex(w => !w);
    if (emptyIdx >= 0) {
      this.weaponSlots[emptyIdx] = newWeapon;
      return;
    }

    const slotIdx = this.activeWeaponIndex;
    const prev = this.weaponSlots[slotIdx];
    if (prev) {
      const ox = this.player.x + (Math.random() - 0.5) * 40;
      const oy = this.player.y + (Math.random() - 0.5) * 40;
      const drop = new WeaponDrop(ox, oy, nowMs, prev.id, prev.name);
      this.weaponDrops.push(drop);
      this.interactables.add(drop);
    }

    this.weaponSlots[slotIdx] = newWeapon;
  }

  interactWith(id: string) {
    const it = this.interactables.findById(id);
    if (!it) return false;
    if (!it.isOverlappingCircle(this.player.x, this.player.y, this.player.radius)) return false;
    if (it.interactionMode !== 'MANUAL') return false;

    const now = performance.now();
    if (it.kind === 'WEAPON_DROP' && it instanceof WeaponDrop) {
      this.pickupWeapon(it.weaponId, now);
      this.weaponDrops = this.weaponDrops.filter(w => w.id !== it.id);
      this.interactables.removeById(it.id);
      return true;
    }

    return false;
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

  private lastEliteWaveIndex: number = -1;

  private pendingBoomerDeaths: Array<{ x: number; y: number; level: number }> = [];
  private boomerDeathEmitters: Array<{
    x: number;
    y: number;
    level: number;
    nextAtMs: number;
    volleysRemaining: number;
    intervalMs: number;
  }> = [];

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
    this.skills.forEach(s => {
      if (s) s.currentCooldown = 0;
    });
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
        return;
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

    this.skills.forEach(skill => {
      if (skill) skill.update(dt);
    });

    this.player.updateEffects(dt, time);

    const stunned = this.player.isStunned();
    if (stunned) {
      this.player.isDashing = false;
      this.player.dashTimeRemaining = 0;
    }

    if (this.player.isKnockedBack) {
      this.updateKnockbackWithCollisions(dt);
    }

    if (!stunned && this.player.isDashing) {
      this.updateDashWithCollisions(dt);
      this.particles.push(new Particle(
        this.player.x,
        this.player.y,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        0,
        300,
        '#3b82f6'
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

    if (!stunned && this.rightJoystick.active) {
      const dx = this.rightJoystick.x - this.rightJoystick.originX;
      const dy = this.rightJoystick.y - this.rightJoystick.originY;

      const weapon = this.weaponSlots[this.activeWeaponIndex];
      if (weapon) {
        weapon.tryFire({
          timeMs: time,
          owner: this.player,
          aimDx: dx,
          aimDy: dy,
          spawnBullet: (bullet) => this.spawnBullet(bullet),
        });
      }
    }

    this.bulletManager.updateAndCollideActors(dt, {
      timeMs: time,
      rules: this.rules,
      debugFlags: this.debugFlags,
      player: this.player,
      enemies: this.enemies,
      particles: this.particles,
      credits: this.credits,
      onEnemyKilled: (enemy) => this.handleEnemyKilled(enemy, time),
    });

    if (this.pendingBoomerDeaths.length > 0) {
      for (const d of this.pendingBoomerDeaths) {
        const volleys = clamp(10 + 2 * (d.level - 1), 10, 16);
        const intervalMs = clamp(62 - 3 * (d.level - 1), 38, 62);
        this.boomerDeathEmitters.push({
          x: d.x,
          y: d.y,
          level: d.level,
          nextAtMs: time,
          volleysRemaining: volleys,
          intervalMs,
        });
      }
      this.pendingBoomerDeaths = [];
    }

    if (this.boomerDeathEmitters.length > 0) {
      for (let i = this.boomerDeathEmitters.length - 1; i >= 0; i--) {
        const em = this.boomerDeathEmitters[i];
        if (time < em.nextAtMs) continue;
        if (em.volleysRemaining <= 0) {
          this.boomerDeathEmitters.splice(i, 1);
          continue;
        }

        const speed = 460 + 18 * (em.level - 1);
        const life = 1700;
        const dmg = 10 + 1.5 * (em.level - 1);
        const blindMs = 3000 + 350 * (em.level - 1);
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          this.spawnBullet(new Bullet(
            em.x,
            em.y,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
            life,
            time,
            dmg,
            false,
            '#22c55e',
            { radius: 7, effectKind: 'BLIND', effectDurationMs: blindMs }
          ));
        }

        em.volleysRemaining -= 1;
        em.nextAtMs += em.intervalMs;
      }
    }

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

    const worldIndex = this.dungeon.getWorldIndex();
    const waveIndex = this.waveSystem.state.index;
    const isLastCombatWave = stage === 'COMBAT' && this.combatWaveTarget > 0 && this.combatWavesCleared === this.combatWaveTarget - 1;

    for (const s of waveOut.spawns) {
      const enemyLevel = computeSpawnEnemyLevel({
        worldIndex,
        waveIndex,
        rng: Math.random,
      });

      const eliteChance = clamp(0.02 + 0.01 * worldIndex + 0.004 * waveIndex, 0, 0.14);
      const forceEliteThisWave = isLastCombatWave && this.lastEliteWaveIndex !== waveIndex;
      const shouldSpawnElite = stage === 'COMBAT' && (forceEliteThisWave || (waveIndex > 0 && Math.random() < eliteChance));

      if (shouldSpawnElite) {
        const roll = Math.random();
        const tankBias = clamp(0.42 + 0.06 * worldIndex + 0.04 * waveIndex, 0.42, 0.78);
        const elite = roll < tankBias
          ? new TankElite(s.x, s.y, enemyLevel)
          : new BoomerElite(s.x, s.y, enemyLevel);
        this.enemies.push(elite);
        this.lastEliteWaveIndex = waveIndex;
        continue;
      }

      if (s.kind === 'RANGED') {
        const poisonChance = clamp(0.12 + 0.03 * worldIndex, 0.12, 0.24);
        const flameChance = clamp(0.1 + 0.03 * worldIndex, 0.1, 0.22);
        const r = Math.random();
        if (r < poisonChance) {
          this.enemies.push(new PoisonShooterEnemy(s.x, s.y, enemyLevel));
        } else if (r < poisonChance + flameChance) {
          this.enemies.push(new FlameShooterEnemy(s.x, s.y, enemyLevel));
        } else {
          this.enemies.push(new RangedEnemy(s.x, s.y, enemyLevel));
        }
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
      const e = this.enemies[i];
      e.updateEffects(dt, time);
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.handleEnemyKilled(e, time);
        continue;
      }

      if (e.hasEffect('STUN')) continue;

      e.update(dt, stateObj);
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.handleEnemyKilled(e, time);
      }
    }

    for (let i = this.credits.length - 1; i >= 0; i--) {
      const c = this.credits[i];
      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 150) {
        const pullSpeed = 400 * (1 - dist / 150);
        c.x += (dx / dist) * pullSpeed * dt;
        c.y += (dy / dist) * pullSpeed * dt;
      }

      if (dist < this.player.radius + 15) {
        this.collectedCredits += c.value;
        this.onScoreChange?.(this.score, this.collectedCredits);
        this.credits.splice(i, 1);
        for (let k = 0; k < 3; k++) {
          this.particles.push(new Particle(
            c.x,
            c.y,
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200,
            0,
            200,
            '#06b6d4'
          ));
        }
      }
    }

    let portalTouched = false;
    for (const it of [...this.interactables.all]) {
      if (it.interactionMode !== 'AUTO') continue;
      if (!it.isOverlappingCircle(this.player.x, this.player.y, this.player.radius)) continue;

      if (it.kind === 'HEALTH_PICKUP' && it instanceof HealthPickup) {
        if (stage !== 'REWARD') continue;
        this.player.hp = this.player.maxHp;
        this.healthPickups = this.healthPickups.filter(h => h.id !== it.id);
        this.interactables.removeById(it.id);
        this.dungeon.setHealCollected();
        this.unlockDoorToPortal();
        this.navigationPath = this.dungeon.getNavigationPath(this.player.x, this.player.y);
        for (let k = 0; k < 6; k++) {
          this.particles.push(new Particle(
            it.x,
            it.y,
            (Math.random() - 0.5) * 260,
            (Math.random() - 0.5) * 260,
            0,
            320,
            '#22c55e'
          ));
        }
      }

      if (it.kind === 'PORTAL') {
        portalTouched = true;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    for (const tile of this.tiles) {
      tile.update(dt);
      tile.x = Math.max(tile.width / 2, Math.min(this.world.width - tile.width / 2, tile.x));
      tile.y = Math.max(tile.height / 2, Math.min(this.world.height - tile.height / 2, tile.y));
    }

    for (let i = 0; i < this.tiles.length; i++) {
      for (let j = i + 1; j < this.tiles.length; j++) {
        resolveRectRect(this.tiles[i], this.tiles[j]);
      }
    }

    for (const tile of this.tiles) {
      resolveCircleRect(this.player, tile);
    }

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
    this.weaponDrops = [];
    this.interactables.reset();

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
    const health = new HealthPickup(rewardCenterX, rewardCenterY, nowMs);
    this.healthPickups.push(health);
    this.interactables.add(health);

    const bounce = createWeaponById('bounce_gun');
    const weaponDrop = new WeaponDrop(rewardCenterX + 120, rewardCenterY, nowMs, bounce.id, bounce.name);
    this.weaponDrops.push(weaponDrop);
    this.interactables.add(weaponDrop);

    const portalCenterX = portal.x + portal.width / 2;
    const portalCenterY = portal.y + portal.height / 2;
    const portalObj = new Portal(portalCenterX, portalCenterY, nowMs);
    this.portals.push(portalObj);
    this.interactables.add(portalObj);

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

  private handleEnemyKilled(enemy: BaseEnemy, timeMs: number) {
    this.waveSystem.onEnemyKilled(1);
    if (enemy instanceof BoomerElite) {
      this.pendingBoomerDeaths.push({ x: enemy.x, y: enemy.y, level: enemy.level });
    }

    this.score += enemy instanceof MeleeEnemy ? 10 : 20;
    this.onScoreChange?.(this.score, this.collectedCredits);

    if (Math.random() < 0.4) {
      this.credits.push(new Credit(enemy.x, enemy.y, 10, timeMs));
    }

    for (let k = 0; k < 8; k++) {
      this.particles.push(new Particle(
        enemy.x,
        enemy.y,
        (Math.random() - 0.5) * 420,
        (Math.random() - 0.5) * 420,
        0,
        420 + Math.random() * 240,
        enemy.color,
      ));
    }
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

  private updateKnockbackWithCollisions(dt: number) {
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 240);
      this.player.updateKnockback(step, this.world.width, this.world.height);

      let hitWall = false;
      for (const tile of this.tiles) {
        if (resolveCircleRect(this.player, tile)) {
          hitWall = true;
        }
      }
      if (hitWall) {
        this.player.isKnockedBack = false;
        this.player.knockbackTimeRemaining = 0;
        break;
      }

      remaining -= step;
      if (!this.player.isKnockedBack) break;
    }
  }

  private isCombatRoomFinished(): boolean {
    if (this.dungeon.getStage() !== 'COMBAT') return false;
    if (this.combatWaveTarget <= 0) return false;
    if (this.combatWavesCleared < this.combatWaveTarget) return false;
    return this.enemies.length === 0;
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
