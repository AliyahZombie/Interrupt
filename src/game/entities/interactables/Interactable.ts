export type InteractableKind = 'PORTAL' | 'HEALTH_PICKUP' | 'WEAPON_DROP';

export type InteractableMode = 'AUTO' | 'MANUAL';

export interface NearbyInteractableEntry {
  id: string;
  kind: InteractableKind;
  title: string;
  distance: number;
}

let interactableSeq = 0;

export abstract class Interactable {
  public readonly id: string;

  abstract readonly kind: InteractableKind;
  abstract readonly interactionMode: InteractableMode;
  abstract readonly radius: number;
  abstract readonly name: string;

  constructor(
    public x: number,
    public y: number,
    public spawnTime: number,
    id?: string,
  ) {
    this.id = id ?? `it_${interactableSeq++}`;
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.x - x, this.y - y);
  }

  isOverlappingCircle(x: number, y: number, radius: number): boolean {
    return this.distanceTo(x, y) < this.radius + radius;
  }

  getNearbyListRange(): number {
    return this.radius + 110;
  }

  getNearbyEntry(playerX: number, playerY: number): NearbyInteractableEntry | null {
    return null;
  }

  abstract draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, timeSec: number): void;
}
