# Survivor Game Architecture Design

## 1. Overview (架构概述)
The project is split into two major layers:

- **React UI Shell** (DOM, overlays, fullscreen/orientation, debug panel)
- **Canvas Game Engine** (requestAnimationFrame loop, input, gameplay state, AI, collisions, rendering)

The engine is written in TypeScript and follows a lightweight OOP approach:

- **Composition-first**: `GameEngine` owns and wires systems + entity collections.
- **Inheritance only where it buys polymorphism**: enemies (`BaseEnemy`) and skills (`Skill`).

This separation keeps React focused on UI/UX, while gameplay code stays deterministic and performant.

## 2. Directory Structure (目录结构)
- `src/components/Game.tsx`: React UI shell. Creates/destroys the engine, controls overlays, fullscreen/orientation, and debug UI.
- `src/components/ui/*`: Reusable cyber UI component library used by overlays.

- `src/game/Engine.ts`: `GameEngine` orchestrator. Owns the main loop, input, state, update order, and calls into subsystems.
- `src/game/Renderer.ts`: `Renderer` subsystem. Draws the world + HUD onto the canvas.
- `src/game/Entities.ts`: OOP entity model: `Player`, `Bullet`, `Particle`, `Credit`, `Tile`, plus polymorphic enemy base `BaseEnemy`.
- `src/game/Skills.ts`: Skill system: abstract `Skill` base and concrete skills (e.g. `DashSkill`, `BounceSkill`).
- `src/game/combat/Weapon.ts`: Combat abstractions (weapon interface + fire context).
- `src/game/combat/DefaultWeapon.ts`: Default player weapon implementation (reproduces legacy fire cadence/params).
- `src/game/combat/BulletManager.ts`: Bullet lifecycle + collisions (bullet vs actors + bullet vs tiles).
- `src/game/waves/WaveSystem.ts`: Wave/spawn state machine. Outputs spawn requests consumed by the engine.
- `src/game/physics/Collisions.ts`: Collision/resolution helpers for circle-rect and rect-rect.
- `src/game/physics/TileSpatialIndex.ts`: Uniform-grid spatial index for tiles (broadphase candidate queries).
- `src/game/Difficulty.ts`: Difficulty rules (`Difficulty`, `DifficultyRules`, `getDifficultyRules`).

## 3. Core Modules (核心模块)

### 3.1 React UI Shell (`components/Game.tsx`)
The React layer is a host/controller for the canvas engine:

- Creates the engine with `new GameEngine(canvas)` and stores it in a ref.
- Wires callbacks from engine → React state:
  - `engine.onStateChange?: (state: 'START' | 'PLAYING' | 'GAME_OVER') => void`
  - `engine.onScoreChange?: (score: number, credits: number) => void`
- Subscribes to a small **engine-owned UI snapshot** via `useSyncExternalStore`:
  - `engine.subscribeUi(listener): () => void`
  - `engine.getUiSnapshot(): EngineUiSnapshot`
  - Used for overlay state that must stay in sync with the engine (weapon slots, active weapon, nearby interactables).
- Renders overlays (START / GAME_OVER / ROTATE DEVICE) and a debug modal.

React is intentionally not part of the frame-by-frame simulation; the engine loop runs independently and only emits coarse-grained state changes.

### 3.2 Game Engine Orchestrator (`game/Engine.ts`)
`GameEngine` encapsulates the gameplay lifecycle and update order:

- **Input management**: pointer events for three virtual controls:
  - left joystick (movement)
  - right joystick (aiming/shooting)
  - skill joystick (directional skill aim)
- **Main loop**: `requestAnimationFrame` → compute `dt` → `update(dt, time)` → `renderer.draw(this)`.
  - `dt` is clamped (max 50ms) to prevent large frame spikes from destabilizing movement/collisions.
- **State ownership**:
  - `player: Player`
  - entity collections: `projectiles: Bullet[]`, `enemies: BaseEnemy[]`, `particles: Particle[]`, `credits: Credit[]`, `tiles: Tile[]`
  - `skills: (Skill | null)[]` (3 slots)
  - `weapon: Weapon` (player fire behavior)
  - `bulletManager: BulletManager` (owns bullet list + collision processing)
  - `difficulty` + derived `rules: DifficultyRules`
  - `debugFlags` (stop spawning / god mode / no cooldowns / wave debug)
- **Collisions & resolution**:
  - projectile vs enemy/player uses distance checks
  - tile collisions use `resolveRectRect` / `resolveCircleRect` from `physics/Collisions.ts`
  - tile broadphase uses `TileSpatialIndex` to query candidate tile indices while preserving deterministic tile-order semantics

The engine also owns a `WaveSystem` instance and converts its outputs into concrete enemy instances.

### 3.3 Entity Model (`game/Entities.ts`)
The engine state is modeled using classes (OOP entities). Each entity owns its data and encapsulated behavior.

- **`Player`**
  - Owns vitals: HP + shield (`configureShield`, `applyDamage`, `updateShield`, `resetVitals`).
  - Owns dash state used by `DashSkill` (`isDashing`, `dashTimeRemaining`, etc.).
- **`Bullet`**
  - One class for both player and enemy bullets (`isPlayer` flag + `damage`).
  - Has simple kinematics (`update`) and visual style (`draw`).
- **`Particle`**
  - Lightweight VFX elements with lifetime-based fade.
- **`Credit`**
  - Dropped currency with its own `draw`; the magnetic pull + collection logic is applied in the engine update.
- **`Tile`**
  - Rectangular obstacles (fixed or dynamic) with friction and collision response.

#### Enemy polymorphism
Enemies use a classic polymorphic base:

- **`BaseEnemy` (abstract)**
  - Shared fields: position, radius, speed, hp, color.
  - Shared `draw()` implementation (includes HP bar).
  - `abstract update(dt: number, state: GameState): void`.
- Concrete subclasses:
  - **`MeleeEnemy`**: chases player, applies contact damage, uses separation and optional bullet dodge.
  - **`RangedEnemy`**: orbits within a band, fires bullets, uses separation and optional bullet dodge.

The engine stores enemies as `BaseEnemy[]` and calls `enemy.update(...)` each frame; dynamic dispatch selects the concrete AI.

### 3.4 Skill System (`game/Skills.ts`)
Player skills are modeled similarly to enemies: an abstract base class plus concrete implementations.

- **`Skill` (abstract)**
  - Owns cooldown (`cooldown`, `currentCooldown`) and metadata (`id`, `name`, `color`, `isDirectional`).
  - `abstract activate(engine: GameEngine, dx: number, dy: number): void`
  - `update(dt)` ticks cooldown.

Concrete skills currently include:

- **`DashSkill`**: directional dash (if no aim input provided, it falls back to movement joystick → aiming joystick → default right).
- **`BounceSkill`**: reflects nearby enemy projectiles; applies VFX and sets cooldown based on whether anything was reflected.
- **`BounceSkill`**: reflects nearby enemy bullets; applies VFX and sets cooldown based on whether anything was reflected.

The engine owns `skills: (Skill | null)[]` and triggers `activate` from pointer events.

### 3.5 Rendering (`game/Renderer.ts`)
Rendering is separated into a dedicated class:

- `Renderer.draw(engine: GameEngine)` draws the world and HUD.
- Entity drawing is delegated to entity `draw(...)` methods (e.g. `Credit.draw`, `Particle.draw`, `BaseEnemy.draw`, `Bullet.draw`, `Player.draw`).
- HUD (HP/shield bars, score/credits, skill slots, joystick visuals, optional wave debug) is drawn in `Renderer`.

### 3.6 Combat (Weapons + Bullets) (`game/combat/*`)
Combat is intentionally split into two responsibilities:

- **Weapon** (`Weapon`, `DefaultWeapon`)
  - Decides *if/when/how* a player shot is fired.
  - Exposes `tryFire(ctx)` where the engine provides aim vector + a typed `spawnBullet` callback.
  - The default implementation reproduces the legacy parameters (interval, deadzone, speed/life/color/damage).

- **BulletManager** (`BulletManager`)
  - Owns the bullet list and processes:
    - bullet movement + lifetime expiry
    - bullet vs actors (enemy/player) hits + particles
    - enemy death side effects via injected callback (`onEnemyKilled`)
    - bullet vs tile collision (separate pass)

This keeps the engine orchestrator simple while making it easy to add alternate weapons without rewriting collision logic.

### 3.7 Waves / Spawning (`game/waves/WaveSystem.ts`)
`WaveSystem` is a small state machine that decides *when/where/what* to spawn.

- Uses `WavePhase = 'SPAWNING' | 'WAIT_CLEAR' | 'INTERMISSION'` and internal `WaveState` to track progress.
- On `update(...)`, returns a list of `SpawnRequest` objects (kind + x/y) and an optional `clearEnemies` flag.
- The engine converts spawn requests into concrete enemy classes (e.g. `new RangedEnemy(...)` / `new MeleeEnemy(...)`).

### 3.8 Difficulty Rules (`game/Difficulty.ts`)
Difficulty is represented as a union type and a derived rules object:

- `Difficulty = 'EASY' | 'NORMAL' | 'HARD'`
- `DifficultyRules` currently controls:
  - `playerDamageMultiplier`
  - `enemiesDodgeBullets`

The engine stores `rules` and passes them into enemy AI via `GameState`.

### 3.9 Collision Helpers (`game/physics/Collisions.ts`)
Physics resolution is extracted into pure functions:

- `resolveRectRect(tileA, tileB)` for tile-tile.
- `resolveCircleRect(circleBody, tile, isProjectile?)` for player/enemy/projectile vs tile.
- `resolveCircleRect(circleBody, tile, isProjectile?)` for player/enemy/bullet vs tile (the parameter name is legacy).

The collision layer uses small structural interfaces (`CircleBody`, `VelocityBody`) instead of tight coupling to specific classes.

## 4. Extensibility Guide (扩展指南)

### 4.1 Adding a New Enemy Type (添加新敌人)
1. Create a new class extending `BaseEnemy` in `Entities.ts`.
2. Implement the `update(dt, state)` method to define its unique AI behavior (e.g., dashing, spawning minions, erratic movement).
3. Add it to the spawn mapping in `Engine.ts` where `WaveSystem.update(...)` returns `waveOut.spawns`.
   - Example: introduce a new `SpawnKind` in `WaveSystem.ts`, then map it to `new YourEnemy(...)` in `Engine.update(...)`.

### 4.2 Adding New Weapons (添加新武器)
Prefer implementing the weapon interface instead of editing core engine loops.

1. Create a new class implementing `Weapon` under `src/game/combat/`.
2. Implement `tryFire(ctx: WeaponFireContext)` and spawn bullets via `ctx.spawnBullet(new Bullet(...))`.
3. Swap the engine weapon (e.g. `engine.weapon = new ShotgunWeapon()`), or configure it during `GameEngine` construction.

Notes:
- Keep bullet collision semantics in `BulletManager` so new weapons only decide spawn patterns (spread, burst, piercing, etc.).
- The engine exposes `spawnBullet(bullet)` which routes into the manager.

### 4.3 Adding Upgrades / EXP System (添加升级系统)
1. Create an `ExpGem` entity class in `Entities.ts`.
2. When an enemy dies (`e.hp <= 0`), spawn an `ExpGem` at its location.
3. Add collision detection between `Player` and `ExpGem` in `Engine.ts`.
4. Track `exp` and `level` in `GameEngine`. When leveling up, pause the game loop and trigger a React callback to show an upgrade UI.

### 4.4 Adding a New Skill (添加新技能)
1. Create a new class extending `Skill` in `Skills.ts`.
2. Implement `activate(engine, dx, dy)`.
3. Add an instance into `GameEngine.skills` (3 slots) in `Engine.ts`.
4. If the skill is directional, set `isDirectional: true` so the renderer draws the aiming indicator.

### 4.5 Tweaking Waves / Spawning (调整波次/刷怪)
1. Modify progression knobs in `WaveSystem.ts`:
   - `computeWaveTargetCount(waveIndex)`
   - `computeWaveSpawnIntervalMs()`
   - `computeIntermissionMs()` / `computeForceNextWaveAfterMs()`
2. Modify enemy mix in `createSpawnRequest(...)` by adjusting `rangedChance`.
3. If you introduce a new spawn kind:
   - extend `SpawnKind` union and `SpawnRequest.kind` in `WaveSystem.ts`
   - update `Engine.update(...)` to instantiate the matching enemy class.

### 4.6 Adding Obstacles / Tiles (添加障碍物/地形)
1. Use the existing `Tile` class in `Entities.ts`.
2. Spawn tiles by pushing into `engine.tiles` (owned by `GameEngine`).
3. Collision resolution is already wired in `Engine.update(...)` via:
   - tile vs tile: `resolveRectRect`
   - player/enemy/projectile vs tile: `resolveCircleRect`
