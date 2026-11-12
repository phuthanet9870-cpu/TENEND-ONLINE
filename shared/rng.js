// Deterministic RNG helpers (map generation is identical on client and server)
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rngFrom = (seed) => mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export function weighted(rng, entries) { // [[value, weight], ...]
  let total = 0; for (const e of entries) total += e[1];
  let r = rng() * total;
  for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
  return entries[entries.length - 1][0];
}
