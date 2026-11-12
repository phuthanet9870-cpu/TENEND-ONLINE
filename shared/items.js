// ===== Itemization: bases, affixes, legendary/mythic effects, sets, materials, crafting rules =====
// generateItem() takes an RNG argument and is ONLY called by the server (drops are server-authoritative).
import { RARITIES, RARITY_INFO, ELEMENTS, ELEMENT_INFO } from './constants.js';
import { pick, rint, weighted } from './rng.js';

export const SLOTS = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring1', 'ring2'];
export const SLOT_TH = { weapon: 'อาวุธ', offhand: 'มือรอง', helm: 'หมวก', chest: 'เกราะ', gloves: 'ถุงมือ', boots: 'รองเท้า', belt: 'เข็มขัด', amulet: 'สร้อยคอ', ring1: 'แหวน', ring2: 'แหวน', ring: 'แหวน' };
export const DROP_SLOTS = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'];

export const WEAPON_TYPES = {
  greatsword: { name: 'Greatsword', mul: 1.3, classes: ['warrior'] },
  axe: { name: 'Battle Axe', mul: 1.2, classes: ['warrior', 'shaman'] },
  mace: { name: 'Mace', mul: 1.1, classes: ['paladin', 'cleric'] },
  sword: { name: 'Longsword', mul: 1.1, classes: ['paladin'] },
  bow: { name: 'Longbow', mul: 1.15, classes: ['ranger'] },
  crossbow: { name: 'Crossbow', mul: 1.25, classes: ['ranger'] },
  dagger: { name: 'Dagger', mul: 1.0, classes: ['assassin'] },
  katar: { name: 'Katar', mul: 1.12, classes: ['assassin'] },
  staff: { name: 'Staff', mul: 1.2, classes: ['arcanist', 'cleric', 'monk'] },
  wand: { name: 'Wand', mul: 1.0, classes: ['arcanist', 'necromancer'] },
  scythe: { name: 'Scythe', mul: 1.25, classes: ['necromancer'] },
  totemstaff: { name: 'Totem Staff', mul: 1.15, classes: ['shaman'] },
  pistol: { name: 'Pistol', mul: 1.0, classes: ['gunslinger'] },
  rifle: { name: 'Rifle', mul: 1.25, classes: ['gunslinger'] },
  fist: { name: 'Claw Fist', mul: 1.05, classes: ['monk'] },
};

const TIER_PREFIX = ['Rusty', 'Iron', 'Steel', 'Knight', 'Mythril', 'Runic', 'Dragon', 'Celestial', 'Abyssal', 'Eternal', 'Godforged'];
const SLOT_BASE = { offhand: 'Shield', helm: 'Helm', chest: 'Armor', gloves: 'Gauntlets', boots: 'Boots', belt: 'Belt', amulet: 'Amulet', ring: 'Ring' };

// affix: [id, stat, min@ilvl1, max@ilvl300, allowed slots ('*' = any), weight]
const A = [];
const add = (stat, lo, hi, slots, w = 10, minIlvl = 1) => A.push({ id: stat, stat, lo, hi, slots, w, minIlvl });
add('str', 2, 60, '*'); add('dex', 2, 60, '*'); add('int', 2, 60, '*'); add('vit', 2, 60, '*');
add('hp', 15, 900, ['chest', 'helm', 'belt', 'offhand', 'boots', 'amulet', 'ring']);
add('hpPct', 2, 12, ['chest', 'belt', 'offhand'], 6);
add('mp', 5, 120, ['helm', 'amulet', 'ring', 'offhand']);
add('atkPct', 2, 14, ['weapon', 'ring', 'amulet', 'gloves'], 12);
add('crit', 1, 8, ['weapon', 'gloves', 'ring', 'amulet', 'helm'], 9);
add('critDmg', 4, 45, ['weapon', 'gloves', 'amulet', 'ring'], 8);
add('atkSpd', 2, 14, ['weapon', 'gloves', 'ring', 'amulet'], 8);
add('cdr', 1, 10, ['helm', 'amulet', 'ring', 'offhand'], 6);
add('move', 2, 10, ['boots'], 14);
add('leech', 0.4, 3, ['weapon', 'ring', 'amulet', 'gloves'], 6);
for (const el of ELEMENTS) add(`dmg_${el}`, 3, 30, ['weapon', 'amulet', 'ring', 'gloves', 'offhand'], 5);
for (const el of ELEMENTS.slice(1)) add(`res_${el}`, 3, 25, ['chest', 'helm', 'boots', 'belt', 'offhand', 'ring', 'amulet'], 4);
add('res', 2, 12, ['chest', 'amulet', 'offhand'], 4);
add('armorPct', 3, 20, ['chest', 'helm', 'gloves', 'boots', 'belt', 'offhand'], 9);
add('hpRegen', 1, 40, ['chest', 'belt', 'amulet', 'ring']);
add('mpRegen', 0.5, 6, ['helm', 'amulet', 'ring', 'offhand'], 6);
add('dmgBoss', 2, 20, ['weapon', 'amulet', 'helm'], 5);
add('dmgElAll', 2, 15, ['weapon', 'amulet'], 4);
add('area', 2, 15, ['helm', 'chest', 'amulet'], 5);
add('minionDmg', 4, 40, ['weapon', 'offhand', 'amulet', 'helm'], 5);
add('healPower', 3, 30, ['weapon', 'offhand', 'amulet', 'ring'], 4);
add('dodge', 1, 6, ['boots', 'gloves', 'belt'], 4);
add('block', 1, 8, ['offhand', 'chest'], 4);
add('magicFind', 2, 20, ['helm', 'ring', 'amulet', 'boots'], 4);
add('goldFind', 3, 30, ['helm', 'ring', 'amulet', 'belt'], 4);
add('expBonus', 1, 8, ['helm', 'amulet'], 3);
add('allSkills', 1, 2, ['weapon', 'amulet'], 2, 100);
export const AFFIXES = A;
export const STAT_TH = {
  str: 'STR', dex: 'DEX', int: 'INT', vit: 'VIT', hp: 'HP', hpPct: 'HP%', mp: 'ทรัพยากรสูงสุด', atk: 'พลังโจมตี', atkPct: 'พลังโจมตี%', armor: 'เกราะ',
  crit: 'โอกาสคริติคอล%', critDmg: 'ดาเมจคริติคอล%', atkSpd: 'ความเร็วโจมตี%', cdr: 'ลดคูลดาวน์%', move: 'ความเร็วเคลื่อนที่%', leech: 'ดูดเลือด%',
  res: 'ต้านทานทุกธาตุ%', armorPct: 'เกราะ%', hpRegen: 'ฟื้นฟู HP/วิ', mpRegen: 'ฟื้นฟูทรัพยากร/วิ', dmgBoss: 'ดาเมจต่อบอส%', dmgElAll: 'ดาเมจธาตุทั้งหมด%',
  area: 'ขนาดพื้นที่%', minionDmg: 'ดาเมจสมุน%', healPower: 'พลังฮีล%', dodge: 'หลบหลีก%', block: 'บล็อก%', magicFind: 'โอกาสของดี%', goldFind: 'ทองดรอป%',
  expBonus: 'EXP%', allSkills: '+ระดับสกิลทั้งหมด', dmgAll: 'ดาเมจ%', dmgMelee: 'ดาเมจประชิด%', dmgRanged: 'ดาเมจระยะไกล%', dmgSpell: 'ดาเมจเวท%',
  dmgDot: 'ดาเมจต่อเนื่อง%', shieldPower: 'พลังโล่%', statusPower: 'พลังสถานะ%', dodgeCd: 'ลดคูลดาวน์หลบ%', mpPct: 'ทรัพยากร%', dmgPvp: 'ดาเมจ PvP%',
};
for (const el of ELEMENTS) { STAT_TH[`dmg_${el}`] = `ดาเมจ${ELEMENT_INFO[el].th}%`; STAT_TH[`res_${el}`] = `ต้าน${ELEMENT_INFO[el].th}%`; STAT_TH[`pen_${el}`] = `เจาะ${ELEMENT_INFO[el].th}%`; }

// Legendary: changes how skills/combat behave. (skill-level mods live in skills.js LEGENDARY_SKILL_MODS)
export const LEGENDARIES = {
  shadowstep: { name: 'Shadowstep Remnant', slot: 'boots', th: 'สกิล Dash ทิ้งเงาที่ระเบิดหลัง 0.8 วิ' },
  prism: { name: 'Prism Core', slot: 'weapon', th: 'โปรเจกไทล์ยิงเพิ่ม 2 ลูก แต่ละลูกเป็นธาตุแบบสุ่ม' },
  tempest: { name: 'Tempest Heart', slot: 'amulet', th: 'คริติคอลเรียกสายฟ้าฟาดเป้าหมาย (คูลดาวน์ 0.5 วิ)' },
  phoenix: { name: 'Phoenix Feather', slot: 'amulet', th: 'เมื่อตาย ฟื้นขึ้นทันทีพร้อม HP 40% (ทุก 90 วิ)' },
  echoruin: { name: 'Echoing Ruin', slot: 'helm', th: 'สกิลอัลติเมทร่ายซ้ำอีกครั้ง' },
  gravecaller: { name: 'Gravecaller', slot: 'offhand', th: 'สกิลอัญเชิญได้สมุนเพิ่ม +2' },
  bloodlust: { name: 'Bloodlust Edge', slot: 'weapon', th: 'สังหารศัตรูฟื้น HP 4% และความเร็วโจมตี +5% (ซ้อน 10)' },
  meteor: { name: 'Meteor Signet', slot: 'ring', th: 'ทุก 10 สกิลที่ร่าย อุกกาบาตตกใส่ศัตรูใกล้สุด' },
  mirrorward: { name: 'Mirror Ward', slot: 'offhand', th: 'สะท้อนโปรเจกไทล์ศัตรู 20%' },
  bladeorbit: { name: 'Orbit of Blades', slot: 'chest', th: 'ดาบ 3 เล่มโคจรรอบตัวตลอดเวลา' },
  voidlens: { name: 'Void Lens', slot: 'helm', th: 'สกิลพื้นที่ดูดศัตรูเข้าหาจุดศูนย์กลาง' },
  stormheart: { name: 'Storm Heart', slot: 'gloves', th: 'สกิลสายฟ้ากระโดดเพิ่ม +2 เป้าหมาย' },
  sunforge: { name: 'Sunforge', slot: 'chest', th: 'สกิลศักดิ์สิทธิ์ทิ้งพื้นที่ฮีลพันธมิตร' },
  totemic: { name: 'Totemic Idol', slot: 'belt', th: 'โทเท็มเพิ่ม +1 และอยู่นานขึ้น 50%' },
  frostbite: { name: 'Frostbite Band', slot: 'ring', th: 'สกิลน้ำแข็งทำให้ศัตรูแตกกระจาย (Shatter)' },
  wildfire: { name: 'Wildfire Gloves', slot: 'gloves', th: 'สกิลไฟทิ้งพื้นที่เผาไหม้ 2 วิ' },
  venomweave: { name: 'Venomweave', slot: 'belt', th: 'สถานะพิษรุนแรงขึ้น x2' },
  thundertreads: { name: 'Thunder Treads', slot: 'boots', th: 'วิ่งสะสมประจุ สกิลถัดไปปล่อยสายฟ้ารอบตัว' },
};
export const MYTHICS = {
  crown: { name: 'Crown of the Abyss', slot: 'helm', th: 'ดาเมจ +60% แต่ไม่ฟื้นฟู HP ยกเว้นดูดเลือด', stats: { dmgAll: 60 }, flags: ['noRegen'] },
  hourglass: { name: 'Hourglass of Ruin', slot: 'amulet', th: 'คูลดาวน์ -50% แต่ HP สูงสุด -40%', stats: { hpPct: -40 }, skill: true },
  titan: { name: 'Heart of the Titan', slot: 'chest', th: 'HP +100% แต่ความเร็วเคลื่อนที่ -25%', stats: { hpPct: 100, move: -25 } },
  eternity: { name: 'Shard of Eternity', slot: 'weapon', th: 'ดาเมจสกิล +80% แต่ใช้ทรัพยากร x2', stats: {}, skill: true },
  chaos: { name: 'Chaos Engine', slot: 'ring', th: 'ทุกสกิลสุ่มธาตุทุกครั้ง ดาเมจ +50%', stats: {}, skill: true },
};

export const SETS = {
  stormcaller: { name: 'Stormcaller', slots: ['helm', 'chest', 'gloves', 'boots'], b2: { dmg_lightning: 20, cdr: 5 }, b4: { dmg_lightning: 40, chainBonus: 2 }, th4: 'สกิลสายฟ้ากระโดดเพิ่ม 2' },
  bloodsworn: { name: 'Bloodsworn', slots: ['helm', 'chest', 'gloves', 'belt'], b2: { leech: 2, hpPct: 10 }, b4: { leech: 4, dmgAll: 20 }, th4: 'ดูดเลือดเกินจะกลายเป็นโล่' },
  shadowdancer: { name: 'Shadowdancer', slots: ['helm', 'chest', 'boots', 'gloves'], b2: { move: 8, dodge: 5 }, b4: { crit: 12, critDmg: 40 }, th4: 'หลัง Dash คริติคอลแน่นอน 1 ครั้ง' },
  ironwall: { name: 'Ironwall', slots: ['helm', 'chest', 'offhand', 'belt'], b2: { armorPct: 25, block: 8 }, b4: { res: 15, hpPct: 25 }, th4: 'บล็อกสำเร็จสะท้อนดาเมจ' },
  conduit: { name: 'Arcane Conduit', slots: ['amulet', 'ring', 'helm', 'chest'], b2: { cdr: 8, mpRegen: 3 }, b4: { dmgSpell: 30, dmgElAll: 15 }, th4: 'ทุกสกิลลดคูลดาวน์สกิลอื่น 0.3 วิ' },
  huntmaster: { name: "Huntmaster's Mark", slots: ['gloves', 'boots', 'ring', 'amulet'], b2: { crit: 6, dmgBoss: 10 }, b4: { dmgRanged: 30, critDmg: 30 }, th4: 'ตีตราบอสอัตโนมัติ' },
};

export const MATERIALS = {
  ore: { name: 'Iron Ore', th: 'แร่เหล็ก', color: '#a0a0a8' },
  dust: { name: 'Spirit Dust', th: 'ผงวิญญาณ', color: '#a0e0ff' },
  shard: { name: 'Elemental Shard', th: 'เศษธาตุ', color: '#ff9a2a' },
  essence: { name: 'Abyss Essence', th: 'แก่นอเวจี', color: '#9a5cff' },
  core: { name: 'Boss Core', th: 'แกนบอส', color: '#ff3a5a' },
  mythril: { name: 'Mythril', th: 'มิธริล', color: '#7fe8ff' },
  guildsigil: { name: 'Guild Sigil', th: 'ตรากิลด์', color: '#ffd84a' },
};

export const REFINE_CHANCE = [100, 100, 100, 95, 85, 70, 55, 40, 28, 18];
export const MAX_REFINE = 10;

const lerp = (a, b, t) => a + (b - a) * t;
function rollAffixValue(rng, af, ilvl) {
  const t = Math.min(1, ilvl / 300);
  const hi = lerp(af.lo * 1.6, af.hi, t), lo = Math.max(af.lo, hi * 0.45);
  const v = lo + (hi - lo) * rng();
  return af.hi <= 15 ? Math.round(v * 10) / 10 : Math.round(v);
}
export function affixPool(slot, ilvl, exclude = []) {
  const s = slot.startsWith('ring') ? 'ring' : slot;
  return AFFIXES.filter((a) => (a.slots === '*' || a.slots.includes(s)) && ilvl >= a.minIlvl && !exclude.includes(a.id));
}
export function rollAffix(rng, slot, ilvl, exclude) {
  const pool = affixPool(slot, ilvl, exclude);
  const af = weighted(rng, pool.map((a) => [a, a.w]));
  return { id: af.id, v: rollAffixValue(rng, af, ilvl) };
}

export function rollRarity(rng, { mf = 0, boss = false, minRarity = null } = {}) {
  const m = 1 + mf / 100;
  const w = [['common', 60], ['magic', 28 * m], ['rare', 9 * m * (boss ? 3 : 1)], ['epic', 2.4 * m * (boss ? 4 : 1)], ['legendary', 0.45 * m * (boss ? 6 : 1)], ['mythic', 0.04 * m * (boss ? 6 : 1)]];
  let r = weighted(rng, w);
  if (minRarity && RARITIES.indexOf(r) < RARITIES.indexOf(minRarity)) r = minRarity;
  return r;
}

let uidCounter = 0;
export const newUid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

// opts: { ilvl, slot, rarity, classId, weaponType, mf, boss, set }
export function generateItem(rng, opts) {
  const ilvl = Math.max(1, Math.min(320, opts.ilvl | 0));
  let slot = opts.slot || pick(rng, DROP_SLOTS);
  const rarity = opts.rarity || rollRarity(rng, opts);
  const tier = Math.min(10, Math.floor(ilvl / 30));
  const item = { uid: newUid(), type: 'gear', slot: slot === 'ring' ? 'ring' : slot, rarity, ilvl, req: Math.max(1, ilvl - 5), affixes: [], sockets: 0, cards: [], refine: 0, dur: 100, bound: false };
  if (slot === 'weapon') {
    let wt = opts.weaponType;
    if (!wt) {
      const opt = Object.entries(WEAPON_TYPES).filter(([, w]) => !opts.classId || rng() < 0.25 || w.classes.includes(opts.classId)).map(([k]) => k);
      wt = pick(rng, opt);
    }
    item.wtype = wt;
    item.base = `${TIER_PREFIX[tier]} ${WEAPON_TYPES[wt].name}`;
    item.implicit = { atk: Math.round((10 + ilvl * 2.4) * WEAPON_TYPES[wt].mul) };
  } else {
    item.base = `${TIER_PREFIX[tier]} ${SLOT_BASE[item.slot]}`;
    const armorMul = { chest: 1.6, helm: 1, gloves: 0.8, boots: 0.8, belt: 0.7, offhand: 1.3 }[item.slot];
    if (armorMul) item.implicit = { armor: Math.round((6 + ilvl * 1.5) * armorMul) };
    else if (item.slot === 'amulet') item.implicit = { hp: Math.round(20 + ilvl * 3) };
    else item.implicit = { res: Math.min(10, Math.round(2 + ilvl / 40)) };
  }
  const info = RARITY_INFO[rarity];
  const nAff = rint(rng, info.affixes[0], info.affixes[1]);
  for (let i = 0; i < nAff; i++) item.affixes.push(rollAffix(rng, item.slot, ilvl, item.affixes.map((a) => a.id)));
  item.sockets = rint(rng, info.sockets[0], info.sockets[1]);
  if (rarity === 'legendary') {
    const pool = Object.entries(LEGENDARIES).filter(([, l]) => l.slot === item.slot);
    if (pool.length) { const [id, l] = pick(rng, pool); item.legendary = id; item.name = l.name; } else item.rarity = 'epic';
  }
  if (rarity === 'mythic') {
    const pool = Object.entries(MYTHICS).filter(([, l]) => l.slot === item.slot);
    if (pool.length) { const [id, l] = pick(rng, pool); item.mythic = id; item.name = l.name; item.bound = true; } else item.rarity = 'legendary';
  }
  if (opts.set || ((rarity === 'epic' || rarity === 'rare') && rng() < 0.12)) {
    const pool = Object.entries(SETS).filter(([, s]) => s.slots.some((sl) => sl.startsWith(item.slot)));
    if (pool.length) { const [id, st] = opts.set && SETS[opts.set] ? [opts.set, SETS[opts.set]] : pick(rng, pool); item.set = id; item.name = `${st.name} ${SLOT_BASE[item.slot] || 'Blade'}`; }
  }
  if (rarity === 'epic') item.affixes.forEach((a) => { a.v = Math.round(a.v * 1.15 * 10) / 10; });
  if (!item.name) {
    if (rarity === 'common') item.name = item.base;
    else if (rarity === 'magic') item.name = `${item.base} of ${STAT_TH[item.affixes[0]?.id]?.replace('%', '') || 'Power'}`;
    else item.name = `${pick(rng, ['Grim', 'Storm', 'Dread', 'Bright', 'Wolf', 'Raven', 'Sun', 'Moon', 'Blood', 'Ember', 'Frost', 'Iron', 'Soul', 'Doom', 'Star'])}${pick(rng, ['bane', 'fang', 'song', 'ward', 'call', 'heart', 'brand', 'veil', 'reach', 'spire', 'grip', 'thorn'])} ${item.base.split(' ').slice(1).join(' ')}`;
  }
  return item;
}

// Total stat contribution of an item (broken items give nothing)
export function itemStats(item, cardLookup) {
  const st = {};
  if (!item || item.type !== 'gear' || item.dur <= 0) return st;
  const refineMul = 1 + (item.refine || 0) * 0.07 + (item.refine >= 7 ? 0.1 : 0);
  for (const [k, v] of Object.entries(item.implicit || {})) st[k] = (st[k] || 0) + Math.round(v * refineMul);
  for (const a of item.affixes || []) st[a.id] = (st[a.id] || 0) + a.v;
  if (item.mythic && MYTHICS[item.mythic]) for (const [k, v] of Object.entries(MYTHICS[item.mythic].stats)) st[k] = (st[k] || 0) + v;
  if (cardLookup) for (const c of item.cards || []) { const card = c && cardLookup(c); if (card) for (const [k, v] of Object.entries(card.stats)) st[k] = (st[k] || 0) + v; }
  return st;
}

export function salvageYield(item) {
  const r = RARITIES.indexOf(item.rarity);
  return { ore: 1 + Math.floor(item.ilvl / 25) + r, dust: r >= 1 ? r * 2 : 0, shard: r >= 2 ? r - 1 : 0, essence: r >= 4 ? 2 : 0, mythril: r >= 5 ? 2 : (r >= 3 ? 1 : 0) };
}
export const sellPrice = (item) => Math.floor((5 + item.ilvl * 2) * (1 + RARITIES.indexOf(item.rarity) * 1.5));
export const POTIONS = { hp: { name: 'Healing Potion', th: 'ยาฟื้น HP 35%', price: (lv) => 10 + lv * 2 }, mp: { name: 'Spirit Potion', th: 'ยาฟื้นทรัพยากร 40%', price: (lv) => 8 + lv * 2 } };
