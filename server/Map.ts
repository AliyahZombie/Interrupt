export interface MapConfig {
  width: number;
  height: number;
  maxPlayers: number;
  tiles: { x: number, y: number, width: number, height: number, color: string }[];
  portals?: { x: number, y: number, radius: number, targetRoomType: 'city' | 'arena' | 'battlefield', color: string, label: string }[];
}

export const maps: Record<'city' | 'arena' | 'battlefield', MapConfig> = {
  city: {
    width: 2000,
    height: 2000,
    maxPlayers: 50,
    tiles: [
      { x: 1000, y: 1000, width: 400, height: 400, color: '#1e293b' },
      { x: 500, y: 500, width: 200, height: 200, color: '#1e293b' },
      { x: 1500, y: 1500, width: 200, height: 200, color: '#1e293b' },
    ],
    portals: [
      { x: 800, y: 1000, radius: 50, targetRoomType: 'arena', color: '#ef4444', label: 'ARENA (PvP)' },
      { x: 1200, y: 1000, radius: 50, targetRoomType: 'battlefield', color: '#22c55e', label: 'BATTLEFIELD (PvE)' }
    ]
  },
  arena: {
    width: 1500,
    height: 1500,
    maxPlayers: 10,
    tiles: [
      { x: 750, y: 750, width: 300, height: 300, color: '#7f1d1d' },
    ],
    portals: [
      { x: 750, y: 1400, radius: 50, targetRoomType: 'city', color: '#3b82f6', label: 'RETURN TO CITY' }
    ]
  },
  battlefield: {
    width: 3000,
    height: 3000,
    maxPlayers: 20,
    tiles: [
      { x: 1500, y: 1500, width: 500, height: 500, color: '#14532d' },
      { x: 500, y: 2500, width: 300, height: 300, color: '#14532d' },
      { x: 2500, y: 500, width: 300, height: 300, color: '#14532d' },
    ],
    portals: [
      { x: 1500, y: 2800, radius: 50, targetRoomType: 'city', color: '#3b82f6', label: 'RETURN TO CITY' }
    ]
  }
};
