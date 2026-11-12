// Verifies every one of the 1,000 skills gets its own distinct VFX recipe (client/js/skillfx.js).
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'client', 'js', '.fxcheck_tmp'); 
import { mkdirSync, rmSync } from 'node:fs';
mkdirSync(dir, { recursive: true });
const src = readFileSync(join(root, 'client/js/skillfx.js'), 'utf8').replace("'/shared/skills.js'", JSON.stringify(pathToFileURL(join(root, 'shared/skills.js')).href)).replace(/'\.\/(fx2|fxglyphs)\.js'/g, (m, f) => JSON.stringify(pathToFileURL(join(root, 'client/js', f + '.js')).href));
writeFileSync(join(dir, 'skillfx.mjs'), src);
try {
  const m = await import(pathToFileURL(join(dir, 'skillfx.mjs')).href);
  const list = m.buildRecipes().filter(Boolean);
  const sigs = new Map(); let dup = 0;
  for (const r of list) { const k = m.recipeSignature(r); if (sigs.has(k)) { dup++; console.log('DUP', r.id, sigs.get(k)); } else sigs.set(k, r.id); }
  const by = (k) => new Set(list.map((r) => r[k])).size;
  console.log(`recipes ${list.length} • unique ${sigs.size} • emblems ${by('emb')} • patterns ${by('pattern')} • projectile glyphs ${by('projEmb')}`);
  console.log('sample:', list.slice(0, 3).map((r) => `${r.name}: ${m.describeFx(r)}`).join('\n        '));
  if (dup || list.length !== 1000) { console.log('FAIL'); process.exit(1); } else console.log('OK: 1000 skills, 1000 distinct VFX recipes');
} finally { rmSync(dir, { recursive: true, force: true }); }
