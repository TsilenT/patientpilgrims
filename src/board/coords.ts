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

/** Vertex key for corner i (between DIRECTIONS[i] and DIRECTIONS[i+1]), scaled x3. */
export function vertexKeyAt(hex: Cube, i: number): string {
  const d1 = DIRECTIONS[i % 6]!;
  const d2 = DIRECTIONS[(i + 1) % 6]!;
  return cubeKey({
    x: hex.x * 3 + d1.x + d2.x,
    y: hex.y * 3 + d1.y + d2.y,
    z: hex.z * 3 + d1.z + d2.z,
  });
}

/** Edge key for side i (toward DIRECTIONS[i]), scaled x2. */
export function edgeKeyAt(hex: Cube, i: number): string {
  const d = DIRECTIONS[i % 6]!;
  return cubeKey({ x: hex.x * 2 + d.x, y: hex.y * 2 + d.y, z: hex.z * 2 + d.z });
}

export function hexVertices(hex: Cube): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => vertexKeyAt(hex, i));
}

export function hexEdges(hex: Cube): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => edgeKeyAt(hex, i));
}

/** Edge i connects corner (i-1) and corner i. */
export function edgeEndpoints(hex: Cube, i: number): [string, string] {
  return [vertexKeyAt(hex, (i + 5) % 6), vertexKeyAt(hex, i)];
}

export interface Pixel {
  px: number;
  py: number;
}

const HEX_SIZE = 1; // unit size; scale in the UI layer later

function cubeToPixel(c: Cube, size = HEX_SIZE): Pixel {
  const q = c.x;
  const r = c.z;
  return {
    px: size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    py: size * ((3 / 2) * r),
  };
}

export function hexPixel(hex: Cube): Pixel {
  return cubeToPixel(hex);
}

/** Vertex key is a x3-scaled cube; divide back to a fractional hex, then project. */
export function vertexPixel(key: string): Pixel {
  const c = parseKey(key);
  return cubeToPixel({ x: c.x / 3, y: c.y / 3, z: c.z / 3 });
}

/** Edge key is a x2-scaled cube; divide back, then project. */
export function edgePixel(key: string): Pixel {
  const c = parseKey(key);
  return cubeToPixel({ x: c.x / 2, y: c.y / 2, z: c.z / 2 });
}
