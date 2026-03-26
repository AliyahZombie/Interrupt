export function computeSpawnEnemyLevel(params: {
  worldIndex: number;
  waveIndex: number;
  rng: () => number;
}): number {
  const worldIndex = Math.max(0, Math.floor(params.worldIndex));
  const waveIndex = Math.max(1, Math.floor(params.waveIndex));

  if (worldIndex <= 0) return 1;

  const maxLevel = Math.min(1 + worldIndex, 8);
  const rawChance = 0.08 + worldIndex * 0.05 + (waveIndex - 1) * 0.01;
  const stepChance = Math.max(0, Math.min(0.4, rawChance));

  let level = 1;
  for (let next = 2; next <= maxLevel; next++) {
    if (params.rng() < stepChance) {
      level = next;
    } else {
      break;
    }
  }
  return level;
}
