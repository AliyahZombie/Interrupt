import type { Tile } from '../Entities';
import type { CircleBody } from './Collisions';

export interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class TileSpatialIndex {
  private tiles: readonly Tile[] = [];
  private readonly cellSize: number;
  private readonly bigTileMaxCells: number;

  private readonly grid = new Map<string, number[]>();
  private readonly bigTileIndices: number[] = [];

  constructor(options?: { cellSize?: number; bigTileMaxCells?: number }) {
    this.cellSize = options?.cellSize ?? 128;
    this.bigTileMaxCells = options?.bigTileMaxCells ?? 64;
  }

  rebuild(tiles: readonly Tile[]) {
    this.tiles = tiles;
    this.grid.clear();
    this.bigTileIndices.length = 0;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const aabb = tileAabb(t);
      const { minCx, minCy, maxCx, maxCy } = this.cellRangeForAabb(aabb);
      const cellCount = (maxCx - minCx + 1) * (maxCy - minCy + 1);
      if (cellCount > this.bigTileMaxCells) {
        this.bigTileIndices.push(i);
        continue;
      }
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = `${cx},${cy}`;
          const arr = this.grid.get(key);
          if (arr) {
            arr.push(i);
          } else {
            this.grid.set(key, [i]);
          }
        }
      }
    }
  }

  queryCircle(circle: CircleBody): number[] {
    const aabb: Aabb = {
      minX: circle.x - circle.radius,
      minY: circle.y - circle.radius,
      maxX: circle.x + circle.radius,
      maxY: circle.y + circle.radius,
    };
    return this.queryAabb(aabb);
  }

  queryTile(tile: Tile): number[] {
    return this.queryAabb(tileAabb(tile));
  }

  queryAabb(aabb: Aabb): number[] {
    if (this.tiles.length === 0) return [];

    const { minCx, minCy, maxCx, maxCy } = this.cellRangeForAabb(aabb);

    const idx = new Set<number>();
    for (const i of this.bigTileIndices) idx.add(i);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.grid.get(`${cx},${cy}`);
        if (!arr) continue;
        for (const i of arr) idx.add(i);
      }
    }

    const out = Array.from(idx);
    out.sort((a, b) => a - b);
    return out;
  }

  private cellRangeForAabb(aabb: Aabb): { minCx: number; minCy: number; maxCx: number; maxCy: number } {
    const minCx = Math.floor(aabb.minX / this.cellSize);
    const minCy = Math.floor(aabb.minY / this.cellSize);
    const maxCx = Math.floor(aabb.maxX / this.cellSize);
    const maxCy = Math.floor(aabb.maxY / this.cellSize);
    return { minCx, minCy, maxCx, maxCy };
  }
}

function tileAabb(tile: Tile): Aabb {
  return {
    minX: tile.x - tile.width / 2,
    minY: tile.y - tile.height / 2,
    maxX: tile.x + tile.width / 2,
    maxY: tile.y + tile.height / 2,
  };
}
