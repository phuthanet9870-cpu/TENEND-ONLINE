// Verifies: every one of the 1,000 skills has its own distinct VFX recipe (client/js/skillfx.js)
// and every skill mechanic has a hand-made choreography in client/js/moves.js.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'client', 'js', '.fxcheck_tmp');
mkdirSync(dir, { recursive: true });
const shared = pathToFileURL(join(root, 'shared')).href + '/';
for (const f of ['fx2', 'fxglyphs', 'fxpro', 'skillfx', 'moves']) writeFileSync(join(dir, f + '.js'), readFileSync(join(root, 'client/js', f + '.js'), 'utf8').replaceAll("'/shared/", `'${shared}`));
let fail = false;
try {
  const m = await import(pathToFileURL(join(dir, 'skillfx.js')).href);
  const mv = await import(pathToFileURL(join(dir, 'moves.js')).href);
  const { SIGS } = await import(shared + 'signatures.js');
  const list = m.buildRecipes().filter(Boolean);
  const sigs = new Map(); let dup = 0;
  for (const r of list) { const k = m.recipeSignature(r); if (sigs.has(k)) { dup++; console.log('DUP', r.id, sigs.get(k)); } else sigs.set(k, r.id); }
  const by = (k) => new Set(list.map((r) => r[k])).size;
  console.log(`recipes ${list.length} • unique ${sigs.size} • emblems ${by('emb')} • patterns ${by('pattern')} • projectile glyphs ${by('projEmb')}`);
  const missing = SIGS.filter((s) => !mv.MOVE_IMPACTS[s.id] && !mv.MOVE_BUFFS[s.id]).map((s) => s.id);
  console.log(`mechanics ${SIGS.length} • choreographies ${Object.keys(mv.MOVE_IMPACTS).length} impacts + ${Object.keys(mv.MOVE_BUFFS).length} auras${missing.length ? ' • MISSING ' + missing.join(',') : ''}`);
  if (dup || list.length !== 1000 || missing.length) fail = true;
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(fail ? 'FAIL' : 'OK: 1000 skills, 1000 distinct VFX recipes, every mechanic choreographed');
process.exit(fail ? 1 : 0);
