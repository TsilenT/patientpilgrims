/** A crypto-backed 32-bit seed for mulberry32. Generated once per networked dispatch. */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
    return buf[0]!;
  }
  return (Date.now() >>> 0) ^ (Math.floor(Math.random() * 0xffffffff) >>> 0);
}
