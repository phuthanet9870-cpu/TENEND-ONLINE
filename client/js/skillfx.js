// ===== Per-skill VFX recipes =====
// Every one of the 1,000 skills gets its own deterministic "recipe" built from what the skill actually does:
//   class motif (how that class's magic looks) • element palette with a per-skill hue shift • emblem picked from the
//   skill's NAME (Dragon → serpent, Meteor → star, Heal → heart …) • ground magic-circle geometry (sides/star step/rings)
//   • burst pattern chosen from its behaviour (projectile, nova, ground, melee, buff …) • motif particles
//   • overlays for each modifier (freeze → ice shards, pull → inward vortex, execute → red skull, mark → reticle …).
// buildRecipes() guarantees all 1,000 signatures are distinct.
import { SKILL_LIST } from '/shared/skills.js';
import { PAL, glow } from './fx2.js';
import { ROTATING, glyphSprite } from './fxglyphs.js';

const TAU = Math.PI * 2;
const R = Math.random;
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- colour helpers ----------
const toRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function hsl2rgb([h, s, l]) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
function shift(hex, dh, ds = 0, mix = null, mk = 0) { let c = toRgb(hex); if (mix) { const m = toRgb(mix); c = c.map((v, i) => v + (m[i] - v) * mk); } const [h, s, l] = rgb2hsl(c); return toHex(...hsl2rgb([(h + dh / 360 + 1) % 1, Math.max(0, Math.min(1, s + ds)), l])); }

// ---------- class motifs ----------
export const MOTIF = {
  warrior: { th: 'คมดาบเหล็กกล้า', accent: '#ff5a3a', parts: ['slash', 'p_chunk', 'spark'], embs: ['sword', 'axe', 'hammer', 'crown', 'fist'], proj: 'axe', cast: 'warcry' },
  paladin: { th: 'แสงศักดิ์สิทธิ์ทองคำ', accent: '#ffd84a', parts: ['p_cross', 'p_hex', 'plus'], embs: ['shield', 'cross', 'hammer', 'crown', 'sun'], proj: 'hammer', cast: 'sigil' },
  ranger: { th: 'ขนนกและสายลม', accent: '#8ad84a', parts: ['p_feather', 'p_leaf', 'spark'], embs: ['arrow', 'feather', 'bird', 'leaf', 'paw'], proj: 'arrow', cast: 'wind' },
  assassin: { th: 'ควันเงาและคมมีด', accent: '#c03aff', parts: ['p_dagger', 'puff', 'p_x'], embs: ['dagger', 'mask', 'eye', 'moon', 'scythe'], proj: 'dagger', cast: 'smoke' },
  arcanist: { th: 'วงเวทผลึกอาร์เคน', accent: '#5ac8ff', parts: ['star', 'p_crystal', 'p_rune'], embs: ['crystal', 'star', 'eye', 'hourglass', 'spiral'], proj: 'crystal', cast: 'circle' },
  necromancer: { th: 'วิญญาณและกระดูก', accent: '#5aff9a', parts: ['p_skull', 'wisp', 'p_bone'], embs: ['skull', 'bone', 'scythe', 'eye', 'moon'], proj: 'skull', cast: 'grave' },
  cleric: { th: 'ปีกขาวและรัศมี', accent: '#fff2b0', parts: ['p_feather', 'plus', 'p_cross'], embs: ['wing', 'cross', 'heart', 'sun', 'note'], proj: 'orb', cast: 'halo' },
  shaman: { th: 'วิญญาณธรรมชาติ', accent: '#4ad8a8', parts: ['p_leaf', 'wisp', 'p_chunk'], embs: ['totem', 'paw', 'leaf', 'tornado', 'rock'], proj: 'leaf', cast: 'spirit' },
  gunslinger: { th: 'ดินปืนและปลอกกระสุน', accent: '#ffb84a', parts: ['p_shell', 'spark', 'puff'], embs: ['bullet', 'gear', 'bomb', 'star', 'eye'], proj: 'bullet', cast: 'muzzle' },
  monk: { th: 'ปราณและกลีบบัว', accent: '#ffa040', parts: ['p_petal', 'ripple', 'spark'], embs: ['fist', 'palm', 'lotus', 'sun', 'wave'], proj: 'palm', cast: 'chi' },
};
// emblem from the skill's own name (first two matches are used)
const KEYWORDS = [
  [/dragon|serpent|snake|wyrm|hydra|naga/, 'serpent'], [/skull|bone|grave|corpse|lich|death|doom|reap|necro|undead|ghoul/, 'skull'], [/scythe|reaper|harvest/, 'scythe'],
  [/sword|blade|edge|slash|cut|cleave|saber|katana/, 'sword'], [/axe|chop|hew/, 'axe'], [/hammer|smash|crush|maul|pound|slam/, 'hammer'], [/spear|lance|pierc|impale|javelin|pike|thrust/, 'spear'],
  [/shield|guard|ward|wall|aegis|bulwark|bastion|fort|barrier|protect/, 'shield'], [/cross|crusade|judg|exorc|smite|sanct|saint|divine|holy|sacred/, 'cross'],
  [/angel|wing|seraph|heaven|celest/, 'wing'], [/heal|mend|life|heart|vital|renew|blood|vamp|leech|drain/, 'heart'], [/hymn|song|chant|choir|requiem|melod|drum|psalm/, 'note'],
  [/arrow|volley|shot|snipe|bow|quiver|barrage/, 'arrow'], [/feather|hawk|eagle|falcon|crow|raven|owl|bird|phoenix|wing/, 'bird'],
  [/dagger|knife|stab|shiv|fang|venom|toxin|assassin/, 'dagger'], [/mask|shadow|shade|veil|night|phantom|ghost|wraith|stealth|cloak/, 'mask'],
  [/eye|sight|gaze|mark|hunter|seek|focus|scope/, 'eye'], [/fire|flame|blaze|inferno|burn|cinder|ember|lava|magma|pyre|scorch|ignit|napalm/, 'flame'],
  [/frost|ice|blizzard|snow|glacier|freez|cold|winter|hail|chill|crystal/, 'snow'], [/thunder|lightning|storm|spark|volt|shock|static|tempest/, 'bolt'],
  [/water|tide|wave|rain|aqua|torrent|flood|geyser|surf|mist/, 'drop'], [/leaf|thorn|vine|root|nature|wild|grove|bloom|seed|sprout|verdant/, 'leaf'],
  [/moon|lunar|eclipse|dusk/, 'moon'], [/sun|solar|dawn|radian|light|shine/, 'sun'], [/star|astral|comet|meteor|nova|cosmic|celestial|galax/, 'star'],
  [/fist|punch|knuckle|strike|kick|blow|jab|uppercut/, 'fist'], [/palm|hand|touch/, 'palm'], [/lotus|zen|chakra|mantra|chi|ki\b|qi|meditat|enlight|buddha|vajra/, 'lotus'],
  [/wolf|bear|beast|tiger|claw|paw|maul|feral|lion|boar|primal/, 'paw'], [/bullet|gun|pistol|rifle|round|revolver|shell|buckshot|slug|ammo/, 'bullet'],
  [/bomb|grenade|mine|dynamite|cannon|blast|explos|charge|barrel/, 'bomb'], [/gear|turret|drone|mech|engine|rocket|cog/, 'gear'],
  [/king|crown|royal|lord|command|war|banner|general|emperor|tyrant/, 'crown'], [/vortex|cyclone|tornado|whirl|twister|gale|wind|tempest|gust/, 'tornado'],
  [/spiral|time|haste|clock|quick|chrono/, 'hourglass'], [/chain|link|bind|hook|shackle|tether/, 'chain'], [/totem|spirit|ancestor|shaman|idol/, 'totem'],
  [/quake|earth|stone|rock|boulder|terra|mountain|tremor|fissure/, 'rock'], [/arcane|mana|prism|rune|sigil|glyph|magic|missile|orb/, 'crystal'],
];
const EMB_TH = { sword: 'ดาบ', axe: 'ขวาน', hammer: 'ค้อน', spear: 'หอก', shield: 'โล่', cross: 'กางเขน', wing: 'ปีกเทวดา', heart: 'หัวใจ', note: 'ตัวโน้ต', arrow: 'ลูกศร', bird: 'นกเหยี่ยว', dagger: 'มีดสั้น', mask: 'หน้ากากเงา', eye: 'ดวงตา', flame: 'เปลวไฟ', snow: 'เกล็ดหิมะ', bolt: 'สายฟ้า', drop: 'หยดน้ำ', leaf: 'ใบไม้', moon: 'จันทร์เสี้ยว', sun: 'ดวงอาทิตย์', star: 'ดวงดาว', fist: 'กำปั้น', palm: 'ฝ่ามือ', lotus: 'ดอกบัว', paw: 'อุ้งเท้าสัตว์', bullet: 'กระสุน', bomb: 'ระเบิด', gear: 'เฟือง', crown: 'มงกุฎ', tornado: 'พายุหมุน', hourglass: 'นาฬิกาทราย', chain: 'โซ่', totem: 'โทเท็ม', rock: 'หินผา', crystal: 'ผลึก', serpent: 'มังกร/อสรพิษ', skull: 'หัวกะโหลก', scythe: 'เคียวยมทูต', bone: 'กระดูก', spiral: 'เกลียววน', wave: 'คลื่นปราณ', orb: 'ลูกแก้ว' };
// burst patterns by behaviour
const PATTERNS = {
  melee: ['cross', 'starburst', 'shock', 'radial', 'fan'], dash: ['fan', 'starburst', 'radial', 'shock'], leap: ['shock', 'pulse', 'crater', 'radial', 'rain'],
  projectile: ['radial', 'starburst', 'cross', 'fan', 'spiral'], barrage: ['radial', 'starburst', 'rain', 'cross'], chain: ['starburst', 'radial', 'spiral'],
  beam: ['starburst', 'cross', 'radial', 'pulse'], nova: ['spiral', 'pulse', 'ring', 'petals', 'shock', 'crater'], ground: ['rain', 'spiral', 'pillar', 'pulse', 'petals', 'crater', 'ring'],
  trap: ['crater', 'radial', 'ring', 'cross'], buff: ['ring', 'fountain', 'helix', 'petals'], heal: ['fountain', 'petals', 'ring', 'helix'], summon: ['pillar', 'helix', 'ring', 'fountain'],
  totem: ['pillar', 'ring', 'helix', 'pulse'], orbit: ['ring', 'spiral', 'helix'],
};
const PAT_TH = { cross: 'กระจายเป็นกากบาท', starburst: 'ประกายแฉกพุ่ง', shock: 'คลื่นกระแทก', radial: 'ระเบิดรอบทิศ', fan: 'พัดคลื่นด้านหน้า', pulse: 'คลื่นซ้อนหลายชั้น', crater: 'หลุมแตกพร้อมเศษหิน', rain: 'ฝนอนุภาคตกจากฟ้า', spiral: 'เกลียววนออก', ring: 'วงแหวนลอยขึ้น', petals: 'กลีบบานออก', pillar: 'เสาพลังพุ่งขึ้น', fountain: 'น้ำพุอนุภาค', helix: 'เกลียวคู่หมุนขึ้น' };
const PART_TH = { slash: 'รอยฟัน', p_chunk: 'เศษหิน', spark: 'ประกายไฟ', p_cross: 'กางเขนเล็ก', p_hex: 'เกล็ดโล่หกเหลี่ยม', plus: 'แสงระยิบ', p_feather: 'ขนนก', p_leaf: 'ใบไม้', p_dagger: 'มีดบิน', puff: 'ควัน', p_x: 'รอยกากบาท', star: 'ดาวประกาย', p_crystal: 'เศษผลึก', p_rune: 'อักษรรูน', p_skull: 'กะโหลกเล็ก', wisp: 'ดวงวิญญาณ', p_bone: 'เศษกระดูก', p_shell: 'ปลอกกระสุน', p_petal: 'กลีบดอก', ripple: 'วงคลื่นปราณ' };
export const ELEM_EXTRA = { fire: 'ไฟ', ice: 'น้ำแข็ง', lightning: 'สายฟ้า', poison: 'พิษ', holy: 'ศักดิ์สิทธิ์', shadow: 'เงามืด', arcane: 'อาร์เคน', physical: 'กายภาพ' };

// ---------- recipe construction ----------
const RECIPES = [];
function makeRecipe(def, salt) {
  const r = rng(hash(def.id + '#' + salt));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const M = MOTIF[def.classId] || MOTIF.warrior;
  const name = def.name.toLowerCase();
  const found = []; for (const [re, e] of KEYWORDS) if (re.test(name) && !found.includes(e)) found.push(e);
  const emb = found[0] || M.embs[Math.floor(r() * M.embs.length)];
  const emb2 = found[1] || M.embs.filter((e) => e !== emb)[Math.floor(r() * (M.embs.length - 1))];
  const el = def.el || 'physical';
  const base = PAL[el] || PAL.physical;
  const dh = (r() - 0.5) * 56 + (salt ? salt * 9 : 0), mk = 0.12 + r() * 0.22;
  const pal = base.map((c, i) => (i === 0 ? c : shift(c, dh, (r() - 0.5) * 0.2, M.accent, mk)));
  const beh = def.behavior;
  const pattern = pick(PATTERNS[beh] || PATTERNS.nova);
  const parts = [...M.parts]; const part = pick(parts), part2 = pick(parts.filter((p) => p !== part));
  const sides = 3 + Math.floor(r() * 6), step = sides >= 5 && r() < 0.55 ? 2 : 1;
  const rings = 1 + Math.floor(r() * 3), spin = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 2.2), ticks = [0, 8, 12, 16, 24][Math.floor(r() * 5)];
  const projEmb = ROTATING.has(emb) ? emb : ROTATING.has(emb2) && r() < 0.5 ? emb2 : ['skull', 'flame', 'snow', 'star', 'crystal', 'bolt', 'drop', 'leaf', 'bomb', 'heart', 'eye', 'moon', 'sun', 'gear', 'note', 'fist', 'palm', 'hammer', 'axe', 'bone'].includes(emb) ? emb : M.proj;
  const count = 14 + Math.floor(r() * 18);
  return { n: def.n, id: def.id, cls: def.classId, M, name: def.name, el, pal, glowC: pal[2], emb, emb2, pattern, part, part2, sides, step, rings, spin, ticks, inner: r() < 0.5,
    projEmb, projSpin: !ROTATING.has(projEmb), count, mods: def.mods || [], beh, ult: def.kind === 'ultimate', size: def.kind === 'ultimate' ? 1.6 : 1 };
}
const sigOf = (x) => [x.cls, x.el, x.emb, x.emb2, x.pattern, x.part, x.part2, x.sides + '/' + x.step, x.rings, x.projEmb, Math.round(toRgb(x.pal[2])[0] / 24), x.mods.join('+')].join('|');
export function buildRecipes() {
  if (RECIPES.length) return RECIPES;
  const seen = new Set();
  for (const def of SKILL_LIST) { let s = 0, rc; do { rc = makeRecipe(def, s++); } while (seen.has(sigOf(rc)) && s < 40); seen.add(sigOf(rc)); RECIPES[def.n] = rc; }
  return RECIPES;
}
export const recipeOf = (n) => (n == null ? null : (RECIPES.length || buildRecipes(), RECIPES[n]));
export const recipeSignature = sigOf;
export function describeFx(rc) {
  return `${rc.M.th} • ตรา${EMB_TH[rc.emb] || rc.emb} + ${EMB_TH[rc.emb2] || rc.emb2} • วงเวท ${rc.sides} เหลี่ยม${rc.step > 1 ? ' (ดาว)' : ''} ${rc.rings} ชั้น • ${PAT_TH[rc.pattern]} • อนุภาค${PART_TH[rc.part]}/${PART_TH[rc.part2]}`;
}

// ---------- emit helpers ----------
export function partOf(F, rc, kind, x, y, vx, vy, life, extra = {}) {
  const pal = rc.pal;
  switch (kind) {
    case 'slash': F.add({ x, y, vx: 0, vy: 0, shape: 'slash', r: 18 + R() * 16, ang: Math.atan2(vy, vx), arc: 1.6, w: 6, pal, life: life * 0.6, dir: R() < 0.5 ? -1 : 1, ...extra }); return;
    case 'spark': F.add({ x, y, vx, vy, life: life * 0.6, pal, shape: 'spark', size: 2, g: 160, drag: 0.92, ...extra }); return;
    case 'plus': F.add({ x, y, vx, vy: vy - 30, life, pal, shape: 'plus', size: 2 + R() * 2, drag: 0.94, ...extra }); return;
    case 'star': F.add({ x, y, vx, vy, life, pal, shape: 'star', size: 3, drag: 0.92, rot: R() * TAU, vr: 8, ...extra }); return;
    case 'wisp': F.add({ x, y, vx: vx * 0.5, vy: vy * 0.5 - 50, life: life * 1.3, pal, shape: 'wisp', size: 3, drag: 0.97, ...extra }); return;
    case 'puff': F.add({ x, y, vx: vx * 0.4, vy: vy * 0.4 - 10, life: life * 1.3, pal: [pal[3], pal[4], '#1a1420'], shape: 'puff', size: 4, size2: 12, add: false, alpha: 0.5, drag: 0.94, ...extra }); return;
    case 'ripple': F.add({ x, y, vx: 0, vy: 0, shape: 'ring', life: life * 0.8, r0: 4, r1: 26, pal: ['#ffffff', pal[2]], size: 2, ...extra }); return;
    case 'p_rune': kind = 'p_rune' + (1 + Math.floor(R() * 4)); break;
    default: break;
  }
  const brass = kind === 'p_shell';
  F.add({ x, y, vx, vy, life, shape: 'bmp', key: kind, c1: brass ? '#d8a030' : pal[2], c2: brass ? '#fff0a0' : pal[1], size: 2, rot: R() * TAU, vr: (R() - 0.5) * 10, drag: 0.93, g: brass ? 520 : 60, add: false, floor: brass ? y + 14 : undefined, ...extra });
}
export function emblem(F, rc, x, y, scale, life = 0.8, rise = 40, extra = {}) {
  F.add({ x, y, vx: 0, vy: -rise, drag: 0.94, life, shape: 'bmp', key: rc.emb, c1: rc.pal[2], c2: rc.pal[1], size: scale, size2: scale + 1, glow: rc.glowC, add: false, ...extra });
}
export function glyphCircle(F, rc, x, y, r, life = 0.7, extra = {}) {
  F.add({ x, y, vx: 0, vy: 0, shape: 'glyph', life, r, pal: rc.pal, sides: rc.sides, step: rc.step, rings: rc.rings, spin: rc.spin, ticks: rc.ticks, inner: rc.inner, rot0: R() * TAU, w: rc.ult ? 3 : 2, ...extra });
}

export function burst(F, rc, x, y, r, ang = 0) {
  const n = Math.round(rc.count * Math.min(1.8, 0.6 + r / 110) * rc.size), P = rc.pattern, K = [rc.part, rc.part2];
  const pk = (i) => K[i % 3 === 2 ? 1 : 0];
  switch (P) {
    case 'cross': case 'starburst': {
      const rays = P === 'cross' ? (rc.sides % 2 ? 4 : 8) : rc.sides + 2;
      for (let i = 0; i < n; i++) { const a = ang + (Math.floor(i % rays) / rays) * TAU + (R() - 0.5) * 0.12, s = r * (1.4 + R() * 2.6); partOf(F, rc, i % 2 ? 'spark' : pk(i), x, y - 8, Math.cos(a) * s, Math.sin(a) * s * 0.55, 0.45 + R() * 0.3); }
      break;
    }
    case 'fan': for (let i = 0; i < n; i++) { const a = ang + (R() - 0.5) * 1.6, s = r * (1.6 + R() * 2.4); partOf(F, rc, pk(i), x, y - 8, Math.cos(a) * s, Math.sin(a) * s * 0.55, 0.45 + R() * 0.3); } break;
    case 'radial': for (let i = 0; i < n; i++) { const a = (i / n) * TAU, s = r * (1.2 + R() * 1.6); partOf(F, rc, pk(i), x, y - 8, Math.cos(a) * s, Math.sin(a) * s * 0.55 - 20, 0.5 + R() * 0.3); } break;
    case 'shock': case 'crater': {
      for (let k = 0; k < (P === 'shock' ? 3 : 1); k++) setTimeout(() => F.add({ x, y, vx: 0, vy: 0, shape: 'ring', life: 0.45, r0: r * 0.15, r1: r * (1.1 + k * 0.25), pal: ['#ffffff', rc.pal[1], rc.pal[2]], size: 4 - k }), k * 90);
      for (let i = 0; i < n; i++) { const a = R() * TAU, s = r * (1 + R() * 2); partOf(F, rc, P === 'crater' && i % 2 ? 'p_chunk' : pk(i), x, y - 4, Math.cos(a) * s, Math.sin(a) * s * 0.5 - 120 - R() * 120, 0.7 + R() * 0.3, { g: 520, floor: y + Math.sin(a) * r * 0.3 }); }
      if (P === 'crater') F.dust(x, y, r);
      break;
    }
    case 'pulse': for (let k = 0; k < 4; k++) setTimeout(() => { F.add({ x, y, vx: 0, vy: 0, shape: 'ring', life: 0.5, r0: r * 0.1, r1: r * (0.6 + k * 0.2), pal: [rc.pal[0], rc.pal[2]], size: 3 }); for (let i = 0; i < n / 4; i++) { const a = R() * TAU; partOf(F, rc, pk(i), x + Math.cos(a) * r * (0.3 + k * 0.2), y + Math.sin(a) * r * (0.15 + k * 0.1), 0, -30, 0.5); } }, k * 110); break;
    case 'rain': for (let i = 0; i < n; i++) { const a = R() * TAU, d = r * Math.sqrt(R()); const tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d * 0.5; setTimeout(() => { partOf(F, rc, pk(i), tx - 40, ty - 220, 180, 540, 0.4, { drag: 1, g: 0 }); setTimeout(() => partOf(F, rc, 'spark', tx, ty, (R() - 0.5) * 120, -60, 0.3), 380); }, R() * 380); } break;
    case 'spiral': { const arms = 2 + (rc.sides % 4); for (let i = 0; i < n; i++) { const arm = i % arms, k = i / n; partOf(F, rc, pk(i), x, y, 0, 0, 0.8, { orb: { cx: x, cy: y - 6, a0: (arm / arms) * TAU + k * 3, spin: rc.spin * 3, r0: 4, r1: r * (0.7 + k * 0.5), ease: 1, lift: 20 } }); } break; }
    case 'ring': for (let i = 0; i < n; i++) { const a = (i / n) * TAU; partOf(F, rc, pk(i), x, y, 0, 0, 1, { orb: { cx: x, cy: y, a0: a, spin: rc.spin, r0: r * 0.8, r1: r * 0.6, lift: 70 + R() * 30 } }); } break;
    case 'petals': { const pe = rc.sides + 2; for (let i = 0; i < pe * 3; i++) { const a = ((i % pe) / pe) * TAU, k = Math.floor(i / pe); partOf(F, rc, i % 2 ? rc.part : 'p_petal', x, y, 0, 0, 0.9, { orb: { cx: x, cy: y - 4, a0: a + k * 0.2, spin: rc.spin * 0.6, r0: 6, r1: r * (0.5 + k * 0.25), ease: 1, lift: 10 } }); } F.light(x, y, r * 1.4, rc.glowC, 0.4); break; }
    case 'pillar': { F.add({ x, y, shape: 'beam', life: 0.7, w: Math.min(50, r * 0.45), h: 260, pal: rc.pal, vx: 0, vy: 0 }); for (let i = 0; i < n; i++) partOf(F, rc, pk(i), x + (R() - 0.5) * r * 0.5, y - R() * 30, (R() - 0.5) * 30, -160 - R() * 220, 0.7, { g: 0, drag: 0.97 }); break; }
    case 'fountain': for (let i = 0; i < n; i++) partOf(F, rc, pk(i), x + (R() - 0.5) * 16, y - 10, (R() - 0.5) * r * 2, -200 - R() * 200, 0.9, { g: 420, drag: 0.99 }); break;
    case 'helix': for (let i = 0; i < n; i++) { const k = i / n; partOf(F, rc, pk(i), x, y, 0, 0, 1.1, { orb: { cx: x, cy: y, a0: (i % 2) * Math.PI + k * 6, spin: rc.spin * 2.5, r0: r * 0.45, r1: r * 0.3, lift: 90 + k * 60 } }); } break;
  }
}
export const MOD_FX = {
  freeze: (F, rc, x, y, r) => { for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; F.add({ x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.25, vx: 0, vy: 0, life: 0.9, pal: PAL.ice, shape: 'shard', size: 5, size2: 3, rot: a, vr: 0, add: false, g: 0 }); } F.light(x, y, r, '#9adfff', 0.4); },
  chill: (F, rc, x, y, r) => { for (let i = 0; i < 12; i++) F.add({ x: x + (R() - 0.5) * r, y: y - 50 - R() * 40, vx: -10, vy: 50, life: 0.9, pal: ['#ffffff', '#c8f0ff'], shape: 'plus', size: 2, drag: 1 }); },
  burn: (F, rc, x, y, r) => { F.embers(x, y, 10, r); F.flame(x, y, 6, r * 0.6, 70, 2, 0.5); },
  shock: (F, rc, x, y, r) => { for (let i = 0; i < 3; i++) { const a = R() * TAU; F.bolt(x, y - 10, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.45, '#c8e0ff', 0.18, 1.5, 0); } },
  poison: (F, rc, x, y, r) => F.poisonBurst(x, y, r * 0.6),
  bleed: (F, rc, x, y) => { for (let i = 0; i < 8; i++) F.add({ x, y: y - 14, vx: (R() - 0.5) * 120, vy: -80 - R() * 60, life: 0.6, shape: 'bmp', key: 'p_drop', c1: '#c0102a', c2: '#ff5a5a', size: 2, g: 500, drag: 0.98, add: false, floor: y + 6 }); },
  stun: (F, rc, x, y) => { for (let i = 0; i < 5; i++) F.add({ x, y, vx: 0, vy: 0, life: 1, pal: ['#ffffff', '#ffe14a'], shape: 'star', size: 3, rot: 0, vr: 6, orb: { cx: x, cy: y - 40, a0: (i / 5) * TAU, spin: 6, r0: 16, r1: 16 } }); },
  slow: (F, rc, x, y) => F.add({ x, y: y - 30, vx: 0, vy: -20, life: 0.9, shape: 'bmp', key: 'hourglass', c1: '#8a9ac8', c2: '#d8e0ff', size: 2, add: false, drag: 0.95 }),
  root: (F, rc, x, y, r) => { for (let i = 0; i < 10; i++) { const a = R() * TAU; F.add({ x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.2, vx: 0, vy: -60, life: 0.7, shape: 'bmp', key: 'p_leaf', c1: '#4a9a3a', c2: '#9adf6a', size: 2, rot: -1.2, add: false, drag: 0.9 }); } },
  blind: (F, rc, x, y, r) => F.smoke(x, y - 10, 6, r * 0.5, 20, 0.9, true),
  weaken: (F, rc, x, y) => F.add({ x, y: y - 40, vx: 0, vy: 20, life: 0.8, shape: 'bmp', key: 'p_x', c1: '#8a6a6a', c2: '#c8a8a8', size: 3, add: false }),
  silence: (F, rc, x, y) => F.add({ x, y: y - 46, vx: 0, vy: -10, life: 0.9, shape: 'bmp', key: 'p_x', c1: '#c83aff', c2: '#f0a8ff', size: 4, add: false }),
  fear: (F, rc, x, y) => F.add({ x, y: y - 50, vx: 0, vy: -20, life: 1, shape: 'bmp', key: 'eye', c1: '#6a2aa8', c2: '#c87aff', size: 2, glow: '#9a5cff', add: false }),
  mark: (F, rc, x, y) => F.add({ x, y: y - 16, vx: 0, vy: 0, life: 0.9, shape: 'reticle', r: 16, pal: ['#ffffff', '#ff5a5a', '#ff2a2a'], size: 2 }),
  lex: (F, rc, x, y) => F.add({ x, y: y - 16, vx: 0, vy: 0, life: 1, shape: 'reticle', r: 20, pal: ['#ffffff', '#ffd84a', '#ff9a2a'], size: 2 }),
  sunder: (F, rc, x, y) => { for (let i = 0; i < 8; i++) F.add({ x, y: y - 16, vx: (R() - 0.5) * 180, vy: -100 - R() * 80, life: 0.7, shape: 'bmp', key: 'p_hex', c1: '#8a8a92', c2: '#d8d8e0', size: 2, g: 520, add: false, rot: R() * TAU, vr: 10, floor: y + 4 }); },
  knockup: (F, rc, x, y, r) => { F.add({ x, y, vx: 0, vy: 0, shape: 'ring', life: 0.4, r0: 6, r1: r, pal: ['#ffffff', '#d8c8a8'], size: 4 }); F.dust(x, y, r * 0.6); },
  knock: (F, rc, x, y, r, a) => { for (let i = 0; i < 10; i++) { const b = a + (R() - 0.5) * 1.2; F.add({ x, y: y - 10, vx: Math.cos(b) * 380, vy: Math.sin(b) * 200, life: 0.3, pal: ['#ffffff', rc.pal[1]], shape: 'spark', size: 2 }); } },
  pull: (F, rc, x, y, r) => { for (let i = 0; i < 18; i++) partOf(F, rc, 'spark', x, y, 0, 0, 0.5, { orb: { cx: x, cy: y - 6, a0: R() * TAU, spin: 5, r0: r * 1.1, r1: 2, ease: 1 } }); },
  leech: (F, rc, x, y) => { for (let i = 0; i < 6; i++) F.add({ x: x + (R() - 0.5) * 20, y: y - 14, vx: (R() - 0.5) * 40, vy: -70 - R() * 50, life: 0.8, shape: 'bmp', key: 'p_heart', c1: '#d82a4a', c2: '#ff8aa8', size: 2, add: false, drag: 0.97 }); },
  heal: (F, rc, x, y, r) => F.healBurst(x, y, Math.min(60, r)),
  regen: (F, rc, x, y) => { for (let i = 0; i < 6; i++) F.add({ x: x + (R() - 0.5) * 30, y, vx: 0, vy: -50, life: 0.9, pal: PAL.heal, shape: 'plus', size: 2 }); },
  shield: (F, rc, x, y) => { for (let i = 0; i < 12; i++) partOf(F, rc, 'p_hex', x, y, 0, 0, 0.8, { orb: { cx: x, cy: y - 16, a0: (i / 12) * TAU, spin: 2, r0: 34, r1: 30, lift: 0 } }); },
  block: (F, rc, x, y) => F.add({ x, y: y - 30, vx: 0, vy: -15, life: 0.8, shape: 'bmp', key: 'shield', c1: '#8ab8e8', c2: '#e0f0ff', size: 2, add: false }),
  haste: (F, rc, x, y) => { for (let i = 0; i < 8; i++) F.add({ x: x + 20, y: y - 6 - R() * 30, vx: -260, vy: 0, life: 0.3, pal: ['#ffffff', '#a8f0ff'], shape: 'spark', size: 1.5, drag: 1 }); },
  cdr: (F, rc, x, y) => F.add({ x, y: y - 30, vx: 0, vy: -15, life: 0.8, shape: 'bmp', key: 'hourglass', c1: rc.pal[2], c2: rc.pal[1], size: 2, add: false }),
  execute: (F, rc, x, y) => F.add({ x, y: y - 30, vx: 0, vy: -30, life: 0.9, shape: 'bmp', key: 'skull', c1: '#c8102a', c2: '#ff6a6a', size: 3, size2: 4, glow: '#ff2a2a', add: false }),
  crit: (F, rc, x, y) => { F.add({ x, y: y - 14, vx: 0, vy: 0, life: 0.3, pal: ['#ffffff', '#ffe14a'], shape: 'star', size: 14, size2: 4, rot: 0, vr: 4 }); F.light(x, y, 60, '#fff4c0', 0.15); },
  pierce: (F, rc, x, y, r, a) => F.add({ x, y: y - 10, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.18, pal: ['#ffffff', rc.pal[1]], shape: 'spark', size: 3, drag: 1 }),
  detonate: (F, rc, x, y, r) => setTimeout(() => F.explosion(x, y, Math.min(110, r), rc.el === 'physical' ? 'fire' : rc.el), 220),
  linger: (F, rc, x, y, r) => glyphCircle(F, rc, x, y, r, 1.4, { spin: rc.spin * 0.3 }),
  taunt: (F, rc, x, y) => F.add({ x, y: y - 40, vx: 0, vy: -20, life: 0.9, shape: 'bmp', key: 'crown', c1: '#d83a2a', c2: '#ffa08a', size: 2, add: false }),
  cleanse: (F, rc, x, y) => { for (let i = 0; i < 12; i++) F.add({ x: x + (R() - 0.5) * 30, y: y - 10, vx: (R() - 0.5) * 60, vy: -120 - R() * 80, life: 0.8, pal: ['#ffffff', '#c8fff8'], shape: 'star', size: 2, rot: 0, vr: 6, g: 120 }); },
  aura: (F, rc, x, y, r) => glyphCircle(F, rc, x, y, Math.max(r, 90), 1, { spin: 0.4 }),
  echo: (F, rc, x, y, r) => setTimeout(() => F.add({ x, y, vx: 0, vy: 0, shape: 'ring', life: 0.4, r0: r * 0.2, r1: r, pal: [rc.pal[0], rc.pal[2]], size: 2 }), 160),
  chain: () => {}, fork: () => {}, homing: () => {}, x2: () => {}, x3: () => {}, big: () => {}, wide: () => {}, fast: () => {}, heavy: () => {}, long: () => {},
};

// ---------- public VFX entry points ----------
export const SFX = {
  cast(F, rc, x, y, ang, noCircle) {
    if (!noCircle) glyphCircle(F, rc, x, y + 2, rc.ult ? 90 : 34, rc.ult ? 1.1 : 0.55);
    const fx = x + Math.cos(ang) * 22, fy = y - 18 + Math.sin(ang) * 12;
    switch (rc.M.cast) {
      case 'warcry': F.dust(x, y, 26); partOf(F, rc, 'slash', fx, fy, Math.cos(ang), Math.sin(ang), 0.4, { r: 26, w: 7 }); break;
      case 'sigil': F.add({ x, y: y - 50, vx: 0, vy: -20, life: 0.6, shape: 'bmp', key: 'cross', c1: rc.pal[2], c2: rc.pal[1], size: 2, glow: rc.glowC, add: false }); F.light(x, y - 30, 70, rc.glowC, 0.3); break;
      case 'wind': for (let i = 0; i < 8; i++) F.add({ x: x - Math.cos(ang) * 10, y: y - 10 - R() * 30, vx: -Math.cos(ang) * 240 + (R() - 0.5) * 40, vy: -Math.sin(ang) * 120, life: 0.3, pal: ['#ffffff', rc.pal[1]], shape: 'spark', size: 1.5, drag: 0.95 }); partOf(F, rc, 'p_feather', x, y - 30, (R() - 0.5) * 60, -40, 0.8, { g: 40 }); break;
      case 'smoke': F.smoke(x, y - 6, 5, 22, 14, 0.7, true); partOf(F, rc, 'p_x', fx, fy, 0, -20, 0.4); break;
      case 'circle': F.add({ x, y: y - 20, shape: 'runering', life: 0.6, r0: 12, r1: 30, pal: rc.pal, vx: 0, vy: 0 }); for (let i = 0; i < 6; i++) partOf(F, rc, 'star', x, y, 0, 0, 0.6, { orb: { cx: x, cy: y, a0: (i / 6) * TAU, spin: 6, r0: 26, r1: 8, lift: 50 } }); break;
      case 'grave': emblem(F, { ...rc, emb: 'skull' }, x, y - 40, 2, 0.7, 50); for (let i = 0; i < 6; i++) partOf(F, rc, 'wisp', x + (R() - 0.5) * 30, y, 0, -40, 0.8); break;
      case 'halo': F.add({ x, y: y - 56, vx: 0, vy: 0, shape: 'ring', life: 0.7, r0: 10, r1: 14, pal: ['#ffffff', '#fff2b0'], size: 3 }); for (let i = 0; i < 5; i++) partOf(F, rc, 'p_feather', x + (R() - 0.5) * 40, y - 70, (R() - 0.5) * 30, 30, 1.1, { g: 20, drag: 0.98 }); break;
      case 'spirit': for (let i = 0; i < 10; i++) partOf(F, rc, i % 2 ? 'p_leaf' : 'wisp', x, y, 0, 0, 0.9, { orb: { cx: x, cy: y, a0: (i / 10) * TAU, spin: 5, r0: 28, r1: 10, lift: 70 } }); break;
      case 'muzzle': F.add({ x: fx, y: fy, vx: 0, vy: 0, life: 0.12, pal: ['#ffffff', '#ffe080', '#ff8a2a'], shape: 'star', size: 10, size2: 4, rot: ang, vr: 0 }); F.light(fx, fy, 50, '#ffcc66', 0.12); partOf(F, rc, 'p_shell', x, y - 22, -Math.cos(ang) * 60 + (R() - 0.5) * 40, -160, 1.1); F.smoke(fx, fy, 2, 6, 20, 0.6); break;
      case 'chi': for (let k = 0; k < 2; k++) setTimeout(() => F.add({ x, y, vx: 0, vy: 0, shape: 'ring', life: 0.4, r0: 8, r1: 40, pal: ['#ffffff', rc.pal[2]], size: 3 }), k * 90); partOf(F, rc, 'p_petal', x, y - 30, (R() - 0.5) * 60, -40, 0.8); break;
    }
  },
  impact(F, rc, x, y, r, ang = 0) {
    r = Math.max(30, Math.min(260, r || 60)) * (rc.ult ? 1.2 : 1);
    glyphCircle(F, rc, x, y, r * 0.9, rc.ult ? 1.2 : 0.75);
    burst(F, rc, x, y, r, ang);
    emblem(F, rc, x, y - 30, rc.ult ? 5 : r > 110 ? 4 : 3, rc.ult ? 1.3 : 0.75, 40);
    F.light(x, y - 10, r * 1.3, rc.glowC, 0.3);
    for (const m of rc.mods) (MOD_FX[m] || (() => {}))(F, rc, x, y, r, ang);
  },
  hit(F, rc, x, y, crit) {
    for (let i = 0; i < (crit ? 6 : 3); i++) { const a = R() * TAU, s = 80 + R() * 100; partOf(F, rc, i % 2 ? rc.part2 : rc.part, x, y, Math.cos(a) * s, Math.sin(a) * s * 0.6 - 40, 0.45); }
    if (crit) F.add({ x, y, vx: 0, vy: -40, life: 0.5, shape: 'bmp', key: rc.emb2, c1: rc.pal[2], c2: rc.pal[1], size: 2, glow: rc.glowC, add: false, drag: 0.95 });
  },
  trail(F, rc, x, y, vx, vy) {
    const back = Math.atan2(vy, vx) + Math.PI;
    if (R() < 0.55) partOf(F, rc, R() < 0.6 ? rc.part : rc.part2, x, y, Math.cos(back) * 40 + (R() - 0.5) * 40, Math.sin(back) * 40 + (R() - 0.5) * 40, 0.4, { g: 0 });
    F.add({ x, y, vx: 0, vy: 0, life: 0.18, pal: rc.pal, size: 2.5, size2: 0.5 });
  },
  drawProj(ctx, rc, x, y, p, t) {
    const ang = Math.atan2(p.vy, p.vx), sc = rc.ult ? 3 : 2;
    const gr = (p.r || 6) * 3 + 6; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75; ctx.drawImage(glow(rc.glowC, 32), x - gr, y - gr, gr * 2, gr * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const spr = rc._spr || (rc._spr = { key: rc.projEmb });
    ctx.save(); ctx.translate(x, y); ctx.rotate(rc.projSpin ? t * rc.spin * 4 : ang);
    const img = glyphSprite(spr.key, rc.pal[2], rc.pal[1]); ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc); ctx.restore();
  },
  field(F, rc, x, y, r, dt) {
    if (R() > Math.min(1, (r * r) / 12000) * dt * 40) return;
    const a = R() * TAU, d = r * Math.sqrt(R()); const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.5;
    if (R() < 0.08) F.add({ x: px, y: py - 10, vx: 0, vy: -30, life: 1, shape: 'bmp', key: rc.emb2, c1: rc.pal[2], c2: rc.pal[1], size: 2, add: false, glow: rc.glowC, drag: 0.97 });
    else partOf(F, rc, R() < 0.5 ? rc.part : rc.part2, px, py, 0, -40, 0.8, { g: -10 });
  },
  beam(F, rc, x1, y1, x2, y2) {
    const n = Math.min(30, Math.hypot(x2 - x1, y2 - y1) / 14);
    for (let i = 0; i < n; i++) { const k = i / n; partOf(F, rc, i % 2 ? rc.part : 'spark', x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, (R() - 0.5) * 80, (R() - 0.5) * 80 - 20, 0.5); }
    glyphCircle(F, rc, x1, y1 + 8, 26, 0.5); emblem(F, rc, x2, y2 - 10, 2, 0.6, 30);
  },
  dash(F, rc, x1, y1, x2, y2) {
    for (let i = 0; i < 6; i++) { const k = i / 6; F.add({ x: x1 + (x2 - x1) * k, y: y1 - 24 + (y2 - y1) * k, vx: 0, vy: 0, life: 0.35 + k * 0.2, shape: 'bmp', key: rc.emb, c1: rc.pal[3], c2: rc.pal[2], size: 2, alpha: 0.5, add: false }); partOf(F, rc, rc.part, x1 + (x2 - x1) * k, y1 - 10 + (y2 - y1) * k, (R() - 0.5) * 60, -30, 0.5); }
  },
  buff(F, rc, x, y) {
    glyphCircle(F, rc, x, y + 2, 44, 0.9); emblem(F, rc, x, y - 64, 2, 1, 25);
    for (let i = 0; i < 10; i++) partOf(F, rc, i % 2 ? rc.part : rc.part2, x, y, 0, 0, 0.9, { orb: { cx: x, cy: y, a0: (i / 10) * TAU, spin: rc.spin * 2, r0: 30, r1: 22, lift: 60 } });
    for (const m of rc.mods) (MOD_FX[m] || (() => {}))(F, rc, x, y, 40, 0);
  },
  ult(F, rc, x, y) {
    glyphCircle(F, rc, x, y, 170, 1.6, { spin: rc.spin * 0.6 });
    glyphCircle(F, rc, x, y, 100, 1.6, { spin: -rc.spin, sides: rc.sides + 1 });
    emblem(F, rc, x, y - 110, 6, 1.6, 15);
    burst(F, { ...rc, count: rc.count * 2 }, x, y, 160, 0);
    F.light(x, y - 40, 320, rc.glowC, 0.8); F.light(x, y - 40, 200, '#ffffff', 0.15);
  },
};
