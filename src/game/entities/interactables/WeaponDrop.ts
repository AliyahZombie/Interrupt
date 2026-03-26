import type { NearbyInteractableEntry } from './Interactable';
import { Interactable } from './Interactable';
import type { WeaponId } from '../../combat/Weapon';

export class WeaponDrop extends Interactable {
  readonly kind = 'WEAPON_DROP' as const;
  readonly interactionMode = 'MANUAL' as const;
  readonly radius: number;
  readonly name = 'WEAPON';

  constructor(
    x: number,
    y: number,
    spawnTime: number,
    public weaponId: WeaponId,
    public weaponName: string,
    id?: string,
  ) {
    super(x, y, spawnTime, id);
    this.radius = 18;
  }

  getNearbyEntry(playerX: number, playerY: number): NearbyInteractableEntry {
    return {
      id: this.id,
      kind: this.kind,
      title: this.weaponName,
      distance: this.distanceTo(playerX, playerY),
    };
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, timeSec: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    const pulse = 1 + Math.sin(timeSec * 5) * 0.08;
    const r = this.radius * pulse;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(timeSec * 0.9);

    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, 0);
    ctx.lineTo(r * 0.65, 0);
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.fillText(this.weaponName, 0, this.radius + 10);
    ctx.restore();
  }
}
