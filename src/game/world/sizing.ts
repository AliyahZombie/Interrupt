import type { RoomBounds, ViewportSize, WorldSizing } from './types';

export function createDefaultWorldSizing(getViewportSize: () => ViewportSize): WorldSizing {
  return {
    getViewportSize,
    getRoomBounds: (viewport) => getRoomBoundsForViewport(viewport),
  };
}

export function getRoomBoundsForViewport(viewport: ViewportSize): RoomBounds {
  const minW = Math.max(1800, viewport.width + 800);
  const minH = Math.max(1200, viewport.height + 600);

  const width = roundUpTo(minW, 100);
  const height = roundUpTo(minH, 100);
  return { width, height };
}

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}
