import { Tile } from '../Entities';
import type { Rect } from '../world/types';

export function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function createOuterBoundsTiles(worldW: number, worldH: number, thickness: number): Tile[] {
  const halfT = thickness / 2;
  return [
    new Tile(worldW / 2, halfT, worldW, thickness, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
    new Tile(worldW / 2, worldH - halfT, worldW, thickness, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
    new Tile(halfT, worldH / 2, thickness, worldH, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
    new Tile(worldW - halfT, worldH / 2, thickness, worldH, true, 0, 0, 100, '#0b1220', 'BOUNDS'),
  ];
}

export function createCorridorWallTiles(rect: Rect, thickness: number): Tile[] {
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

export function createRoomWallTiles(
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

export function detectCorridorEdge(room: Rect, corridor: Rect): 'NORTH' | 'SOUTH' | 'WEST' | 'EAST' {
  const eps = 1e-3;
  if (Math.abs(corridor.x - (room.x + room.width)) < eps) return 'EAST';
  if (Math.abs(corridor.x + corridor.width - room.x) < eps) return 'WEST';
  if (Math.abs(corridor.y - (room.y + room.height)) < eps) return 'SOUTH';
  return 'NORTH';
}

export function buildRoomOpenings(
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

export function createDoorTile(
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
