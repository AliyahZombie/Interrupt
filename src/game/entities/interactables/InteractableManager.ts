import type { Interactable, NearbyInteractableEntry } from './Interactable';

export class InteractableManager {
  private interactables: Interactable[] = [];

  reset() {
    this.interactables = [];
  }

  get all(): Interactable[] {
    return this.interactables;
  }

  add(interactable: Interactable) {
    this.interactables.push(interactable);
  }

  removeById(id: string): boolean {
    const idx = this.interactables.findIndex(i => i.id === id);
    if (idx < 0) return false;
    this.interactables.splice(idx, 1);
    return true;
  }

  findById(id: string): Interactable | null {
    return this.interactables.find(i => i.id === id) ?? null;
  }

  getNearbyEntries(playerX: number, playerY: number): NearbyInteractableEntry[] {
    const out: NearbyInteractableEntry[] = [];
    for (const it of this.interactables) {
      const dist = it.distanceTo(playerX, playerY);
      if (dist <= it.getNearbyListRange()) {
        const entry = it.getNearbyEntry(playerX, playerY);
        if (entry) {
          out.push(entry);
        }
      }
    }

    out.sort((a, b) => a.distance - b.distance);
    return out;
  }

  getOverlappingEntries(playerX: number, playerY: number, playerRadius: number): NearbyInteractableEntry[] {
    const out: NearbyInteractableEntry[] = [];
    for (const it of this.interactables) {
      if (it.interactionMode !== 'MANUAL') continue;
      if (!it.isOverlappingCircle(playerX, playerY, playerRadius)) continue;
      const entry = it.getNearbyEntry(playerX, playerY);
      if (entry) out.push(entry);
    }

    out.sort((a, b) => a.distance - b.distance);
    return out;
  }
}
