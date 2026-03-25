import type {
  RoomDefinition,
  RoomRuntime,
  WorldDefinition,
  WorldRuntime,
  WorldSizing,
} from './types';

export type WorldPhase = 'ENTER_ROOM' | 'IN_ROOM' | 'TRANSITIONING';

export interface RoomSignals {
  nowMs: number;
  enemiesAlive: number;
  isCombatCleared: boolean;
  isHealPickupCollected: boolean;
  isPortalTouched: boolean;
}

export interface RoomPlan {
  roomId: string;
  kind: RoomDefinition['kind'];
  displayName: string;
  width: number;
  height: number;
  waveCount: number;
  lockDoorsOnEnter: boolean;
  hasHealPickup: boolean;
  hasPortal: boolean;
}

export interface WorldManagerOptions {
  sizing: WorldSizing;
  startingWorldIndex?: number;
}

export class WorldManager {
  private readonly sizing: WorldSizing;
  private phase: WorldPhase = 'ENTER_ROOM';
  private worldIndex: number;
  private runtime: WorldRuntime;
  private inDungeon: boolean = false;

  constructor(options: WorldManagerOptions) {
    this.sizing = options.sizing;
    this.worldIndex = options.startingWorldIndex ?? 0;
    const hub = createHubWorld();
    this.runtime = createWorldRuntime(hub, 0, 0);
  }

  resetRun(nowMs: number) {
    this.phase = 'ENTER_ROOM';
    this.worldIndex = 0;
    this.inDungeon = false;
    const hub = createHubWorld();
    this.runtime = createWorldRuntime(hub, 0, nowMs);
  }

  getPhase(): WorldPhase {
    return this.phase;
  }

  getWorldRuntime(): WorldRuntime {
    return this.runtime;
  }

  enterCurrentRoom(nowMs: number): RoomPlan {
    const viewport = this.sizing.getViewportSize();
    const bounds = this.sizing.getRoomBounds(viewport);
    const room = this.runtime.room;
    const waveCount = room.kind === 'COMBAT' ? room.waveCount ?? 3 : 0;
    const plan: RoomPlan = {
      roomId: room.id,
      kind: room.kind,
      displayName: room.displayName,
      width: bounds.width,
      height: bounds.height,
      waveCount,
      lockDoorsOnEnter: room.kind === 'COMBAT',
      hasHealPickup: room.kind === 'REWARD',
      hasPortal: true,
    };

    this.runtime = {
      ...this.runtime,
      roomRuntime: { enteredAtMs: nowMs, isCompleted: false },
    };
    this.phase = 'IN_ROOM';
    return plan;
  }

  update(signals: RoomSignals): void {
    if (this.phase !== 'IN_ROOM') return;

    const room = this.runtime.room;
    const completed = isRoomCompleted(room, signals);
    if (!completed) return;

    this.runtime = {
      ...this.runtime,
      roomRuntime: { ...this.runtime.roomRuntime, isCompleted: true },
    };
    this.phase = 'TRANSITIONING';
  }

  proceedIfReady(nowMs: number): { didTransition: boolean; plan?: RoomPlan } {
    if (this.phase !== 'TRANSITIONING') return { didTransition: false };

    if (!this.inDungeon && this.runtime.room.kind === 'HUB') {
      this.inDungeon = true;
      const world = createLinearWorld(this.worldIndex);
      this.runtime = createWorldRuntime(world, 0, nowMs);
      this.phase = 'ENTER_ROOM';
      return { didTransition: true };
    }

    const next = getNextRoomIndex(this.runtime.world, this.runtime.roomIndex);
    if (next.roomIndex !== this.runtime.roomIndex) {
      this.runtime = createWorldRuntime(this.runtime.world, next.roomIndex, nowMs);
      this.phase = 'ENTER_ROOM';
      return { didTransition: true };
    }

    this.worldIndex += 1;
    const world = createLinearWorld(this.worldIndex);
    this.runtime = createWorldRuntime(world, 0, nowMs);
    this.phase = 'ENTER_ROOM';
    return { didTransition: true };
  }
}

function isRoomCompleted(room: RoomDefinition, signals: RoomSignals): boolean {
  if (room.kind === 'COMBAT') return signals.isCombatCleared;
  if (room.kind === 'REWARD') return signals.isHealPickupCollected && signals.isPortalTouched;
  if (room.kind === 'HUB') return signals.isPortalTouched;
  if (room.kind === 'PORTAL') return signals.isPortalTouched;
  return false;
}

function createWorldRuntime(world: WorldDefinition, roomIndex: number, nowMs: number): WorldRuntime {
  const room = world.rooms[roomIndex];
  const roomRuntime: RoomRuntime = { enteredAtMs: nowMs, isCompleted: false };
  return { world, roomIndex, room, roomRuntime };
}

function getNextRoomIndex(world: WorldDefinition, roomIndex: number): { roomIndex: number } {
  const next = roomIndex + 1;
  if (next < world.rooms.length) return { roomIndex: next };
  return { roomIndex };
}

function createLinearWorld(index: number): WorldDefinition {
  const worldId = `WORLD_${index}`;
  const rooms: RoomDefinition[] = [
    {
      id: `${worldId}_COMBAT_0`,
      kind: 'COMBAT',
      displayName: 'COMBAT ROOM',
      waveCount: 3 + index,
    },
    {
      id: `${worldId}_REWARD_0`,
      kind: 'REWARD',
      displayName: 'REWARD ROOM',
    },
    {
      id: `${worldId}_PORTAL_0`,
      kind: 'PORTAL',
      displayName: 'PORTAL ROOM',
    },
  ];
  return { id: worldId, index, rooms };
}

function createHubWorld(): WorldDefinition {
  return {
    id: 'HUB',
    index: -1,
    rooms: [
      {
        id: 'HUB_ROOM',
        kind: 'HUB',
        displayName: 'SAFEHOUSE',
      },
    ],
  };
}
