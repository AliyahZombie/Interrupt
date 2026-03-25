import type { Rect, WorldLayout, WorldSizing } from './types';
import { createLinearDungeonLayout } from './layout';

export type DungeonStage = 'COMBAT' | 'REWARD' | 'PORTAL';

export interface DungeonNavigationPath {
  points: { x: number; y: number }[];
}

export class DungeonManager {
  private readonly sizing: WorldSizing;
  private worldIndex = 0;
  private layout: WorldLayout;
  private stage: DungeonStage = 'COMBAT';
  private combatCleared = false;
  private healCollected = false;

  constructor(sizing: WorldSizing) {
    this.sizing = sizing;
    this.layout = createLinearDungeonLayout(0, sizing);
  }

  resetRun() {
    this.worldIndex = 0;
    this.layout = createLinearDungeonLayout(this.worldIndex, this.sizing);
    this.stage = 'COMBAT';
    this.combatCleared = false;
    this.healCollected = false;
  }

  getWorldIndex(): number {
    return this.worldIndex;
  }

  getLayout(): WorldLayout {
    return this.layout;
  }

  getStage(): DungeonStage {
    return this.stage;
  }

  getCombatRect(): Rect {
    return this.getRoomRect('COMBAT');
  }

  getRewardRect(): Rect {
    return this.getRoomRect('REWARD');
  }

  getPortalRect(): Rect {
    return this.getRoomRect('PORTAL');
  }

  isCombatCleared(): boolean {
    return this.combatCleared;
  }

  isHealCollected(): boolean {
    return this.healCollected;
  }

  setCombatCleared() {
    this.combatCleared = true;
  }

  setHealCollected() {
    this.healCollected = true;
  }

  updateStage(playerX: number, playerY: number) {
    const reward = this.getRewardRect();
    const portal = this.getPortalRect();

    if (this.stage === 'COMBAT' && this.combatCleared) {
      if (pointInRect(playerX, playerY, reward)) {
        this.stage = 'REWARD';
      }
      return;
    }

    if (this.stage === 'REWARD' && this.healCollected) {
      if (pointInRect(playerX, playerY, portal)) {
        this.stage = 'PORTAL';
      }
    }
  }

  advanceWorld() {
    this.worldIndex += 1;
    this.layout = createLinearDungeonLayout(this.worldIndex, this.sizing);
    this.stage = 'COMBAT';
    this.combatCleared = false;
    this.healCollected = false;
  }

  getNavigationPath(playerX: number, playerY: number): DungeonNavigationPath | null {
    const combat = this.getCombatRect();
    const reward = this.getRewardRect();
    const portal = this.getPortalRect();

    const corridor1 = this.layout.corridors[0];
    const corridor1Mid = { x: corridor1.x + corridor1.width / 2, y: corridor1.y + corridor1.height / 2 };
    const combatExit = roomConnectorPoint(combat, corridor1, 120);
    const rewardCenter = { x: reward.x + reward.width / 2, y: reward.y + reward.height / 2 };

    const corridor2 = this.layout.corridors[1];
    const corridor2Mid = { x: corridor2.x + corridor2.width / 2, y: corridor2.y + corridor2.height / 2 };
    const rewardExit = roomConnectorPoint(reward, corridor2, 120);
    const portalCenter = { x: portal.x + portal.width / 2, y: portal.y + portal.height / 2 };

    if (this.stage === 'COMBAT' && this.combatCleared) {
      return { points: trimPathToPlayer({ x: playerX, y: playerY }, [combatExit, corridor1Mid, rewardCenter]) };
    }

    if (this.stage === 'REWARD' && this.healCollected) {
      return { points: trimPathToPlayer({ x: playerX, y: playerY }, [rewardExit, corridor2Mid, portalCenter]) };
    }

    return null;
  }

  private getRoomRect(kind: 'COMBAT' | 'REWARD' | 'PORTAL'): Rect {
    const room = this.layout.rooms.find(r => r.kind === kind);
    if (!room) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return room.rect;
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
