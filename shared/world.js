// ===== World: 5 towns, 30 farm maps, monsters, cards, bosses (with mechanics), dungeons =====
import { rngFrom, pick } from './rng.js';

export const BIOMES = {
  plains: { ground: ['#4a7a3a', '#548a40', '#467236'], path: '#9a8458', water: '#2a5a8a', obstacle: ['tree', 'rock', 'bush'], fog: null },
  forest: { ground: ['#2f5a2a', '#36662e', '#2a5226'], path: '#7a6a48', water: '#2a4a6a', obstacle: ['tree', 'tree', 'pine', 'bush'], fog: null },
  coast: { ground: ['#d8c88a', '#cfbe80', '#e0d094'], path: '#b8a070', water: '#2a7aa8', obstacle: ['palm', 'rock', 'coral'], fog: null },
  swamp: { ground: ['#3a4a2a', '#42522e', '#364426'], path: '#5a4a30', water: '#2a3a2a', obstacle: ['deadtree', 'reed', 'rock'], fog: 'rgba(80,110,60,0.12)' },
  snow: { ground: ['#dde6ee', '#e8eef4', '#d0dce6'], path: '#a8b8c8', water: '#7ab0d8', obstacle: ['pine', 'icerock', 'rock'], fog: 'rgba(220,235,255,0.10)' },
  cave: { ground: ['#3a3640', '#42404a', '#34303a'], path: '#5a5662', water: '#1a2a4a', obstacle: ['crystal', 'rock', 'stalag'], fog: 'rgba(0,0,20,0.25)' },
  desert: { ground: ['#e0b870', '#d8b068', '#e8c27a'], path: '#c09858', water: '#3aa0a8', obstacle: ['cactus', 'rock', 'bones'], fog: 'rgba(255,200,120,0.08)' },
  tomb: { ground: ['#8a7a5a', '#94845e', '#7e7050'], path: '#a89a70', water: '#3a3020', obstacle: ['pillar', 'bones', 'rock'], fog: 'rgba(30,20,0,0.18)' },
  volcano: { ground: ['#3a2a26', '#44302a', '#2e2220'], path: '#5a4038', water: '#e05a1a', obstacle: ['obsidian', 'rock', 'deadtree'], fog: 'rgba(255,60,0,0.08)' },
  abyss: { ground: ['#241a30', '#2a1e38', '#1e1628'], path: '#3a2a4a', water: '#5a1a6a', obstacle: ['crystal', 'obsidian', 'pillar'], fog: 'rgba(60,0,90,0.18)' },
  town: { ground: ['#7a8a6a', '#808f70', '#768664'], path: '#a8a090', water: '#3a7ab0', obstacle: ['tree', 'lamp'], fog: null },
  arena: { ground: ['#5a5048', '#605650', '#564c44'], path: '#7a6e60', water: '#3a3a5a', obstacle: ['pillar'], fog: null },
};

// ---- Monster archetypes ----
export const MONSTER_KINDS = {
  slime: { name: 'Slime', ai: 'melee', hp: 0.8, dmg: 0.8, spd: 70, size: 14 },
  wolf: { name: 'Wolf', ai: 'melee', hp: 0.9, dmg: 1.1, spd: 125, size: 15 },
  goblin: { name: 'Goblin', ai: 'melee', hp: 0.9, dmg: 1, spd: 100, size: 13 },
  archer: { name: 'Goblin Archer', ai: 'ranged', hp: 0.7, dmg: 1, spd: 90, size: 13 },
  skeleton: { name: 'Skeleton', ai: 'melee', hp: 1, dmg: 1.1, spd: 90, size: 14 },
  bat: { name: 'Bat', ai: 'swarm', hp: 0.5, dmg: 0.7, spd: 150, size: 10 },
  golem: { name: 'Golem', ai: 'melee', hp: 2.2, dmg: 1.5, spd: 60, size: 22 },
  spider: { name: 'Spider', ai: 'melee', hp: 0.8, dmg: 1, spd: 115, size: 14 },
  orc: { name: 'Orc', ai: 'charger', hp: 1.5, dmg: 1.3, spd: 95, size: 18 },
  wraith: { name: 'Wraith', ai: 'caster', hp: 0.9, dmg: 1.2, spd: 95, size: 15 },
  elemental: { name: 'Elemental', ai: 'caster', hp: 1.2, dmg: 1.2, spd: 80, size: 17 },
  demon: { name: 'Demon', ai: 'charger', hp: 1.6, dmg: 1.4, spd: 110, size: 19 },
  treant: { name: 'Treant', ai: 'melee', hp: 2, dmg: 1.2, spd: 55, size: 21 },
  crab: { name: 'Crab', ai: 'melee', hp: 1.3, dmg: 0.9, spd: 80, size: 15 },
  scorpion: { name: 'Scorpion', ai: 'melee', hp: 1.1, dmg: 1.2, spd: 105, size: 16 },
  yeti: { name: 'Yeti', ai: 'charger', hp: 1.8, dmg: 1.4, spd: 85, size: 20 },
  mummy: { name: 'Mummy', ai: 'melee', hp: 1.4, dmg: 1.1, spd: 70, size: 15 },
  imp: { name: 'Imp', ai: 'ranged', hp: 0.7, dmg: 1.1, spd: 120, size: 12 },
  knight: { name: 'Dark Knight', ai: 'charger', hp: 1.7, dmg: 1.3, spd: 90, size: 17 },
  mushroom: { name: 'Mushroom', ai: 'caster', hp: 0.9, dmg: 0.9, spd: 60, size: 13 },
  lizard: { name: 'Lizardman', ai: 'melee', hp: 1.2, dmg: 1.1, spd: 105, size: 16 },
  siren: { name: 'Siren', ai: 'caster', hp: 0.9, dmg: 1.2, spd: 90, size: 15 },
};

const REGIONS = [
  { id: 'aurelia', town: 'Aurelia', th: 'ออเรเลีย', biome: 'town', lv: [1, 50], maps: [
    ['Verdant Meadows', 'plains', ['slime', 'wolf', 'mushroom'], 'physical', 'kingslime'],
    ['Whispering Woods', 'forest', ['wolf', 'spider', 'treant'], 'poison', 'direwolf'],
    ['Goblin Ravine', 'plains', ['goblin', 'archer', 'orc'], 'physical', 'goblinchief'],
    ['Old Mill Fields', 'plains', ['skeleton', 'bat', 'slime'], 'shadow', 'kingslime'],
    ['Mushroom Hollow', 'forest', ['mushroom', 'spider', 'treant'], 'poison', 'golemking'],
    ['Bandit Ridge', 'plains', ['goblin', 'orc', 'archer'], 'physical', 'goblinchief'],
  ] },
  { id: 'mareth', town: 'Port Mareth', th: 'ท่าเรือมาเรธ', biome: 'town', lv: [50, 110], maps: [
    ['Tidal Shore', 'coast', ['crab', 'slime', 'siren'], 'ice', 'krakenqueen'],
    ['Coral Caves', 'cave', ['crab', 'bat', 'elemental'], 'ice', 'krakenqueen'],
    ['Mangrove Swamp', 'swamp', ['lizard', 'spider', 'mushroom'], 'poison', 'drownedking'],
    ["Wreckers' Cove", 'coast', ['skeleton', 'lizard', 'archer'], 'physical', 'drownedking'],
    ['Siren Cliffs', 'coast', ['siren', 'bat', 'elemental'], 'lightning', 'krakenqueen'],
    ['Drowned Ruins', 'swamp', ['skeleton', 'wraith', 'lizard'], 'shadow', 'drownedking'],
  ] },
  { id: 'frosthold', town: 'Frosthold', th: 'ฟรอสต์โฮลด์', biome: 'town', lv: [110, 170], maps: [
    ['Frostpine Forest', 'snow', ['wolf', 'yeti', 'treant'], 'ice', 'yetilord'],
    ['Glacier Pass', 'snow', ['elemental', 'yeti', 'bat'], 'ice', 'frostwyrm'],
    ['Yeti Peaks', 'snow', ['yeti', 'wolf', 'golem'], 'ice', 'yetilord'],
    ['Frozen Lake', 'snow', ['wraith', 'elemental', 'crab'], 'ice', 'frostwyrm'],
    ['Crystal Caverns', 'cave', ['golem', 'elemental', 'spider'], 'arcane', 'golemking'],
    ["Wyrm's Rest", 'snow', ['knight', 'wraith', 'yeti'], 'ice', 'frostwyrm'],
  ] },
  { id: 'sandara', town: 'Sandara', th: 'ซานดารา', biome: 'town', lv: [170, 230], maps: [
    ['Dune Sea', 'desert', ['scorpion', 'lizard', 'elemental'], 'fire', 'sandworm'],
    ['Scorpion Wastes', 'desert', ['scorpion', 'spider', 'bat'], 'poison', 'sandworm'],
    ['Tomb Outskirts', 'tomb', ['mummy', 'skeleton', 'wraith'], 'shadow', 'pharaoh'],
    ['Mirage Oasis', 'desert', ['siren', 'lizard', 'elemental'], 'arcane', 'sandworm'],
    ['Sandstorm Canyon', 'desert', ['orc', 'scorpion', 'golem'], 'physical', 'golemking'],
    ["Pharaoh's Necropolis", 'tomb', ['mummy', 'knight', 'wraith'], 'holy', 'pharaoh'],
  ] },
  { id: 'ember', town: 'Ember Spire', th: 'เอมเบอร์สไปร์', biome: 'town', lv: [230, 300], maps: [
    ['Ashen Fields', 'volcano', ['imp', 'demon', 'elemental'], 'fire', 'infernal'],
    ['Lava Rivers', 'volcano', ['elemental', 'golem', 'imp'], 'fire', 'infernal'],
    ['Obsidian Keep', 'volcano', ['knight', 'demon', 'wraith'], 'shadow', 'lich'],
    ['Demon Gate', 'abyss', ['demon', 'imp', 'bat'], 'fire', 'infernal'],
    ['Abyssal Rift', 'abyss', ['wraith', 'elemental', 'demon'], 'arcane', 'abysslord'],
    ['Throne of Cinders', 'volcano', ['knight', 'demon', 'golem'], 'fire', 'abysslord'],
  ] },
];
export const REGION_LIST = REGIONS;

const ELEMENT_TINT = {
  physical: '#b0a090', fire: '#e0603a', ice: '#7ac8f0', lightning: '#e8d84a', poison: '#6ac84a', holy: '#f0e0a0', shadow: '#7a4ac8', arcane: '#d04ab8',
};
const REGION_ADJ = { aurelia: ['', 'Wild', 'Young'], mareth: ['Tide', 'Brine', 'Murk'], frosthold: ['Frost', 'Snow', 'Rime'], sandara: ['Sand', 'Sun', 'Dust'], ember: ['Infernal', 'Ash', 'Void'] };

export const MONSTERS = {};
export const MAPS = {};
export const TOWNS = {};
const NPC_LAYOUT = [
  ['shop', 'ร้านค้า', -6, -4], ['smith', 'ช่างตีเหล็ก', 6, -4], ['stash', 'คลังของ', -9, 2], ['market', 'ตลาดกลาง', 9, 2],
  ['guild', 'นายทะเบียนกิลด์', -4, 6], ['arena', 'ผู้ดูแลอารีน่า', 4, 6], ['dungeon', 'ประตูดันเจี้ยน', 0, -7], ['teleport', 'นักเคลื่อนย้าย', -12, -5],
  ['quest', 'กระดานเควสต์', 12, -5], ['build', 'อาจารย์ฝึกสกิล', 0, 8],
];

REGIONS.forEach((reg, ri) => {
  const townId = `town_${reg.id}`;
  TOWNS[townId] = MAPS[townId] = {
    id: townId, kind: 'town', name: reg.town, th: reg.th, region: reg.id, biome: 'town', lv: [reg.lv[0], reg.lv[0]], w: 44, h: 32, safe: true,
    npcs: NPC_LAYOUT.map(([type, name, dx, dy]) => ({ id: `${townId}_${type}`, type, name, x: (22 + dx) * 32 + 16, y: (16 + dy) * 32 + 16 })),
    exits: [], index: ri,
  };
  const span = (reg.lv[1] - reg.lv[0]) / 6;
  reg.maps.forEach(([name, biome, kinds, el, boss], mi) => {
    const id = `${reg.id}_${mi + 1}`;
    const lv = [Math.round(reg.lv[0] + span * mi), Math.round(reg.lv[0] + span * (mi + 1))];
    const mons = kinds.map((k, ki) => {
      const mid = `${id}_${k}`;
      const kind = MONSTER_KINDS[k];
      const mel = ki === 0 ? el : pick(rngFrom(mid), ['physical', el, el]);
      const adj = REGION_ADJ[reg.id][(mi + ki) % 3];
      MONSTERS[mid] = { id: mid, kind: k, name: `${adj ? adj + ' ' : ''}${kind.name}`, el: mel, ai: kind.ai, hp: kind.hp, dmg: kind.dmg, spd: kind.spd, size: kind.size, tint: ELEMENT_TINT[mel], lv: lv[0] + ki * Math.max(1, Math.floor(span / 3)) };
      return mid;
    });
    MAPS[id] = { id, kind: 'field', name, region: reg.id, biome, lv, w: 72, h: 56, monsters: mons, density: 34 + mi * 2, fieldBoss: boss, bossRespawn: 300, exits: [], index: mi };
  });
});
// Connect: town -> map1 -> ... -> map6 -> next town
REGIONS.forEach((reg, ri) => {
  const t = MAPS[`town_${reg.id}`];
  const first = MAPS[`${reg.id}_1`];
  t.exits.push({ side: 'e', to: first.id }); first.exits.push({ side: 'w', to: t.id });
  for (let i = 1; i < 6; i++) { const a = MAPS[`${reg.id}_${i}`], b = MAPS[`${reg.id}_${i + 1}`]; a.exits.push({ side: 'e', to: b.id }); b.exits.push({ side: 'w', to: a.id }); }
  const next = REGIONS[ri + 1];
  if (next) { const last = MAPS[`${reg.id}_6`], nt = MAPS[`town_${next.id}`]; last.exits.push({ side: 'e', to: nt.id }); nt.exits.push({ side: 'w', to: last.id }); }
});

// ---- Cards (Socket items dropped by monsters, 0.2% chance) ----
const CARD_STAT_BY_KIND = {
  slime: { hp: 120 }, wolf: { move: 3 }, goblin: { atkPct: 3 }, archer: { dmgRanged: 6 }, skeleton: { armorPct: 6 }, bat: { leech: 1 }, golem: { hpPct: 6 },
  spider: { dmgDot: 8 }, orc: { str: 12 }, wraith: { dmg_shadow: 8 }, elemental: { dmgElAll: 5 }, demon: { critDmg: 12 }, treant: { hpRegen: 10 }, crab: { block: 4 },
  scorpion: { crit: 3 }, yeti: { res_ice: 12 }, mummy: { res: 5 }, imp: { atkSpd: 4 }, knight: { dmgMelee: 6 }, mushroom: { int: 12 }, lizard: { dex: 12 }, siren: { cdr: 3 },
};
export function cardFor(cardId) {
  const mid = cardId.replace(/^card_/, '');
  const m = MONSTERS[mid] || BOSSES[mid];
  if (!m) return null;
  const tier = 1 + Math.floor((m.lv || 1) / 60);
  const base = BOSSES[mid] ? { dmgBoss: 8, atkPct: 4 } : (CARD_STAT_BY_KIND[m.kind] || { hp: 50 });
  const stats = {}; for (const [k, v] of Object.entries(base)) stats[k] = Math.round(v * (1 + tier * 0.5) * 10) / 10;
  if (m.el && m.el !== 'physical') stats[`dmg_${m.el}`] = (stats[`dmg_${m.el}`] || 0) + 2 * tier;
  return { id: cardId, name: `${m.name} Card`, stats, boss: !!BOSSES[mid] };
}

// ---- Bosses with mechanics ----
// attack: { type, shape, windup, dmg (x boss dmg), r, len, w, arc, n, counter, wallStun, summon, ... }
const ATK = {
  slam: { type: 'aoe', shape: 'circle', at: 'target', r: 90, windup: 1.0, dmg: 2.0 },
  bigslam: { type: 'aoe', shape: 'circle', at: 'self', r: 180, windup: 1.4, dmg: 2.6 },
  cleave: { type: 'aoe', shape: 'cone', at: 'self', r: 170, arc: 100, windup: 0.8, dmg: 2.0 },
  line: { type: 'aoe', shape: 'line', at: 'self', len: 520, w: 70, windup: 1.0, dmg: 2.2 },
  cross: { type: 'aoe', shape: 'cross', at: 'self', len: 600, w: 60, windup: 1.2, dmg: 2.4 },
  donut: { type: 'aoe', shape: 'donut', at: 'self', r: 380, r2: 130, windup: 1.4, dmg: 2.4 },
  nova: { type: 'aoe', shape: 'circle', at: 'self', r: 230, windup: 1.3, dmg: 2.2 },
  meteor: { type: 'meteor', shape: 'circle', r: 80, windup: 1.3, dmg: 1.8, n: 1 },
  barrage: { type: 'barrage', n: 16, speed: 260, dmg: 0.9, windup: 0.6 },
  spiral: { type: 'barrage', n: 24, speed: 220, dmg: 0.8, windup: 0.5, spiral: true },
  charge: { type: 'charge', shape: 'line', len: 600, w: 80, windup: 1.0, dmg: 2.4, wallStun: true },
  counter: { type: 'aoe', shape: 'circle', at: 'self', r: 300, windup: 2.0, dmg: 3.5, counter: true },
  summon: { type: 'summon', n: 3, windup: 0.8 },
  weak: { type: 'weak', windup: 0.5, dur: 4 },
  teleport: { type: 'teleport', windup: 0.6 },
  enrage: { type: 'enrage', windup: 0.5 },
};
export const BOSS_ATTACKS = ATK;
const boss = (id, name, sprite, color, el, size, lv, phases, extra = {}) => ({ id, name, kind: sprite, sprite, tint: color, el, size, lv, phases, boss: true, ...extra });
export const BOSSES = {
  kingslime: boss('kingslime', 'Slime King Gloop', 'slime', '#6ad84a', 'poison', 40, 8, [
    { hp: 1, atk: ['slam', 'barrage', 'slam', 'summon'] }, { hp: 0.5, atk: ['bigslam', 'spiral', 'summon', 'meteor'], speed: 1.25 }], { minion: 'slime' }),
  direwolf: boss('direwolf', 'Alpha Direwolf Fenra', 'wolf', '#8a8a9a', 'physical', 36, 15, [
    { hp: 1, atk: ['charge', 'cleave', 'charge', 'summon'] }, { hp: 0.4, atk: ['charge', 'counter', 'cleave', 'enrage'], speed: 1.35 }], { minion: 'wolf' }),
  goblinchief: boss('goblinchief', 'Goblin Warchief Grak', 'orc', '#7a9a3a', 'physical', 38, 25, [
    { hp: 1, atk: ['cleave', 'slam', 'counter', 'summon'] }, { hp: 0.5, atk: ['charge', 'counter', 'meteor', 'cleave', 'enrage'], speed: 1.2 }], { minion: 'goblin' }),
  golemking: boss('golemking', 'Ancient Golem Throm', 'golem', '#9a8a7a', 'physical', 46, 40, [
    { hp: 1, atk: ['slam', 'charge', 'counter'] }, { hp: 0.6, atk: ['bigslam', 'weak', 'donut', 'charge'] }, { hp: 0.25, atk: ['counter', 'meteor', 'donut', 'enrage'], speed: 1.3 }]),
  krakenqueen: boss('krakenqueen', 'Kraken Queen Thalassa', 'siren', '#3a8ac8', 'ice', 42, 70, [
    { hp: 1, atk: ['line', 'barrage', 'donut', 'summon'] }, { hp: 0.5, atk: ['cross', 'spiral', 'donut', 'meteor'], speed: 1.2 }], { minion: 'crab' }),
  drownedking: boss('drownedking', 'Drowned King Morvath', 'skeleton', '#4a8a8a', 'shadow', 40, 95, [
    { hp: 1, atk: ['cleave', 'nova', 'counter', 'meteor'] }, { hp: 0.5, atk: ['teleport', 'cleave', 'counter', 'spiral', 'summon'], speed: 1.25 }], { minion: 'skeleton' }),
  yetilord: boss('yetilord', 'Yeti Lord Brumak', 'yeti', '#e0e8f0', 'ice', 44, 130, [
    { hp: 1, atk: ['slam', 'charge', 'counter'] }, { hp: 0.5, atk: ['charge', 'bigslam', 'meteor', 'enrage', 'counter'], speed: 1.3 }], { minion: 'wolf' }),
  frostwyrm: boss('frostwyrm', 'Frost Wyrm Kryssith', 'demon', '#8ad8ff', 'ice', 50, 160, [
    { hp: 1, atk: ['line', 'meteor', 'donut'] }, { hp: 0.6, atk: ['cross', 'charge', 'meteor', 'weak'] }, { hp: 0.3, atk: ['spiral', 'donut', 'cross', 'enrage'], speed: 1.3 }]),
  sandworm: boss('sandworm', 'Colossal Sandworm Ourak', 'scorpion', '#c8a058', 'physical', 50, 190, [
    { hp: 1, atk: ['charge', 'nova', 'meteor'] }, { hp: 0.5, atk: ['charge', 'donut', 'meteor', 'summon', 'weak'], speed: 1.25 }], { minion: 'scorpion' }),
  pharaoh: boss('pharaoh', 'Pharaoh Ankhamun', 'mummy', '#e8c84a', 'holy', 42, 220, [
    { hp: 1, atk: ['barrage', 'summon', 'teleport', 'donut'] }, { hp: 0.6, atk: ['spiral', 'counter', 'weak', 'cross'] }, { hp: 0.3, atk: ['teleport', 'meteor', 'spiral', 'counter', 'enrage'], speed: 1.3 }], { minion: 'mummy' }),
  infernal: boss('infernal', 'Infernal Titan Pyrrhus', 'demon', '#ff5a2a', 'fire', 54, 260, [
    { hp: 1, atk: ['meteor', 'slam', 'counter', 'line'] }, { hp: 0.6, atk: ['cross', 'meteor', 'donut', 'weak'] }, { hp: 0.3, atk: ['bigslam', 'spiral', 'counter', 'enrage'], speed: 1.35 }], { minion: 'imp' }),
  lich: boss('lich', 'Lich Emperor Vael', 'wraith', '#7aa8ff', 'shadow', 46, 280, [
    { hp: 1, atk: ['barrage', 'donut', 'summon', 'teleport'] }, { hp: 0.7, atk: ['spiral', 'weak', 'cross', 'meteor'] }, { hp: 0.4, atk: ['counter', 'summon', 'spiral', 'donut'] }, { hp: 0.15, atk: ['spiral', 'cross', 'meteor', 'enrage'], speed: 1.4 }], { minion: 'skeleton' }),
  abysslord: boss('abysslord', 'Abyss Lord Vhal-Zur', 'demon', '#9a3aff', 'arcane', 58, 300, [
    { hp: 1, atk: ['cleave', 'meteor', 'counter', 'summon'] }, { hp: 0.75, atk: ['cross', 'donut', 'teleport', 'weak'] }, { hp: 0.5, atk: ['spiral', 'charge', 'counter', 'meteor'] }, { hp: 0.2, atk: ['bigslam', 'spiral', 'cross', 'counter', 'enrage'], speed: 1.45 }], { minion: 'demon' }),
};
// world bosses = boss templates scaled up; spawn on a timer in a specific map
export const WORLD_BOSSES = [
  { id: 'wb_dragon', base: 'infernal', name: 'Elder Dragon Ignareth', map: 'aurelia_3', hpMul: 40, every: 1800, lvOffset: 0 },
  { id: 'wb_leviathan', base: 'krakenqueen', name: 'Leviathan of the Deep', map: 'mareth_5', hpMul: 45, every: 2400 },
  { id: 'wb_colossus', base: 'golemking', name: 'Worldsplitter Colossus', map: 'sandara_5', hpMul: 50, every: 3000 },
];

// ---- Dungeons ----
export const DUNGEONS = {
  story_aurelia: { type: 'story', name: 'Goblin Warrens', th: 'รังก็อบลิน', lv: 20, players: [1, 4], biome: 'cave', waves: [['aurelia_3_goblin', 6], ['aurelia_3_archer', 5], ['aurelia_3_orc', 3]], boss: 'goblinchief', story: 'หัวหน้าก็อบลินลักพาตัวชาวบ้านไปยังรังใต้ดิน' },
  story_mareth: { type: 'story', name: 'Sunken Temple', th: 'วิหารใต้สมุทร', lv: 85, players: [1, 4], biome: 'swamp', waves: [['mareth_6_skeleton', 7], ['mareth_6_wraith', 5]], boss: 'drownedking', story: 'ราชาผู้จมน้ำปลุกกองทัพจากซากเรือ' },
  story_frost: { type: 'story', name: 'Wyrm Glacier', th: 'ธารน้ำแข็งมังกร', lv: 150, players: [1, 4], biome: 'snow', waves: [['frosthold_2_elemental', 6], ['frosthold_6_knight', 5]], boss: 'frostwyrm', story: 'มังกรน้ำแข็งตื่นจากการหลับใหลพันปี' },
  story_sand: { type: 'story', name: 'Tomb of Ankhamun', th: 'สุสานฟาโรห์', lv: 210, players: [1, 4], biome: 'tomb', waves: [['sandara_3_mummy', 8], ['sandara_6_knight', 5]], boss: 'pharaoh', story: 'คำสาปฟาโรห์แผ่ไปทั่วทะเลทราย' },
  story_ember: { type: 'story', name: 'Heart of the Volcano', th: 'หัวใจภูเขาไฟ', lv: 260, players: [1, 4], biome: 'volcano', waves: [['ember_1_imp', 10], ['ember_2_golem', 4], ['ember_4_demon', 5]], boss: 'infernal', story: 'ไททันเพลิงพยายามเปิดประตูนรก' },
  abyss: { type: 'abyss', name: 'The Endless Abyss', th: 'อเวจีไร้ก้นบึ้ง', lv: 1, players: [1, 4], biome: 'abyss', scaling: true },
  hunt: { type: 'hunt', name: 'Boss Hunt', th: 'ล่าบอส', lv: 1, players: [1, 4], biome: 'arena' },
  raid_citadel: { type: 'raid', name: 'Abyssal Citadel', th: 'ป้อมปราการอเวจี', lv: 280, players: [4, 8], biome: 'abyss', waves: [['ember_5_demon', 12], ['ember_5_wraith', 10]], boss: 'abysslord', hpMul: 8 },
  raid_necro: { type: 'raid', name: 'Necropolis of Kings', th: 'นครแห่งราชันย์มรณะ', lv: 250, players: [4, 8], biome: 'tomb', waves: [['sandara_6_mummy', 12], ['ember_3_knight', 8]], boss: 'lich', hpMul: 7 },
};
export const ABYSS_MODIFIERS = [
  { id: 'haste', th: 'ศัตรูเร็วขึ้น 30%' }, { id: 'volatile', th: 'ศัตรูระเบิดเมื่อตาย' }, { id: 'armored', th: 'ศัตรู HP +50%' },
  { id: 'vampiric', th: 'ศัตรูดูดเลือด' }, { id: 'frenzy', th: 'ศัตรูดาเมจ +30%' }, { id: 'horde', th: 'ศัตรูมากขึ้น 50%' },
  { id: 'elemental', th: 'ศัตรูต้านธาตุ 30%' }, { id: 'regen', th: 'ศัตรูฟื้น HP' }, { id: 'treasure', th: 'ของดรอป +100%' },
];

// ---- Quests (data-driven; one kill quest per farm map + region story chain) ----
export const QUESTS = {};
for (const m of Object.values(MAPS)) {
  if (m.kind !== 'field') continue;
  m.monsters.forEach((mid, i) => {
    const q = { id: `q_${mid}`, name: `กำจัด ${MONSTERS[mid].name}`, region: m.region, map: m.id, target: mid, count: 15 + i * 5, lv: m.lv[0], reward: { exp: 0, gold: 0 } };
    QUESTS[q.id] = q;
  });
  QUESTS[`q_boss_${m.id}`] = { id: `q_boss_${m.id}`, name: `ล่าบอสแมพ ${BOSSES[m.fieldBoss].name} ที่ ${m.name}`, region: m.region, map: m.id, target: `boss:${m.fieldBoss}`, count: 1, lv: m.lv[0], reward: {} };
}

export const ARENA_MAPS = {
  duel: { w: 26, h: 20, biome: 'arena' }, arena3: { w: 34, h: 26, biome: 'arena' },
  bg10: { w: 80, h: 50, biome: 'plains', points: [[14, 25], [40, 25], [66, 25]] },
  guildwar: { w: 90, h: 60, biome: 'volcano' },
};
export const START_MAP = 'town_aurelia';
