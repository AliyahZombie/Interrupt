import type { NearbyInteractableEntry } from './Interactable';
import { Interactable } from './Interactable';
import type { Weapon, WeaponQuality } from '../../combat/Weapon';

const QUALITY_COLORS: Record<WeaponQuality, { border: string; borderInner: string; text: string }> = {
  white: { border: '#e5e7eb', borderInner: 'rgba(229, 231, 235, 0.45)', text: 'rgba(255, 255, 255, 0.92)' },
  green: { border: '#22c55e', borderInner: 'rgba(34, 197, 94, 0.45)', text: 'rgba(134, 239, 172, 0.95)' },
  blue: { border: '#3b82f6', borderInner: 'rgba(59, 130, 246, 0.45)', text: 'rgba(147, 197, 253, 0.95)' },
  red: { border: '#ef4444', borderInner: 'rgba(239, 68, 68, 0.45)', text: 'rgba(252, 165, 165, 0.95)' },
};

export class WeaponDrop extends Interactable {
  readonly kind = 'WEAPON_DROP' as const;
  readonly interactionMode = 'MANUAL' as const;
  readonly radius: number;
  readonly name = 'WEAPON';

  constructor(
    x: number,
    y: number,
    spawnTime: number,
    public weapon: Weapon,
    public weaponName: string,
    id?: string,
  ) {
    super(x, y, spawnTime, id);
    this.radius = 18;
  }

  get weaponId(): Weapon['id'] {
    return this.weapon.id;
  }

  get quality(): WeaponQuality {
    return this.weapon.quality;
  }

  getNearbyEntry(playerX: number, playerY: number): NearbyInteractableEntry {
    return {
      id: this.id,
      kind: this.kind,
      title: this.weaponName,
      distance: this.distanceTo(playerX, playerY),
      quality: this.quality,
    };
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, timeSec: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    const colors = QUALITY_COLORS[this.quality];

    const pulse = 1 + Math.sin(timeSec * 5) * 0.08;
    const r = this.radius * pulse;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(timeSec * 0.9);

    ctx.shadowColor = colors.border;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = colors.borderInner;
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
    ctx.fillStyle = colors.text;
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.fillText(this.weaponName, 0, this.radius + 10);
    ctx.restore();
  }
}
