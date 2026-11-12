// ===== Passive Skill Tree =====
// Branches: weapon, element, speed, crit, leech (sustain), guard, class.
// Nodes are addressed by stable string ids. Adding nodes (append to a branch list or add a new
// branch) never changes existing ids, so saved allocations stay valid.
import { CLASS_BY_ID } from './classes.js';
import { ELEMENTS, ELEMENT_INFO } from './constants.js';

export const WEAPON_CATEGORY = {
  greatsword: 'melee', axe: 'melee', mace: 'melee', sword: 'melee', dagger: 'melee', katar: 'melee', scythe: 'melee', fist: 'melee',
  bow: 'ranged', crossbow: 'ranged', pistol: 'ranged', rifle: 'ranged',
  staff: 'magic', wand: 'magic', totemstaff: 'magic',
};

// Path-of-Exile style tree: each branch = trunk -> ring cluster A (+ notable) -> path -> ring cluster B (+ notable) -> keystone,
// plus two side ring clusters. Ids are stable strings (`branch.part`), so new branches/clusters never break saves.
const BRANCHES = [
  { id: 'weapon', th: 'สายอาวุธ', color: '#e8d8b8', icon: '⚔', minors: [{ atkPct: 2 }, { atkSpd: 2 }, { critDmg: 4 }],
    notables: { A: ['Weapon Mastery', { atkPct: 8, atkSpd: 4 }], B: ['Blade Dancer', { atkPct: 10, crit: 3 }], L: ['Brutal Force', { dmgMelee: 14 }], R: ['Steady Aim', { dmgRanged: 14 }] },
    keystones: { main: ['colossus', 'Colossus', 'สกิลประชิดพื้นที่ +30% ดาเมจ +10% แต่ความเร็ว -5%'], L: ['spellweaver', 'Spellweaver', 'ทุก 5 สกิลที่ร่าย สกิลถัดไปไม่มีคูลดาวน์'], R: ['deadshot', 'Deadshot', 'โปรเจกไทล์ทะลุ +1 และคริติคอล +10%'] } },
  { id: 'element', th: 'สายธาตุ', color: '#ff8a3a', icon: '🔥', minors: [{ dmgElAll: 2 }, { statusPower: 4 }],
    notables: { A: ['Elemental Focus', { dmgElAll: 8 }], B: ['Primal Surge', { dmgElAll: 10, statusPower: 12 }], L: ['Fire & Ice', { dmg_fire: 12, dmg_ice: 12, pen_fire: 5, pen_ice: 5 }], R: ['Storm & Venom', { dmg_lightning: 12, dmg_poison: 12, pen_lightning: 5 }] },
    keystones: { main: ['elemaster', 'Elemental Master', 'สถานะผิดปกติรุนแรงขึ้น 40%'], L: ['__light', 'Light & Shadow', null, { dmg_holy: 15, dmg_shadow: 15, dmg_arcane: 15 }] } },
  { id: 'speed', th: 'สายความเร็ว', color: '#8affb0', icon: '💨', minors: [{ move: 1.5 }, { atkSpd: 2 }, { cdr: 1 }],
    notables: { A: ['Fleet Foot', { move: 6 }], B: ['Time Bender', { cdr: 6 }], L: ['Quick Hands', { atkSpd: 8 }], R: ['Escape Artist', { dodgeCd: 15, dodge: 3 }] },
    keystones: { main: ['momentum', 'Momentum', 'หลัง Dash/หลบ ดาเมจ +25% 3 วินาที'], R: ['blur', 'Blur', 'ลดคูลดาวน์หลบ 30%'] } },
  { id: 'crit', th: 'สายคริติคอล', color: '#ffe14a', icon: '🎯', minors: [{ crit: 1 }, { critDmg: 5 }],
    notables: { A: ['Precision', { crit: 4 }], B: ['Lethality', { critDmg: 25 }], L: ['Giant Slayer', { dmgBoss: 10 }], R: ['Eagle Eye', { crit: 3, critDmg: 10 }] },
    keystones: { main: ['critcascade', 'Critical Cascade', 'คริติคอลลดคูลดาวน์ทุกสกิล 0.2 วิ'], L: ['assassinate', 'Assassinate', 'คริติคอลใส่เป้าที่ติด CC ดาเมจ x1.5'] } },
  { id: 'leech', th: 'สายดูดเลือด', color: '#ff4a6a', icon: '🩸', minors: [{ leech: 0.5 }, { hpPct: 2 }, { hpRegen: 2 }],
    notables: { A: ['Bloodthirst', { leech: 2 }], B: ['Undying', { hpPct: 10 }], L: ['Regrowth', { hpRegen: 15 }], R: ['Vital Spark', { hpPct: 6, leech: 1 }] },
    keystones: { main: ['bloodmagic', 'Blood Magic', 'สกิลใช้ HP แทนทรัพยากร ดูดเลือด x1.5'], R: ['vampaura', 'Vampiric Aura', 'ฮีลเกินกลายเป็นโล่'] } },
  { id: 'guard', th: 'สายป้องกัน', color: '#8ad0ff', icon: '🛡', minors: [{ armorPct: 3 }, { res: 2 }, { block: 1 }],
    notables: { A: ['Fortress', { armorPct: 15 }], B: ['Warded', { res: 8 }], L: ['Shield Wall', { block: 6 }], R: ['Iron Will', { vit: 15, hpPct: 4 }] },
    keystones: { main: ['juggernaut', 'Juggernaut', 'ไม่ถูกผลัก/ดึง และลดดาเมจที่ได้รับ 10%'] } },
];
export const STAT_ICON = { atkPct: '⚔', atkSpd: '⚡', critDmg: '💥', crit: '🎯', dmgElAll: '🔥', statusPower: '☠', move: '👟', cdr: '⏱', leech: '🩸', hpPct: '❤', hpRegen: '✚', armorPct: '🛡', res: '🔰', block: '🧱', dmgAll: '✦', minionDmg: '👻', healPower: '💚', dmgMelee: '🗡', dmgRanged: '🏹', dmgDot: '🧪', mpRegen: '💧', area: '◎', shieldPower: '🔵', vit: '💪', dodge: '💨', dmgBoss: '👑' };

const cache = {};
export function buildPassiveTree(classId) {
  if (cache[classId]) return cache[classId];
  const cls = CLASS_BY_ID[classId];
  const nodes = [{ id: 'root', branch: 'root', name: 'Origin', x: 0, y: 0, ranks: 1, stats: {}, req: [], free: true, type: 'root' }];
  const byId = { root: nodes[0] };
  const branches = [...BRANCHES];
  if (cls) {
    const ps = cls.passives.filter((p) => !p.keystone), ks = cls.passives.filter((p) => p.keystone);
    const tri = (st) => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, Math.round(v * 3 * 10) / 10]));
    branches.push({ id: 'class', th: `สายคลาส ${cls.th}`, color: cls.palette.accent, icon: '★', minors: [{ hpPct: 1 }, { dmgAll: 1.5 }],
      notables: { A: [ps[0].name, tri(ps[0].stats)], B: [ps[1].name, tri(ps[1].stats)], L: [ps[2].name, tri(ps[2].stats)], R: [ps[3].name, tri(ps[3].stats)] },
      keystones: { main: [ks[0].keystone, ks[0].name.replace(' (Keystone)', ''), ks[0].desc], R: [ks[1].keystone, ks[1].name.replace(' (Keystone)', ''), ks[1].desc] } });
  }
  const add = (n) => { nodes.push(n); byId[n.id] = n; return n; };
  const link = (a, b) => { if (!byId[b].req.includes(a)) byId[b].req.push(a); if (!byId[a].req.includes(b) && a !== 'root') byId[a].req.push(b); };
  const descOf = (st) => Object.entries(st).map(([k, v]) => `${k} +${v}`).join(', ');
  const sector = (Math.PI * 2) / branches.length;
  branches.forEach((br, bi) => {
    const mid = -Math.PI / 2 + bi * sector;
    const P = (r, a) => [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)];
    let mi = 0;
    const minor = (id, x, y, ring) => { const st = br.minors[mi++ % br.minors.length]; return add({ id: `${br.id}.${id}`, branch: br.id, name: 'Minor', type: 'minor', ranks: 1, stats: st, desc: descOf(st), x, y, req: [], color: br.color, icon: STAT_ICON[Object.keys(st)[0]] || '•', ring }); };
    const notable = (key, x, y) => { const [name, st] = br.notables[key]; return add({ id: `${br.id}.n${key}`, branch: br.id, name, type: 'notable', ranks: 1, stats: st, desc: descOf(st), x, y, req: [], color: br.color, icon: STAT_ICON[Object.keys(st)[0]] || br.icon }); };
    const keystone = (key, x, y) => { const k = br.keystones[key]; if (!k) return null; const [ks, name, desc, st] = k; return add({ id: `${br.id}.k${key}`, branch: br.id, name, type: 'keystone', keystone: ks.startsWith('__') ? null : ks, ranks: 1, stats: st || {}, desc: desc || descOf(st), x, y, req: [], color: br.color, icon: br.icon }); };
    // ring cluster: n nodes on a circle around (cx,cy); returns ring node ids
    const cluster = (tag, cR, cA, rr, n, notKey) => {
      const [cx, cy] = P(cR, cA); const ids = [];
      for (let i = 0; i < n; i++) { const a = cA + Math.PI + (i / n) * Math.PI * 2; const nd = minor(`${tag}${i}`, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), { cx, cy, r: rr }); ids.push(nd.id); }
      for (let i = 0; i < n; i++) link(ids[i], ids[(i + 1) % n]);
      const nt = notable(notKey, cx, cy); link(ids[Math.floor(n / 3)], nt.id); link(ids[Math.floor((2 * n) / 3)], nt.id);
      return ids;
    };
    // trunk
    let prev = 'root';
    for (let i = 0; i < 3; i++) { const [x, y] = P(150 + i * 55, mid); const nd = minor(`t${i}`, x, y); link(prev, nd.id); prev = nd.id; }
    const A = cluster('a', 380, mid, 72, 6, 'A'); link(prev, A[0]);
    // outer path -> cluster B -> keystone
    let p2 = A[3];
    for (let i = 0; i < 2; i++) { const [x, y] = P(500 + i * 52, mid); const nd = minor(`p${i}`, x, y); link(p2, nd.id); p2 = nd.id; }
    const B = cluster('b', 680, mid, 72, 6, 'B'); link(p2, B[0]);
    const [kx, ky] = P(820, mid); const km = keystone('main', kx, ky); if (km) link(B[3], km.id);
    // side clusters
    for (const [side, sgn] of [['L', -1], ['R', 1]]) {
      const a = mid + sgn * sector * 0.3;
      const S2 = cluster(side.toLowerCase(), 560, a, 58, 5, side);
      link(A[sgn < 0 ? 4 : 2], S2[0]);
      const k = br.keystones[side]; if (k) { const [x, y] = P(690, a + sgn * sector * 0.05); const kn = keystone(side, x, y); link(S2[2], kn.id); }
    }
  });
  const tree = { classId, nodes, byId, branches: branches.map((b) => ({ id: b.id, th: b.th, color: b.color, icon: b.icon })) };
  cache[classId] = tree;
  return tree;
}

export const passivePointsFor = (level, mastery = 0) => Math.max(0, level - 1) + Math.floor(mastery / 2);
export function spentPoints(alloc) { let n = 0; for (const k in alloc) if (k !== 'root') n += alloc[k]; return n; }

// Validate and apply allocation (server side). Returns error string or null.
export function canAllocate(tree, alloc, nodeId, level, mastery) {
  const node = tree.byId[nodeId];
  if (!node || node.id === 'root') return 'ไม่พบโหนด';
  const cur = alloc[nodeId] || 0;
  if (cur >= node.ranks) return 'โหนดนี้เต็มแล้ว';
  if (spentPoints(alloc) >= passivePointsFor(level, mastery)) return 'แต้มไม่พอ';
  const reachable = node.req.some((r) => r === 'root' || (alloc[r] || 0) > 0);
  if (!reachable) return 'ต้องเปิดโหนดที่เชื่อมต่อก่อน';
  return null;
}

// Collect stats + keystones from allocation (unknown/removed node ids are ignored safely)
export function passiveEffects(classId, alloc, weaponCat) {
  const tree = buildPassiveTree(classId);
  const stats = {}; const ks = new Set();
  for (const [id, r] of Object.entries(alloc || {})) {
    const n = tree.byId[id]; if (!n || !r) continue;
    if (n.keystone) ks.add(n.keystone);
    if (n.cond && n.cond !== weaponCat) continue;
    for (const [k, v] of Object.entries(n.stats)) stats[k] = (stats[k] || 0) + v * Math.min(r, n.ranks);
  }
  return { stats, ks };
}
export { ELEMENT_INFO };
