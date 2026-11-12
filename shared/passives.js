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

// node spec: [key, name, stats, ranks, opts]
const BRANCHES = [
  {
    id: 'weapon', th: 'สายอาวุธ', angle: -90, color: '#e0d6c8',
    chains: [
      [['train', 'Weapon Training', { atkPct: 3 }, 5]],
      [['melee1', 'Blade Discipline', { atkPct: 5, armorPct: 2 }, 5, { cond: 'melee' }], ['melee2', 'Heavy Swings', { dmgMelee: 6 }, 5], ['colossus', 'Colossus (Keystone)', null, 1, { keystone: 'colossus', desc: 'สกิลระยะประชิดพื้นที่ +30% ดาเมจ +10% แต่ความเร็วเคลื่อนที่ -5%' }]],
      [['ranged1', 'Marksmanship', { atkPct: 5, crit: 1 }, 5, { cond: 'ranged' }], ['ranged2', 'Quick Draw', { dmgRanged: 6 }, 5], ['deadshot', 'Deadshot (Keystone)', null, 1, { keystone: 'deadshot', desc: 'โปรเจกไทล์ทะลุ +1 และโอกาสคริติคอล +10%' }]],
      [['magic1', 'Channeling', { atkPct: 5, mpPct: 4 }, 5, { cond: 'magic' }], ['magic2', 'Spellpower', { dmgSpell: 6 }, 5], ['spellweaver', 'Spellweaver (Keystone)', null, 1, { keystone: 'spellweaver', desc: 'ทุก 4 สกิลที่ร่าย สกิลถัดไปไม่มีคูลดาวน์' }]],
    ],
  },
  {
    id: 'element', th: 'สายธาตุ', angle: -30, color: '#ff7a2a',
    chains: [
      [['attune', 'Elemental Attunement', { dmgElAll: 3 }, 5], ['status', 'Affliction', { statusPower: 8 }, 5], ['elemaster', 'Elemental Master (Keystone)', null, 1, { keystone: 'elemaster', desc: 'สถานะผิดปกติรุนแรงขึ้น 40% และติดนานขึ้น' }]],
      ...ELEMENTS.map((el) => [[`${el}1`, `${el[0].toUpperCase() + el.slice(1)} Affinity`, { [`dmg_${el}`]: 6 }, 5], [`${el}2`, `${el[0].toUpperCase() + el.slice(1)} Penetration`, { [`pen_${el}`]: 4 }, 3]]),
    ],
  },
  {
    id: 'speed', th: 'สายความเร็ว', angle: 30, color: '#a0ffb0',
    chains: [
      [['agility', 'Agility', { move: 2 }, 5], ['haste', 'Haste', { atkSpd: 3 }, 5], ['momentum', 'Momentum (Keystone)', null, 1, { keystone: 'momentum', desc: 'หลัง Dash/หลบ ดาเมจ +25% 3 วินาที' }]],
      [['tempo', 'Tempo', { cdr: 2 }, 5], ['evade', 'Evasive', { dodgeCd: 6 }, 3], ['blur', 'Blur (Keystone)', null, 1, { keystone: 'blur', desc: 'หลบหลีกสร้างเงาลวงที่ดึงความสนใจศัตรู และลดคูลดาวน์หลบ 30%' }]],
    ],
  },
  {
    id: 'crit', th: 'สายคริติคอล', angle: 90, color: '#ffe14a',
    chains: [
      [['precision', 'Precision', { crit: 1.5 }, 5], ['ferocity', 'Ferocity', { critDmg: 8 }, 5], ['critcascade', 'Critical Cascade (Keystone)', null, 1, { keystone: 'critcascade', desc: 'ทุกครั้งที่ติดคริติคอล ลดคูลดาวน์ทุกสกิล 0.2 วินาที' }]],
      [['weakspot', 'Weak Spot', { dmgBoss: 4 }, 5], ['assassinate', 'Assassinate (Keystone)', null, 1, { keystone: 'assassinate', desc: 'คริติคอลกับเป้าหมายที่ติด CC ดาเมจ x1.5' }]],
    ],
  },
  {
    id: 'leech', th: 'สายดูดเลือด', angle: 150, color: '#d0203a',
    chains: [
      [['thirst', 'Thirst', { leech: 0.8 }, 5], ['vigor', 'Vigor', { hpPct: 3 }, 5], ['bloodmagic', 'Blood Magic (Keystone)', null, 1, { keystone: 'bloodmagic', desc: 'สกิลใช้ HP แทนทรัพยากร (ครึ่งหนึ่ง) ดูดเลือด x1.5' }]],
      [['regen', 'Regeneration', { hpRegen: 2 }, 5], ['vampaura', 'Vampiric Aura (Keystone)', null, 1, { keystone: 'vampaura', desc: 'ดูดเลือดส่วนเกินกลายเป็นโล่ และแชร์ 20% ให้ปาร์ตี้' }]],
    ],
  },
  {
    id: 'guard', th: 'สายป้องกัน', angle: 210, color: '#a0e0ff',
    chains: [
      [['toughness', 'Toughness', { armorPct: 4 }, 5], ['resilience', 'Resilience', { res: 3 }, 5], ['juggernaut', 'Juggernaut (Keystone)', null, 1, { keystone: 'juggernaut', desc: 'ไม่ถูกผลัก/ดึง และลดดาเมจที่ได้รับ 10%' }]],
      [['vit', 'Constitution', { vit: 4 }, 5], ['block', 'Parry Training', { block: 2 }, 5]],
    ],
  },
];

const cache = {};
export function buildPassiveTree(classId) {
  if (cache[classId]) return cache[classId];
  const cls = CLASS_BY_ID[classId];
  const nodes = [{ id: 'root', branch: 'root', name: 'Origin', x: 0, y: 0, ranks: 1, stats: {}, req: [], free: true }];
  const branches = [...BRANCHES, {
    id: 'class', th: `สายคลาส ${cls?.th || ''}`, angle: 270 - 0, color: cls?.palette.accent || '#fff',
    chains: [cls ? cls.passives.slice(0, 4).map((p) => [p.key, p.name, p.stats, p.ranks]) .concat([]) : [],
      cls ? cls.passives.slice(4).map((p) => [p.key, p.name, p.stats || null, p.ranks || 1, { keystone: p.keystone, desc: p.desc }]) : []],
  }];
  const totalChains = branches.reduce((a, b) => a + b.chains.length, 0);
  const per = (Math.PI * 2) / totalChains;
  let angCursor = -Math.PI / 2 - (branches[0].chains.length * per) / 2;
  branches.forEach((br) => {
    const n = br.chains.length;
    // trunk takes the middle slot of the branch's sector; side chains fill the rest
    const slots = [...Array(n).keys()];
    const mid = Math.floor(n / 2);
    const order = [mid, ...slots.filter((i) => i !== mid)];
    let trunkTail = 'root';
    br.chains.forEach((chain, ci) => {
      const ang = angCursor + (order[ci] + 0.5) * per;
      const dir = [Math.cos(ang), Math.sin(ang)];
      let prev = ci === 0 ? 'root' : trunkTail;
      chain.forEach((nd, ni) => {
        const [key, name, stats, ranks, opts = {}] = nd;
        const dist = ci === 0 ? 95 + ni * 72 : 185 + ni * 66;
        const id = `${br.id}.${key}`;
        nodes.push({
          id, branch: br.id, name, ranks: ranks || 1, stats: stats || {}, keystone: opts.keystone || null, cond: opts.cond || null,
          desc: opts.desc || (stats ? Object.entries(stats).map(([k, v]) => `${k} +${v}${ranks > 1 ? '/ระดับ' : ''}`).join(', ') : ''),
          x: Math.round(dir[0] * dist), y: Math.round(dir[1] * dist), req: [prev], color: br.color,
        });
        prev = id;
        if (ci === 0 && ni === 0) trunkTail = id;
      });
    });
    angCursor += n * per;
  });
  const tree = { classId, nodes, byId: Object.fromEntries(nodes.map((n) => [n.id, n])), branches: branches.map((b) => ({ id: b.id, th: b.th, color: b.color })) };
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
