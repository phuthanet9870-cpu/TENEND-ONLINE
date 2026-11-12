// ===== Server-authoritative loot & rewards =====
import { generateItem } from '../shared/items.js';
import { RUNES } from '../shared/runes.js';
import { RARITY_INFO } from '../shared/constants.js';
import { MATERIALS } from '../shared/items.js';
import { cardFor } from '../shared/world.js';

const R = Math.random;
export const monsterExp = (lv) => Math.round(12 + lv * 6 + Math.pow(lv, 1.55) * 0.7);
export const monsterGold = (lv) => Math.round(2 + lv * 1.6 + Math.random() * lv);

// returns list of drop payloads for one eligible player
export function rollLoot(mon, char, stats, ctx = {}) {
  const out = [];
  const mf = (stats.magicFind || 0) + (ctx.mf || 0);
  const lv = mon.lv;
  const boss = !!mon.boss;
  const itemChance = boss ? 1 : (mon.elite ? 0.4 : 0.09) * (1 + mf / 200) * (ctx.treasure ? 2 : 1) * (ctx.rate || 1);
  const nItems = boss ? (mon.bossKind === 'raid' ? 4 : mon.bossKind === 'world' ? 3 : 2) + (Math.random() < 0.5 ? 1 : 0) : (R() < itemChance ? 1 : 0);
  for (let i = 0; i < nItems; i++) {
    const it = generateItem(R, { ilvl: lv + (boss ? 3 : 0), classId: R() < 0.6 ? char.classId : null, mf, boss, minRarity: boss && i === 0 ? (mon.bossKind === 'raid' ? 'epic' : 'rare') : null });
    out.push({ item: it, label: it.name, color: RARITY_INFO[it.rarity].color });
  }
  // materials
  if (R() < (boss ? 1 : 0.22)) out.push(mat('ore', 1 + Math.floor(R() * (boss ? 6 : 2))));
  if (R() < (boss ? 1 : 0.1)) out.push(mat('dust', 1 + Math.floor(R() * (boss ? 5 : 2))));
  if (R() < (boss ? 0.8 : 0.04)) out.push(mat('shard', 1 + Math.floor(R() * 2)));
  if (boss) out.push(mat('core', 1 + (mon.bossKind === 'raid' ? 2 : 0)));
  if (R() < (boss ? 0.5 : 0.005) && lv >= 100) out.push(mat('mythril', 1));
  if (ctx.abyss && R() < 0.3) out.push(mat('essence', 1 + Math.floor(R() * 2)));
  // runes (Support Runes)
  if (R() < (boss ? 0.6 : 0.012 * (ctx.rate || 1))) {
    const maxTier = lv < 60 ? 1 : lv < 150 ? 2 : 3;
    const pool = RUNES.filter((r) => r.tier <= maxTier);
    const r = pool[Math.floor(R() * pool.length)];
    out.push({ rune: r.id, label: `Rune: ${r.name}`, color: '#7fe8ff' });
  }
  // cards (very rare, Ragnarok-style)
  if (R() < (boss ? 0.03 : 0.002) * (1 + mf / 100)) {
    const cid = `card_${mon.tpl}`; const c = cardFor(cid);
    if (c) out.push({ item: { uid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, type: 'card', card: cid, name: c.name, rarity: c.boss ? 'legendary' : 'epic', ilvl: lv }, label: c.name, color: '#ff9ad8' });
  }
  if (R() < 0.04) out.push({ potion: R() < 0.6 ? 'hp' : 'mp', n: 1, label: 'Potion', color: '#ff6a6a' });
  return out;
}
const mat = (id, n) => ({ mat: id, n, label: `${MATERIALS[id].th} x${n}`, color: MATERIALS[id].color });
