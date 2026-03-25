import type { Rect, ViewportSize, WorldLayout, WorldSizing } from './types';

export function createLinearDungeonLayout(worldIndex: number, sizing: WorldSizing): WorldLayout {
  const viewport = sizing.getViewportSize();
  const combat = getCombatRoomSize(viewport);
  const reward = getRewardRoomSize(viewport);
  const portal = getPortalRoomSize(viewport);

  const padding = 140;
  const corridorLen = 360;
  const corridorThick = 190;

  const rng = mulberry32(0xC0FFEE + worldIndex * 9973);
  const dirs: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

  const combatRect0: Rect = { x: 0, y: 0, width: combat.width, height: combat.height };
  const d1 = dirs[Math.floor(rng() * dirs.length)];
  const first = placeConnectedRoom(rng, combatRect0, reward.width, reward.height, d1, corridorLen, corridorThick);
  const rewardRect0 = first.room;
  const corridor1_0 = first.corridor;

  let portalRect0: Rect = { x: 0, y: 0, width: portal.width, height: portal.height };
  let corridor2_0: Rect = { x: 0, y: 0, width: corridorLen, height: corridorThick };
  let ok = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const d2 = dirs[Math.floor(rng() * dirs.length)];
    if (d2 === oppositeDir(d1)) continue;
    const second = placeConnectedRoom(rng, rewardRect0, portal.width, portal.height, d2, corridorLen, corridorThick);
    const p = second.room;
    const c = second.corridor;
    if (
      rectsOverlapExpanded(p, combatRect0, 140) ||
      rectsOverlapExpanded(p, corridor1_0, 120) ||
      rectsOverlapExpanded(c, combatRect0, 80)
    ) {
      continue;
    }
    portalRect0 = p;
    corridor2_0 = c;
    ok = true;
    break;
  }
  if (!ok) {
    const second = placeConnectedRoom(rng, rewardRect0, portal.width, portal.height, 'EAST', corridorLen, corridorThick);
    portalRect0 = second.room;
    corridor2_0 = second.corridor;
  }

  const minX = Math.min(combatRect0.x, rewardRect0.x, portalRect0.x, corridor1_0.x, corridor2_0.x);
  const minY = Math.min(combatRect0.y, rewardRect0.y, portalRect0.y, corridor1_0.y, corridor2_0.y);
  const maxX = Math.max(
    combatRect0.x + combatRect0.width,
    rewardRect0.x + rewardRect0.width,
    portalRect0.x + portalRect0.width,
    corridor1_0.x + corridor1_0.width,
    corridor2_0.x + corridor2_0.width,
  );
  const maxY = Math.max(
    combatRect0.y + combatRect0.height,
    rewardRect0.y + rewardRect0.height,
    portalRect0.y + portalRect0.height,
    corridor1_0.y + corridor1_0.height,
    corridor2_0.y + corridor2_0.height,
  );

  const shiftX = padding - minX;
  const shiftY = padding - minY;

  const combatRect = shiftRect(combatRect0, shiftX, shiftY);
  const rewardRect = shiftRect(rewardRect0, shiftX, shiftY);
  const portalRect = shiftRect(portalRect0, shiftX, shiftY);
  const corridor1: Rect = shiftRect(corridor1_0, shiftX, shiftY);
  const corridor2: Rect = shiftRect(corridor2_0, shiftX, shiftY);

  const worldWidth = roundUpTo((maxX - minX) + padding * 2, 50);
  const worldHeight = roundUpTo((maxY - minY) + padding * 2, 50);

  const waveCount = 3 + worldIndex;
  const layout: WorldLayout = {
    id: `WORLD_${worldIndex}`,
    index: worldIndex,
    bounds: { width: worldWidth, height: worldHeight },
    rooms: [
      { kind: 'COMBAT', rect: combatRect },
      { kind: 'REWARD', rect: rewardRect },
      { kind: 'PORTAL', rect: portalRect },
    ],
    corridors: [corridor1, corridor2],
    combatWaveCount: waveCount,
  };
  return layout;
}

function oppositeDir(dir: Direction): Direction {
  if (dir === 'NORTH') return 'SOUTH';
  if (dir === 'SOUTH') return 'NORTH';
  if (dir === 'EAST') return 'WEST';
  return 'EAST';
}

type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

function placeConnectedRoom(
  rng: () => number,
  base: Rect,
  roomW: number,
  roomH: number,
  dir: Direction,
  corridorLen: number,
  corridorThick: number,
): { room: Rect; corridor: Rect } {
  const baseCx = base.x + base.width / 2;
  const baseCy = base.y + base.height / 2;
  const room: Rect = { x: 0, y: 0, width: roomW, height: roomH };
  const halfThick = corridorThick / 2;

  if (dir === 'EAST' || dir === 'WEST') {
    const shiftMax = Math.max(0, Math.min((base.height - corridorThick) / 2, (roomH - corridorThick) / 2, 260));
    const shift = (rng() * 2 - 1) * shiftMax;
    room.y = Math.round(baseCy - roomH / 2 + shift);
    room.x = dir === 'EAST'
      ? Math.round(base.x + base.width + corridorLen)
      : Math.round(base.x - corridorLen - roomW);

    const overlapTop = Math.max(base.y, room.y);
    const overlapBottom = Math.min(base.y + base.height, room.y + roomH);
    const minCy = overlapTop + halfThick;
    const maxCy = overlapBottom - halfThick;
    const cy = minCy > maxCy
      ? Math.round((minCy + maxCy) / 2)
      : Math.round(minCy + (maxCy - minCy) * rng());

    const corridorX = dir === 'EAST' ? base.x + base.width : room.x + roomW;
    const corridor: Rect = {
      x: Math.round(corridorX),
      y: Math.round(cy - corridorThick / 2),
      width: corridorLen,
      height: corridorThick,
    };
    return { room, corridor };
  }

  const shiftMax = Math.max(0, Math.min((base.width - corridorThick) / 2, (roomW - corridorThick) / 2, 320));
  const shift = (rng() * 2 - 1) * shiftMax;
  room.x = Math.round(baseCx - roomW / 2 + shift);
  room.y = dir === 'SOUTH'
    ? Math.round(base.y + base.height + corridorLen)
    : Math.round(base.y - corridorLen - roomH);

  const overlapLeft = Math.max(base.x, room.x);
  const overlapRight = Math.min(base.x + base.width, room.x + roomW);
  const minCx = overlapLeft + halfThick;
  const maxCx = overlapRight - halfThick;
  const cx = minCx > maxCx
    ? Math.round((minCx + maxCx) / 2)
    : Math.round(minCx + (maxCx - minCx) * rng());

  const corridorY = dir === 'SOUTH' ? base.y + base.height : room.y + roomH;
  const corridor: Rect = {
    x: Math.round(cx - corridorThick / 2),
    y: Math.round(corridorY),
    width: corridorThick,
    height: corridorLen,
  };
  return { room, corridor };
}

function shiftRect(rect: Rect, dx: number, dy: number): Rect {
  return { x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height };
}

function rectsOverlapExpanded(a: Rect, b: Rect, pad: number): boolean {
  return !(
    a.x + a.width + pad < b.x - pad ||
    a.x - pad > b.x + b.width + pad ||
    a.y + a.height + pad < b.y - pad ||
    a.y - pad > b.y + b.height + pad
  );
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getCombatRoomSize(viewport: ViewportSize): { width: number; height: number } {
  const minW = Math.max(viewport.width + 420, 1400);
  const minH = Math.max(viewport.height + 280, 900);
  const width = roundUpTo(Math.min(minW, 1900), 100);
  const height = roundUpTo(Math.min(minH, 1150), 100);
  return { width, height };
}

function getRewardRoomSize(viewport: ViewportSize): { width: number; height: number } {
  const baseW = Math.round(viewport.width * 0.64);
  const baseH = Math.round(viewport.height * 0.56);
  const width = roundUpTo(clamp(baseW, 700, 1050), 50);
  const height = roundUpTo(clamp(baseH, 480, 760), 50);
  return { width, height };
}

function getPortalRoomSize(viewport: ViewportSize): { width: number; height: number } {
  const baseW = Math.round(viewport.width * 0.60);
  const baseH = Math.round(viewport.height * 0.54);
  const width = roundUpTo(clamp(baseW, 680, 1000), 50);
  const height = roundUpTo(clamp(baseH, 460, 720), 50);
  return { width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}
