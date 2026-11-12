// ===== Procedural pixel-art sprites (no external assets needed) =====
const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ---------------- Characters ----------------
const HEAD = {
  warrior(p, P) { P(4, 1, 8, 4, p.trim); P(5, 0, 6, 1, shade(p.trim, 0.3)); P(2, 0, 2, 3, '#eee8d8'); P(12, 0, 2, 3, '#eee8d8'); P(5, 4, 6, 1, shade(p.trim, -0.4)); },
  paladin(p, P) { P(4, 0, 8, 6, p.trim); P(5, 3, 6, 1, '#222'); P(7, -3, 2, 3, '#d83a2a'); P(4, 5, 8, 1, shade(p.trim, -0.3)); },
  ranger(p, P) { P(4, 1, 8, 4, p.body); P(3, 3, 1, 4, p.body); P(12, 3, 1, 4, p.body); P(6, 0, 4, 1, shade(p.body, 0.2)); },
  assassin(p, P) { P(4, 1, 8, 4, p.body); P(3, 3, 1, 5, p.body); P(12, 3, 1, 5, p.body); P(5, 6, 6, 2, shade(p.body, -0.3)); P(5, 4, 6, 1, p.trim); },
  arcanist(p, P) { P(2, 3, 12, 1, p.body); P(4, 1, 8, 2, p.body); P(5, -1, 6, 2, p.body); P(6, -3, 4, 2, p.body); P(7, -5, 2, 2, p.body); P(4, 2, 8, 1, p.trim); P(5, 4, 6, 2, p.hair); },
  necromancer(p, P) { P(4, 1, 8, 4, p.body); P(3, 3, 1, 5, p.body); P(12, 3, 1, 5, p.body); P(7, 1, 2, 2, '#e8e4d8'); P(5, 5, 6, 1, '#000'); },
  cleric(p, P) { P(4, 1, 8, 4, p.body); P(3, 3, 1, 4, p.body); P(12, 3, 1, 4, p.body); P(5, 2, 6, 1, '#e8c040'); P(7, 1, 2, 1, '#4a8ad8'); },
  shaman(p, P) { P(4, 2, 8, 2, p.hair); P(3, -2, 1, 4, '#e84a3a'); P(6, -3, 1, 4, '#f3e04a'); P(9, -3, 1, 4, '#3ad8c8'); P(12, -2, 1, 4, '#e84a3a'); P(4, 3, 8, 1, p.trim); },
  gunslinger(p, P) { P(2, 2, 12, 1, p.trim); P(4, 0, 8, 2, p.trim); P(4, 1, 8, 1, shade(p.trim, -0.4)); P(5, 3, 6, 1, p.hair); },
  monk(p, P) { P(5, 2, 6, 1, p.skin); P(4, 3, 8, 1, '#c82a1a'); P(12, 3, 2, 1, '#c82a1a'); P(13, 4, 1, 2, '#c82a1a'); },
  clone(p, P) { P(4, 1, 8, 4, '#2a2238'); P(3, 3, 1, 5, '#2a2238'); P(12, 3, 1, 5, '#2a2238'); },
  angel(p, P) { P(5, -1, 6, 1, '#ffe14a'); P(4, 2, 8, 2, '#f0e0a0'); },
};
// draws a 16x24 humanoid into ctx at (ox,oy)
function drawHumanoid(ctx, cls, p, frame, ox = 0, oy = 6) {
  const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };
  const dark = shade(p.body, -0.35);
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  // legs
  P(5, 16, 2, 4 + Math.max(0, -step), dark); P(9, 16, 2, 4 + Math.max(0, step), dark);
  P(5, 19 + Math.max(0, -step), 2, 1, '#2a1a10'); P(9, 19 + Math.max(0, step), 2, 1, '#2a1a10');
  // body
  P(4, 9, 8, 8, p.body); P(4, 13, 8, 1, p.trim); P(7, 9, 2, 4, shade(p.body, 0.15));
  if (['cleric', 'arcanist', 'necromancer'].includes(cls)) P(3, 15, 10, 3, p.body); // robe
  // arms
  P(2, 10 + (step > 0 ? 1 : 0), 2, 5, p.body); P(12, 10 + (step < 0 ? 1 : 0), 2, 5, p.body);
  P(2, 15 + (step > 0 ? 1 : 0), 2, 1, p.skin); P(12, 15 + (step < 0 ? 1 : 0), 2, 1, p.skin);
  P(3, 9, 2, 2, p.trim); P(11, 9, 2, 2, p.trim);
  // head
  P(5, 3, 6, 6, p.skin); P(4, 3, 1, 3, p.hair); P(11, 3, 1, 3, p.hair); P(5, 2, 6, 2, p.hair);
  P(6, 6, 1, 1, '#1a1a2a'); P(9, 6, 1, 1, '#1a1a2a');
  (HEAD[cls] || (() => {}))(p, P);
  if (cls === 'angel') { P(0, 8, 3, 6, '#ffffff'); P(13, 8, 3, 6, '#ffffff'); P(-1, 9, 2, 3, '#e8f0ff'); P(15, 9, 2, 3, '#e8f0ff'); }
}
export function charSprite(cls, pal, frame) {
  const key = `c|${cls}|${frame}|${pal.body}|${pal.trim}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(18, 30); const ctx = c.getContext('2d');
  drawHumanoid(ctx, cls, pal, frame, 1, 6);
  cache.set(key, c); return c;
}

// weapons (drawn separately so they can rotate with the aim)
const WEAPON_DRAW = {
  greatsword: (P) => { P(0, 3, 3, 1, '#6a4a2a'); P(3, 1, 1, 5, '#d9b25a'); P(4, 2, 14, 2, '#dfe6ee'); P(4, 3, 14, 1, '#a8b0bc'); P(18, 2, 1, 1, '#dfe6ee'); },
  sword: (P) => { P(0, 3, 3, 1, '#6a4a2a'); P(3, 1, 1, 5, '#e8c040'); P(4, 2, 10, 2, '#e8eef4'); P(4, 3, 10, 1, '#b0b8c8'); },
  axe: (P) => { P(0, 3, 12, 1, '#7a5a3a'); P(9, 0, 4, 7, '#c8ccd4'); P(12, 1, 1, 5, '#e8ecf0'); },
  mace: (P) => { P(0, 3, 10, 1, '#7a5a3a'); P(9, 1, 5, 5, '#d8c870'); P(10, 0, 3, 7, '#b8a850'); },
  bow: (P) => { P(3, 0, 1, 1, '#8a5a2a'); P(4, 1, 1, 2, '#8a5a2a'); P(5, 3, 1, 3, '#8a5a2a'); P(4, 6, 1, 2, '#8a5a2a'); P(3, 8, 1, 1, '#8a5a2a'); P(3, 1, 1, 7, '#e8e8e8'); },
  crossbow: (P) => { P(0, 3, 12, 2, '#6a4a2a'); P(9, 0, 2, 8, '#8a6a3a'); P(5, 3, 7, 1, '#ccc'); },
  dagger: (P) => { P(0, 3, 2, 1, '#3a2a1a'); P(2, 2, 1, 3, '#c0a050'); P(3, 3, 6, 1, '#d0d8e0'); },
  katar: (P) => { P(0, 2, 2, 3, '#5a3a5a'); P(2, 2, 2, 3, '#8a2a5a'); P(4, 3, 8, 1, '#d0d8e0'); P(4, 2, 6, 1, '#a0a8b8'); },
  staff: (P) => { P(0, 3, 16, 1, '#7a4a2a'); P(15, 1, 3, 4, '#7fd8ff'); P(16, 2, 1, 2, '#ffffff'); },
  wand: (P) => { P(0, 3, 9, 1, '#5a3a2a'); P(9, 2, 2, 3, '#ff5cd6'); },
  scythe: (P) => { P(0, 3, 16, 1, '#4a4a5a'); P(14, -2, 2, 5, '#a8b0bc'); P(8, -3, 7, 1, '#c8d0dc'); P(7, -2, 2, 1, '#c8d0dc'); },
  totemstaff: (P) => { P(0, 3, 15, 1, '#6a4a2a'); P(13, 0, 4, 7, '#3ad8c8'); P(14, 1, 2, 2, '#111'); P(13, -1, 1, 2, '#e84a3a'); },
  pistol: (P) => { P(0, 3, 3, 3, '#4a3a2a'); P(2, 2, 7, 2, '#5a5a6a'); P(8, 2, 1, 1, '#888'); },
  rifle: (P) => { P(0, 3, 5, 2, '#6a4a2a'); P(5, 2, 12, 2, '#4a4a5a'); P(10, 1, 2, 1, '#888'); },
  fist: (P) => { P(1, 2, 4, 3, '#e0c070'); P(5, 2, 2, 1, '#fff'); P(5, 4, 2, 1, '#fff'); },
};
export function weaponSprite(w) {
  const key = 'w|' + w; if (cache.has(key)) return cache.get(key);
  const c = canvas(20, 10); const ctx = c.getContext('2d');
  (WEAPON_DRAW[w] || WEAPON_DRAW.sword)((x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y + 2, ww, hh); });
  cache.set(key, c); return c;
}

// ---------------- Monsters (ASCII templates; b=tint d=dark l=light e=eye k=black w=bone r=red y=gold) ----------------
const T = {
  slime: ['................', '................', '................', '................', '......llll......', '....llbbbbll....', '...lbbbbbbbbl...', '..lbbbbbbbbbbl..', '..bbbekbbbekbb..', '..bbbbbbbbbbbb..', '..bbbbbddbbbbb..', '..dbbbbbbbbbbd..', '...dddddddddd...', '................'],
  wolf: ['................', '................', '...........d.d..', '..........dbdbd.', '..........bbbbbb', '.d.......dbbbekk', 'dbdddddddbbbbbbw', '.dbbbbbbbbbbbbd.', '..bbbbbbbbbbbd..', '..bbllllllbbb...', '..ddbdd..ddbd...', '..d.bd....d.bd..', '..k..k....k..k..'],
  goblin: ['................', '..d..........d..', '..db.bbbbbb.bd..', '...bbbbbbbbbb...', '....bekbbekb....', '....bbbbbbbb....', '.....bwwwwb.....', '...yyyyyyyyyy...', '..bbyddddddybb..', '..bb.dddddd.bb..', '.....dd..dd.....', '.....dd..dd.....', '....kkk..kkk....'],
  skeleton: ['................', '.....wwwwww.....', '....wwwwwwww....', '....wkkwwkkw....', '....wwwwwwww....', '.....wkwkww.....', '......wwww......', '...wwwwwwwwww...', '..w..wwwwww..w..', '..w..w.ww.w..w..', '.....wwwwww.....', '.....w....w.....', '.....w....w.....', '....ww....ww....'],
  bat: ['................', '................', '................', 'd.............d.', 'dd....b..b....dd', 'dbd...bbbb...dbd', 'dbbd.bebbeb.dbbd', 'dbbbbbbbbbbbbbbd', '.dbbbbbbbbbbbbd.', '..ddbbbbbbbbdd..', '....d.bbbb.d....', '.......dd.......'],
  golem: ['................', '....dddddddd....', '...dbbbbbbbbd...', '...bbbeebeebb...', '...bbbbbbbbbb...', '.ddddbbbbbbdddd.', 'dbbbbbbbbbbbbbbd', 'dbbbblllllbbbbbd', 'dbbd.bbbbbb.dbbd', 'dbbd.bbbbbb.dbbd', '.dd..bbbbbb..dd.', '.....bbddbb.....', '....dbbddbbd....', '....dddddddd....'],
  spider: ['................', '................', '................', '.d....dddd....d.', '..d..dbbbbd..d..', 'd..ddbbbbbbdd..d', '.dd.dbbbbbbd.dd.', '...ddbeebeebdd..', '.dd.dbbbbbbd.dd.', 'd..dddbbbbddd..d', '..d...dddd...d..', '.d............d.'],
  orc: ['................', '....dddddddd....', '...dbbbbbbbbd...', '...bbrkbbrkbb...', '...bbbbbbbbbb...', '...bwbbbbbbwb...', '..yyyyyyyyyyyy..', '.bbyddddddddybb.', '.bb.dddddddd.bb.', '.bb.dddddddd.bb.', '....ddd..ddd....', '....ddd..ddd....', '...kkkk..kkkk...'],
  wraith: ['................', '.....dddddd.....', '....dbbbbbbd....', '...dbbbbbbbbd...', '...bbekbbekbb...', '...bbbbbbbbbb...', '..dbbbbllbbbbd..', '..bbbbbbbbbbbb..', '.dbbbbbbbbbbbbd.', '.bbbbbbbbbbbbbb.', '.b.bb.bb.bb.bb..', '.b..b..b..b..b..'],
  elemental: ['................', '.......ll.......', '......lbbl......', '.....lbbbbl.....', '....lbbllbbl....', '...lbbllllbbl...', '..lbbbllllbbbl..', '..bbbeelleebbb..', '..bbbbllllbbbb..', '...bbbbbbbbbb...', '....dbbbbbbd....', '.....dbbbbd.....', '......dddd......'],
  demon: ['................', '..ww........ww..', '...w.dddddd.w...', '....dbbbbbbd....', '....bybbbbyb....', '....bbbkkbbb....', '..d..bbbbbb..d..', '.dbbbbbbbbbbbbd.', 'dbb.bbbbbbbb.bbd', 'db..bbllllbb..bd', '....bbbbbbbb....', '....bbb..bbb....', '...kkkk..kkkk...'],
  treant: ['.....ll.ll......', '...llbbllbbll...', '..lbbbbbbbbbbl..', '..bbbbbbbbbbbb..', '...dbbbbbbbbd...', '.....dkddkd.....', '.....dddddd.....', '..d..dddddd..d..', '...dddddddddd...', '.....dddddd.....', '.....dddddd.....', '....dd.dd.dd....', '...dd..dd..dd...'],
  crab: ['................', '................', '.ll..........ll.', 'lbbl........lbbl', '.lbb.e....e.bbl.', '..bb.k....k.bb..', '...bbbbbbbbbb...', '..dbbbbbbbbbbd..', '..bbbbllllbbbb..', '...dbbbbbbbbd...', '..d.d.d..d.d.d..', '.d..d..dd..d..d.'],
  scorpion: ['..........ddd...', '.........d...d..', '.........d...r..', '..........d.....', '...........d....', '.ll......dbd....', 'lbbl...dbbbbd...', '.lbbbbbbbbbbbbd.', '..dbbbekbbekbbd.', '...dbbbbbbbbbd..', '..d.d.d..d.d.d..', '.d..d..dd..d..d.'],
  mummy: ['................', '.....wwwwww.....', '....wdwwwwdw....', '....wkwwwwkw....', '....wwdwwdww....', '.....wwwwww.....', '...wdwwwwwwdw...', '..ww.wdwwdww.ww.', '..w..wwwwdww..w.', '.....wdwwwww....', '.....ww..ww.....', '.....wd..dw.....', '....www..www....'],
  mushroom: ['................', '.....rrrrrr.....', '...rrwrrrrwrr...', '..rrrrrrrwrrrr..', '..rwrrrrrrrrrr..', '...dddddddddd...', '.....llllll.....', '.....lkllkl.....', '.....llllll.....', '.....llllll.....', '....dd....dd....'],
  clone: null, angel: null,
  drone: ['................', '................', '..d..........d..', '.ddd........ddd.', '..d..dddddd..d..', '..dddbbbbbbddd..', '.....bbeebb.....', '.....bbbbbb.....', '......dddd......', '.......yy.......'],
  spirit: ['................', '......llll......', '.....lbbbbl.....', '....lbbllbbl....', '....bbekkebb....', '....bbbbbbbb....', '.....bbbbbb.....', '......bbbb......', '.......bb.......', '........b.......'],
  totem: ['.....dddddd.....', '....dbbbbbbd....', '....bekbbekb....', '....bbbyybbb....', '....dbbbbbbd....', '.....dddddd.....', '....dbbbbbbd....', '....bwbbbbwb....', '....bbbrrbbb....', '.....dddddd.....', '......dddd......', '......dddd......', '.....dddddd.....'],
  crystal: ['.......ll.......', '......lbbl......', '.....lbbbbl.....', '.....bbllbb.....', '....lbbllbbl....', '....bbbllbbb....', '...lbbbllbbbl...', '...bbbbllbbbb...', '...dbbbbbbbbd...', '....dbbbbbbd....', '.....dbbbbd.....', '....dddddddd....'],
};
T.archer = T.goblin; T.imp = T.demon; T.lizard = T.goblin; T.siren = T.wraith; T.knight = T.orc; T.yeti = T.golem; T.hawk = T.bat;
export function monsterSprite(kind, tint) {
  const key = `m|${kind}|${tint}`; if (cache.has(key)) return cache.get(key);
  const tpl = T[kind] || T.slime;
  const c = canvas(16, 16); const ctx = c.getContext('2d');
  const map = { b: tint, d: shade(tint, -0.4), l: shade(tint, 0.35), e: '#ffffff', k: '#111111', w: '#e8e4d8', r: '#d02a2a', y: '#e8c040' };
  if (kind === 'knight') { map.b = '#4a4a5a'; map.d = '#2a2a3a'; map.y = tint; }
  if (kind === 'yeti') { map.b = '#f0f4f8'; map.d = '#a8b8c8'; map.e = '#4a8ad8'; }
  if (kind === 'imp') map.b = shade(tint, 0.1);
  tpl.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== '.' && map[ch]) { ctx.fillStyle = map[ch]; ctx.fillRect(x, y + (16 - tpl.length), 1, 1); } } });
  cache.set(key, c); return c;
}

// ---------------- Tiles & obstacles ----------------
export function groundTile(color, seed, kind = 0) {
  const key = `t|${color}|${seed % 6}|${kind}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(32, 32); const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, 32, 32);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < 18; i++) { ctx.fillStyle = rnd() < 0.5 ? shade(color, -0.06) : shade(color, 0.05); ctx.fillRect((rnd() * 16 | 0) * 2, (rnd() * 16 | 0) * 2, 2, 2); }
  if (kind === 1) for (let i = 0; i < 3; i++) { ctx.fillStyle = shade(color, 0.25); ctx.fillRect((rnd() * 14 | 0) * 2, (rnd() * 14 | 0) * 2, 2, 4); }
  cache.set(key, c); return c;
}
export function plazaTile(seed) {
  const key = 'plaza|' + (seed % 4); if (cache.has(key)) return cache.get(key);
  const c = canvas(32, 32); const x = c.getContext('2d');
  x.fillStyle = '#8a8478'; x.fillRect(0, 0, 32, 32);
  const off = (seed % 2) * 8;
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    const bx = k * 16 + (r % 2 ? off + 8 : off), by = r * 8;
    x.fillStyle = ['#a49e90', '#9c9688', '#aaa496'][(r + k + seed) % 3]; x.fillRect(bx + 1, by + 1, 14, 6);
    x.fillStyle = '#b8b2a4'; x.fillRect(bx + 1, by + 1, 14, 1);
  }
  cache.set(key, c); return c;
}
export function obstacleSprite(type, seed = 0) {
  const key = `o|${type}|${seed % 3}`; if (cache.has(key)) return cache.get(key);
  const c = canvas(32, 56); const x = c.getContext('2d');
  const P = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  const v = seed % 3;
  switch (type) {
    case 'tree': P(13, 36, 6, 18, '#5a3a22'); P(14, 36, 2, 18, '#7a5232'); P(4, 12, 24, 26, '#2f6a2a'); P(6, 8, 20, 6, '#3a7a32'); P(2, 18, 28, 14, '#2f6a2a'); P(8, 12, 8, 6, '#4a9a3a'); P(4, 32, 24, 4, '#24521f'); break;
    case 'pine': P(14, 42, 4, 12, '#5a3a22'); for (let i = 0; i < 5; i++) P(16 - (4 + i * 2.6), 8 + i * 7, 2 * (4 + i * 2.6), 8, i % 2 ? '#1f5a3a' : '#2a6a44'); P(14, 4, 4, 6, '#2a6a44'); if (v) P(10, 14, 12, 2, '#e8f0f8'); break;
    case 'rock': P(5, 38, 22, 14, '#7a7a82'); P(8, 34, 16, 6, '#8a8a92'); P(10, 36, 6, 3, '#a8a8b0'); P(5, 50, 22, 2, '#4a4a52'); break;
    case 'icerock': P(5, 36, 22, 16, '#a8d8f0'); P(9, 32, 12, 6, '#c8ecff'); P(11, 34, 4, 8, '#ffffff'); P(5, 50, 22, 2, '#6a98b8'); break;
    case 'bush': P(4, 38, 24, 14, '#3a7a32'); P(8, 34, 16, 6, '#4a8a3a'); P(10, 40, 3, 3, '#d84a4a'); P(19, 44, 3, 3, '#d84a4a'); break;
    case 'palm': P(14, 18, 4, 36, '#8a6a3a'); P(2, 12, 28, 5, '#3a8a3a'); P(6, 8, 20, 5, '#4a9a3a'); P(0, 16, 6, 6, '#3a8a3a'); P(26, 16, 6, 6, '#3a8a3a'); P(13, 16, 6, 4, '#6a4a2a'); break;
    case 'coral': P(8, 36, 4, 16, '#ff7a8a'); P(14, 30, 4, 22, '#ff9aa8'); P(20, 38, 4, 14, '#ff7a8a'); P(6, 50, 20, 2, '#c85a6a'); break;
    case 'deadtree': P(14, 22, 4, 32, '#4a3a2a'); P(6, 20, 8, 3, '#4a3a2a'); P(18, 14, 8, 3, '#4a3a2a'); P(6, 14, 3, 6, '#4a3a2a'); P(24, 8, 3, 6, '#4a3a2a'); break;
    case 'reed': for (let i = 0; i < 5; i++) P(6 + i * 5, 30 + (i % 2) * 4, 2, 22, '#6a8a3a'); P(6, 28, 3, 5, '#8a6a3a'); P(21, 30, 3, 5, '#8a6a3a'); break;
    case 'crystal': P(12, 24, 8, 28, '#9a5cff'); P(14, 20, 4, 6, '#c8a8ff'); P(6, 34, 6, 18, '#7a4ad8'); P(20, 36, 6, 16, '#7a4ad8'); P(15, 28, 2, 16, '#e8d8ff'); break;
    case 'stalag': P(10, 30, 12, 22, '#5a5662'); P(12, 20, 8, 12, '#6a6672'); P(14, 14, 4, 8, '#7a7682'); break;
    case 'cactus': P(13, 22, 6, 30, '#3a8a4a'); P(7, 30, 4, 10, '#3a8a4a'); P(7, 38, 6, 3, '#3a8a4a'); P(21, 26, 4, 10, '#3a8a4a'); P(19, 34, 6, 3, '#3a8a4a'); P(15, 22, 2, 30, '#5aaa6a'); break;
    case 'bones': P(6, 44, 20, 3, '#e8e4d8'); P(10, 40, 3, 10, '#e8e4d8'); P(18, 38, 8, 7, '#e8e4d8'); P(20, 40, 2, 2, '#222'); P(23, 40, 2, 2, '#222'); break;
    case 'pillar': P(8, 8, 16, 44, '#a8a090'); P(6, 6, 20, 4, '#c8c0b0'); P(6, 50, 20, 4, '#8a8270'); P(11, 10, 2, 40, '#c8c0b0'); P(19, 10, 2, 40, '#8a8270'); break;
    case 'obsidian': P(6, 30, 20, 22, '#1e1a24'); P(10, 22, 12, 10, '#2a2432'); P(12, 26, 3, 14, '#5a4a7a'); P(6, 50, 20, 2, '#e05a1a'); break;
    case 'lamp': P(15, 20, 2, 34, '#3a3a42'); P(12, 14, 8, 8, '#3a3a42'); P(13, 15, 6, 6, '#ffe08a'); break;
    default: P(6, 36, 20, 16, '#6a6a72');
  }
  cache.set(key, c); return c;
}
export function wallTile(roof) {
  const key = 'wall|' + roof; if (cache.has(key)) return cache.get(key);
  const c = canvas(32, 32); const x = c.getContext('2d');
  if (roof) { x.fillStyle = '#8a3a2a'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#a84a32'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 8, 32, 3); x.fillStyle = '#6a2a1a'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 8 + 6, 32, 2); }
  else { x.fillStyle = '#c8b898'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#a89878'; for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) x.fillRect(((r % 2) * 8 + k * 16) % 32, r * 8, 14, 1); x.fillStyle = '#5a4a3a'; x.fillRect(12, 14, 8, 18); x.fillStyle = '#ffe08a'; x.fillRect(3, 12, 6, 6); x.fillRect(23, 12, 6, 6); }
  cache.set(key, c); return c;
}
export function borderTile(biome) {
  const key = 'border|' + biome; if (cache.has(key)) return cache.get(key);
  const c = canvas(32, 32); const x = c.getContext('2d');
  const base = { snow: '#7a8a9a', volcano: '#2a1a16', abyss: '#140e1c', desert: '#9a7a4a', tomb: '#5a4a3a', cave: '#22202a' }[biome] || '#3a4a32';
  x.fillStyle = base; x.fillRect(0, 0, 32, 32); x.fillStyle = shade(base, 0.15); x.fillRect(2, 2, 12, 10); x.fillRect(16, 14, 14, 12); x.fillStyle = shade(base, -0.3); x.fillRect(0, 28, 32, 4);
  cache.set(key, c); return c;
}
// guild emblem (shield/circle/diamond/star + icon)
export function drawEmblem(ctx, x, y, s, em) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = em.color; ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = Math.max(1, s / 10);
  ctx.beginPath();
  if (em.shape === 'circle') ctx.arc(0, 0, s / 2, 0, 7);
  else if (em.shape === 'diamond') { ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(0, s / 2); ctx.lineTo(-s / 2, 0); }
  else if (em.shape === 'star') for (let i = 0; i < 10; i++) { const r = i % 2 ? s / 4 : s / 2, a = (i / 10) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  else { ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(0, s / 2); ctx.lineTo(-s / 2, 0); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `${Math.round(s * 0.5)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText({ sword: '⚔', skull: '☠', crown: '♛', dragon: '🐉', sun: '☀', moon: '☾' }[em.icon] || '⚔', 0, 1);
  ctx.restore();
}
