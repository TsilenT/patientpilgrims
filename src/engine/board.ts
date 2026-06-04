import { buildTopology, type BoardTopology } from "../board/topology";

let cached: BoardTopology | undefined;

/** Memoized standard-board topology (radius 2). Deterministic; no randomness. */
export function topology(): BoardTopology {
  return (cached ??= buildTopology());
}
