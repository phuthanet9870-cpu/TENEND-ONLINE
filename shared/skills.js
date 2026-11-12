// ===== Skill generation + resolution =====
// Each class: 90 Active Skills (each a different signature mechanic, see signatures.js) + 10 Ultimate Skills = 100.
// IDs are stable ("warrior.cleave.3", "warrior.ult.0") so new classes / nodes / runes never break saves.
import { CLASSES, CLASS_BY_ID } from './classes.js';
import { RUNE_BY_ID, runeFits, runeSlotsForRank } from './runes.js';
import { ELEMENT_INFO, PVP_DEFAULT } from './constants.js';
import { SIGS, CLASS_AFFINITY, ELEM_ADJ, FAMILIES } from './signatures.js';
import { hashStr } from './rng.js';

export const BEHAVIOR = {
  melee: { th: 'โจมตีระยะประชิดเป็นรูปพัด', dmg: 130, cd: 0.55, cost: 4, range: 85, radius: 85, arc: 110, windup: 0.12 },
  projectile: { th: 'ยิงโปรเจกไทล์', dmg: 115, cd: 0.65, cost: 6, range: 620, radius: 10, speed: 520, count: 1, spread: 12, windup: 0.12 },
  nova: { th: 'ระเบิดรอบตัว', dmg: 160, cd: 4, cost: 14, radius: 140, windup: 0.15 },
  ground: { th: 'โจมตีพื้นที่เป้าหมาย', dmg: 180, cd: 3.5, cost: 16, range: 520, radius: 90, delay: 0.45, windup: 0.15 },
  beam: { th: 'ลำแสงเป็นเส้นตรง', dmg: 170, cd: 2.5, cost: 14, range: 460, width: 28, windup: 0.2 },
  dash: { th: 'พุ่งตัวทำดาเมจตามเส้นทาง', dmg: 110, cd: 4, cost: 10, range: 230, width: 46, windup: 0.05 },
  leap: { th: 'กระโดดกระแทกพื้นที่', dmg: 190, cd: 6, cost: 16, range: 340, radius: 115, delay: 0.45, windup: 0.1 },
  summon: { th: 'อัญเชิญสมุนต่อสู้', dmg: 55, cd: 12, cost: 25, count: 1, duration: 20, minion: 'spirit' },
  buff: { th: 'เสริมพลังตนเอง', dmg: 0, cd: 20, cost: 20, duration: 8, buff: { dmgAll: 15 } },
  chain: { th: 'สายพลังกระโดดหลายเป้าหมาย', dmg: 120, cd: 1.1, cost: 9, range: 420, chain: 3, windup: 0.12 },
  trap: { th: 'วางกับดัก', dmg: 210, cd: 5, cost: 12, range: 300, radius: 80, duration: 15 },
  orbit: { th: 'อาวุธโคจรรอบตัว', dmg: 45, cd: 9, cost: 18, radius: 78, count: 3, duration: 5, tick: 0.35 },
  heal: { th: 'ฟื้นฟูพลังชีวิตพื้นที่', dmg: 0, heal: 140, cd: 9, cost: 22, radius: 220 },
  barrage: { th: 'ระดมยิงต่อเนื่อง', dmg: 55, cd: 5, cost: 16, range: 560, count: 7, interval: 0.11, speed: 600, radius: 9, spread: 14 },
  totem: { th: 'ปักโทเท็มโจมตีอัตโนมัติ', dmg: 70, cd: 12, cost: 22, duration: 12, tick: 1, range: 450, count: 1 },
};
const DAMAGE_BEH = new Set(['melee', 'projectile', 'nova', 'ground', 'beam', 'dash', 'leap', 'chain', 'trap', 'orbit', 'barrage', 'totem', 'summon']);

export const MECH_TH = {
  bleed: 'ทำให้เลือดไหล (DoT ซ้อนได้ 5)', burn: 'เผาไหม้ต่อเนื่อง', freeze: 'สะสมความหนาว 3 ชั้นจะแช่แข็ง', chill: 'ทำให้หนาวเหน็บ ช้าลง',
  shock: 'ช็อต: เป้าหมายรับดาเมจ +15%', poison: 'พิษสะสม (ซ้อนได้ 10)', stun: 'ทำให้มึนงง', knock: 'ผลักกระเด็น', pull: 'ดูดศัตรูเข้าหา',
  mark: 'ตีตรา: รับดาเมจ +20%', shield: 'สร้างโล่ป้องกันให้ตนเอง', heal: 'ฟื้นฟู HP เมื่อโจมตีโดน', lifesteal: 'ดูดพลังชีวิต 15%',
  slow: 'ทำให้ช้าลง 40%', weaken: 'ลดดาเมจศัตรู 25%', blind: 'ทำให้ตาบอด โจมตีพลาด 30%', execute: 'ดาเมจ x2 กับเป้าหมาย HP < 30%',
  shatter: 'ดาเมจ x2.5 กับศัตรูที่หนาว/แช่แข็ง', haste: 'ได้ความเร็วเคลื่อนที่ +30%', rage: 'คืนทรัพยากร 35%', pierce: 'ทะลุเป้าหมายเพิ่ม',
};

const ADJ = {
  physical: [null, 'Crushing', 'Swift', 'Sweeping', 'Linked', 'Rending', 'Shattering', 'Hunting', 'Twin', 'Savage'],
  fire: [null, 'Infernal', 'Flickering', 'Blazing', 'Wildfire', 'Smoldering', 'Erupting', 'Seeking', 'Twin Flame', 'Phoenix'],
  ice: [null, 'Glacial', 'Frostbite', 'Blizzard', 'Crystal', 'Permafrost', 'Shattering', 'Hoarfrost', 'Twin Frost', 'Absolute'],
  lightning: [null, 'Thunderous', 'Static', 'Tempest', 'Arcing', 'Charged', 'Overloaded', 'Ion', 'Double', 'Storm King'],
  poison: [null, 'Virulent', 'Quick', 'Miasmic', 'Contagious', 'Festering', 'Bursting', 'Creeping', 'Twin Fang', 'Plaguelord'],
  holy: [null, 'Divine', 'Swift', 'Radiant', 'Hallowed', 'Sanctified', 'Blessed', 'Guiding', 'Twin Halo', 'Seraphic'],
  shadow: [null, 'Abyssal', 'Fleeting', 'Umbral', 'Shadowlinked', 'Haunting', 'Void', 'Stalking', 'Phantom', 'Nightlord'],
  arcane: [null, 'Empowered', 'Quickened', 'Expanded', 'Resonant', 'Lingering', 'Volatile', 'Seeking', 'Echoing', 'Archmage'],
};

function scaleBuff(s, m) { if (s.buff) for (const k in s.buff) s.buff[k] = Math.round(s.buff[k] * m); }
const isProj = (s) => s.behavior === 'projectile' || s.behavior === 'barrage';
const isArea = (s) => ['nova', 'ground', 'leap', 'trap'].includes(s.behavior);

export const VARIANTS = [
  { id: 'base', th: 'รูปแบบพื้นฐาน สมดุล', f: () => {} },
  { id: 'heavy', th: 'หนักหน่วง: ดาเมจสูง คูลดาวน์นาน ผลักกระเด็น', f: (s) => { s.dmg *= 1.75; s.cd = s.cd * 1.7 + 0.6; s.radius *= 1.2; s.width *= 1.2; s.knock += 50; s.heal *= 1.6; scaleBuff(s, 1.4); } },
  { id: 'rapid', th: 'รวดเร็ว: คูลดาวน์สั้นมาก ใช้ทรัพยากรน้อย', f: (s) => { s.dmg *= 0.6; s.cd *= 0.45; s.cost *= 0.55; s.windup *= 0.5; s.heal *= 0.55; if (s.behavior === 'buff') s.duration *= 0.6; } },
  { id: 'wide', th: 'กว้าง: ครอบคลุมพื้นที่มากขึ้น', f: (s) => { s.radius *= 1.55; s.arc = Math.min(360, s.arc * 1.5); s.width *= 1.6; if (isProj(s)) { s.count += 2; s.spread = Math.max(s.spread, 40); } s.dmg *= 0.9; if (s.behavior === 'buff') s.aura = 300; } },
  { id: 'linked', th: 'เชื่อมโยง: พลังกระโดดไปเป้าหมายอื่น', f: (s) => { s.chain += 2; s.dmg *= 0.9; if (s.behavior === 'buff' || s.behavior === 'heal') s.aura = Math.max(s.aura, 360); } },
  { id: 'lingering', th: 'ค้างอยู่: ทิ้งพื้นที่ทำดาเมจต่อเนื่อง', f: (s) => { if (DAMAGE_BEH.has(s.behavior) && !['summon', 'totem', 'orbit'].includes(s.behavior)) s.linger += 3; s.dmg *= 0.85; if (['buff', 'summon', 'totem', 'orbit', 'trap'].includes(s.behavior)) s.duration *= 1.6; } },
  { id: 'explosive', th: 'ระเบิด: ระเบิดรุนแรงเมื่อจบการทำงาน', f: (s) => { s.detonate = Math.max(s.detonate, 85); s.dmg *= 0.9; if (s.behavior === 'buff') s.castNova = 160; } },
  { id: 'seeking', th: 'ไล่ล่า: ติดตามหรือดูดเป้าหมาย', f: (s) => { if (isProj(s)) s.homing = true; else if (isArea(s)) s.pull = true; else if (s.behavior === 'dash') s.range *= 1.4; else s.selfHaste = true; } },
  { id: 'twin', th: 'คู่: ทำงานซ้ำสองครั้ง', f: (s) => { s.echo += 1; s.echoMul = 0.7; s.dmg *= 0.8; if (s.behavior === 'summon') s.count += 1; } },
  { id: 'empowered', th: 'เหนือขั้น: สถานะรุนแรงขึ้นมาก', f: (s) => { s.dmg *= 1.35; s.cd *= 1.4; s.sp *= 2.2; scaleBuff(s, 1.8); s.heal *= 1.5; } },
];

function blankSpec(behavior) {
  return {
    behavior, el: 'physical', dmg: 100, cd: 1, cost: 5, range: 0, radius: 0, arc: 0, width: 0, speed: 0, count: 1, spread: 0,
    pierce: 0, chain: 0, delay: 0, linger: 0, duration: 0, tick: 0.5, interval: 0.1, windup: 0.1, homing: false, echo: 0, echoMul: 0.6,
    detonate: 0, radial: false, fork: 0, pull: false, trapMode: false, totemMode: false, spiritMode: false, orbitMode: false,
    mirror: false, cascade: 0, leech: 0, selfShield: 0, selfHaste: false, execute: 0, critBonus: 0, costHp: false, charges: 1,
    knock: 0, mech: null, sp: 1, buff: null, heal: 0, minion: null, aura: 0, castNova: 0, cleanse: false, shatter: false,
    extraStatus: [], healOnHit: 0, pvp: null,
  };
}

function makeBase(behavior, school, overrides) {
  const s = blankSpec(behavior);
  Object.assign(s, structuredClone(BEHAVIOR[behavior]));
  delete s.th;
  s.el = school.el; s.mech = school.mech;
  if (overrides) Object.assign(s, structuredClone(overrides));
  if (s.mech === 'pierce') s.pierce += 2;
  if (s.mech === 'pull') s.pull = true;
  if (s.mech === 'knock') s.knock += 70;
  if (s.mech === 'execute') s.execute = Math.max(s.execute, 0.3);
  if (s.mech === 'lifesteal') s.leech += 15;
  if (s.mech === 'shield') s.selfShield += 8;
  if (s.mech === 'haste') s.selfHaste = true;
  if (s.mech === 'shatter') s.shatter = true;
  if (s.mech === 'heal') s.healOnHit += 3;
  return s;
}

function describe(def) {
  const s = def.base, beh = BEHAVIOR[s.behavior];
  const parts = def.sig ? [def.variantTh, `ธาตุ${ELEMENT_INFO[s.el].th}`] : [`${beh.th} ธาตุ${ELEMENT_INFO[s.el].th}`];
  if (s.mech && MECH_TH[s.mech] && !def.sig) parts.push(MECH_TH[s.mech]);
  if (def.variantTh && !def.sig) parts.push(def.variantTh);
  if (s.behavior === 'buff' && s.buff) parts.push('บัฟ: ' + Object.entries(s.buff).map(([k, v]) => `${k}+${v}`).join(', ') + ` (${s.duration.toFixed(0)}วิ)`);
  if (s.behavior === 'summon') parts.push(`อัญเชิญ ${s.minion} x${s.count} (${s.duration.toFixed(0)}วิ)`);
  if (s.behavior === 'heal') parts.push(`ฟื้นฟู ${Math.round(s.heal)}% พลังโจมตี`);
  return parts.join(' • ');
}

const ULT_ICON = { leap: '☄', orbit: '🌀', buff: '🔥', beam: '🌟', totem: '🚩', melee: '⚔', barrage: '💫', ground: '🌋', heal: '😇', nova: '💥', summon: '👑', dash: '⚡', projectile: '🎯', chain: '⛈', trap: '🕸' };
const g2 = (g) => g.id;
const DMG_FAM = new Set(['strike', 'sweep', 'shot', 'spell']);
const ALL_SKILLS = new Map();
export { FAMILIES };
const CLASS_SKILLS = {};

export function generateClassSkills(cls) {
  const list = [];
  const aff = CLASS_AFFINITY[cls.id] || {};
  const offElement = (g) => g.el && g.el !== 'class' && g.el !== 'physical' && !cls.elements.includes(g.el);
  const chosen = SIGS.map((g) => ({ g, score: (aff[g.fam] ?? 1) * 10 + (hashStr(cls.id + ':' + g.id) % 10) - (offElement(g) ? 100 : 0) }))
    .sort((a, b) => b.score - a.score).slice(0, 90).map((x) => x.g)
    .sort((a, b) => a.tier - b.tier || (aff[b.fam] ?? 1) - (aff[a.fam] ?? 1) + (DMG_FAM.has(b.fam) - DMG_FAM.has(a.fam)) * 0 || (hashStr(cls.id + g2(a)) % 997) - (hashStr(cls.id + g2(b)) % 997));
  // the three level-1 skills are the class's bread-and-butter attacks
  const topDmg = Math.max(...[...DMG_FAM].map((f) => aff[f] ?? 0));
  const starters = chosen.filter((g) => g.tier === 1 && DMG_FAM.has(g.fam) && (aff[g.fam] ?? 0) >= topDmg - 1 && g.b !== 'trap').sort((a, b) => (aff[b.fam] ?? 0) - (aff[a.fam] ?? 0)).slice(0, 3);
  const ordered = [...starters, ...chosen.filter((g) => !starters.includes(g))];
  chosen.length = 0; chosen.push(...ordered);
  const nonPhys = cls.elements.filter((e) => e !== 'physical');
  chosen.forEach((g, idx) => {
    const h = hashStr(cls.id + '/' + g.id);
    let el;
    if (g.el === 'class') el = nonPhys[0] || 'physical';
    else if (g.el) el = cls.elements.includes(g.el) ? g.el : (g.el === 'physical' ? 'physical' : nonPhys[h % Math.max(1, nonPhys.length)] || 'physical');
    else if (['strike', 'sweep', 'shot', 'move'].includes(g.fam)) el = cls.elements.includes('physical') && h % 2 ? 'physical' : cls.elements[h % cls.elements.length];
    else if (['spell', 'control'].includes(g.fam)) el = nonPhys.length ? nonPhys[h % nonPhys.length] : cls.elements[0];
    else el = cls.elements[0];
    const base = makeBase(g.b, { el, mech: g.p.mech || null }, g.p);
    base.sig = g.id; base.v = g.v; base.fam = g.fam;
    if (g.p.extra) base.extraStatus = [...g.p.extra];
    if (g.p.erupt) { base.linger = g.p.erupt * 0.4; base.tick = 0.4; }
    base.dmg *= 1 + (g.tier - 1) * 0.15;
    let name = g.names?.[el];
    const dealsDmg = (g.p.dmg ?? BEHAVIOR[g.b].dmg) > 0 && DMG_FAM.has(g.fam) || g.fam === 'control' && (g.p.dmg ?? 0) > 0;
    if (!name) name = (ELEM_ADJ[el] && !g.el && dealsDmg ? `${ELEM_ADJ[el]} ` : '') + g.name;
    const def = {
      id: `${cls.id}.${g.id}`, classId: cls.id, kind: 'active', school: g.fam, sig: g.id, icon: g.icon, name, behavior: g.b, el: base.el,
      unlock: idx < 3 ? 1 : Math.min(298, Math.round(1 + idx * 3.33)), base, tier: g.tier, variantTh: g.th,
    };
    def.desc = describe(def);
    list.push(def);
  });
  cls.ultimates.forEach((u, ui) => {
    const base = makeBase(u.b, { el: u.el, mech: u.mech }, u.p);
    base.dmg *= 4.2; base.radius *= 1.8; base.width *= 2; base.range *= 1.3; base.sp *= 2;
    if (['projectile', 'barrage'].includes(u.b)) base.count += 6;
    if (u.b === 'summon') base.duration *= 1.5;
    if (u.b === 'buff') { base.duration = 12; scaleBuff(base, 1); }
    if (u.b === 'heal') base.heal *= 3;
    if (u.b === 'orbit') { base.count += 3; base.duration *= 1.6; }
    base.cd = 45 + ui * 4; base.cost = 35; base.windup = Math.max(base.windup, 0.25);
    const def = {
      id: `${cls.id}.ult.${ui}`, classId: cls.id, kind: 'ultimate', school: 'ultimate', variant: 'ultimate', name: u.name,
      behavior: u.b, el: u.el, unlock: 20 + ui * 31, base, variantTh: 'อัลติเมท: พลังทำลายล้างมหาศาล', icon: ULT_ICON[u.b] || '🌟',
    };
    def.desc = describe(def);
    list.push(def);
  });
  list.sort((a, b) => a.unlock - b.unlock);
  for (const d of list) ALL_SKILLS.set(d.id, d);
  CLASS_SKILLS[cls.id] = list;
  return list;
}
for (const c of CLASSES) generateClassSkills(c);

export const getSkill = (id) => ALL_SKILLS.get(id);
export const classSkills = (classId) => CLASS_SKILLS[classId] || [];
export const MAX_SKILL_RANK = 20;

// Legendary / Mythic item effects that modify skill behaviour (see items.js LEGENDARIES)
const LEGENDARY_SKILL_MODS = {
  prism: (s) => { if (s.behavior === 'projectile') { s.count += 2; s.spread = Math.max(s.spread, 25); s.prism = true; } },
  echoruin: (s, def) => { if (def.kind === 'ultimate') s.echo += 1; },
  gravecaller: (s) => { if (s.behavior === 'summon') s.count += 2; },
  voidlens: (s) => { if (['ground', 'nova', 'leap'].includes(s.behavior)) s.pull = true; },
  stormheart: (s) => { if (s.el === 'lightning') s.chain += 2; },
  shadowstep: (s) => { if (s.behavior === 'dash') s.shadowBomb = true; },
  sunforge: (s) => { if (s.el === 'holy' && DAMAGE_BEH.has(s.behavior)) s.healField = true; },
  chaos: (s) => { s.chaos = true; s.dmg *= 1.5; },
  hourglass: (s) => { s.cd *= 0.5; },
  eternity: (s) => { s.cost *= 2; s.dmg *= 1.8; },
  totemic: (s) => { if (s.behavior === 'totem') { s.count += 1; s.duration *= 1.5; } },
  frostbite: (s) => { if (s.el === 'ice') s.shatter = true; },
  wildfire: (s) => { if (s.el === 'fire') s.linger += 2; },
  venomweave: (s) => { if (s.el === 'poison') s.sp *= 2; },
};

// Resolve a skill into its final executable spec for a specific character build.
// ctx: { rank, runes:[], stats, ks:Set(keystones), leg:Set(legendary ids), pvp:boolean }
export function resolveSkill(def, ctx = {}) {
  const rank = ctx.rank || 1;
  const s = structuredClone(def.base);
  s.id = def.id; s.name = def.name; s.kind = def.kind;
  s.dmg *= 1 + (rank - 1) * 0.09;
  s.heal *= 1 + (rank - 1) * 0.07;
  const slots = runeSlotsForRank(rank);
  const runes = (ctx.runes || []).slice(0, slots).filter((r) => r && RUNE_BY_ID[r] && runeFits(RUNE_BY_ID[r], def.behavior));
  for (const r of runes) RUNE_BY_ID[r].apply(s);
  s.runes = runes;
  const ks = ctx.ks || new Set(), leg = ctx.leg || new Set();
  if (ks.has('conduit') && s.el === 'lightning') s.chain += 2;
  if (ks.has('ricochet') && (s.behavior === 'projectile' || s.behavior === 'barrage')) s.chain += 1;
  if (ks.has('legion') && s.behavior === 'summon') { s.count += 3; s.dmg *= 0.8; }
  if (ks.has('totemlord') && s.behavior === 'totem') s.count += 2;
  if (ks.has('manaflow')) { s.cost *= 0.7; s.cd *= 1.1; }
  for (const l of leg) if (LEGENDARY_SKILL_MODS[l]) LEGENDARY_SKILL_MODS[l](s, def);
  const st = ctx.stats || {};
  const cdr = Math.min(60, st.cdr || 0) / 100;
  s.cd = Math.max(0.15, s.cd * (1 - cdr) * (s.cd <= 1 ? 1 / (1 + (st.atkSpd || 0) / 100) : 1));
  s.windup = s.windup / (1 + (st.atkSpd || 0) / 200);
  const area = 1 + (st.area || 0) / 100;
  s.radius *= area; s.width *= area;
  s.critBonus += st.crit || 0;
  s.pvpMul = { ...PVP_DEFAULT, ...(s.pvp || {}) };
  if (ctx.pvp) { s.sp *= s.pvpMul.cc; s.leech *= s.pvpMul.leech; if (s.behavior === 'summon') s.count = Math.max(1, Math.round(s.count * s.pvpMul.minions)); }
  return s;
}
export { runeSlotsForRank };
