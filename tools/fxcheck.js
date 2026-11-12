// Verifies: every one of the 1,000 skills has its own distinct VFX recipe (client/js/skillfx.js)
// and every skill mechanic has a hand-made choreography in client/js/moves.js.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'client', 'js', '.fxcheck_tmp');
mkdirSync(dir, { recursive: true });
const shared = pathToFileURL(join(root, 'shared')).href + '/';
for (const f of ['fx2', 'fxglyphs', 'skillfx']) writeFileSync(join(dir, f + '.js'), readFileSync(join(root, 'client/js', f + '.js'), 'utf8').replaceAll("'/shared/", `'${shared}`));
let fail = false;
try {
  const m = await import(pathToFileURL(join(dir, 'skillfx.js')).href);
  const { SIGS } = await import(shared + 'signatures.js');
  const list = m.buildRecipes().filter(Boolean);
  const sigs = new Map(); let dup = 0;
  for (const r of list) { const k = m.recipeSignature(r); if (sigs.has(k)) { dup++; console.log('DUP', r.id, sigs.get(k)); } else sigs.set(k, r.id); }
  const by = (k) => new Set(list.map((r) => r[k])).size;
  console.log(`recipes ${list.length} • unique ${sigs.size} • emblems ${by('emb')} • patterns ${by('pattern')} • projectile glyphs ${by('projEmb')}`);
  // every mechanic must have its own choreography in the pixel VFX engine (client/js/pxfx/index.js)
  const src = readFileSync(join(root, 'client/js/pxfx/index.js'), 'utf8');
  const body = src.slice(src.indexOf('function choreo('), src.indexOf('const BUFF = {'));
  const cases = new Set([...body.matchAll(/case '([a-z0-9]+)'/g)].map((m) => m[1]));
  const buffs = new Set([...src.slice(src.indexOf('const BUFF = {')).matchAll(/^\s*([a-z0-9]+): \(/gm)].map((m) => m[1]).concat([...src.slice(src.indexOf('const BUFF = {')).matchAll(/\]\], ([a-z0-9]+): \(/g)].map((m) => m[1])));
  const missing = SIGS.filter((s) => !cases.has(s.id) && !buffs.has(s.id)).map((s) => s.id);
  console.log(`mechanics ${SIGS.length} • choreographies ${cases.size} impact + ${buffs.size} aura${missing.length ? ' • MISSING ' + missing.join(',') : ''}`);
  if (dup || list.length !== 1000 || missing.length) fail = true;
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(fail ? 'FAIL' : 'OK: 1000 skills, 1000 distinct VFX recipes, every mechanic choreographed');
process.exit(fail ? 1 : 0);
