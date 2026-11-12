// Verifies the hand-made class kits: every class has 90 actives + 10 ultimates, all names unique,
// every form exists, every modifier is known, and no two skills in the game share form+modifiers+element.
import { KITS, resolvedKits } from '../shared/classkits.js';
import { SIG_BY_ID } from '../shared/signatures.js';
const MODS = new Set('stun burn bleed poison chill freeze shock slow root blind weaken silence fear mark lex sunder knockup knock pull leech heal shield haste execute crit pierce chain fork homing echo detonate linger x2 x3 big wide fast heavy long cleanse aura taunt regen block cdr'.split(' '));
const names = new Map(), combos = new Map(); let errors = 0;
const err = (m) => { errors++; console.log('✖', m); };
const R = resolvedKits();
for (const [cls, kit] of Object.entries(KITS)) {
  if (kit.disc.length !== 9 || kit.disc.some(([, , l]) => l.length !== 10)) err(`${cls}: need 9 disciplines x 10`);
  if (kit.ult.length !== 10) err(`${cls}: need 10 ultimates`);
  const entries = [...R[cls].disc.flatMap(([, , l]) => l).map((e) => [e, '']), ...R[cls].ult.map((e) => [e, 'U:'])];
  for (const [e, u] of entries) {
    if (!SIG_BY_ID[e.form]) err(`${cls}: unknown form "${e.form}" in ${e.name}`);
    for (const m of e.mods) if (!MODS.has(m)) err(`${cls}: unknown mod "${m}" in ${e.name}`);
    if (names.has(e.name)) err(`duplicate name "${e.name}" (${cls} & ${names.get(e.name)})`); names.set(e.name, cls);
    const key = `${u}${e.form}|${[...e.mods].sort().join(',')}|${e.el || '?'}`;
    if (combos.has(key)) err(`duplicate ability ${key}: "${e.name}" (${cls}) == "${combos.get(key)}"`); combos.set(key, `${e.name} (${cls})`);
  }
}
console.log(errors ? `${errors} problems` : `OK: ${names.size} skills, all names and ability combinations unique`);
process.exit(errors ? 1 : 0);
