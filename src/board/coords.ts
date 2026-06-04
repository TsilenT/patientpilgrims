export interface Cube {
  x: number;
  y: number;
  z: number;
}

export const DIRECTIONS: readonly Cube[] = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
];

export function cubeAdd(a: Cube, b: Cube): Cube {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function cubeKey(c: Cube): string {
  return `${c.x},${c.y},${c.z}`;
}

export function parseKey(key: string): Cube {
  const [x, y, z] = key.split(",").map(Number);
  return { x: x!, y: y!, z: z! };
}

export function boardHexes(radius = 2): Cube[] {
  const hexes: Cube[] = [];
  for (let x = -radius; x <= radius; x++) {
    const lo = Math.max(-radius, -x - radius);
    const hi = Math.min(radius, -x + radius);
    for (let y = lo; y <= hi; y++) {
      hexes.push({ x, y, z: -x - y });
    }
  }
  return hexes;
}
