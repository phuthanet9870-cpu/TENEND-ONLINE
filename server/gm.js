// ===== GM (Game Master) system: full in-game control, works on the online server =====
// Who is a GM:
//   * accounts listed in env GM_ACCOUNTS (comma separated usernames), or
//   * accounts with acc.gm = true (set by another GM), or
//   * if no GM exists yet and GM_AUTO_FIRST != '0': the first account that logs in becomes the owner GM.
// Every GM action is written to db.gmlog.
import { db, saveDB } from './db.js';
import { MAPS, MONSTERS, BOSSES, WORLD_BOSSES } from '../shared/world.js';
import { generateItem, MATERIALS, DROP_SLOTS } from '../shared/items.js';
import { RUNES } from '../shared/runes.js';
import { MAX_LEVEL, RARITIES } from '../shared/constants.js';
import { spotNear } from '../shared/mapgen.js';
import { classSkills } from '../shared/skills.js';

const envGMs = () => String(process.env.GM_ACCOUNTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export function onAuth(game, sess) {
  const acc = db.accounts[sess.acc];
  if (envGMs().includes(sess.acc)) acc.gm = true;
  if (!acc.gm && process.env.GM_AUTO_FIRST !== '0' && !Object.values(db.accounts).some((a) => a.gm)) {
    acc.gm = true; saveDB();
    game.send(sess, { t: 'msg', text: 'บัญชีนี้เป็นบัญชีแรกของเซิร์ฟเวอร์ จึงได้สิทธิ์ GM (เจ้าของเซิร์ฟเวอร์) กด F9 เพื่อเปิดแผง GM', c: '#ffd84a', big: 1 });
  }
  sess.isGM = !!acc.gm;
  sess.gmState = sess.gmState || { god: false, invis: false, speed: 1 };
}
export function applyUnitState(sess, u) {
  if (!sess.isGM) return;
  const g = sess.gmState; u.god = !!g.god; u.gmInvis = !!g.invis; u.gmSpeed = g.speed || 1;
}
function log(game, sess, text) {
  db.gmlog = db.gmlog || [];
  db.gmlog.unshift({ t: Date.now(), by: sess.char?.name || sess.acc, text });
  if (db.gmlog.length > 500) db.gmlog.length = 500;
  console.log('[GM]', sess.acc, text);
}
const findOnline = (game, name) => [...game.online.values()].find((s) => s.char.name.toLowerCase() === String(name || '').trim().toLowerCase());
function findAccount(name) {
  const n = String(name || '').trim().toLowerCase();
  if (db.accounts[n]) return db.accounts[n];
  const c = Object.values(db.chars).find((x) => x.name.toLowerCase() === n);
  return c ? db.accounts[c.account] : null;
}

export function sendState(game, sess) {
  const mem = typeof process.memoryUsage === 'function' ? Math.round(process.memoryUsage().heapUsed / 1048576) : null;
  game.send(sess, {
    t: 'gmState',
    players: [...game.online.values()].map((s) => ({ name: s.char.name, acc: s.acc, lv: s.char.level, cls: s.char.classId, map: s.inst?.name, gm: !!s.isGM, gold: s.char.gold, muted: (db.accounts[s.acc]?.mutedUntil || 0) > Date.now() })),
    rates: game.rates, config: game.config,
    stats: { online: game.online.size, sessions: game.sessions.size, instances: game.instances.size, units: [...game.instances.values()].reduce((a, i) => a + i.units.size, 0), accounts: Object.keys(db.accounts).length, chars: Object.keys(db.chars).length, guilds: Object.keys(db.guilds).length, listings: db.market.length, uptime: Math.round((Date.now() - game.startedAt) / 1000), memMB: mem },
    banned: Object.values(db.accounts).filter((a) => a.banned).map((a) => ({ acc: a.user, reason: a.banReason })),
    gms: Object.values(db.accounts).filter((a) => a.gm).map((a) => a.user),
    guilds: Object.values(db.guilds).map((g) => ({ id: g.id, name: g.name, tag: g.tag, level: g.level, funds: g.funds, members: Object.keys(g.members).length })),
    log: (db.gmlog || []).slice(0, 60), self: sess.gmState,
  });
}

export function gmOp(game, sess, m) {
  if (!sess.isGM) return game.err(sess, 'คุณไม่มีสิทธิ์ GM');
  const u = sess.unit, inst = sess.inst, me = sess.char;
  const ok = (text) => { log(game, sess, text); game.msg(sess, `[GM] ${text}`, '#ffd84a'); sendState(game, sess); };
  switch (m.op) {
    case 'state': return sendState(game, sess);
    // ---- self ----
    case 'self': {
      const g = sess.gmState;
      if (m.god != null) g.god = !!m.god; if (m.invis != null) g.invis = !!m.invis; if (m.speed != null) g.speed = Math.max(0.5, Math.min(5, +m.speed || 1));
      if (u) applyUnitState(sess, u); game.markDirty(sess);
      return ok(`self god=${g.god} invis=${g.invis} speed=${g.speed}`);
    }
    case 'warp': { if (!MAPS[m.map]) return; game.enterField(sess, m.map, m.x != null ? +m.x : null, m.y != null ? +m.y : null); return ok(`warp -> ${MAPS[m.map].name}`); }
    case 'goto': { const t = findOnline(game, m.name); if (!t?.unit) return game.err(sess, 'ไม่พบผู้เล่นออนไลน์'); if (t.inst !== inst) game.moveToInstance(sess, t.inst, t.unit.x + 40, t.unit.y); else { u.x = t.unit.x + 40; u.y = t.unit.y; } return ok(`goto ${t.char.name}`); }
    case 'summon': { const t = findOnline(game, m.name); if (!t?.unit || !u) return game.err(sess, 'ไม่พบผู้เล่นออนไลน์'); if (t.inst !== inst) game.moveToInstance(t, inst, u.x + 40, u.y); else { t.unit.x = u.x + 40; t.unit.y = u.y; } game.msg(t, 'คุณถูก GM เรียกตัว', '#ffd84a'); return ok(`summon ${t.char.name}`); }
    // ---- target player ----
    case 'player': return playerAction(game, sess, m, ok);
    // ---- accounts (online or offline) ----
    case 'ban': case 'unban': case 'setgm': {
      const acc = findAccount(m.name); if (!acc) return game.err(sess, 'ไม่พบบัญชี/ตัวละคร');
      if (m.op === 'ban') { if (acc.user === sess.acc) return game.err(sess, 'แบนตัวเองไม่ได้'); acc.banned = true; acc.banReason = String(m.reason || '').slice(0, 120); for (const s of game.sessions) if (s.acc === acc.user) { game.err(s, 'บัญชีของคุณถูกระงับ'); s.ws.close(); } }
      if (m.op === 'unban') acc.banned = false;
      if (m.op === 'setgm') { if (acc.user === sess.acc && !m.value) return game.err(sess, 'ถอดสิทธิ์ตัวเองไม่ได้'); acc.gm = !!m.value; for (const s of game.sessions) if (s.acc === acc.user) { s.isGM = acc.gm; s.gmState = s.gmState || { god: false, invis: false, speed: 1 }; if (s.unit) applyUnitState(s, s.unit); game.markDirty(s); } }
      saveDB(); return ok(`${m.op} ${acc.user}${m.op === 'setgm' ? '=' + !!m.value : ''}`);
    }
    // ---- world ----
    case 'spawn': {
      if (!u) return; const tpl = MONSTERS[m.tpl] || BOSSES[m.tpl]; if (!tpl) return game.err(sess, 'ไม่พบมอนสเตอร์');
      const n = Math.max(1, Math.min(50, m.n | 0 || 1)); const lv = Math.max(1, Math.min(350, m.lv | 0 || tpl.lv || 1));
      for (let i = 0; i < n; i++) { const [x, y] = spotNear(inst.L, Math.random, u.x, u.y, 220); const mon = inst.spawnMonster(m.tpl, lv, x, y, { noRespawn: true, elite: !!m.elite, mul: m.elite ? { hp: 4, dmg: 1.6 } : {} }); mon.gmSpawn = true; }
      return ok(`spawn ${tpl.name} x${n} Lv${lv} @ ${inst.name}`);
    }
    case 'boss': {
      if (!u) return; const b = BOSSES[m.id]; if (!b) return;
      const [x, y] = spotNear(inst.L, Math.random, u.x + 200, u.y, 120);
      inst.spawnBoss(m.id, Math.max(1, m.lv | 0 || b.lv), x, y, { hpMul: Math.max(0.1, +m.hpMul || 1), world: !!m.world, bossKind: m.world ? 'world' : 'field', name: m.world ? `World ${b.name}` : undefined });
      return ok(`boss ${b.name} @ ${inst.name}`);
    }
    case 'worldboss': {
      const w = WORLD_BOSSES.find((x) => x.id === m.id) || WORLD_BOSSES[0]; const field = game.getField(w.map);
      const fw = field.mode?.worldBosses?.find((x) => x.id === w.id); if (fw && !fw.alive) fw.at = field.mode.clock;
      return ok(`force world boss ${w.name} (${MAPS[w.map].name})`);
    }
    case 'killAll': { let n = 0; for (const x of [...inst.units.values()]) if (x.kind === 'monster' && !x.dead && !x.static) { x.hp = 0; inst.onKill(x, m.reward ? u : null, null); n++; } return ok(`killAll ${n} monsters @ ${inst.name}`); }
    case 'clearSpawns': { let n = 0; for (const x of [...inst.units.values()]) if (x.gmSpawn) { inst.killQuiet(x); n++; } return ok(`clear ${n} GM spawns`); }
    case 'announce': { const text = String(m.text || '').slice(0, 200); if (!text) return; game.announce(`📢 [GM] ${text}`, '#ff9a2a'); return ok(`announce: ${text}`); }
    case 'rates': { for (const k of ['exp', 'drop', 'gold']) if (m[k] != null) game.rates[k] = Math.max(0, Math.min(100, +m[k] || 0)); game.announce(`📢 อัตรา EXP x${game.rates.exp} • ดรอป x${game.rates.drop} • ทอง x${game.rates.gold}`, '#ffd84a'); return ok(`rates ${JSON.stringify(game.rates)}`); }
    case 'config': { for (const k of ['pvpBotFill', 'raidMinPlayers', 'guildWarMin']) if (m[k] != null) game.config[k] = Math.max(0, Math.min(3600, +m[k] || 0)); return ok(`config ${JSON.stringify(game.config)}`); }
    case 'save': game.persistAll(); return ok('save database');
    case 'guild': {
      const g = db.guilds[m.id]; if (!g) return;
      if (m.action === 'level') g.level = Math.max(1, Math.min(50, m.n | 0));
      if (m.action === 'funds') g.funds = Math.max(0, +m.n || 0);
      if (m.action === 'disband') { for (const cid of Object.keys(g.members)) { if (db.chars[cid]) db.chars[cid].guildId = null; const s = game.online.get(cid); if (s) game.refreshUnit(s); } delete db.guilds[m.id]; }
      saveDB(); return ok(`guild ${g.name} ${m.action} ${m.n ?? ''}`);
    }
    case 'marketRemove': { const i = db.market.findIndex((l) => l.id === m.id); if (i < 0) return; const l = db.market.splice(i, 1)[0]; const acc = db.accounts[db.chars[l.seller]?.account]; if (acc) acc.stash.push(l.item); return ok(`market remove ${l.item.name}`); }
  }
}

function playerAction(game, sess, m, ok) {
  const t = findOnline(game, m.name) || (m.name ? null : sess);
  if (!t) return game.err(sess, 'ไม่พบผู้เล่นออนไลน์');
  const c = t.char; const n = +m.n || 0; const acc = db.accounts[c.account];
  const refresh = () => { game.refreshUnit(t); game.sendChar(t); };
  switch (m.action) {
    case 'level': c.level = Math.max(1, Math.min(MAX_LEVEL, n | 0)); c.exp = 0; break;
    case 'exp': game.giveExp(t, Math.max(0, n)); break;
    case 'gold': c.gold = Math.max(0, c.gold + n); break;
    case 'honor': c.honor = Math.max(0, (c.honor || 0) + n); break;
    case 'mats': for (const k of Object.keys(MATERIALS)) c.materials[k] = (c.materials[k] || 0) + Math.max(1, n || 100); break;
    case 'runes': for (const r of RUNES) c.runes[r.id] = (c.runes[r.id] || 0) + Math.max(1, n || 3); break;
    case 'potions': c.potions.hp = (c.potions.hp || 0) + 100; c.potions.mp = (c.potions.mp || 0) + 100; break;
    case 'item': {
      const rarity = RARITIES.includes(m.rarity) ? m.rarity : 'legendary';
      const slots = m.slot === 'all' ? ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring', 'ring'] : [DROP_SLOTS.includes(m.slot) ? m.slot : 'weapon'];
      for (const slot of slots) if (c.inv.length < 60) c.inv.push(generateItem(Math.random, { ilvl: m.ilvl | 0 || c.level, slot, rarity, classId: c.classId }));
      break;
    }
    case 'unlockSkills': for (const s of classSkills(c.classId)) c.skillRanks[s.id] = Math.max(c.skillRanks[s.id] || 1, 1); c.level = MAX_LEVEL; break;
    case 'heal': if (t.unit) { t.unit.hp = t.unit.hpMax; t.unit.mp = t.unit.mpMax; t.unit.statuses.clear(); } break;
    case 'revive': if (t.unit?.dead) { t.unit.dead = false; t.unit.hp = t.unit.hpMax; } break;
    case 'kill': if (t.unit && !t.unit.dead) { t.unit.hp = 0; t.inst.onKill(t.unit, null, null); } break;
    case 'repair': for (const it of Object.values(c.equip)) if (it) it.dur = 100; break;
    case 'resetBuild': c.build.passives = { root: 1 }; c.skillRanks = {}; c.build.runes = {}; break;
    case 'clearInv': c.inv = []; break;
    case 'warp': if (MAPS[m.map]) game.enterField(t, m.map, null, null); break;
    case 'kick': game.err(t, 'คุณถูก GM เตะออกจากเกม'); t.ws.close(); return ok(`kick ${c.name}`);
    case 'mute': acc.mutedUntil = Date.now() + Math.max(1, n || 10) * 60000; game.err(t, `คุณถูกห้ามแชท ${Math.max(1, n || 10)} นาที`); break;
    case 'unmute': acc.mutedUntil = 0; break;
    default: return;
  }
  refresh(); saveDB();
  if (t !== sess) game.msg(t, `GM ได้ปรับปรุงตัวละครของคุณ (${m.action})`, '#ffd84a');
  return ok(`player ${c.name} ${m.action} ${m.n ?? ''}${m.rarity ? ' ' + m.rarity : ''}`);
}
