# Survivor Game Architecture Design

## 1. Overview (架构概述)
The game has been refactored to separate the React UI layer from the core Vanilla JS Game Engine. This ensures high extensibility, better performance, and maintainability as the game grows in complexity.

## 2. Directory Structure (目录结构)
- `src/components/Game.tsx`: React component. Handles DOM mounting, fullscreen toggling, and orientation detection.
- `src/game/Engine.ts`: Core game engine. Manages the game loop, state, collision detection, and rendering.
- `src/game/Entities.ts`: Object-Oriented representations of game objects (Player, Enemies, Projectiles, Particles).

## 3. Core Modules (核心模块)

### 3.1 Game Engine (`Engine.ts`)
The `GameEngine` class encapsulates the entire game lifecycle:
- **Input Management**: Handles multi-touch pointer events for dual virtual joysticks (Left for movement, Right for aiming/shooting) and UI buttons (Skills).
- **Game Loop**: Uses `requestAnimationFrame` for smooth updates and rendering based on delta time (`dt`).
- **Collision Detection**: Simple circle-based AABB/distance checks for projectiles and entities.
- **Camera System**: Calculates `cameraX` and `cameraY` to keep the player centered, clamping to world bounds.

### 3.2 Entity System (`Entities.ts`)
Uses an OOP approach to make adding new content easy.
- **`Player`**: Manages player stats (HP, speed, radius).
- **`Projectile`**: Unified class for both player and enemy bullets. Differentiated by `isPlayer` flag and `damage`.
- **`Particle`**: Simple visual effects system for hit feedback.
- **`Credit`**: Currency dropped by enemies. Features a magnetic pull towards the player and a pulsing, rotating curved rhombus visual.
- **`BaseEnemy` (Abstract)**: Base class for all enemies. Defines common properties (HP, speed, radius) and the `draw` method (including HP bars).
  - **`MeleeEnemy`**: Inherits `BaseEnemy`. Chases the player and deals continuous touch damage.
  - **`RangedEnemy`**: Inherits `BaseEnemy`. Maintains a specific distance from the player and fires projectiles periodically.

### 3.3 Skill System (`Skills.ts`)
An extensible system for player abilities.
- **`Skill` (Abstract)**: Base class for all skills. Manages cooldowns, icons/colors, and the `activate` interface.
- **`DashSkill`**: A mobility skill that instantly blinks the player in their current movement or aiming direction, leaving a trail of particles.

## 4. Extensibility Guide (扩展指南)

### 4.1 Adding a New Enemy Type (添加新敌人)
1. Create a new class extending `BaseEnemy` in `Entities.ts`.
2. Implement the `update(dt, state)` method to define its unique AI behavior (e.g., dashing, spawning minions, erratic movement).
3. Add it to the spawn logic in `Engine.ts` (`spawnEnemy` method).

### 4.2 Adding New Weapons (添加新武器)
1. Modify the `Player` class to include a `weaponType` or `fireRate` property.
2. In `Engine.ts` (Shooting logic), switch behavior based on the weapon type (e.g., shotgun spreads, piercing lasers).
3. Adjust the `Projectile` instantiation accordingly.

### 4.3 Adding Upgrades / EXP System (添加升级系统)
1. Create an `ExpGem` entity class in `Entities.ts`.
2. When an enemy dies (`e.hp <= 0`), spawn an `ExpGem` at its location.
3. Add collision detection between `Player` and `ExpGem` in `Engine.ts`.
4. Track `exp` and `level` in `GameEngine`. When leveling up, pause the game loop and trigger a React callback to show an upgrade UI.
