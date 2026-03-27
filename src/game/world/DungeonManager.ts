import type { Rect, WorldLayout, WorldLayoutConnection, WorldSizing } from './types';
import { createDungeonLayout } from './layout';

export type DungeonStage = 'COMBAT' | 'REWARD' | 'PORTAL';

export interface DungeonNavigationPath {
  points: { x: number; y: number }[];
}

export class DungeonManager {
  private readonly sizing: WorldSizing;
  private worldIndex = 0;
  private layout: WorldLayout;
  private currentRoomIndex: number = 0;
  private readonly clearedCombatRooms = new Set<number>();
  private readonly claimedRewardRooms = new Set<number>();

  constructor(sizing: WorldSizing) {
    this.sizing = sizing;
    this.layout = createDungeonLayout(0, sizing);
    this.currentRoomIndex = this.getStartRoomIndex();
  }

  resetRun() {
    this.worldIndex = 0;
    this.layout = createDungeonLayout(this.worldIndex, this.sizing);
    this.currentRoomIndex = this.getStartRoomIndex();
    this.clearedCombatRooms.clear();
    this.claimedRewardRooms.clear();
  }

  getWorldIndex(): number {
    return this.worldIndex;
  }

  getLayout(): WorldLayout {
    return this.layout;
  }

  getCurrentRoomIndex(): number {
    return this.currentRoomIndex;
  }

  setCurrentRoomIndex(index: number): boolean {
    if (index === this.currentRoomIndex) return false;
    this.currentRoomIndex = index;
    return true;
  }

  findRoomIndexAt(x: number, y: number): number | null {
    for (let i = 0; i < this.layout.rooms.length; i++) {
      if (pointInRect(x, y, this.layout.rooms[i].rect)) {
        return i;
      }
    }
    return null;
  }

  getRoom(index: number): WorldLayout['rooms'][number] | null {
    const r = this.layout.rooms[index];
    return r ?? null;
  }

  getStartRoomIndex(): number {
    const idx = this.layout.rooms.findIndex(r => r.kind === 'HUB');
    return idx >= 0 ? idx : 0;
  }

  getPortalRoomIndex(): number {
    const idx = this.layout.rooms.findIndex(r => r.kind === 'PORTAL');
    return idx >= 0 ? idx : 0;
  }

  isCombatRoomCleared(index: number): boolean {
    return this.clearedCombatRooms.has(index);
  }

  setCombatRoomCleared(index: number) {
    this.clearedCombatRooms.add(index);
  }

  isRewardRoomClaimed(index: number): boolean {
    return this.claimedRewardRooms.has(index);
  }

  setRewardRoomClaimed(index: number) {
    this.claimedRewardRooms.add(index);
  }

  advanceWorld() {
    this.worldIndex += 1;
    this.layout = createDungeonLayout(this.worldIndex, this.sizing);
    this.currentRoomIndex = this.getStartRoomIndex();
    this.clearedCombatRooms.clear();
    this.claimedRewardRooms.clear();
  }

  getNavigationPath(playerX: number, playerY: number): DungeonNavigationPath | null {
    const startRoomIndex = this.findRoomIndexAt(playerX, playerY) ?? this.currentRoomIndex;
    const portalIndex = this.getPortalRoomIndex();
    if (startRoomIndex === portalIndex) return null;

    const adjacency = this.buildRoomAdjacency();
    const pathRooms = bfsRoomPath(adjacency, startRoomIndex, portalIndex);
    if (!pathRooms || pathRooms.length < 2) return null;

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < pathRooms.length - 1; i++) {
      const aIdx = pathRooms[i];
      const bIdx = pathRooms[i + 1];
      const conn = this.findConnection(aIdx, bIdx);
      if (!conn) continue;

      const aRect = this.layout.rooms[aIdx]?.rect;
      const bRect = this.layout.rooms[bIdx]?.rect;
      if (!aRect || !bRect) continue;

      const corridor = conn.corridor;
      const corridorMid = { x: corridor.x + corridor.width / 2, y: corridor.y + corridor.height / 2 };
      const aExit = roomConnectorPoint(aRect, corridor, 120);
      const bCenter = { x: bRect.x + bRect.width / 2, y: bRect.y + bRect.height / 2 };

      if (i === 0) {
        points.push(aExit);
      }
      points.push(corridorMid);
      points.push(bCenter);
    }

    return { points: trimPathToPlayer({ x: playerX, y: playerY }, points) };
  }

  private buildRoomAdjacency(): Map<number, number[]> {
    const adj = new Map<number, number[]>();
    for (let i = 0; i < this.layout.rooms.length; i++) adj.set(i, []);
    for (const c of this.layout.connections) {
      const a = c.roomA;
      const b = c.roomB;
      const aList = adj.get(a);
      const bList = adj.get(b);
      if (aList) aList.push(b);
      if (bList) bList.push(a);
    }
    return adj;
  }

  private findConnection(a: number, b: number): WorldLayoutConnection | null {
    for (const c of this.layout.connections) {
      if ((c.roomA === a && c.roomB === b) || (c.roomA === b && c.roomB === a)) {
        return c;
      }
    }
    return null;
  }
}

function roomConnectorPoint(room: Rect, corridor: Rect, inset: number): { x: number; y: number } {
  const edge = detectCorridorEdge(room, corridor);
  const cx = corridor.x + corridor.width / 2;
  const cy = corridor.y + corridor.height / 2;
  if (edge === 'EAST') return { x: room.x + room.width - inset, y: cy };
  if (edge === 'WEST') return { x: room.x + inset, y: cy };
  if (edge === 'SOUTH') return { x: cx, y: room.y + room.height - inset };
  return { x: cx, y: room.y + inset };
}

function detectCorridorEdge(room: Rect, corridor: Rect): 'NORTH' | 'SOUTH' | 'WEST' | 'EAST' {
  const eps = 1e-3;
  if (Math.abs(corridor.x - (room.x + room.width)) < eps) return 'EAST';
  if (Math.abs(corridor.x + corridor.width - room.x) < eps) return 'WEST';
  if (Math.abs(corridor.y - (room.y + room.height)) < eps) return 'SOUTH';
  return 'NORTH';
}

function trimPathToPlayer(
  player: { x: number; y: number },
  path: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (path.length < 2) return path;
  const proj = projectPointToPolyline(player, path);
  if (!proj) return path;

  const out: { x: number; y: number }[] = [];
  out.push({ x: proj.x, y: proj.y });
  out.push(path[proj.segIndex + 1]);
  for (let i = proj.segIndex + 2; i < path.length; i++) {
    out.push(path[i]);
  }
  return out;
}

function projectPointToPolyline(
  p: { x: number; y: number },
  points: { x: number; y: number }[],
): { x: number; y: number; segIndex: number } | null {
  if (points.length < 2) return null;
  let best: { x: number; y: number; segIndex: number } | null = null;
  let bestD2 = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 1e-6) continue;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    const tt = Math.max(0, Math.min(1, t));
    const x = a.x + dx * tt;
    const y = a.y + dy * tt;
    const ddx = p.x - x;
    const ddy = p.y - y;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = { x, y, segIndex: i };
    }
  }
  return best;
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function bfsRoomPath(adjacency: Map<number, number[]>, start: number, goal: number): number[] | null {
  if (start === goal) return [start];
  const q: number[] = [start];
  const prev = new Map<number, number>();
  const seen = new Set<number>([start]);

  while (q.length > 0) {
    const cur = q.shift();
    if (cur === undefined) break;
    const next = adjacency.get(cur) ?? [];
    for (const n of next) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, cur);
      if (n === goal) {
        const out: number[] = [goal];
        let p = cur;
        out.push(p);
        while (p !== start) {
          const pp = prev.get(p);
          if (pp === undefined) break;
          p = pp;
          out.push(p);
        }
        return out.reverse();
      }
      q.push(n);
    }
  }
  return null;
}
