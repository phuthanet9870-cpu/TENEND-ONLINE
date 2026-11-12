// ===== TENEND ONLINE : shared constants (used by server and browser) =====
export const TILE = 32;
export const TICK_RATE = 20;          // server simulation ticks / sec
export const SNAP_RATE = 10;          // snapshots / sec
export const MAX_LEVEL = 300;
export const VIEW_RADIUS = 900;       // interest management radius

export const ELEMENTS = ['physical', 'fire', 'ice', 'lightning', 'poison', 'holy', 'shadow', 'arcane'];
export const ELEMENT_INFO = {
  physical: { th: 'กายภาพ', color: '#e0d6c8', glow: '#ffffff' },
  fire: { th: 'ไฟ', color: '#ff7a2a', glow: '#ffd060' },
  ice: { th: 'น้ำแข็ง', color: '#7fd8ff', glow: '#e0f8ff' },
  lightning: { th: 'สายฟ้า', color: '#f3e04a', glow: '#ffffc0' },
  poison: { th: 'พิษ', color: '#7be04a', glow: '#d0ff90' },
  holy: { th: 'ศักดิ์สิทธิ์', color: '#ffe9a0', glow: '#fffbe8' },
  shadow: { th: 'เงา', color: '#9a5cff', glow: '#d8b8ff' },
  arcane: { th: 'อาคม', color: '#ff5cd6', glow: '#ffc8f2' },
};

export const RARITIES = ['common', 'magic', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_INFO = {
  common: { th: 'ธรรมดา', color: '#cfcfcf', affixes: [0, 0], sockets: [0, 1] },
  magic: { th: 'เวทมนตร์', color: '#5aa2ff', affixes: [1, 2], sockets: [0, 1] },
  rare: { th: 'หายาก', color: '#ffe14a', affixes: [3, 4], sockets: [0, 2] },
  epic: { th: 'มหากาพย์', color: '#c25cff', affixes: [4, 5], sockets: [1, 2] },
  legendary: { th: 'ตำนาน', color: '#ff9a2a', affixes: [4, 4], sockets: [1, 3] },
  mythic: { th: 'เทพนิยาย', color: '#ff3a5a', affixes: [5, 5], sockets: [2, 3] },
};

// Status effects (server applies; client renders)
export const STATUS = {
  burn: { th: 'เผาไหม้', color: '#ff7a2a', dot: true },
  poison: { th: 'พิษ', color: '#7be04a', dot: true, stacks: 10 },
  bleed: { th: 'เลือดไหล', color: '#d0203a', dot: true, stacks: 5 },
  chill: { th: 'หนาวเหน็บ', color: '#7fd8ff', stacks: 3 },
  freeze: { th: 'แช่แข็ง', color: '#bff0ff', cc: true },
  stun: { th: 'มึนงง', color: '#ffe14a', cc: true },
  shock: { th: 'ช็อต', color: '#f3e04a' },
  slow: { th: 'ช้า', color: '#88aaff' },
  mark: { th: 'ตีตรา', color: '#ff4a8a' },
  weaken: { th: 'อ่อนแรง', color: '#8a8a8a' },
  blind: { th: 'ตาบอด', color: '#333366' },
  shield: { th: 'โล่', color: '#a0e0ff' },
  haste: { th: 'เร่งความเร็ว', color: '#a0ffb0' },
  buff: { th: 'บัฟ', color: '#ffd060' },
  weak: { th: 'จุดอ่อนเปิด', color: '#ff2a2a' },
  silence: { th: 'ใบ้', color: '#aa66aa', cc: true },
  root: { th: 'ถูกตรึง', color: '#6a8a3a' },
  sunder: { th: 'เกราะแตก', color: '#c86a2a' },
  stealth: { th: 'ล่องหน', color: '#5a5a8a' },
  lex: { th: 'Lex Aeterna', color: '#ffd84a' },
  fear: { th: 'หวาดกลัว', color: '#7a2a7a' },
  parry: { th: 'ท่าปัดป้อง', color: '#e0e0ff' },
};
export const STATUS_BITS = Object.keys(STATUS);

export function expToNext(lv) {
  if (lv >= MAX_LEVEL) return Math.floor(60 * Math.pow(MAX_LEVEL, 1.62)); // mastery levels
  return Math.floor(40 * Math.pow(lv, 1.62) + 80 * lv + 60);
}

// Economy (gold sinks to control inflation)
export const ECONOMY = {
  marketFee: 0.06,          // 6% taken from seller on sale (destroyed)
  marketListFee: 0.01,      // 1% listing deposit (destroyed)
  repairPerDur: (ilvl) => Math.ceil(2 + ilvl * 0.35),
  resetBuild: (lv) => 200 + lv * lv * 2,
  rerollGold: (ilvl) => 150 + ilvl * 25,
  refineGold: (r, ilvl) => Math.floor((r + 1) * (r + 1) * (60 + ilvl * 6)),
  craftGold: (ilvl) => 100 + ilvl * 30,
  teleportGold: 120,
  guildCreate: 50000,
  socketPunch: (n) => 2000 * (n + 1) * (n + 1),
  deathDurability: 10,
};

// PvP global balance multipliers (individual skills can override with spec.pvp)
export const PVP_DEFAULT = { dmg: 0.55, heal: 0.6, cc: 0.5, leech: 0.4, minions: 0.5, shield: 0.6 };

export const PVP_MODES = {
  duel: { th: 'ดวล 1v1', size: 1, teams: 2, ranked: true, time: 240 },
  arena3: { th: 'อารีน่า 3v3', size: 3, teams: 2, ranked: true, time: 300 },
  bg10: { th: 'แบทเทิลกราวด์ 10v10', size: 10, teams: 2, ranked: false, time: 600, score: 1000 },
};

export const GUILD_RANKS = [
  { id: 'leader', th: 'หัวหน้ากิลด์', perm: ['all'] },
  { id: 'officer', th: 'รองหัวหน้า', perm: ['invite', 'kick', 'storage', 'war', 'quest'] },
  { id: 'member', th: 'สมาชิก', perm: ['storage_deposit'] },
  { id: 'recruit', th: 'ทดลองงาน', perm: [] },
];

export const HOTBAR_SIZE = 30; // 3 rows x 10: [1-0], [Shift+1-0], [Alt+1-0] (+ R for ultimate)
export const HOTBAR_ROWS = 3;
export const INVENTORY_SIZE = 60;
export const STASH_SIZE = 80;
export const GUILD_STORAGE_SIZE = 100;
