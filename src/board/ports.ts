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
