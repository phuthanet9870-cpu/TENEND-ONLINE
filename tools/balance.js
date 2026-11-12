// Balance report: typical character (rare gear of its level, average passive investment) vs same-level monsters/bosses.
import { computeStats, monsterStats } from '../shared/stats.js';
import { generateItem } from '../shared/items.js';
import { mulberry32 } from '../shared/rng.js';
const rng = mulberry32(7);
const LV = [1, 10, 30, 60, 100, 150, 200, 250, 300];
const mit = (armor, atkLv) => armor / (armor + 60 + atkLv * 22);
const rows = [];
for (const L of LV) {
  const res = { cls: [] };
  for (const classId of ['warrior', 'arcanist', 'ranger', 'cleric']) {
    const c = { classId, level: L, equip: {}, build: { passives: {} } };
    for (const slot of ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2']) c.equip[slot] = generateItem(rng, { ilvl: L, slot: slot.startsWith('ring') ? 'ring' : slot, rarity: L < 10 ? 'magic' : 'rare', classId });
    const s = computeStats(c);
    const mon = monsterStats(L, { hp: 1, dmg: 1, spd: 100 });
    const hit = s.atk * 1.5 * (1 + (s.dmgAll || 0) / 100) * (1 - mit(mon.armor, L)) * (1 + (s.crit / 100) * (s.critDmg / 100));
    const monHit = mon.atk * (1 - mit(s.armor, L));
    const monDps = monHit / 1.3;
    res.cls.push({ classId, hp: s.hpMax, atk: s.atk, armor: s.armor, mitig: (mit(s.armor, L) * 100).toFixed(0) + '%', hits: (mon.hpMax / hit).toFixed(1), ttd1: (s.hpMax / monDps).toFixed(0) + 's', ttd3: (s.hpMax / (monDps * 3)).toFixed(0) + 's', boss: ((mon.hpMax * 20) / (hit * 1.8)).toFixed(0) + 's', bossHit: ((mon.atk * 2.2 * (1 - mit(s.armor, L))) / s.hpMax * 100).toFixed(0) + '%' });
  }
  rows.push([L, res]);
}
console.log('Lv | class | HP | ATK | armor(mitig) | hits/mob | die vs 1 mob | vs 3 mobs | solo field boss | boss big hit %HP');
for (const [L, r] of rows) for (const c of r.cls) console.log(`${String(L).padStart(3)} ${c.classId.padEnd(10)} ${String(c.hp).padStart(6)} ${String(c.atk).padStart(6)} ${String(c.armor).padStart(6)}(${c.mitig}) ${c.hits.padStart(6)} ${c.ttd1.padStart(6)} ${c.ttd3.padStart(6)} ${c.boss.padStart(6)} ${c.bossHit.padStart(5)}`);
