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
// words used to name the many generated Notables of each branch
const NOTABLE_WORDS = {
  weapon: [['Keen', 'Brutal', 'Honed', 'Savage', 'Masterful', 'Deadly', 'Relentless', 'Tempered', 'Vicious', 'Heavy', 'Precise', 'Battle-born', 'Unstoppable', 'Warforged'], ['Edge', 'Strikes', 'Arms', 'Blows', 'Steel', 'Technique']],
  element: [['Burning', 'Frozen', 'Storming', 'Toxic', 'Radiant', 'Umbral', 'Arcane', 'Primal', 'Elemental', 'Volatile', 'Searing', 'Glacial', 'Thundering', 'Prismatic'], ['Affinity', 'Conduit', 'Surge', 'Heart', 'Mastery', 'Flux']],
  speed: [['Swift', 'Fleeting', 'Rapid', 'Agile', 'Hasted', 'Nimble', 'Quick', 'Restless', 'Darting', 'Windborne', 'Blurred', 'Lightfoot', 'Racing', 'Tempo'], ['Steps', 'Reflexes', 'Motion', 'Rhythm', 'Stride', 'Pace']],
  crit: [['Lethal', 'Piercing', 'Sharp', 'Fatal', 'Ruthless', 'Exact', 'Cruel', 'Merciless', 'Assassin', 'Sniper', 'Vital', 'Killer', 'Predator', 'Eagle'], ['Precision', 'Instinct', 'Aim', 'Focus', 'Strikes', 'Eye']],
  leech: [['Thirsting', 'Crimson', 'Vampiric', 'Undying', 'Hungering', 'Sanguine', 'Living', 'Blooded', 'Regal', 'Feral', 'Eternal', 'Hemomantic', 'Ravenous', 'Vital'], ['Blood', 'Vigor', 'Life', 'Veins', 'Pulse', 'Heart']],
  guard: [['Iron', 'Stone', 'Warded', 'Bastion', 'Stalwart', 'Steadfast', 'Fortified', 'Unbroken', 'Granite', 'Aegis', 'Guardian', 'Bulwark', 'Titan', 'Adamant'], ['Skin', 'Wall', 'Ward', 'Shell', 'Bastion', 'Resolve']],
  class: [['Ancestral', 'Chosen', 'Sworn', 'Exalted', 'Veteran', 'Legendary', 'Heroic', 'Ascendant', 'Mythic', 'Elder', 'Royal', 'Fabled', 'Awakened', 'Sacred'], ['Discipline', 'Path', 'Calling', 'Legacy', 'Oath', 'Art']],
};
const TIERS = [{ r: 400, n: 1 }, { r: 680, n: 2 }, { r: 960, n: 3 }, { r: 1240, n: 4 }, { r: 1520, n: 3 }];
const RING = 7; // minor nodes per cluster ring

export function buildPassiveTree(classId) {
  if (cache[classId]) return cache[classId];
  const cls = CLASS_BY_ID[classId];
  const nodes = [{ id: 'root', branch: 'root', name: 'Origin', x: 0, y: 0, ranks: 1, stats: {}, req: [], free: true, type: 'root' }];
  const byId = { root: nodes[0] };
  const branches = [...BRANCHES];
  if (cls) {
    const ps = cls.passives.filter((p) => !p.keystone), ks = cls.passives.filter((p) => p.keystone);
    const tri = (st) => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, Math.round(v * 3 * 10) / 10]));
    branches.push({ id: 'class', th: `สายคลาส ${cls.th}`, color: cls.palette.accent, icon: '★', minors: [{ hpPct: 1 }, { dmgAll: 1.5 }, { cdr: 0.8 }],
      fixed: ps.map((p) => [p.name, tri(p.stats)]),
      keystones: { main: [ks[0].keystone, ks[0].name.replace(' (Keystone)', ''), ks[0].desc], R: [ks[1].keystone, ks[1].name.replace(' (Keystone)', ''), ks[1].desc] } });
  }
  const add = (n) => { nodes.push(n); byId[n.id] = n; return n; };
  const link = (a, b) => { if (!byId[b].req.includes(a)) byId[b].req.push(a); if (a !== 'root' && !byId[a].req.includes(b)) byId[a].req.push(b); };
  const descOf = (st) => Object.entries(st).map(([k, v]) => `${k} +${v}`).join(', ');
  const sector = (Math.PI * 2) / branches.length;
  branches.forEach((br, bi) => {
    const mid = -Math.PI / 2 + bi * sector;
    let mi = 0, ni = 0;
    const words = NOTABLE_WORDS[br.id] || NOTABLE_WORDS.class;
    const minorStat = () => br.minors[mi++ % br.minors.length];
    const minor = (id, x, y, ring) => { const st = minorStat(); return add({ id: `${br.id}.${id}`, branch: br.id, name: 'Minor', type: 'minor', ranks: 1, stats: st, desc: descOf(st), x: Math.round(x), y: Math.round(y), req: [], color: br.color, icon: STAT_ICON[Object.keys(st)[0]] || '•', ring }); };
    const notableAt = (id, x, y) => {
      let name, st;
      const legacy = br.notables && Object.values(br.notables)[ni];
      if (br.fixed && br.fixed[ni]) [name, st] = br.fixed[ni];
      else if (legacy) [name, st] = legacy;
      else {
        name = `${words[0][ni % words[0].length]} ${words[1][Math.floor(ni / words[0].length) % words[1].length]}`;
        st = {}; for (let k = 0; k < 2; k++) { const m = br.minors[(ni + k) % br.minors.length]; for (const [kk, vv] of Object.entries(m)) st[kk] = Math.round(((st[kk] || 0) + vv * (3 + ni % 3)) * 10) / 10; }
      }
      ni++;
      return add({ id: `${br.id}.${id}`, branch: br.id, name, type: 'notable', ranks: 1, stats: st, desc: descOf(st), x: Math.round(x), y: Math.round(y), req: [], color: br.color, icon: STAT_ICON[Object.keys(st)[0]] || br.icon });
    };
    const keystone = (key, x, y) => { const k = br.keystones[key]; if (!k) return null; const [ksId, name, desc, st] = k; return add({ id: `${br.id}.k${key}`, branch: br.id, name, type: 'keystone', keystone: ksId.startsWith('__') ? null : ksId, ranks: 1, stats: st || {}, desc: desc || descOf(st), x: Math.round(x), y: Math.round(y), req: [], color: br.color, icon: br.icon }); };
    const cluster = (tag, cx, cy, inA) => {
      const rr = 66; const ids = [];
      for (let i = 0; i < RING; i++) { const a = inA + (i / RING) * Math.PI * 2; ids.push(minor(`${tag}r${i}`, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, { cx: Math.round(cx), cy: Math.round(cy), r: rr }).id); }
      for (let i = 0; i < RING; i++) link(ids[i], ids[(i + 1) % RING]);
      const nt = notableAt(`${tag}n`, cx, cy); link(ids[2], nt.id); link(ids[5], nt.id);
      return { ids, cx, cy, entry: ids[0], exit: ids[3] };
    };
    const path = (tag, fromId, toId, n) => { const A = byId[fromId], B = byId[toId]; let prev = fromId; for (let i = 1; i <= n; i++) { const t = i / (n + 1); const nd = minor(`${tag}${i}`, A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t); link(prev, nd.id); prev = nd.id; } link(prev, toId); };
    // trunk
    let prev = 'root';
    for (let i = 0; i < 3; i++) { const nd = minor(`t${i}`, Math.cos(mid) * (150 + i * 60), Math.sin(mid) * (150 + i * 60)); link(prev, nd.id); prev = nd.id; }
    const tiers = [];
    TIERS.forEach((T, ti) => {
      const row = [];
      for (let k = 0; k < T.n; k++) {
        const a = mid + (T.n === 1 ? 0 : (k / (T.n - 1) - 0.5) * sector * 0.72);
        const cx = Math.cos(a) * T.r, cy = Math.sin(a) * T.r;
        const c = cluster(`c${ti}${k}`, cx, cy, a + Math.PI);
        if (ti === 0) link(prev, c.entry);
        else { const inner = tiers[ti - 1].slice().sort((p, q) => Math.hypot(p.cx - cx, p.cy - cy) - Math.hypot(q.cx - cx, q.cy - cy))[0]; path(`p${ti}${k}`, inner.exit, c.entry, 2); }
        if (k > 0) path(`s${ti}${k}`, row[k - 1].ids[2], c.ids[5], 1);
        row.push(c);
      }
      tiers.push(row);
    });
    const outer = tiers[tiers.length - 1];
    const keys = Object.keys(br.keystones);
    keys.forEach((key, i) => { const c = outer[Math.round((i / Math.max(1, keys.length - 1)) * (outer.length - 1))] || outer[0]; const a = Math.atan2(c.cy, c.cx); const kn = keystone(key, Math.cos(a) * 1720, Math.sin(a) * 1720); if (kn) path(`kp${i}`, c.exit, kn.id, 1); });
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
