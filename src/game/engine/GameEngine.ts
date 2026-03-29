import {
  BaseEnemy,
  BoomerElite,
  Bullet,
  Credit,
  MpDrop,
  FlameShooterEnemy,
  HealthPickup,
  InteractableManager,
  MeleeEnemy,
  type NearbyInteractableEntry,
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
import { TileSpatialIndex } from '../physics/TileSpatialIndex';
import { BulletManager } from '../combat/BulletManager';
import { weaponMpCostById, type Weapon, type WeaponId, type WeaponQuality } from '../combat/Weapon';
import { createWeaponById } from '../combat/weapons';
import type { Language, TranslationKey } from '../../i18n/translations';
import { translate } from '../../i18n/translate';
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

export interface EngineUiSnapshot {
  weaponSlots: Array<WeaponId | null>;
  weaponQualities: Array<WeaponQuality | null>;
  activeWeaponIndex: 0 | 1;
  nearbyInteractables: NearbyInteractableEntry[];
}

type SlashArcFx = {
  x: number;
  y: number;
  radius: number;
  angleRad: number;
  halfAngleRad: number;
  startedAtMs: number;
  durationMs: number;
};

type ExpandingRingFx = {
  x: number;
  y: number;
  maxRadius: number;
  startedAtMs: number;
  durationMs: number;
  color: string;
  thicknessPx: number;
  damage: number;
  stunMinMs: number;
  stunMaxMs: number;
  hitTargets: WeakSet<object>;
};

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

  private readonly tileIndex = new TileSpatialIndex({ cellSize: 128, bigTileMaxCells: 64 });

  private readonly uiListeners = new Set<() => void>();
  private uiSnapshot: EngineUiSnapshot = {
    weaponSlots: [null, null],
    weaponQualities: [null, null],
    activeWeaponIndex: 0,
    nearbyInteractables: [],
  };
  private uiWeaponSig = '';
  private uiInteractablesSig = '';

  leftJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  rightJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 60, knobRadius: 25, touchId: null };
  skillJoystick: JoystickData = { active: false, originX: 0, originY: 0, x: 0, y: 0, radius: 40, knobRadius: 20, touchId: null };

  skills: (Skill | null)[] = [new DashSkill(), new BounceSkill(), null];
  activeSkillIndex: number | null = null;

  private bulletManager = new BulletManager();
  weaponSlots: Array<Weapon | null> = [createWeaponById('default'), createWeaponById('knife')];
  activeWeaponIndex: 0 | 1 = 0;

  rightChargeStartedAtMs: number | null = null;
  private rightChargeWeaponId: WeaponId | null = null;
  private rightChargeWeaponIndex: 0 | 1 | null = null;

  language: Language = 'en';

  setLanguage(language: Language) {
    this.language = language;
    for (const drop of this.weaponDrops) {
      drop.weaponName = this.getWeaponDisplayName(drop.weaponId);
    }
    this.refreshUiSnapshot();
  }

  private weaponKey(id: WeaponId): TranslationKey {
    switch (id) {
      case 'default': return 'weapon.default';
      case 'bounce_gun': return 'weapon.bounce_gun';
      case 'knife': return 'weapon.knife';
      case 'bow': return 'weapon.bow';
      case 'pierce_gun': return 'weapon.pierce_gun';
      case 'omni': return 'weapon.omni';
      case 'em_generator': return 'weapon.em_generator';
      case 'scatter_railgun': return 'weapon.scatter_railgun';
    }
  }

  private getWeaponDisplayName(id: WeaponId): string {
    return translate(this.language, this.weaponKey(id));
  }

  get projectiles(): Bullet[] {
    return this.bulletManager.all;
  }

  get nearbyInteractables() {
    return this.interactables.getOverlappingEntries(this.player.x, this.player.y, this.player.radius);
  }

  subscribeUi(listener: () => void): () => void {
    this.uiListeners.add(listener);
    return () => {
      this.uiListeners.delete(listener);
    };
  }

  getUiSnapshot(): EngineUiSnapshot {
    return this.uiSnapshot;
  }

  getWeaponSlots(): Array<WeaponId | null> {
    return this.weaponSlots.map(w => w ? w.id : null);
  }

  getWeaponSlotQualities(): Array<WeaponQuality | null> {
    return this.weaponSlots.map(w => w ? w.quality : null);
  }

  switchWeapon(index: 0 | 1) {
    if (index === this.activeWeaponIndex) return;
    if (!this.weaponSlots[index]) return;
    this.activeWeaponIndex = index;
    this.refreshUiSnapshot();
  }

  pickupWeapon(weaponId: WeaponId, nowMs: number) {
    this.pickupWeaponInstance(createWeaponById(weaponId), nowMs);
  }

  pickupWeaponInstance(newWeapon: Weapon, nowMs: number) {

    const emptyIdx = this.weaponSlots.findIndex(w => !w);
    if (emptyIdx >= 0) {
      this.weaponSlots[emptyIdx] = newWeapon;
      this.refreshUiSnapshot();
      return;
    }

    const slotIdx = this.activeWeaponIndex;
    const prev = this.weaponSlots[slotIdx];
    if (prev) {
      const ox = this.player.x + (Math.random() - 0.5) * 40;
      const oy = this.player.y + (Math.random() - 0.5) * 40;
      const drop = new WeaponDrop(ox, oy, nowMs, prev, this.getWeaponDisplayName(prev.id));
      this.weaponDrops.push(drop);
      this.interactables.add(drop);
    }

    this.weaponSlots[slotIdx] = newWeapon;
    this.refreshUiSnapshot();
  }

  debugSpawnWeaponDrop(weaponId: WeaponId, nowMs: number = performance.now()) {
    const ox = this.player.x + (Math.random() - 0.5) * 40;
    const oy = this.player.y + (Math.random() - 0.5) * 40;
    const weapon = createWeaponById(weaponId);
    const drop = new WeaponDrop(ox, oy, nowMs, weapon, this.getWeaponDisplayName(weaponId));
    this.weaponDrops.push(drop);
    this.interactables.add(drop);
    this.refreshUiSnapshot();
  }

  private roundMp(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private canSpendMp(cost: number): boolean {
    if (cost <= 0) return true;
    return this.player.mp >= cost;
  }

  private spendMp(cost: number) {
    if (cost <= 0) return;
    this.player.mp = this.roundMp(Math.max(0, this.player.mp - cost));
  }

  interactWith(id: string) {
    const it = this.interactables.findById(id);
    if (!it) return false;
    if (!it.isOverlappingCircle(this.player.x, this.player.y, this.player.radius)) return false;
    if (it.interactionMode !== 'MANUAL') return false;

    const now = performance.now();
    if (it.kind === 'WEAPON_DROP' && it instanceof WeaponDrop) {
      this.pickupWeaponInstance(it.weapon, now);
      this.weaponDrops = this.weaponDrops.filter(w => w.id !== it.id);
      this.interactables.removeById(it.id);
      this.refreshUiSnapshot();
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
    if (this.activeCombatRoomIndex !== null && !this.isCombatRoomFinished()) {
      this.combatWavesCleared = Math.min(this.combatWaveTarget, this.combatWavesCleared + 1);
    }
    this.waveSystem.skipCurrentWave(now);
  }

  enemies: BaseEnemy[] = [];
  particles: Particle[] = [];
  slashArcs: SlashArcFx[] = [];
  expandingRings: ExpandingRingFx[] = [];
  credits: Credit[] = [];
  mpDrops: MpDrop[] = [];
  tiles: Tile[] = [];

  navigationPath: DungeonNavigationPath | null = null;

  private dungeon: DungeonManager;
  private layout: WorldLayout;
  private doorTilesByRoomIndex = new Map<number, Tile[]>();

  private activeCombatRoomIndex: number | null = null;

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

  private lockDoorsForRoom(roomIndex: number) {
    const doors = this.doorTilesByRoomIndex.get(roomIndex);
    if (!doors || doors.length === 0) return;
    for (const d of doors) {
      if (this.tiles.includes(d)) continue;
      this.tiles.push(d);
    }
  }

  private unlockDoorsForRoom(roomIndex: number) {
    const doors = this.doorTilesByRoomIndex.get(roomIndex);
    if (!doors || doors.length === 0) return;
    const set = new Set(doors);
    this.tiles = this.tiles.filter(t => !set.has(t));
  }

  private spawnRewardForRoom(roomIndex: number, nowMs: number) {
    const room = this.layout.rooms[roomIndex];
    if (!room || room.kind !== 'REWARD') return;
    if (this.dungeon.isRewardRoomClaimed(roomIndex)) return;

    const cx = room.rect.x + room.rect.width / 2;
    const cy = room.rect.y + room.rect.height / 2;
    const content = room.rewardContent ?? 'CREDIT';

    if (content === 'HEAL') {
      const health = new HealthPickup(cx, cy, nowMs);
      this.healthPickups.push(health);
      this.interactables.add(health);
      this.dungeon.setRewardRoomClaimed(roomIndex);
      return;
    }

    if (content === 'WEAPON') {
      const worldIndex = this.dungeon.getWorldIndex();
      const weaponId = this.rollWeaponRewardId(worldIndex);
      const weapon = createWeaponById(weaponId);
      const drop = new WeaponDrop(cx, cy, nowMs, weapon, this.getWeaponDisplayName(weaponId));
      this.weaponDrops.push(drop);
      this.interactables.add(drop);
      this.dungeon.setRewardRoomClaimed(roomIndex);
      return;
    }

    if (content === 'MP') {
      this.mpDrops.push(new MpDrop(cx, cy, this.player.maxMp, nowMs));
      this.dungeon.setRewardRoomClaimed(roomIndex);
      return;
    }

    const worldIndex = this.dungeon.getWorldIndex();
    const count = Math.max(4, Math.min(12, 6 + worldIndex));
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 90;
      const oy = (Math.random() - 0.5) * 90;
      this.credits.push(new Credit(cx + ox, cy + oy, 10, nowMs));
    }
    this.dungeon.setRewardRoomClaimed(roomIndex);
  }

  private getWeaponQualityWeights(worldIndex: number): Record<WeaponQuality, number> {
    const base: Record<WeaponQuality, number> = { white: 40, green: 30, blue: 20, red: 10 };
    const equal = 25;
    const t = clamp(worldIndex / 50, 0, 1);

    return {
      white: base.white + (equal - base.white) * t,
      green: base.green + (equal - base.green) * t,
      blue: base.blue + (equal - base.blue) * t,
      red: base.red + (equal - base.red) * t,
    };
  }

  private rollWeaponRewardId(worldIndex: number): WeaponId {
    const pool: Record<WeaponQuality, WeaponId[]> = {
      white: ['bounce_gun', 'bow'],
      green: ['pierce_gun', 'omni'],
      blue: ['em_generator', 'scatter_railgun'],
      red: [],
    };

    const weights = this.getWeaponQualityWeights(worldIndex);
    const qualities: WeaponQuality[] = ['white', 'green', 'blue', 'red'];
    const usable = qualities.filter((q) => pool[q].length > 0);

    let total = 0;
    for (const q of usable) total += weights[q];
    if (total <= 0) {
      return 'bounce_gun';
    }

    let r = Math.random() * total;
    let chosen: WeaponQuality = usable[0];
    for (const q of usable) {
      r -= weights[q];
      if (r <= 0) {
        chosen = q;
        break;
      }
    }

    const ids = pool[chosen];
    return ids[Math.floor(Math.random() * ids.length)];
  }

  private startCombatInRoom(roomIndex: number, nowMs: number) {
    if (this.dungeon.isCombatRoomCleared(roomIndex)) return;
    if (this.activeCombatRoomIndex === roomIndex) return;

    this.activeCombatRoomIndex = roomIndex;
    this.lockDoorsForRoom(roomIndex);

    const room = this.layout.rooms[roomIndex];
    const target = room?.combatWaveCount ?? this.layout.combatWaveCount;
    this.combatWaveTarget = Math.max(1, target);
    this.combatWavesCleared = 0;
    this.lastEliteWaveIndex = -1;

    this.enemies = [];
    this.pendingBoomerDeaths = [];
    this.boomerDeathEmitters = [];

    this.waveSystem.reset(nowMs, this.difficulty);
  }

  private updateCurrentRoomAndTriggers(nowMs: number) {
    const roomIndex = this.dungeon.findRoomIndexAt(this.player.x, this.player.y);
    if (roomIndex === null) return;

    const changed = this.dungeon.setCurrentRoomIndex(roomIndex);
    const room = this.layout.rooms[roomIndex];
    if (!room) return;

    if (changed && room.kind === 'REWARD') {
      this.spawnRewardForRoom(roomIndex, nowMs);
    }

    if (room.kind === 'COMBAT' && !this.dungeon.isCombatRoomCleared(roomIndex)) {
      this.startCombatInRoom(roomIndex, nowMs);
    } else if (room.kind === 'COMBAT' && this.dungeon.isCombatRoomCleared(roomIndex)) {
      this.unlockDoorsForRoom(roomIndex);
      if (this.activeCombatRoomIndex === roomIndex) {
        this.activeCombatRoomIndex = null;
      }
    }
  }

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
    this.slashArcs = [];
    this.expandingRings = [];
    this.credits = [];
    this.mpDrops = [];
    this.tiles = [];
    this.healthPickups = [];
    this.portals = [];

    this.navigationPath = null;
    this.dungeon.resetRun();
    this.layout = this.dungeon.getLayout();
    this.doorTilesByRoomIndex = new Map();
    this.activeCombatRoomIndex = null;
    this.combatWaveTarget = 0;
    this.combatWavesCleared = 0;
    this.visitedRoomIndices.clear();

    this.score = 0;
    this.collectedCredits = 0;
    this.gameOver = false;
    this.lastTime = now;

    this.weaponSlots = [createWeaponById('default'), createWeaponById('knife')];
    this.activeWeaponIndex = 0;
    this.rightChargeStartedAtMs = null;
    this.rightChargeWeaponId = null;
    this.rightChargeWeaponIndex = null;
    this.leftJoystick.active = false;
    this.leftJoystick.touchId = null;
    this.rightJoystick.active = false;
    this.rightJoystick.touchId = null;
    this.skillJoystick.active = false;
    this.skillJoystick.touchId = null;
    this.skills.forEach(s => {
      if (s) s.currentCooldown = 0;
    });
    this.onScoreChange?.(this.score, this.collectedCredits);

    this.waveSystem.reset(now, this.difficulty);
    this.buildWorld(now);
    this.refreshUiSnapshot();
  }

  private applyDamageToEnemy(enemy: BaseEnemy, damage: number, timeMs: number) {
    if (damage <= 0) return;
    if (enemy.hp <= 0) return;

    if (!this.enemies.includes(enemy)) return;
    enemy.hp -= damage;
    if (enemy.hp > 0) return;

    const idx = this.enemies.indexOf(enemy);
    if (idx < 0) return;
    this.enemies.splice(idx, 1);
    this.handleEnemyKilled(enemy, timeMs);
  }

  private tryMeleeAttack(timeMs: number) {
    const weapon = this.weaponSlots[this.activeWeaponIndex];
    if (!weapon || weapon.type !== 'melee') return;

    const mpCost = weaponMpCostById[weapon.id];
    if (!this.canSpendMp(mpCost)) return;

    const enemiesSnapshot = [...this.enemies];

    const attacked = weapon.tryAttack({
      timeMs,
      owner: this.player,
      enemies: enemiesSnapshot,
      applyDamageToEnemy: (enemy, damage, atMs) => this.applyDamageToEnemy(enemy, damage, atMs),
      spawnSlashArc: (arc) => {
        this.slashArcs.push({
          ...arc,
          startedAtMs: timeMs,
          durationMs: 140,
        });
      },
      spawnExpandingRing: (ring) => {
        this.expandingRings.push({
          ...ring,
          startedAtMs: timeMs,
          hitTargets: new WeakSet(),
        });
      },
    });

    if (attacked) {
      this.spendMp(mpCost);
    }
  }

  startGame(difficulty?: Difficulty) {
    if (difficulty) {
      this.setDifficulty(difficulty);
    }
    this.gameStarted = true;
    this.resetGame();
    this.onStateChange?.('PLAYING');
    this.refreshUiSnapshot();
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
      const weapon = this.weaponSlots[this.activeWeaponIndex];

      this.rightJoystick.active = true;
      this.rightJoystick.originX = e.clientX;
      this.rightJoystick.originY = e.clientY;
      this.rightJoystick.x = e.clientX;
      this.rightJoystick.y = e.clientY;
      this.rightJoystick.touchId = e.pointerId;

      if (weapon?.type === 'charge') {
        const now = performance.now();
        this.rightChargeStartedAtMs = now;
        this.rightChargeWeaponId = weapon.id;
        this.rightChargeWeaponIndex = this.activeWeaponIndex;
      } else {
        this.rightChargeStartedAtMs = null;
        this.rightChargeWeaponId = null;
        this.rightChargeWeaponIndex = null;
      }

      if (weapon?.type === 'melee') {
        this.tryMeleeAttack(performance.now());
      }
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
      const weapon = this.weaponSlots[this.activeWeaponIndex];
      if (weapon?.type === 'melee') {
        return;
      }
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
      const weapon = this.weaponSlots[this.activeWeaponIndex];
      if (weapon?.type === 'charge' && this.rightChargeStartedAtMs !== null) {
        const now = performance.now();
        const dx = this.rightJoystick.x - this.rightJoystick.originX;
        const dy = this.rightJoystick.y - this.rightJoystick.originY;

        const sameWeapon = this.rightChargeWeaponId === weapon.id && this.rightChargeWeaponIndex === this.activeWeaponIndex;
        if (sameWeapon) {
          const mpCost = weaponMpCostById[weapon.id];
          if (this.canSpendMp(mpCost)) {
            const released = weapon.tryRelease({
              timeMs: now,
              owner: this.player,
              aimDx: dx,
              aimDy: dy,
              chargeMs: Math.max(0, now - this.rightChargeStartedAtMs),
              spawnBullet: (bullet) => this.spawnBullet(bullet),
            });

            if (released) {
              this.spendMp(mpCost);
            }
          }
        }
      }

      this.rightJoystick.active = false;
      this.rightJoystick.touchId = null;
      this.rightChargeStartedAtMs = null;
      this.rightChargeWeaponId = null;
      this.rightChargeWeaponIndex = null;
    }
  }

  loop(time: number) {
    const rawDt = (time - this.lastTime) / 1000;
    const dt = Math.max(0, Math.min(rawDt, 0.05));
    this.lastTime = time;

    if (this.gameStarted && !this.gameOver) {
      this.update(dt, time);
    }
    this.renderer.draw(this);

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  update(dt: number, time: number) {
    this.rebuildTileIndexForSubstepCollisions();

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
      if (weapon && weapon.type === 'projectile') {
        const mpCost = weaponMpCostById[weapon.id];
        if (this.canSpendMp(mpCost)) {
          const fired = weapon.tryFire({
            timeMs: time,
            owner: this.player,
            aimDx: dx,
            aimDy: dy,
            spawnBullet: (bullet) => this.spawnBullet(bullet),
          });

          if (fired) {
            this.spendMp(mpCost);
          }
        }
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
    this.updateCurrentRoomAndTriggers(time);

    const stopSpawningForStage = this.activeCombatRoomIndex === null || this.isCombatRoomFinished();
    const spawnRect = this.activeCombatRoomIndex !== null && !this.isCombatRoomFinished()
      ? this.layout.rooms[this.activeCombatRoomIndex]?.rect
      : undefined;

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

    if (this.activeCombatRoomIndex !== null) {
      if (waveOut.forcedAdvance) {
        this.combatWavesCleared = Math.min(this.combatWaveTarget, this.combatWavesCleared + 1);
      } else if (prevPhase === 'WAIT_CLEAR' && this.waveSystem.state.phase === 'INTERMISSION') {
        this.combatWavesCleared += 1;
      }
    }

    const worldIndex = this.dungeon.getWorldIndex();
    const waveIndex = this.waveSystem.state.index;
    const isLastCombatWave = this.activeCombatRoomIndex !== null && this.combatWaveTarget > 0 && this.combatWavesCleared === this.combatWaveTarget - 1;

    for (const s of waveOut.spawns) {
      const enemyLevel = computeSpawnEnemyLevel({
        worldIndex,
        waveIndex,
        rng: Math.random,
      });

      const eliteChance = clamp(0.02 + 0.01 * worldIndex + 0.004 * waveIndex, 0, 0.14);
      const forceEliteThisWave = isLastCombatWave && this.lastEliteWaveIndex !== waveIndex;
      const shouldSpawnElite = this.activeCombatRoomIndex !== null && (forceEliteThisWave || (waveIndex > 0 && Math.random() < eliteChance));

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

    if (this.expandingRings.length > 0 && this.enemies.length > 0) {
      for (const ring of this.expandingRings) {
        const age = time - ring.startedAtMs;
        if (age < 0 || age > ring.durationMs) continue;
        const t = clamp(age / ring.durationMs, 0, 1);
        const radius = ring.maxRadius * t;

        for (const e of this.enemies) {
          if (ring.hitTargets.has(e)) continue;
          const dist = Math.hypot(e.x - ring.x, e.y - ring.y);
          if (Math.abs(dist - radius) <= ring.thicknessPx + e.radius) {
            ring.hitTargets.add(e);
            this.applyDamageToEnemy(e, ring.damage, time);
            const stunMs = ring.stunMinMs + Math.random() * (ring.stunMaxMs - ring.stunMinMs);
            e.applyEffect('STUN', stunMs, time);
          }
        }
      }
    }

    const creditMagnetRange = 220;
    const creditPickupExtraRange = 25;
    for (let i = this.credits.length - 1; i >= 0; i--) {
      const c = this.credits[i];
      const dx = this.player.x - c.x;
      const dy = this.player.y - c.y;
      const dist = Math.hypot(dx, dy);

      if (dist < creditMagnetRange) {
        const pullSpeed = 460 * (1 - dist / creditMagnetRange);
        c.x += (dx / dist) * pullSpeed * dt;
        c.y += (dy / dist) * pullSpeed * dt;
      }

      if (dist < this.player.radius + creditPickupExtraRange) {
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

    const mpMagnetRange = 240;
    const mpPickupExtraRange = 30;
    for (let i = this.mpDrops.length - 1; i >= 0; i--) {
      const m = this.mpDrops[i];
      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      const dist = Math.hypot(dx, dy);

      if (dist < mpMagnetRange) {
        const pullSpeed = 520 * (1 - dist / mpMagnetRange);
        m.x += (dx / dist) * pullSpeed * dt;
        m.y += (dy / dist) * pullSpeed * dt;
      }

      if (dist < this.player.radius + mpPickupExtraRange) {
        const next = this.roundMp(this.player.mp + m.value);
        this.player.mp = Math.min(this.player.maxMp, Math.max(0, next));
        this.mpDrops.splice(i, 1);
        for (let k = 0; k < 4; k++) {
          this.particles.push(new Particle(
            m.x,
            m.y,
            (Math.random() - 0.5) * 240,
            (Math.random() - 0.5) * 240,
            0,
            240,
            '#ffffff'
          ));
        }
      }
    }

    let portalTouched = false;
    for (const it of [...this.interactables.all]) {
      if (it.interactionMode !== 'AUTO') continue;
      if (!it.isOverlappingCircle(this.player.x, this.player.y, this.player.radius)) continue;

      if (it.kind === 'HEALTH_PICKUP' && it instanceof HealthPickup) {
        this.player.hp = this.player.maxHp;
        this.healthPickups = this.healthPickups.filter(h => h.id !== it.id);
        this.interactables.removeById(it.id);
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

    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      const a = this.slashArcs[i];
      if (time - a.startedAtMs >= a.durationMs) {
        this.slashArcs.splice(i, 1);
      }
    }

    for (let i = this.expandingRings.length - 1; i >= 0; i--) {
      const r = this.expandingRings[i];
      if (time - r.startedAtMs >= r.durationMs) {
        this.expandingRings.splice(i, 1);
      }
    }

    for (const tile of this.tiles) {
      tile.update(dt);
      tile.x = Math.max(tile.width / 2, Math.min(this.world.width - tile.width / 2, tile.x));
      tile.y = Math.max(tile.height / 2, Math.min(this.world.height - tile.height / 2, tile.y));
    }

    this.rebuildTileIndexForPostTileUpdateCollisions();

    for (let i = 0; i < this.tiles.length; i++) {
      const candidates = this.tileIndex.queryTile(this.tiles[i]);
      for (const j of candidates) {
        if (j <= i) continue;
        resolveRectRect(this.tiles[i], this.tiles[j]);
      }
    }

    for (const tileIdx of this.tileIndex.queryCircle(this.player)) {
      resolveCircleRect(this.player, this.tiles[tileIdx]);
    }

    for (const enemy of this.enemies) {
      for (const tileIdx of this.tileIndex.queryCircle(enemy)) {
        resolveCircleRect(enemy, this.tiles[tileIdx]);
      }
    }

    this.bulletManager.collideTiles(this.tiles, this.particles, (circle) => this.tileIndex.queryCircle(circle));

    const combatFinished = this.isCombatRoomFinished();
    if (
      this.activeCombatRoomIndex !== null &&
      combatFinished &&
      !this.dungeon.isCombatRoomCleared(this.activeCombatRoomIndex)
    ) {
      const idx = this.activeCombatRoomIndex;
      this.dungeon.setCombatRoomCleared(idx);
      this.unlockDoorsForRoom(idx);
      this.activeCombatRoomIndex = null;
    }

    this.navigationPath = this.dungeon.getNavigationPath(this.player.x, this.player.y);

    this.updateVisitedRooms(this.player.x, this.player.y);

    const currentRoomIndex = this.dungeon.getCurrentRoomIndex();
    const currentRoom = this.layout.rooms[currentRoomIndex];
    if (currentRoom?.kind === 'PORTAL' && portalTouched) {
      this.advanceWorld(time);
    }

    if (this.player.hp <= 0 && !this.gameOver) {
      this.gameOver = true;
      this.onStateChange?.('GAME_OVER');
    }

    this.refreshUiSnapshot();
  }

  private buildWorld(nowMs: number) {
    this.layout = this.dungeon.getLayout();
    this.world.width = this.layout.bounds.width;
    this.world.height = this.layout.bounds.height;

    this.enemies = [];
    this.bulletManager.reset();
    this.particles = [];
    this.credits = [];
    this.mpDrops = [];
    this.healthPickups = [];
    this.portals = [];
    this.weaponDrops = [];
    this.interactables.reset();

    const startRoomIndex = this.dungeon.getStartRoomIndex();
    const startRoom = this.layout.rooms[startRoomIndex];
    if (startRoom) {
      this.player.x = startRoom.rect.x + startRoom.rect.width / 2;
      this.player.y = startRoom.rect.y + startRoom.rect.height / 2;
    }
    this.dungeon.setCurrentRoomIndex(startRoomIndex);

    const { tiles, doorTilesByRoomIndex } = this.createDungeonTiles();
    this.tiles = tiles;
    this.doorTilesByRoomIndex = doorTilesByRoomIndex;

    const portalRoomIndex = this.dungeon.getPortalRoomIndex();
    const portalRoom = this.layout.rooms[portalRoomIndex];
    if (portalRoom) {
      const portalCenterX = portalRoom.rect.x + portalRoom.rect.width / 2;
      const portalCenterY = portalRoom.rect.y + portalRoom.rect.height / 2;
      const portalObj = new Portal(portalCenterX, portalCenterY, nowMs);
      this.portals.push(portalObj);
      this.interactables.add(portalObj);
    }

    this.activeCombatRoomIndex = null;
    this.combatWaveTarget = 0;
    this.combatWavesCleared = 0;
    this.lastEliteWaveIndex = -1;

    this.visitedRoomIndices.clear();
    this.updateVisitedRooms(this.player.x, this.player.y);
    this.waveSystem.reset(nowMs, this.difficulty);
  }

  getMinimapData(): {
    worldIndex: number;
    bounds: { width: number; height: number };
    rooms: WorldLayout['rooms'];
    corridors: WorldLayout['corridors'];
    visitedRoomIndices: ReadonlySet<number>;
    player: { x: number; y: number };
    objectivePos: { x: number; y: number } | null;
    objectiveStage: DungeonStage;
  } {
    const portalRoomIndex = this.dungeon.getPortalRoomIndex();
    const portalRoom = this.layout.rooms[portalRoomIndex];
    const portalCenter = portalRoom
      ? { x: portalRoom.rect.x + portalRoom.rect.width / 2, y: portalRoom.rect.y + portalRoom.rect.height / 2 }
      : null;

    const objectiveStage: DungeonStage = 'PORTAL';
    const objectivePos = this.portals[0]
      ? { x: this.portals[0].x, y: this.portals[0].y }
      : portalCenter;

    return {
      worldIndex: this.dungeon.getWorldIndex(),
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

  private createDungeonTiles(): { tiles: Tile[]; doorTilesByRoomIndex: Map<number, Tile[]> } {
    const thickness = 70;
    const tiles: Tile[] = [];

    tiles.push(...createOuterBoundsTiles(this.layout.bounds.width, this.layout.bounds.height, thickness));

    type Openings = {
      north?: { x: number; width: number };
      south?: { x: number; width: number };
      west?: { y: number; height: number };
      east?: { y: number; height: number };
    };

    const openingsByRoom = new Map<number, Openings>();
    const ensureOpenings = (roomIndex: number): Openings => {
      const existing = openingsByRoom.get(roomIndex);
      if (existing) return existing;
      const created: Openings = {};
      openingsByRoom.set(roomIndex, created);
      return created;
    };

    for (const conn of this.layout.connections) {
      const roomA = this.layout.rooms[conn.roomA];
      const roomB = this.layout.rooms[conn.roomB];
      if (!roomA || !roomB) continue;

      Object.assign(ensureOpenings(conn.roomA), buildRoomOpenings(roomA.rect, conn.corridor));
      Object.assign(ensureOpenings(conn.roomB), buildRoomOpenings(roomB.rect, conn.corridor));
    }

    for (let i = 0; i < this.layout.rooms.length; i++) {
      const room = this.layout.rooms[i];
      tiles.push(...createRoomWallTiles(room.rect, thickness, openingsByRoom.get(i) ?? {}));
    }

    for (const corridor of this.layout.corridors) {
      tiles.push(...createCorridorWallTiles(corridor, thickness));
    }

    const doorWidth = 90;
    const doorTilesByRoomIndex = new Map<number, Tile[]>();
    const addDoor = (roomIndex: number, door: Tile) => {
      const list = doorTilesByRoomIndex.get(roomIndex);
      if (list) {
        list.push(door);
      } else {
        doorTilesByRoomIndex.set(roomIndex, [door]);
      }
    };

    for (const conn of this.layout.connections) {
      const a = this.layout.rooms[conn.roomA];
      const b = this.layout.rooms[conn.roomB];
      if (!a || !b) continue;
      const corridor = conn.corridor;
      addDoor(conn.roomA, createDoorTile(corridor, doorWidth, detectCorridorEdge(a.rect, corridor)));
      addDoor(conn.roomB, createDoorTile(corridor, doorWidth, detectCorridorEdge(b.rect, corridor)));
    }

    return { tiles, doorTilesByRoomIndex };
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

    if (Math.random() < 0.5) {
      this.mpDrops.push(new MpDrop(enemy.x, enemy.y, enemy.maxHp * 0.1, timeMs));
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
      for (const tileIdx of this.tileIndex.queryCircle(this.player)) {
        if (resolveCircleRect(this.player, this.tiles[tileIdx])) {
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
      for (const tileIdx of this.tileIndex.queryCircle(this.player)) {
        if (resolveCircleRect(this.player, this.tiles[tileIdx])) {
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
    if (this.activeCombatRoomIndex === null) return false;
    if (this.combatWaveTarget <= 0) return false;
    if (this.combatWavesCleared < this.combatWaveTarget) return false;
    return this.enemies.length === 0;
  }

  private rebuildTileIndexForSubstepCollisions() {
    this.tileIndex.rebuild(this.tiles);
  }

  private rebuildTileIndexForPostTileUpdateCollisions() {
    this.tileIndex.rebuild(this.tiles);
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

  private refreshUiSnapshot() {
    const weaponSig = `${this.activeWeaponIndex}:${this.weaponSlots.map(w => w ? `${w.id}:${w.quality}` : '_').join(',')}`;
    const nearby = this.nearbyInteractables;
    const interactablesSig = `${this.language}:${nearby.map((e) => `${e.id}:${e.title}:${e.quality ?? '_'}`).join('|')}`;

    if (weaponSig === this.uiWeaponSig && interactablesSig === this.uiInteractablesSig) {
      return;
    }

    this.uiWeaponSig = weaponSig;
    this.uiInteractablesSig = interactablesSig;

    this.uiSnapshot = {
      weaponSlots: this.getWeaponSlots(),
      weaponQualities: this.getWeaponSlotQualities(),
      activeWeaponIndex: this.activeWeaponIndex,
      nearbyInteractables: nearby,
    };

    for (const l of this.uiListeners) l();
  }
}
