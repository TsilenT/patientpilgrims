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
