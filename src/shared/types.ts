export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  color: string;
  score: number;
  credits: number;
}

export interface EnemyState {
  id: string;
  type: 'melee' | 'ranged';
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  color: string;
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  ownerId: string;
}

export interface ParticleState {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

export interface CreditState {
  id: string;
  x: number;
  y: number;
  value: number;
}

export interface TileState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface PortalState {
  id: string;
  x: number;
  y: number;
  radius: number;
  targetRoomType: 'city' | 'arena' | 'battlefield';
  color: string;
  label: string;
}

export interface RoomState {
  id: string;
  type: 'city' | 'arena' | 'battlefield';
  width: number;
  height: number;
  players: Record<string, PlayerState>;
  enemies: Record<string, EnemyState>;
  projectiles: Record<string, ProjectileState>;
  particles: Record<string, ParticleState>;
  credits: Record<string, CreditState>;
  tiles: Record<string, TileState>;
  portals: Record<string, PortalState>;
}

export interface ClientInput {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  shooting: boolean;
  skills: {
    index: number;
    aimX: number;
    aimY: number;
  }[];
}
