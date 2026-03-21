import { Server, Socket } from 'socket.io';
import { PlayerState, EnemyState, ProjectileState, ParticleState, CreditState, TileState, RoomState, ClientInput, PortalState } from '../src/shared/types';
import { MapConfig, maps } from './Map';
import { Player, BaseEnemy, MeleeEnemy, RangedEnemy } from './Entities';

export class Room {
  id: string;
  type: 'city' | 'arena' | 'battlefield';
  io: Server;
  map: MapConfig;
  maxPlayers: number;
  onPlayerPortal: (socketId: string, targetType: 'city' | 'arena' | 'battlefield') => void;

  players: Map<string, Player> = new Map();
  enemies: Map<string, BaseEnemy> = new Map();
  projectiles: Map<string, ProjectileState> = new Map();
  particles: Map<string, ParticleState> = new Map();
  credits: Map<string, CreditState> = new Map();
  tiles: Map<string, TileState> = new Map();
  portals: Map<string, PortalState> = new Map();

  inputs: Map<string, ClientInput> = new Map();

  lastTime: number = Date.now();
  time: number = 0;

  constructor(id: string, type: 'city' | 'arena' | 'battlefield', io: Server, onPlayerPortal: (socketId: string, targetType: 'city' | 'arena' | 'battlefield') => void) {
    this.id = id;
    this.type = type;
    this.io = io;
    this.onPlayerPortal = onPlayerPortal;
    this.map = maps[type];
    this.maxPlayers = this.map.maxPlayers;

    // Initialize tiles from map
    this.map.tiles.forEach((t, i) => {
      this.tiles.set(`tile-${i}`, { ...t, id: `tile-${i}` });
    });

    // Initialize portals from map
    if (this.map.portals) {
      this.map.portals.forEach((p, i) => {
        this.portals.set(`portal-${i}`, { ...p, id: `portal-${i}` });
      });
    }
  }

  addPlayer(socket: Socket, score: number = 0, credits: number = 0) {
    const player = new Player(socket.id, this.map.width / 2, this.map.height / 2, score, credits);
    this.players.set(socket.id, player);
    
    // Broadcast to others
    socket.to(this.id).emit('playerJoined', player.getState());
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
    this.inputs.delete(playerId);
    this.io.to(this.id).emit('playerLeft', playerId);
  }

  handleInput(playerId: string, input: ClientInput) {
    this.inputs.set(playerId, input);
  }

  update(dt: number) {
    this.time += dt;

    // Update players
    for (const [id, player] of this.players.entries()) {
      const input = this.inputs.get(id);
      if (input) {
        // Move player
        const speed = 300;
        player.vx = input.moveX * speed;
        player.vy = input.moveY * speed;
        
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        if (input.x !== undefined && input.y !== undefined) {
          // Trust client position if it's reasonably close to server simulation
          if (Math.hypot(player.x - input.x, player.y - input.y) < 200) {
            player.x = input.x;
            player.y = input.y;
          }
        }

        // Constrain to map
        player.x = Math.max(player.radius, Math.min(this.map.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(this.map.height - player.radius, player.y));

        // Check portal collision
        let changedRoom = false;
        for (const portal of this.portals.values()) {
          const dist = Math.hypot(player.x - portal.x, player.y - portal.y);
          if (dist < player.radius + portal.radius) {
            // Trigger portal
            this.onPlayerPortal(id, portal.targetRoomType);
            changedRoom = true;
            break; // Only trigger one portal
          }
        }
        if (changedRoom) continue;

        // Skills logic
        if (input.skills && input.skills.length > 0) {
          for (const skillInput of input.skills) {
            const skill = player.skills[skillInput.index];
            if (skill) {
              skill.activate(player, this, skillInput.aimX, skillInput.aimY);
            }
          }
          // Clear skills after processing to prevent multiple activations from same input
          input.skills = [];
        }

        // Shooting logic (basic)
        if (input.shooting && this.type !== 'city') {
          // Add projectile
          if (Math.random() < 0.1) { // Rate limit
            const projId = `proj-${Date.now()}-${Math.random()}`;
            this.projectiles.set(projId, {
              id: projId,
              x: player.x,
              y: player.y,
              vx: input.aimX * 800,
              vy: input.aimY * 800,
              radius: 5,
              color: '#facc15',
              ownerId: id
            });
          }
        }

        // Credit pickup
        for (const [creditId, credit] of this.credits.entries()) {
          const dist = Math.hypot(player.x - credit.x, player.y - credit.y);
          if (dist < player.radius + 15) { // 15 is approx credit radius
            player.credits += credit.value;
            this.credits.delete(creditId);
          }
        }
      }
    }

    // Update projectiles
    for (const [id, proj] of this.projectiles.entries()) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Remove if out of bounds
      if (proj.x < 0 || proj.x > this.map.width || proj.y < 0 || proj.y > this.map.height) {
        this.projectiles.delete(id);
        continue;
      }

      // Check collision with enemies (Battlefield)
      if (this.type === 'battlefield') {
        // Enemy projectiles hitting players
        if (proj.ownerId.startsWith('enemy-')) {
          for (const [playerId, player] of this.players.entries()) {
            const dist = Math.hypot(proj.x - player.x, proj.y - player.y);
            if (dist < proj.radius + player.radius) {
              player.hp -= 15;
              this.projectiles.delete(id);
              if (player.hp <= 0) {
                player.hp = player.maxHp;
                player.x = Math.random() * this.map.width;
                player.y = Math.random() * this.map.height;
                player.score = Math.floor(player.score / 2);
                this.io.to(playerId).emit('playerDied');
              }
              break;
            }
          }
        } else {
          // Player projectiles hitting enemies
          for (const [enemyId, enemy] of this.enemies.entries()) {
            const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
            if (dist < proj.radius + enemy.radius) {
              enemy.hp -= 10;
              this.projectiles.delete(id);
              if (enemy.hp <= 0) {
                this.enemies.delete(enemyId);
                const owner = this.players.get(proj.ownerId);
                if (owner) {
                  owner.score += 100;
                }
                // Drop credits
                const numCredits = Math.floor(Math.random() * 3) + 1; // 1 to 3 credits
                for (let i = 0; i < numCredits; i++) {
                  const creditId = `credit-${Date.now()}-${i}`;
                  this.credits.set(creditId, {
                    id: creditId,
                    x: enemy.x + (Math.random() - 0.5) * 20,
                    y: enemy.y + (Math.random() - 0.5) * 20,
                    value: 10
                  });
                }
              }
              break;
            }
          }
        }
      }

      // Check collision with players (Arena)
      if (this.type === 'arena') {
        for (const [playerId, player] of this.players.entries()) {
          if (playerId === proj.ownerId) continue;
          const dist = Math.hypot(proj.x - player.x, proj.y - player.y);
          if (dist < proj.radius + player.radius) {
            player.hp -= 10;
            this.projectiles.delete(id);
            if (player.hp <= 0) {
              player.hp = player.maxHp; // Respawn
              player.x = Math.random() * this.map.width;
              player.y = Math.random() * this.map.height;
              const owner = this.players.get(proj.ownerId);
              if (owner) {
                owner.score += 500; // Kill score
              }
              this.io.to(playerId).emit('playerDied');
            }
            break;
          }
        }
      }
    }

    // Update enemies (only in battlefield)
    if (this.type === 'battlefield') {
      // Spawn enemies
      if (this.enemies.size < 10 && Math.random() < 0.05) {
        const enemyId = `enemy-${Date.now()}`;
        const isRanged = Math.random() < 0.3; // 30% chance for ranged enemy
        const ex = Math.random() * this.map.width;
        const ey = Math.random() * this.map.height;
        if (isRanged) {
          this.enemies.set(enemyId, new RangedEnemy(enemyId, ex, ey));
        } else {
          this.enemies.set(enemyId, new MeleeEnemy(enemyId, ex, ey));
        }
      }

      // Update enemies
      for (const enemy of this.enemies.values()) {
        enemy.update(dt, this);
      }
    }

    // Broadcast state
    this.io.to(this.id).volatile.emit('stateUpdate', this.getState());
  }

  getState(): RoomState {
    const playersState: Record<string, PlayerState> = {};
    for (const [id, player] of this.players.entries()) {
      playersState[id] = player.getState();
    }

    const enemiesState: Record<string, EnemyState> = {};
    for (const [id, enemy] of this.enemies.entries()) {
      enemiesState[id] = enemy.getState();
    }

    return {
      id: this.id,
      type: this.type,
      width: this.map.width,
      height: this.map.height,
      players: playersState,
      enemies: enemiesState,
      projectiles: Object.fromEntries(this.projectiles),
      particles: Object.fromEntries(this.particles),
      credits: Object.fromEntries(this.credits),
      tiles: Object.fromEntries(this.tiles),
      portals: Object.fromEntries(this.portals)
    };
  }
}
