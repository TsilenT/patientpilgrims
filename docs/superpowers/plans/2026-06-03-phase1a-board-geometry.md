# Board Geometry & Toolchain Implementation Plan (Phase 1a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the TypeScript/Vitest toolchain and build a pure, fully-tested board-geometry module (hex/vertex/edge coordinate system, adjacency, random + fixed board generation, ports) that later engine phases build on.

**Architecture:** A pure, dependency-free `board/` module plus a small `engine/rng.ts` utility. Hexes use cube coordinates; vertices and edges get canonical integer keys derived from the cube coordinates of the hexes that meet at them, so shared corners/edges deduplicate exactly with no floating-point rounding. No React, no Firebase, no DOM — everything here is a deterministic pure function and is unit-tested.

**Tech Stack:** Node.js (LTS), TypeScript, Vitest. Windows host.

**Scope note:** This plan deliberately contains **no game rules** (no turns, building, trading, etc.). It produces only the board topology + tile/number/port assignment. That keeps it independently testable and reusable by every later phase. Reference spec: `docs/superpowers/specs/2026-06-03-catan-async-design.md` (sections 3 "board/", 7 "board generation").

**Known Catan topology invariants used as test anchors:** 19 hexes, 54 vertices (settlement spots), 72 edges (road spots), 30 coastal/border edges. Tile bag: 4 wood, 4 sheep, 4 wheat, 3 brick, 3 ore, 1 desert. Number bag (18 tokens): 2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12.

---

## File structure

```
package.json
tsconfig.json
vitest.config.ts
src/
  engine/
    rng.ts                # Rng interface + seeded (mulberry32) + crypto impls
  board/
    coords.ts             # cube coords, directions, vertex/edge keys, pixel mapping
    topology.ts           # buildTopology(): adjacency graph (hexes/vertices/edges)
    constants.ts          # tile bag, number bag, pip values, port bag
    generate.ts           # generateRandomBoard / beginnerBoard
    ports.ts              # port placement on coastal edges
    index.ts              # createBoard() public API + Board type
tests/
  engine/rng.test.ts
  board/coords.test.ts
  board/topology.test.ts
  board/constants.test.ts
  board/generate.test.ts
  board/ports.test.ts
  board/index.test.ts
```

Each file has one responsibility. `coords.ts` is pure math; `topology.ts` turns the 19 hexes into an adjacency graph; `generate.ts`/`ports.ts` assign tiles/numbers/ports; `index.ts` composes them.

---

## Task 0: Toolchain bootstrap

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/smoke.test.ts`

- [ ] **Step 1: Install Node.js (one-time, may need the user)**

Check first:

Run: `node --version`
If it prints `v20.x` or newer, skip to Step 2.

If "command not found", install Node LTS. On this Windows machine, in an **elevated** PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
```

If `winget` is unavailable, download the LTS MSI from https://nodejs.org and run it. Then **open a fresh terminal** and verify:

Run: `node --version && npm --version`
Expected: a version line for each (e.g. `v20.18.0` / `10.8.2`).

- [ ] **Step 2: Initialize the package**

Run: `npm init -y`
Then edit `package.json` so its `scripts`, `type`, and metadata read exactly:

```json
{
  "name": "adultingcatan",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Install dev dependencies**

Run: `npm install -D typescript vitest @types/node`
Expected: completes, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 4: Add `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "types": ["node"],
    "lib": ["ES2022"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 6: Add a smoke test** `tests/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the smoke test and typecheck**

Run: `npm run test:run`
Expected: 1 passed.

Run: `npm run typecheck`
Expected: no output, exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts tests/smoke.test.ts
git commit -m "chore: bootstrap TypeScript + Vitest toolchain"
```

---

## Task 1: Seeded RNG utility

**Files:**
- Create: `src/engine/rng.ts`
- Test: `tests/engine/rng.test.ts`

The engine must be pure and deterministic in tests. `Rng` is an injected dependency. `mulberry32` is a tiny, well-known seeded PRNG.

- [ ] **Step 1: Write the failing test** `tests/engine/rng.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { mulberry32, type Rng } from "../../src/engine/rng";

describe("mulberry32 Rng", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a.nextFloat(), a.nextFloat(), a.nextFloat()];
    const seqB = [b.nextFloat(), b.nextFloat(), b.nextFloat()];
    expect(seqA).toEqual(seqB);
  });

  it("nextFloat is in [0, 1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt(n) returns 0..n-1", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it("shuffle is a permutation and deterministic for a seed", () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s1 = mulberry32(42).shuffle([...input]);
    const s2 = mulberry32(42).shuffle([...input]);
    expect(s1).toEqual(s2);
    expect([...s1].sort((a, b) => a - b)).toEqual(input);
    expect(s1).not.toEqual(input); // seed 42 actually reorders
  });

  it("satisfies the Rng interface shape", () => {
    const r: Rng = mulberry32(0);
    expect(typeof r.nextFloat).toBe("function");
    expect(typeof r.nextInt).toBe("function");
    expect(typeof r.shuffle).toBe("function");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/engine/rng.test.ts`
Expected: FAIL — cannot find module `../../src/engine/rng`.

- [ ] **Step 3: Implement** `src/engine/rng.ts`

```ts
export interface Rng {
  /** float in [0, 1) */
  nextFloat(): number;
  /** integer in [0, maxExclusive) */
  nextInt(maxExclusive: number): number;
  /** Fisher–Yates shuffle, mutates and returns the array */
  shuffle<T>(arr: T[]): T[];
}

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  const nextFloat = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nextInt = (maxExclusive: number): number =>
    Math.floor(nextFloat() * maxExclusive);
  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = nextInt(i + 1);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  };
  return { nextFloat, nextInt, shuffle };
}

/** Production RNG seeded from crypto; not deterministic. */
export function cryptoRng(): Rng {
  const seed = (globalThis.crypto?.getRandomValues(new Uint32Array(1))[0]) ?? (Date.now() >>> 0);
  return mulberry32(seed);
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/engine/rng.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts tests/engine/rng.test.ts
git commit -m "feat(engine): seeded mulberry32 Rng utility"
```

---

## Task 2: Cube coordinates and the 19 hexes

**Files:**
- Create: `src/board/coords.ts`
- Test: `tests/board/coords.test.ts`

- [ ] **Step 1: Write the failing test** `tests/board/coords.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { boardHexes, cubeAdd, cubeKey, DIRECTIONS, type Cube } from "../../src/board/coords";

describe("cube coordinates", () => {
  it("DIRECTIONS has 6 unit vectors summing to zero each", () => {
    expect(DIRECTIONS).toHaveLength(6);
    for (const d of DIRECTIONS) expect(d.x + d.y + d.z).toBe(0);
  });

  it("opposite directions cancel", () => {
    for (let i = 0; i < 6; i++) {
      const a = DIRECTIONS[i]!;
      const b = DIRECTIONS[(i + 3) % 6]!;
      expect(cubeAdd(a, b)).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it("boardHexes(2) returns 19 unique hexes with x+y+z===0", () => {
    const hexes = boardHexes(2);
    expect(hexes).toHaveLength(19);
    const keys = new Set(hexes.map(cubeKey));
    expect(keys.size).toBe(19);
    for (const h of hexes) {
      expect(h.x + h.y + h.z).toBe(0);
      expect(Math.max(Math.abs(h.x), Math.abs(h.y), Math.abs(h.z))).toBeLessThanOrEqual(2);
    }
    expect(keys.has("0,0,0")).toBe(true);
  });

  it("cubeKey round-trips uniquely", () => {
    const a: Cube = { x: 1, y: -1, z: 0 };
    const b: Cube = { x: 1, y: 0, z: -1 };
    expect(cubeKey(a)).not.toEqual(cubeKey(b));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/board/coords.test.ts`
Expected: FAIL — cannot find module `../../src/board/coords`.

- [ ] **Step 3: Implement (partial)** `src/board/coords.ts`

```ts
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
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/board/coords.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/board/coords.ts tests/board/coords.test.ts
git commit -m "feat(board): cube coordinate system and 19-hex board"
```

---

## Task 3: Vertex & edge keys + pixel mapping

**Files:**
- Modify: `src/board/coords.ts` (append functions)
- Test: `tests/board/coords.test.ts` (append a describe block)

Canonical keys: a vertex shared by up to 3 hexes is keyed by `3*hex + dir[i] + dir[i+1]` (the sum of the 3 surrounding lattice hexes — identical from every hex that touches it). An edge shared by up to 2 hexes is keyed by `2*hex + dir[i]` (the sum of the 2 lattice hexes — identical from both). Pixel positions divide those scaled keys back down (by 3 and 2 respectively) and apply the pointy-top projection.

- [ ] **Step 1: Append the failing test** to `tests/board/coords.test.ts`

```ts
import {
  hexVertices, hexEdges, edgeEndpoints, vertexPixel, edgePixel, hexPixel,
} from "../../src/board/coords";

describe("vertex/edge keys", () => {
  it("each hex yields 6 distinct vertices and 6 distinct edges", () => {
    const h = { x: 0, y: 0, z: 0 };
    expect(new Set(hexVertices(h)).size).toBe(6);
    expect(new Set(hexEdges(h)).size).toBe(6);
  });

  it("adjacent hexes share exactly 2 vertices and 1 edge", () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: -1, z: 0 }; // DIRECTIONS[0] neighbor
    const sharedV = hexVertices(a).filter((v) => hexVertices(b).includes(v));
    const sharedE = hexEdges(a).filter((e) => hexEdges(b).includes(e));
    expect(sharedV).toHaveLength(2);
    expect(sharedE).toHaveLength(1);
  });

  it("each edge of a hex has 2 endpoints that are vertices of that hex", () => {
    const h = { x: 0, y: 0, z: 0 };
    const verts = new Set(hexVertices(h));
    for (let i = 0; i < 6; i++) {
      const ends = edgeEndpoints(h, i);
      expect(ends).toHaveLength(2);
      for (const v of ends) expect(verts.has(v)).toBe(true);
    }
  });

  it("pixel helpers return finite coordinates", () => {
    const h = { x: 0, y: 0, z: 0 };
    for (const p of [hexPixel(h), vertexPixel(hexVertices(h)[0]!), edgePixel(hexEdges(h)[0]!)]) {
      expect(Number.isFinite(p.px)).toBe(true);
      expect(Number.isFinite(p.py)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/board/coords.test.ts`
Expected: FAIL — `hexVertices` is not exported.

- [ ] **Step 3: Append implementation** to `src/board/coords.ts`

```ts
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
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/board/coords.test.ts`
Expected: all passed (4 + 4).

- [ ] **Step 5: Commit**

```bash
git add src/board/coords.ts tests/board/coords.test.ts
git commit -m "feat(board): canonical vertex/edge keys and pixel projection"
```

---

## Task 4: Board topology (adjacency graph)

**Files:**
- Create: `src/board/topology.ts`
- Test: `tests/board/topology.test.ts`

Composes the per-hex keys into deduplicated global sets with adjacency maps.

- [ ] **Step 1: Write the failing test** `tests/board/topology.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildTopology } from "../../src/board/topology";

describe("board topology", () => {
  const topo = buildTopology();

  it("has 19 hexes, 54 vertices, 72 edges", () => {
    expect(topo.hexIds).toHaveLength(19);
    expect(topo.vertexIds).toHaveLength(54);
    expect(topo.edgeIds).toHaveLength(72);
  });

  it("has 30 coastal (border) edges", () => {
    const border = topo.edgeIds.filter((e) => topo.edgeHexes.get(e)!.length === 1);
    expect(border).toHaveLength(30);
  });

  it("every edge connects two vertices that are also neighbor vertices", () => {
    for (const e of topo.edgeIds) {
      const [a, b] = topo.edgeVertices.get(e)!;
      expect(topo.vertexNeighbors.get(a)!).toContain(b);
      expect(topo.vertexNeighbors.get(b)!).toContain(a);
    }
  });

  it("adjacency is symmetric and bounded (vertices touch <=3 hexes, <=3 edges, <=3 neighbors)", () => {
    for (const v of topo.vertexIds) {
      expect(topo.vertexHexes.get(v)!.length).toBeLessThanOrEqual(3);
      expect(topo.vertexEdges.get(v)!.length).toBeLessThanOrEqual(3);
      expect(topo.vertexNeighbors.get(v)!.length).toBeLessThanOrEqual(3);
    }
    // center hex's 6 vertices are all interior (touch 3 hexes)
    const center = topo.hexVertices.get("0,0,0")!;
    for (const v of center) expect(topo.vertexHexes.get(v)!.length).toBe(3);
  });

  it("edge incidence accounting matches 2*interior + border = 19*6", () => {
    const interior = topo.edgeIds.filter((e) => topo.edgeHexes.get(e)!.length === 2).length;
    const border = topo.edgeIds.length - interior;
    expect(2 * interior + border).toBe(19 * 6);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/board/topology.test.ts`
Expected: FAIL — cannot find module `../../src/board/topology`.

- [ ] **Step 3: Implement** `src/board/topology.ts`

```ts
import {
  boardHexes, cubeKey, hexVertices, hexEdges, edgeEndpoints, type Cube,
} from "./coords";

export interface BoardTopology {
  hexIds: string[];
  vertexIds: string[];
  edgeIds: string[];
  hexVertices: Map<string, string[]>;   // hexId -> 6 vertexIds
  hexEdges: Map<string, string[]>;      // hexId -> 6 edgeIds
  vertexHexes: Map<string, string[]>;   // vertexId -> 1..3 hexIds (on-board)
  vertexEdges: Map<string, string[]>;   // vertexId -> incident edgeIds
  vertexNeighbors: Map<string, string[]>; // vertexId -> adjacent vertexIds
  edgeVertices: Map<string, [string, string]>; // edgeId -> its 2 endpoints
  edgeHexes: Map<string, string[]>;     // edgeId -> 1..2 hexIds (on-board)
}

function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key) ?? [];
  if (!arr.includes(value)) arr.push(value);
  map.set(key, arr);
}

export function buildTopology(radius = 2): BoardTopology {
  const hexes: Cube[] = boardHexes(radius);
  const hexIdSet = new Set(hexes.map(cubeKey));

  const hexVertexMap = new Map<string, string[]>();
  const hexEdgeMap = new Map<string, string[]>();
  const vertexHexes = new Map<string, string[]>();
  const vertexEdges = new Map<string, string[]>();
  const vertexNeighbors = new Map<string, string[]>();
  const edgeVertices = new Map<string, [string, string]>();
  const edgeHexes = new Map<string, string[]>();

  for (const h of hexes) {
    const hid = cubeKey(h);
    const vs = hexVertices(h);
    const es = hexEdges(h);
    hexVertexMap.set(hid, vs);
    hexEdgeMap.set(hid, es);
    for (const v of vs) pushUnique(vertexHexes, v, hid);
    for (let i = 0; i < 6; i++) {
      const e = es[i]!;
      pushUnique(edgeHexes, e, hid);
      const [a, b] = edgeEndpoints(h, i);
      edgeVertices.set(e, [a, b]);
      pushUnique(vertexEdges, a, e);
      pushUnique(vertexEdges, b, e);
      pushUnique(vertexNeighbors, a, b);
      pushUnique(vertexNeighbors, b, a);
    }
  }

  // Drop incident hexes that are off-board (keep only real board hexes).
  for (const [v, hs] of vertexHexes) vertexHexes.set(v, hs.filter((h) => hexIdSet.has(h)));
  for (const [e, hs] of edgeHexes) edgeHexes.set(e, hs.filter((h) => hexIdSet.has(h)));

  return {
    hexIds: [...hexIdSet],
    vertexIds: [...vertexHexes.keys()],
    edgeIds: [...edgeVertices.keys()],
    hexVertices: hexVertexMap,
    hexEdges: hexEdgeMap,
    vertexHexes,
    vertexEdges,
    vertexNeighbors,
    edgeVertices,
    edgeHexes,
  };
}
```

> Note: `vertexHexes`/`edgeHexes` are accumulated from on-board hexes only, so off-board incidences never appear — the filter is a belt-and-suspenders guard. `vertexIds`/`edgeIds` come from maps populated solely by board hexes, giving exactly 54/72.

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/board/topology.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/board/topology.ts tests/board/topology.test.ts
git commit -m "feat(board): adjacency topology (19/54/72) with invariant tests"
```

---

## Task 5: Tile / number / port constants

**Files:**
- Create: `src/board/constants.ts`
- Test: `tests/board/constants.test.ts`

- [ ] **Step 1: Write the failing test** `tests/board/constants.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  RESOURCES, TILE_BAG, NUMBER_BAG, PIP, PORT_BAG, type Resource,
} from "../../src/board/constants";

describe("board constants", () => {
  it("has the 5 resources", () => {
    expect([...RESOURCES].sort()).toEqual(["brick", "ore", "sheep", "wheat", "wood"]);
  });

  it("tile bag is 19 tiles with correct counts", () => {
    expect(TILE_BAG).toHaveLength(19);
    const count = (r: Resource | "desert") => TILE_BAG.filter((t) => t === r).length;
    expect(count("wood")).toBe(4);
    expect(count("sheep")).toBe(4);
    expect(count("wheat")).toBe(4);
    expect(count("brick")).toBe(3);
    expect(count("ore")).toBe(3);
    expect(count("desert")).toBe(1);
  });

  it("number bag is the 18 standard tokens", () => {
    expect([...NUMBER_BAG].sort((a, b) => a - b)).toEqual(
      [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
    );
  });

  it("pip values follow distance-from-7", () => {
    expect(PIP[2]).toBe(1);
    expect(PIP[6]).toBe(5);
    expect(PIP[8]).toBe(5);
    expect(PIP[12]).toBe(1);
    expect(PIP[7]).toBe(0);
  });

  it("port bag has 4 generic 3:1 and one 2:1 per resource", () => {
    expect(PORT_BAG).toHaveLength(9);
    expect(PORT_BAG.filter((p) => p === "any").length).toBe(4);
    for (const r of RESOURCES) expect(PORT_BAG.filter((p) => p === r).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/board/constants.test.ts`
Expected: FAIL — cannot find module `../../src/board/constants`.

- [ ] **Step 3: Implement** `src/board/constants.ts`

```ts
export const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"] as const;
export type Resource = (typeof RESOURCES)[number];
export type TileKind = Resource | "desert";
export type PortKind = Resource | "any";

export const TILE_BAG: TileKind[] = [
  "wood", "wood", "wood", "wood",
  "sheep", "sheep", "sheep", "sheep",
  "wheat", "wheat", "wheat", "wheat",
  "brick", "brick", "brick",
  "ore", "ore", "ore",
  "desert",
];

export const NUMBER_BAG: number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
];

/** Dots on the number token = ways to roll it = 6 - |7 - n|. */
export const PIP: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 0, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

export const PORT_BAG: PortKind[] = [
  "any", "any", "any", "any",
  "wood", "brick", "sheep", "wheat", "ore",
];
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/board/constants.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/board/constants.ts tests/board/constants.test.ts
git commit -m "feat(board): tile/number/pip/port constants"
```

---

## Task 6: Tile + number assignment (random and beginner)

**Files:**
- Create: `src/board/generate.ts`
- Test: `tests/board/generate.test.ts`

`generateRandomBoard` shuffles the tile bag onto the 19 hexes, places the robber on the desert, and assigns the 18 number tokens to the 18 non-desert hexes. It retries (bounded) until no two red tokens (6/8) are adjacent. `beginnerBoard` returns a fixed valid layout (a deterministic reference layout — not claimed to be the exact printed setup, but with correct distributions).

- [ ] **Step 1: Write the failing test** `tests/board/generate.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../../src/engine/rng";
import { generateRandomBoard, beginnerBoard, type TileAssignment } from "../../src/board/generate";
import { buildTopology } from "../../src/board/topology";
import { PIP } from "../../src/board/constants";

const topo = buildTopology();

function check(board: TileAssignment): void {
  expect(Object.keys(board.tiles)).toHaveLength(19);
  const kinds = Object.values(board.tiles).map((t) => t.kind);
  expect(kinds.filter((k) => k === "desert")).toHaveLength(1);
  // exactly the 18 non-desert hexes have numbers
  const numbered = Object.values(board.tiles).filter((t) => t.number !== undefined);
  expect(numbered).toHaveLength(18);
  // desert has the robber, and no number
  const desert = Object.entries(board.tiles).find(([, t]) => t.kind === "desert")!;
  expect(board.robber).toBe(desert[0]);
  expect(desert[1].number).toBeUndefined();
}

function noAdjacentReds(board: TileAssignment): boolean {
  for (const hid of topo.hexIds) {
    const n = board.tiles[hid]!.number;
    if (n === undefined || PIP[n] !== 5) continue;
    for (const other of topo.hexIds) {
      if (other === hid) continue;
      const shareEdge = topo.hexEdges.get(hid)!.some((e) => topo.hexEdges.get(other)!.includes(e));
      if (!shareEdge) continue;
      const m = board.tiles[other]!.number;
      if (m !== undefined && PIP[m] === 5) return false;
    }
  }
  return true;
}

describe("generateRandomBoard", () => {
  it("produces a structurally valid board", () => {
    check(generateRandomBoard(mulberry32(1)));
  });

  it("is deterministic for a seed", () => {
    expect(generateRandomBoard(mulberry32(99))).toEqual(generateRandomBoard(mulberry32(99)));
  });

  it("never places two red (6/8) tokens on adjacent hexes", () => {
    for (let seed = 0; seed < 25; seed++) {
      expect(noAdjacentReds(generateRandomBoard(mulberry32(seed)))).toBe(true);
    }
  });
});

describe("beginnerBoard", () => {
  it("is a valid, fixed board", () => {
    check(beginnerBoard());
    expect(beginnerBoard()).toEqual(beginnerBoard());
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/board/generate.test.ts`
Expected: FAIL — cannot find module `../../src/board/generate`.

- [ ] **Step 3: Implement** `src/board/generate.ts`

```ts
import { buildTopology } from "./topology";
import { TILE_BAG, NUMBER_BAG, PIP, type TileKind } from "./constants";
import type { Rng } from "../engine/rng";

export interface Tile {
  kind: TileKind;
  number?: number; // undefined on desert
}

export interface TileAssignment {
  tiles: Record<string, Tile>; // hexId -> Tile
  robber: string;              // hexId holding the robber (starts on desert)
}

const topo = buildTopology();

function adjacentHexes(hid: string): string[] {
  const myEdges = topo.hexEdges.get(hid)!;
  return topo.hexIds.filter(
    (o) => o !== hid && topo.hexEdges.get(o)!.some((e) => myEdges.includes(e))
  );
}

function hasAdjacentReds(tiles: Record<string, Tile>): boolean {
  for (const hid of topo.hexIds) {
    const n = tiles[hid]!.number;
    if (n === undefined || PIP[n] !== 5) continue;
    for (const o of adjacentHexes(hid)) {
      const m = tiles[o]!.number;
      if (m !== undefined && PIP[m] === 5) return true;
    }
  }
  return false;
}

function assignOnce(rng: Rng): TileAssignment {
  const hexIds = topo.hexIds;
  const kinds = rng.shuffle([...TILE_BAG]);
  const numbers = rng.shuffle([...NUMBER_BAG]);

  const tiles: Record<string, Tile> = {};
  let robber = "";
  let numCursor = 0;
  hexIds.forEach((hid, i) => {
    const kind = kinds[i]!;
    if (kind === "desert") {
      tiles[hid] = { kind };
      robber = hid;
    } else {
      tiles[hid] = { kind, number: numbers[numCursor++]! };
    }
  });
  return { tiles, robber };
}

export function generateRandomBoard(rng: Rng): TileAssignment {
  for (let attempt = 0; attempt < 200; attempt++) {
    const board = assignOnce(rng);
    if (!hasAdjacentReds(board.tiles)) return board;
  }
  // Extremely unlikely; return last attempt rather than loop forever.
  return assignOnce(rng);
}

// A fixed, deterministic reference layout (correct distributions).
// hexIds order is the deterministic output of boardHexes(2).
export function beginnerBoard(): TileAssignment {
  const hexIds = topo.hexIds;
  const layout: Tile[] = [
    { kind: "ore", number: 10 }, { kind: "sheep", number: 2 }, { kind: "wood", number: 9 },
    { kind: "wheat", number: 12 }, { kind: "brick", number: 6 }, { kind: "sheep", number: 4 },
    { kind: "brick", number: 10 }, { kind: "wheat", number: 9 }, { kind: "wood", number: 11 },
    { kind: "desert" }, { kind: "wood", number: 3 }, { kind: "ore", number: 8 },
    { kind: "sheep", number: 8 }, { kind: "ore", number: 3 }, { kind: "wheat", number: 4 },
    { kind: "sheep", number: 5 }, { kind: "brick", number: 5 }, { kind: "wheat", number: 6 },
    { kind: "wood", number: 11 },
  ];
  const tiles: Record<string, Tile> = {};
  let robber = "";
  hexIds.forEach((hid, i) => {
    const t = layout[i]!;
    tiles[hid] = t.number === undefined ? { kind: t.kind } : { kind: t.kind, number: t.number };
    if (t.kind === "desert") robber = hid;
  });
  return { tiles, robber };
}
```

> If `beginnerBoard` ever needs to satisfy `noAdjacentReds`, adjust the fixed `layout` array — the test only requires structural validity, not the red-adjacency rule, for the fixed board.

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/board/generate.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/board/generate.ts tests/board/generate.test.ts
git commit -m "feat(board): random + fixed tile/number assignment with red-adjacency guard"
```

---

## Task 7: Port placement

**Files:**
- Create: `src/board/ports.ts`
- Test: `tests/board/ports.test.ts`

Ports sit on coastal edges. We order the 30 border edges clockwise by the angle of their pixel midpoint, then place the 9 ports on evenly-spaced indices. Each port records its edge, the edge's 2 vertices (where a settlement may use it), and its kind. (Positions are a valid fixed placement; swap for the exact printed positions later if desired.)

- [ ] **Step 1: Write the failing test** `tests/board/ports.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { placePorts, type Port } from "../../src/board/ports";
import { buildTopology } from "../../src/board/topology";
import { PORT_BAG } from "../../src/board/constants";

const topo = buildTopology();

describe("placePorts", () => {
  const ports = placePorts();

  it("places exactly 9 ports", () => {
    expect(ports).toHaveLength(9);
  });

  it("uses the full port bag", () => {
    expect(ports.map((p) => p.kind).sort()).toEqual([...PORT_BAG].sort());
  });

  it("each port is on a distinct coastal (border) edge", () => {
    const edges = new Set(ports.map((p) => p.edge));
    expect(edges.size).toBe(9);
    for (const p of ports) {
      expect(topo.edgeHexes.get(p.edge)!.length).toBe(1); // coastal
    }
  });

  it("each port references the 2 real endpoints of its edge", () => {
    for (const p of ports) {
      expect(p.vertices.length).toBe(2);
      expect(new Set(topo.edgeVertices.get(p.edge)!)).toEqual(new Set(p.vertices));
    }
  });

  it("is deterministic", () => {
    expect(placePorts()).toEqual(placePorts());
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/board/ports.test.ts`
Expected: FAIL — cannot find module `../../src/board/ports`.

- [ ] **Step 3: Implement** `src/board/ports.ts`

```ts
import { buildTopology } from "./topology";
import { edgePixel } from "./coords";
import { PORT_BAG, type PortKind } from "./constants";

export interface Port {
  edge: string;
  vertices: [string, string];
  kind: PortKind;
}

const topo = buildTopology();

export function placePorts(): Port[] {
  const border = topo.edgeIds.filter((e) => topo.edgeHexes.get(e)!.length === 1);
  // Order clockwise around the coast by midpoint angle (stable tiebreak on key).
  const ordered = [...border].sort((a, b) => {
    const pa = edgePixel(a);
    const pb = edgePixel(b);
    const aa = Math.atan2(pa.py, pa.px);
    const ab = Math.atan2(pb.py, pb.px);
    return aa - ab || (a < b ? -1 : 1);
  });

  const ports: Port[] = [];
  for (let i = 0; i < PORT_BAG.length; i++) {
    const idx = Math.floor((i * ordered.length) / PORT_BAG.length);
    const edge = ordered[idx]!;
    ports.push({
      edge,
      vertices: topo.edgeVertices.get(edge)!,
      kind: PORT_BAG[i]! as PortKind,
    });
  }
  return ports;
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/board/ports.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/board/ports.ts tests/board/ports.test.ts
git commit -m "feat(board): coastal port placement"
```

---

## Task 8: Public board API + index

**Files:**
- Create: `src/board/index.ts`
- Test: `tests/board/index.test.ts`

Composes topology + tile assignment + ports into one `Board` and exposes `createBoard`.

- [ ] **Step 1: Write the failing test** `tests/board/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createBoard, type Board } from "../../src/board";
import { mulberry32 } from "../../src/engine/rng";

function assertWellFormed(board: Board): void {
  expect(board.topology.hexIds).toHaveLength(19);
  expect(board.topology.vertexIds).toHaveLength(54);
  expect(board.topology.edgeIds).toHaveLength(72);
  expect(Object.keys(board.tiles)).toHaveLength(19);
  expect(board.ports).toHaveLength(9);
  expect(board.topology.hexIds).toContain(board.robber); // robber on a real hex
}

describe("createBoard", () => {
  it("creates a random board deterministically from an rng", () => {
    const a = createBoard({ mode: "random", rng: mulberry32(5) });
    const b = createBoard({ mode: "random", rng: mulberry32(5) });
    assertWellFormed(a);
    expect(a.tiles).toEqual(b.tiles);
  });

  it("creates the fixed beginner board", () => {
    const a = createBoard({ mode: "beginner" });
    assertWellFormed(a);
    expect(a.tiles).toEqual(createBoard({ mode: "beginner" }).tiles);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/board/index.test.ts`
Expected: FAIL — cannot find module `../../src/board`.

- [ ] **Step 3: Implement** `src/board/index.ts`

```ts
import { buildTopology, type BoardTopology } from "./topology";
import { generateRandomBoard, beginnerBoard, type Tile } from "./generate";
import { placePorts, type Port } from "./ports";
import type { Rng } from "../engine/rng";

export type { BoardTopology } from "./topology";
export type { Tile, TileAssignment } from "./generate";
export type { Port } from "./ports";
export * from "./coords";
export * from "./constants";

export interface Board {
  topology: BoardTopology;
  tiles: Record<string, Tile>;
  robber: string;
  ports: Port[];
}

export type CreateBoardOptions =
  | { mode: "random"; rng: Rng }
  | { mode: "beginner" };

export function createBoard(opts: CreateBoardOptions): Board {
  const assignment = opts.mode === "random" ? generateRandomBoard(opts.rng) : beginnerBoard();
  return {
    topology: buildTopology(),
    tiles: assignment.tiles,
    robber: assignment.robber,
    ports: placePorts(),
  };
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/board/index.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm run test:run`
Expected: all test files pass (smoke, rng, coords, topology, constants, generate, ports, index).

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/board/index.ts tests/board/index.test.ts
git commit -m "feat(board): createBoard public API composing topology, tiles, ports"
```

---

## Done criteria

- `npm run test:run` and `npm run typecheck` both green.
- `createBoard({ mode: "random", rng })` and `createBoard({ mode: "beginner" })` return a `Board` with 19 hexes / 54 vertices / 72 edges / 9 ports, robber on the desert, correct tile and number distributions, and (random mode) no adjacent red tokens.
- No game-rule logic exists yet — that is the next plan (Phase 1b: setup, dice/production, building), which imports `createBoard` and the `BoardTopology` adjacency maps from this module.
