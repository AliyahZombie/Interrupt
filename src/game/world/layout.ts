import type { Rect, RewardContent, RoomKind, ViewportSize, WorldLayout, WorldLayoutConnection, WorldSizing } from './types';

export function createDungeonLayout(worldIndex: number, sizing: WorldSizing): WorldLayout {
  const viewport = sizing.getViewportSize();

  const hub = getHubRoomSize(viewport);
  const combat = getCombatRoomSize(viewport);
  const reward = getRewardRoomSize(viewport);
  const portal = getPortalRoomSize(viewport);

  const padding = 140;
  const corridorLen = 360;
  const corridorThick = 190;

  const baseWaveCount = 3 + worldIndex;
  const rng = Math.random;

  const maxRoomW = Math.max(hub.width, combat.width, reward.width, portal.width);
  const maxRoomH = Math.max(hub.height, combat.height, reward.height, portal.height);
  const cellW = maxRoomW + corridorLen;
  const cellH = maxRoomH + corridorLen;

  type Node = {
    id: string;
    kind: RoomKind;
    gx: number;
    gy: number;
    parentIndex: number | null;
    rewardContent?: RewardContent;
    combatWaveCount?: number;
  };

  const nodes: Node[] = [];
  const occupied = new Set<string>();
  const keyOf = (gx: number, gy: number) => `${gx},${gy}`;
  const addNode = (node: Node) => {
    nodes.push(node);
    occupied.add(keyOf(node.gx, node.gy));
  };

  addNode({ id: 'ROOM_SAFE', kind: 'HUB', gx: 0, gy: 0, parentIndex: null });
  addNode({ id: 'ROOM_BATTLE_0', kind: 'COMBAT', gx: 0, gy: -1, parentIndex: 0 });

  const targetRoomCount = 4 + Math.floor(rng() * 4);
  const dirs: Array<{ dx: number; dy: number }> = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  for (let guard = 0; nodes.length < targetRoomCount && guard < 500; guard++) {
    const parentIndex = 1 + Math.floor(rng() * Math.max(1, nodes.length - 1));
    const parent = nodes[parentIndex];
    const d = dirs[Math.floor(rng() * dirs.length)];
    const gx = parent.gx + d.dx;
    const gy = parent.gy + d.dy;
    if (occupied.has(keyOf(gx, gy))) continue;
    if (gx === 0 && gy === 0) continue;
    if (gx === 0 && gy === -1) continue;
    addNode({
      id: `ROOM_${nodes.length}`,
      kind: 'COMBAT',
      gx,
      gy,
      parentIndex,
    });
  }

  if (nodes.length < 4) {
    const battle = nodes[1];
    const candidates: Array<{ gx: number; gy: number }> = [
      { gx: battle.gx, gy: battle.gy - 1 },
      { gx: battle.gx + 1, gy: battle.gy },
      { gx: battle.gx - 1, gy: battle.gy },
      { gx: battle.gx, gy: battle.gy + 1 },
      { gx: battle.gx, gy: battle.gy - 2 },
    ];
    for (const p of candidates) {
      if (nodes.length >= 4) break;
      if (occupied.has(keyOf(p.gx, p.gy))) continue;
      addNode({
        id: `ROOM_${nodes.length}`,
        kind: 'COMBAT',
        gx: p.gx,
        gy: p.gy,
        parentIndex: 1,
      });
    }
  }

  const safe = nodes[0];
  let portalIndex = nodes.length > 2 ? 2 : 1;
  let bestDist = -1;
  for (let i = 1; i < nodes.length; i++) {
    if (i === 1 && nodes.length > 2) continue;
    const n = nodes[i];
    const d = Math.abs(n.gx - safe.gx) + Math.abs(n.gy - safe.gy);
    if (d > bestDist) {
      bestDist = d;
      portalIndex = i;
    }
  }
  nodes[portalIndex].kind = 'PORTAL';

  const nonSafeIndices: number[] = [];
  for (let i = 1; i < nodes.length; i++) {
    if (i === portalIndex) continue;
    if (i === 1) continue;
    nonSafeIndices.push(i);
  }
  if (nonSafeIndices.length > 0) {
    const rewardCount = rng() < 0.55 ? 2 : 1;
    for (let k = 0; k < rewardCount; k++) {
      const idx = nonSafeIndices[Math.floor(rng() * nonSafeIndices.length)];
      nodes[idx].kind = 'REWARD';
    }
  }

  if (!nodes.some(n => n.kind === 'REWARD')) {
    const fallbackIdx = nonSafeIndices.length > 0
      ? nonSafeIndices[Math.floor(rng() * nonSafeIndices.length)]
      : (nodes.length > 3 ? 3 : 1);
    if (fallbackIdx !== portalIndex && fallbackIdx !== 0) {
      nodes[fallbackIdx].kind = 'REWARD';
    }
  }

  for (const n of nodes) {
    if (n.kind === 'REWARD') {
      const r = rng();
      n.rewardContent = r < 1 / 4 ? 'CREDIT' : r < 2 / 4 ? 'HEAL' : r < 3 / 4 ? 'MP' : 'WEAPON';
    }
    if (n.kind === 'COMBAT') {
      const bonus = rng() < 0.25 ? 1 : 0;
      n.combatWaveCount = Math.max(1, baseWaveCount + bonus);
    }
  }

  const roomRects0: Rect[] = nodes.map((n) => {
    const size = n.kind === 'HUB'
      ? hub
      : n.kind === 'COMBAT'
        ? combat
        : n.kind === 'REWARD'
          ? reward
          : portal;
    const x = Math.round(n.gx * cellW + (cellW - size.width) / 2);
    const y = Math.round(n.gy * cellH + (cellH - size.height) / 2);
    return { x, y, width: size.width, height: size.height };
  });

  const edges: Array<{ a: number; b: number }> = [];
  const edgeKey = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const edgeSet = new Set<string>();
  const addEdge = (a: number, b: number) => {
    if (a === 0 || b === 0) {
      const other = a === 0 ? b : a;
      if (other !== 1) return;
    }
    const k = edgeKey(a, b);
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push({ a, b });
  };

  for (let i = 1; i < nodes.length; i++) {
    const p = nodes[i].parentIndex;
    if (p === null) continue;
    addEdge(i, p);
  }

  const byPos = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    byPos.set(keyOf(nodes[i].gx, nodes[i].gy), i);
  }

  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    for (const d of dirs) {
      const j = byPos.get(keyOf(n.gx + d.dx, n.gy + d.dy));
      if (j === undefined) continue;
      if (j === 0) continue;
      if (j === i) continue;
      if (rng() < 0.35) {
        addEdge(i, j);
      }
    }
  }

  const connections0: WorldLayoutConnection[] = edges.map((e, idx) => {
    const a = roomRects0[e.a];
    const b = roomRects0[e.b];
    const corridor = buildCorridorBetweenRooms(a, b, corridorThick);
    return { id: `CONN_${idx}`, roomA: e.a, roomB: e.b, corridor };
  });

  const rectsForBounds: Rect[] = [...roomRects0, ...connections0.map(c => c.corridor)];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rectsForBounds) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  const shiftX = padding - minX;
  const shiftY = padding - minY;

  const rooms = nodes.map((n, i) => ({
    id: n.id,
    kind: n.kind,
    rect: shiftRect(roomRects0[i], shiftX, shiftY),
    rewardContent: n.rewardContent,
    combatWaveCount: n.combatWaveCount,
  }));

  const connections = connections0.map((c) => ({
    ...c,
    corridor: shiftRect(c.corridor, shiftX, shiftY),
  }));

  const corridors = connections.map(c => c.corridor);
  const worldWidth = roundUpTo((maxX - minX) + padding * 2, 50);
  const worldHeight = roundUpTo((maxY - minY) + padding * 2, 50);

  return {
    id: `WORLD_${worldIndex}`,
    index: worldIndex,
    bounds: { width: worldWidth, height: worldHeight },
    rooms,
    corridors,
    connections,
    combatWaveCount: baseWaveCount,
  };
}

export function createLinearDungeonLayout(worldIndex: number, sizing: WorldSizing): WorldLayout {
  return createDungeonLayout(worldIndex, sizing);
}

function buildCorridorBetweenRooms(a: Rect, b: Rect, thickness: number): Rect {
  const halfT = thickness / 2;
  const aCx = a.x + a.width / 2;
  const aCy = a.y + a.height / 2;
  const bCx = b.x + b.width / 2;
  const bCy = b.y + b.height / 2;

  const horizontal = Math.abs(aCx - bCx) >= Math.abs(aCy - bCy);
  if (horizontal) {
    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;

    const overlapTop = Math.max(left.y, right.y);
    const overlapBottom = Math.min(left.y + left.height, right.y + right.height);
    const cy = Math.round((overlapTop + overlapBottom) / 2);

    const x = Math.round(left.x + left.width);
    const width = Math.max(50, Math.round(right.x - x));
    return {
      x,
      y: Math.round(cy - halfT),
      width,
      height: thickness,
    };
  }

  const top = a.y < b.y ? a : b;
  const bottom = a.y < b.y ? b : a;

  const overlapLeft = Math.max(top.x, bottom.x);
  const overlapRight = Math.min(top.x + top.width, bottom.x + bottom.width);
  const cx = Math.round((overlapLeft + overlapRight) / 2);

  const y = Math.round(top.y + top.height);
  const height = Math.max(50, Math.round(bottom.y - y));
  return {
    x: Math.round(cx - halfT),
    y,
    width: thickness,
    height,
  };
}

function shiftRect(rect: Rect, dx: number, dy: number): Rect {
  return { x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height };
}

function getHubRoomSize(viewport: ViewportSize): { width: number; height: number } {
  const base = getRewardRoomSize(viewport);
  const width = roundUpTo(clamp(base.width + 80, 720, 1120), 50);
  const height = roundUpTo(clamp(base.height + 60, 520, 820), 50);
  return { width, height };
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
