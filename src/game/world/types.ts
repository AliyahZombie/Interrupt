export type RoomKind = 'HUB' | 'COMBAT' | 'REWARD' | 'PORTAL';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldBounds {
  width: number;
  height: number;
}

export interface WorldLayoutRoom {
  kind: RoomKind;
  rect: Rect;
}

export interface WorldLayout {
  id: string;
  index: number;
  bounds: WorldBounds;
  rooms: WorldLayoutRoom[];
  corridors: Rect[];
  combatWaveCount: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface RoomBounds {
  width: number;
  height: number;
}

export type DoorEdge = 'NORTH' | 'SOUTH' | 'WEST' | 'EAST';

export interface RoomDoor {
  edge: DoorEdge;
  center: number;
  size: number;
}

export interface RoomDefinition {
  id: string;
  kind: RoomKind;
  displayName: string;
  waveCount?: number;
}

export interface WorldDefinition {
  id: string;
  index: number;
  rooms: RoomDefinition[];
}

export interface RoomRuntime {
  enteredAtMs: number;
  isCompleted: boolean;
}

export interface WorldRuntime {
  world: WorldDefinition;
  roomIndex: number;
  room: RoomDefinition;
  roomRuntime: RoomRuntime;
}

export interface WorldSizing {
  getViewportSize: () => ViewportSize;
  getRoomBounds: (viewport: ViewportSize) => RoomBounds;
}
