import { Server, Socket } from 'socket.io';
import { PlayerState, EnemyState, ProjectileState, ParticleState, CreditState, TileState, RoomState, ClientInput } from '../src/shared/types';
import { MapConfig, maps } from './Map';

export class Room {
  id: string;
  type: 'city' | 'arena' | 'battlefield';
  io: Server;
  map: MapConfig;
  maxPlayers: number;

  players: Map<string, PlayerState> = new Map();
  enemies: Map<string, EnemyState> = new Map();
  projectiles: Map<string, ProjectileState> = new Map();
  particles: Map<string, ParticleState> = new Map();
  credits: Map<string, CreditState> = new Map();
  tiles: Map<string, TileState> = new Map();

  inputs: Map<string, ClientInput> = new Map();

  lastTime: number = Date.now();
  time: number = 0;

  constructor(id: string, type: 'city' | 'arena' | 'battlefield', io: Server) {
    this.id = id;
    this.type = type;
    this.io = io;
    this.map = maps[type];
    this.maxPlayers = this.map.maxPlayers;

    // Initialize tiles from map
    this.map.tiles.forEach((t, i) => {
      this.tiles.set(`tile-${i}`, { ...t, id: `tile-${i}` });
    });
  }

  addPlayer(socket: Socket) {
    const player: PlayerState = {
      id: socket.id,
      x: this.map.width / 2,
      y: this.map.height / 2,
      vx: 0,
      vy: 0,
      radius: 20,
      hp: 100,
      maxHp: 100,
      color: '#3b82f6',
      score: 0,
      credits: 0
    };
    this.players.set(socket.id, player);
    
    // Broadcast to others
    socket.to(this.id).emit('playerJoined', player);
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

        // Constrain to map
        player.x = Math.max(player.radius, Math.min(this.map.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(this.map.height - player.radius, player.y));

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
            }
            break;
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
        this.enemies.set(enemyId, {
          id: enemyId,
          type: 'melee',
          x: Math.random() * this.map.width,
          y: Math.random() * this.map.height,
          radius: 15,
          hp: 50,
          maxHp: 50,
          color: '#ef4444'
        });
      }

      // Move enemies towards nearest player
      for (const [id, enemy] of this.enemies.entries()) {
        let nearestPlayer: PlayerState | null = null;
        let minDist = Infinity;
        for (const player of this.players.values()) {
          const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
          if (dist < minDist) {
            minDist = dist;
            nearestPlayer = player;
          }
        }

        if (nearestPlayer) {
          const angle = Math.atan2(nearestPlayer.y - enemy.y, nearestPlayer.x - enemy.x);
          const speed = 100;
          enemy.x += Math.cos(angle) * speed * dt;
          enemy.y += Math.sin(angle) * speed * dt;

          // Damage player if close enough
          if (minDist < enemy.radius + nearestPlayer.radius) {
            nearestPlayer.hp -= 20 * dt; // 20 damage per second
            if (nearestPlayer.hp <= 0) {
              nearestPlayer.hp = nearestPlayer.maxHp;
              nearestPlayer.x = Math.random() * this.map.width;
              nearestPlayer.y = Math.random() * this.map.height;
              // Player died, maybe reset score?
              nearestPlayer.score = Math.floor(nearestPlayer.score / 2);
            }
          }
        }
      }
    }

    // Broadcast state
    this.io.to(this.id).volatile.emit('stateUpdate', this.getState());
  }

  getState(): RoomState {
    return {
      id: this.id,
      type: this.type,
      width: this.map.width,
      height: this.map.height,
      players: Object.fromEntries(this.players),
      enemies: Object.fromEntries(this.enemies),
      projectiles: Object.fromEntries(this.projectiles),
      particles: Object.fromEntries(this.particles),
      credits: Object.fromEntries(this.credits),
      tiles: Object.fromEntries(this.tiles)
    };
  }
}
