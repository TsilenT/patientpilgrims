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
