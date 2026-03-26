import { getPortalSvgDataUrl } from '../assets/portalSvg';
import { Interactable } from './interactables/Interactable';

export class Portal extends Interactable {
  readonly kind = 'PORTAL' as const;
  readonly interactionMode = 'AUTO' as const;
  readonly radius: number;
  readonly name = 'PORTAL';

  constructor(
    public x: number,
    public y: number,
    public spawnTime: number,
    id?: string,
  ) {
    super(x, y, spawnTime, id);
    this.radius = 34;
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    const wobble = 1 + Math.sin(time * 3) * 0.05;
    const size = this.radius * 2.8 * wobble;
    const img = getPortalImage();

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(time * 0.55);

    if (img.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = 0.96;
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.globalAlpha = 1;
    } else {
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * wobble, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

let portalImage: HTMLImageElement | null = null;

function getPortalImage(): HTMLImageElement {
  if (portalImage) return portalImage;
  const img = new Image();
  img.decoding = 'async';
  img.src = getPortalSvgDataUrl();
  portalImage = img;
  return img;
}
