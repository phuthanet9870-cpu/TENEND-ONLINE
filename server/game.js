// ===== Game: sessions, world instances, player simulation, rewards =====
import { db, nextId, hashPass, checkPass, saveDB } from './db.js';
import { Instance } from './instance.js';
import { castSkill, isCC, addStatus, refreshStats, healUnit } from './combat.js';
import { rollLoot, monsterExp, monsterGold } from './loot.js';
import { CLASSES, CLASS_BY_ID } from '../shared/classes.js';
import { classSkills, getSkill, resolveSkill } from '../shared/skills.js';
import { computeStats } from '../shared/stats.js';
import { generateItem } from '../shared/items.js';
import { MAPS, START_MAP, QUESTS, BOSSES } from '../shared/world.js';
import { getMapLayout, moveWithCollision, randomOpenSpot } from '../shared/mapgen.js';
import { TILE, TICK_RATE, SNAP_RATE, expToNext, MAX_LEVEL, ECONOMY, HOTBAR_SIZE, INVENTORY_SIZE } from '../shared/constants.js';
import { FieldMode, TownMode } from './modes.js';
import * as player from './player.js';
import * as social from './social.js';
import * as pvp from './pvp.js';
import * as dungeons from './dungeons.js';
import * as gm from './gm.js';

const NAME_RE = /^[\p{L}\p{N}_]{3,16}$/u;

export class Game {
  constructor() {
    this.sessions = new Set();
    this.online = new Map(); // charId -> session
    this.instances = new Map();
    this.fields = new Map();
    this.parties = new Map();
    this.queues = { duel: [], arena3: [], bg10: [], guildwar: [] };
    this.time = 0;
    this.config = {
      raidMinPlayers: +(process.env.RAID_MIN_PLAYERS || 4),
      pvpBotFill: +(process.env.PVP_BOT_FILL || 25), // seconds before bots fill a queue (practice, unranked)
      guildWarMin: +(process.env.GUILDWAR_MIN || 1),
    };
    this.rates = { exp: 1, drop: 1, gold: 1 };
    this.startedAt = Date.now();
  }

  start() {
    const dt = 1 / TICK_RATE; let snapAcc = 0, saveAcc = 0, secAcc = 0;
    setInterval(() => {
      const t0 = Date.now();
      this.time += dt;
      for (const inst of this.instances.values()) {
        if (inst.kind === 'field' && inst.players.size === 0 && !inst.alwaysOn) { inst.idleTime = (inst.idleTime || 0) + dt; if (inst.mode?.idle) inst.mode.idle(dt); continue; }
        try { inst.update(dt); } catch (e) { console.error('inst update', inst.id, e); }
      }
      snapAcc += dt; saveAcc += dt; secAcc += dt;
      if (snapAcc >= 1 / SNAP_RATE) { snapAcc = 0; this.broadcastSnapshots(); }
      if (secAcc >= 1) { secAcc = 0; pvp.matchmake(this); this.cleanupInstances(); for (const s of this.sessions) if (s.dirty) this.sendChar(s); }
      if (saveAcc >= 30) { saveAcc = 0; this.persistAll(); }
      const el = Date.now() - t0; if (el > 40) console.warn('slow tick', el, 'ms');
    }, 1000 / TICK_RATE);
  }

  // ---------- sessions ----------
  connect(ws) {
    const sess = { ws, id: nextId('s'), acc: null, char: null, unit: null, inst: null, seen: new Map(), msgCount: 0, msgWindow: Date.now() };
    this.sessions.add(sess);
    this.send(sess, { t: 'hello', classes: CLASSES.map((c) => c.id) });
    return sess;
  }
  disconnect(sess) {
    this.sessions.delete(sess);
    if (sess.char) {
      this.saveUnitToChar(sess);
      this.online.delete(sess.char.id);
      pvp.leaveQueues(this, sess);
      social.onLogout(this, sess);
      if (sess.inst && sess.unit) sess.inst.removeUnit(sess.unit);
    }
    saveDB();
  }
  send(sess, obj) { if (sess.ws && sess.ws.readyState === 1) sess.ws.send(JSON.stringify(obj)); }
  msg(sess, text, c = '#ffe9a0') { this.send(sess, { t: 'msg', text, c }); }
  err(sess, text) { this.send(sess, { t: 'msg', text, c: '#ff6a6a' }); }
  broadcast(obj, filter) { for (const s of this.sessions) if (s.char && (!filter || filter(s))) this.send(s, obj); }
  announce(text, c = '#ffd84a') { this.broadcast({ t: 'msg', text, c, big: 1 }); }

  handle(sess, m) {
    const now = Date.now();
    if (now - sess.msgWindow > 1000) { sess.msgWindow = now; sess.msgCount = 0; }
    if (++sess.msgCount > 80) return;
    if (!m || typeof m.t !== 'string') return;
    try {
      if (!sess.acc) return this.handleAuth(sess, m);
      if (!sess.char) return this.handleCharSelect(sess, m);
      return this.handleGame(sess, m);
    } catch (e) { console.error('handle', m.t, e); this.err(sess, 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์'); }
  }

  handleAuth(sess, m) {
    const user = String(m.user || '').trim().toLowerCase(), pass = String(m.pass || '');
    if (!/^[a-z0-9_]{3,20}$/.test(user) || pass.length < 4 || pass.length > 64) return this.send(sess, { t: 'authErr', text: 'ชื่อผู้ใช้ 3-20 ตัว (a-z 0-9 _) รหัสผ่าน 4 ตัวขึ้นไป' });
    if (m.t === 'register') {
      if (db.accounts[user]) return this.send(sess, { t: 'authErr', text: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
      db.accounts[user] = { user, ...hashPass(pass), chars: [], stash: [], created: Date.now() };
      saveDB();
    } else if (m.t === 'login') {
      const acc = db.accounts[user];
      if (!acc || !checkPass(pass, acc)) return this.send(sess, { t: 'authErr', text: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      if (acc.banned) return this.send(sess, { t: 'authErr', text: `บัญชีนี้ถูกระงับ${acc.banReason ? ': ' + acc.banReason : ''}` });
      for (const s of this.sessions) if (s !== sess && s.acc === user) { this.err(s, 'บัญชีนี้ถูกล็อกอินจากที่อื่น'); s.ws.close(); }
    } else return;
    sess.acc = user;
    gm.onAuth(this, sess);
    this.sendCharList(sess);
  }
  sendCharList(sess) {
    const acc = db.accounts[sess.acc];
    this.send(sess, { t: 'chars', list: acc.chars.map((id) => db.chars[id]).filter(Boolean).map((c) => ({ id: c.id, name: c.name, classId: c.classId, level: c.level, map: MAPS[c.map]?.name })) });
  }
  handleCharSelect(sess, m) {
    const acc = db.accounts[sess.acc];
    if (m.t === 'createChar') {
      const name = String(m.name || '').trim();
      if (!NAME_RE.test(name)) return this.err(sess, 'ชื่อตัวละคร 3-16 ตัวอักษร');
      if (Object.values(db.chars).some((c) => c.name.toLowerCase() === name.toLowerCase())) return this.err(sess, 'ชื่อนี้ถูกใช้แล้ว');
      if (!CLASS_BY_ID[m.classId]) return this.err(sess, 'คลาสไม่ถูกต้อง');
      if (acc.chars.length >= 10) return this.err(sess, 'สร้างตัวละครได้สูงสุด 10 ตัว');
      const c = this.newChar(sess.acc, name, m.classId);
      db.chars[c.id] = c; acc.chars.push(c.id); saveDB();
      return this.sendCharList(sess);
    }
    if (m.t === 'deleteChar') {
      const c = db.chars[m.id]; if (!c || c.account !== sess.acc) return;
      if (c.guildId) social.leaveGuild(this, { char: c, acc: sess.acc }, true);
      acc.chars = acc.chars.filter((x) => x !== m.id); delete db.chars[m.id]; saveDB();
      return this.sendCharList(sess);
    }
    if (m.t === 'selectChar') {
      const c = db.chars[m.id]; if (!c || c.account !== sess.acc) return;
      if (this.online.has(c.id)) return this.err(sess, 'ตัวละครนี้ออนไลน์อยู่');
      sess.char = c; this.online.set(c.id, sess);
      player.migrateChar(c);
      this.send(sess, { t: 'selected', id: c.id });
      this.sendChar(sess);
      const map = MAPS[c.map] ? c.map : START_MAP;
      this.enterField(sess, map, c.x, c.y);
      social.onLogin(this, sess);
      this.msg(sess, `ยินดีต้อนรับสู่ TENEND ONLINE, ${c.name}!`);
    }
  }

  newChar(account, name, classId) {
    const cls = CLASS_BY_ID[classId];
    const weapon = generateItem(Math.random, { ilvl: 1, slot: 'weapon', rarity: 'common', weaponType: cls.weapons[0] });
    const chest = generateItem(Math.random, { ilvl: 1, slot: 'chest', rarity: 'common' });
    const skills = classSkills(classId).filter((s) => s.unlock <= 1 && s.kind === 'active');
    return {
      id: nextId('c'), account, name, classId, level: 1, exp: 0, mastery: 0, masteryExp: 0, gold: 500, honor: 0,
      map: START_MAP, x: null, y: null, hp: null, mp: null,
      equip: { weapon, chest }, inv: [], materials: { ore: 5, dust: 2 }, runes: { split: 1, linger: 1, vampiric: 1 }, potions: { hp: 10, mp: 5 },
      skillRanks: {}, build: { hotbar: [skills[0]?.id || null, skills[1]?.id || null, skills[2]?.id || null, null, null, null], ult: null, runes: {}, passives: { root: 1 } },
      presets: [], quests: { active: {}, done: {} }, rating: { duel: 1000, arena3: 1000 }, pvpStats: { wins: 0, losses: 0, kills: 0 },
      guildId: null, created: Date.now(), titles: [], daily: {},
    };
  }

  // ---------- char sync ----------
  charView(sess) {
    const c = sess.char;
    const st = sess.unit?.baseStats || computeStats(c);
    return {
      ...c, account: undefined,
      stash: db.accounts[c.account]?.stash || [],
      derived: { hpMax: st.hpMax, mpMax: st.mpMax, atk: st.atk, armor: st.armor, crit: +st.crit.toFixed(1), critDmg: st.critDmg, atkSpd: st.atkSpd, cdr: st.cdr, move: Math.round(st.move * (sess.unit?.gmSpeed || 1)), leech: st.leech, dodge: st.dodge, block: st.block, res: st.res, dmgEl: st.dmgEl, ks: [...st.ks], leg: [...st.leg], setBonuses: st.setBonuses, magicFind: st.magicFind, hpRegen: +st.hpRegen.toFixed(1), mpRegen: st.mpRegen, dmgAll: st.dmgAll },
      expNext: expToNext(c.level), party: social.partyView(this, sess), guild: social.guildView(this, sess),
      gm: sess.isGM ? { ...(sess.gmState || {}) } : null, settings: c.settings || {},
    };
  }
  sendChar(sess) { sess.dirty = false; if (sess.char) this.send(sess, { t: 'char', c: this.charView(sess) }); }
  markDirty(sess) { sess.dirty = true; }

  // rebuild unit stats & skill specs after gear/build change
  refreshUnit(sess) {
    const u = sess.unit; if (!u) return;
    const c = sess.char;
    const stats = computeStats(c, { normalize: !!sess.inst?.normalize });
    const g = c.guildId && db.guilds[c.guildId];
    if (g) { stats.expBonus += 2 * (g.skills.g_exp || 0); stats.goldFind += 3 * (g.skills.g_gold || 0); if (sess.inst?.mode?.info?.().pvp === 'guildwar') stats.dmgAll += 2 * (g.skills.g_war || 0); }
    u.guildTag = g ? g.tag : null;
    const ratio = u.hp / u.hpMax;
    u.baseStats = stats; u.hpMax = stats.hpMax; u.mpMax = stats.mpMax; u.hp = Math.max(1, Math.min(u.hpMax, ratio * u.hpMax)); u.mp = Math.min(u.mp, u.mpMax);
    refreshStats(u);
    u.skillSpecs = {};
    const allSk = stats.allSkills || 0;
    for (const id of [...c.build.hotbar, c.build.ult]) {
      if (!id) continue; const def = getSkill(id); if (!def) continue;
      u.skillSpecs[id] = resolveSkill(def, { rank: Math.min(25, (c.skillRanks[id] || 1) + allSk), runes: c.build.runes[id] || [], stats, ks: stats.ks, leg: stats.leg, pvp: !!sess.inst?.isPvp });
    }
    if (stats.ks.has('martyr') && sess.inst) { if (!sess.inst.martyrs.includes(u)) sess.inst.martyrs.push(u); }
    if (stats.leg.has('bladeorbit')) u.bladeOrbit = true; else u.bladeOrbit = false;
    u.level = c.level; u.palette = CLASS_BY_ID[c.classId].palette; u.weaponType = c.equip.weapon?.wtype;
    this.markDirty(sess);
  }

  makePlayerUnit(sess, inst, x, y, team = 'p') {
    const c = sess.char; const cls = CLASS_BY_ID[c.classId];
    const stats = computeStats(c, { normalize: !!inst.normalize });
    const hp = inst.isPvp || inst.kind !== 'field' && inst.kind !== 'town' ? stats.hpMax : (c.hp ?? stats.hpMax);
    const g = c.guildId && db.guilds[c.guildId];
    const u = inst.addUnit({
      kind: 'player', team, sess, charId: c.id, classId: c.classId, name: c.name, level: c.level, x, y, r: 12,
      hp: Math.min(stats.hpMax, Math.max(1, hp)), hpMax: stats.hpMax, mp: stats.mpMax, mpMax: stats.mpMax, stats, baseStats: stats,
      input: { mx: 0, my: 0 }, palette: cls.palette, tint: cls.palette.accent, guildTag: g ? g.tag : null, title: c.activeTitle || null,
      lastCombat: -99, dodgeReady: 0, countering: 0, counterReady: 0, potionReady: 0, castCount: 0, treads: 0,
    });
    sess.unit = u; sess.inst = inst; sess.seen = new Map();
    gm.applyUnitState(sess, u);
    inst.players.add(u);
    this.refreshUnit(sess);
    return u;
  }
  saveUnitToChar(sess) {
    const u = sess.unit, c = sess.char; if (!u || !c) return;
    if (sess.inst && (sess.inst.kind === 'field' || sess.inst.kind === 'town')) { c.map = sess.inst.key; c.x = Math.round(u.x); c.y = Math.round(u.y); c.hp = u.dead ? null : Math.round(u.hp); }
  }
  persistAll() { for (const s of this.sessions) this.saveUnitToChar(s); saveDB(); }

  // ---------- world instances ----------
  getField(mapId) {
    let inst = this.fields.get(mapId);
    if (inst) return inst;
    const def = MAPS[mapId];
    const L = getMapLayout(mapId);
    inst = new Instance(this, { id: `f_${mapId}`, kind: def.kind, key: mapId, def, layout: L, level: def.lv[0], safe: def.kind === 'town', name: def.name });
    inst.layoutSpec = { key: mapId };
    inst.mode = def.kind === 'town' ? new TownMode(this, inst) : new FieldMode(this, inst);
    this.instances.set(inst.id, inst); this.fields.set(mapId, inst);
    return inst;
  }
  enterField(sess, mapId, x, y, side) {
    const inst = this.getField(mapId); const L = inst.L;
    if (side) { const ex = L.exits.find((e) => e.side === side) || L.exits[0]; if (ex) { x = ex.x + (side === 'w' ? 70 : -70); y = ex.y; } }
    if (x == null || y == null || !L.solid || L.solid(Math.floor(x / TILE), Math.floor(y / TILE))) {
      if (inst.kind === 'town') { x = L.pxW / 2; y = L.pxH / 2 + 120; } else [x, y] = randomOpenSpot(L, Math.random);
    }
    this.moveToInstance(sess, inst, x, y);
    if (sess.unit) sess.unit.portalReady = inst.time + 1.5;
  }
  moveToInstance(sess, inst, x, y, team = 'p') {
    if (sess.unit && sess.inst) { this.saveUnitToChar(sess); sess.inst.removeUnit(sess.unit); }
    if (inst.kind === 'field' || inst.kind === 'town') sess.returnPoint = { map: inst.key };
    const u = this.makePlayerUnit(sess, inst, x, y, team);
    this.send(sess, { t: 'enter', inst: { id: inst.id, kind: inst.kind, key: inst.key, name: inst.name, layout: inst.layoutSpec, region: inst.def?.region, lv: inst.def?.lv, safe: inst.safe, pvp: inst.isPvp, mods: inst.mods, mode: inst.mode?.info?.() }, you: u.id });
    this.sendChar(sess);
    if (sess.char && (inst.kind === 'field' || inst.kind === 'town')) { sess.char.map = inst.key; }
    social.partyChanged(this, sess);
  }
  returnToWorld(sess) {
    const rp = sess.returnPoint?.map || sess.char.map || START_MAP;
    const map = MAPS[rp] ? rp : START_MAP;
    if (sess.unit) { sess.unit.dead = false; }
    this.enterField(sess, map, sess.char.x, sess.char.y);
  }
  regionTown(mapId) { const r = MAPS[mapId]?.region || 'aurelia'; return `town_${r}`; }
  createInstance(o) {
    const inst = new Instance(this, o);
    this.instances.set(inst.id, inst);
    return inst;
  }
  cleanupInstances() {
    for (const [id, inst] of this.instances) {
      if (inst.kind === 'field' || inst.kind === 'town') continue;
      if (inst.players.size === 0) { inst.emptySince = inst.emptySince ?? this.time; if (this.time - inst.emptySince > 20 || inst.ended) { inst.mode?.dispose?.(); this.instances.delete(id); } }
      else inst.emptySince = null;
    }
  }

  broadcastSnapshots() {
    for (const inst of this.instances.values()) {
      if (inst.players.size === 0) { inst.events.length = 0; continue; }
      for (const u of inst.players) {
        const sess = u.sess; if (!sess || sess.unit !== u) continue;
        const snap = inst.snapshotFor(u, sess.seen);
        snap.me = this.meState(sess, u, inst);
        if (inst.mode?.state) snap.obj = inst.mode.state(u);
        this.send(sess, snap);
      }
      inst.events.length = 0;
    }
  }
  meState(sess, u, inst) {
    const c = sess.char, cds = [];
    for (const id of [...c.build.hotbar, c.build.ult]) {
      if (!id || !u.skillSpecs?.[id]) { cds.push(null); continue; }
      const sp = u.skillSpecs[id]; const ch = u.charges[id];
      const rem = Math.max(0, (u.cd[id] || 0) - inst.time);
      cds.push([+rem.toFixed(2), +sp.cd.toFixed(2), ch ? ch.n : null, Math.round(sp.cost)]);
    }
    return { hp: Math.round(u.hp), hpMax: u.hpMax, mp: Math.round(u.mp), mpMax: u.mpMax, sh: Math.round(u.shield || 0), cds, dodge: +Math.max(0, u.dodgeReady - inst.time).toFixed(2), pot: +Math.max(0, u.potionReady - inst.time).toFixed(1), dead: u.dead ? 1 : 0, rs: u.dead ? +Math.max(0, (u.respawnAt || 0) - inst.time).toFixed(1) : 0, exp: c.exp, lv: c.level, gold: c.gold };
  }

  // ---------- in-game messages ----------
  handleGame(sess, m) {
    const u = sess.unit, inst = sess.inst;
    switch (m.t) {
      case 'input': if (u) { const mx = +m.mx || 0, my = +m.my || 0; const l = Math.hypot(mx, my); u.input.mx = l > 1 ? mx / l : mx; u.input.my = l > 1 ? my / l : my; if (Number.isFinite(+m.ax)) { u.aimX = +m.ax; u.aimY = +m.ay; } } return;
      case 'cast': return this.playerCast(sess, m);
      case 'dodge': return this.playerDodge(sess, m);
      case 'counter': if (u && !u.dead && u.counterReady <= inst.time) { u.countering = inst.time + 0.4; u.counterReady = inst.time + 1.2; inst.fx({ k: 'counter', id: u.id }, u); } return;
      case 'potion': return player.usePotion(this, sess, m.kind);
      case 'pickup': return player.pickup(this, sess, m.id);
      case 'pickupAll': return player.pickupAll(this, sess);
      case 'respawn': return this.respawn(sess);
      case 'build': return player.buildOp(this, sess, m);
      case 'item': return player.itemOp(this, sess, m);
      case 'npc': return player.npcOp(this, sess, m);
      case 'quest': return player.questOp(this, sess, m);
      case 'chat': return social.chat(this, sess, m);
      case 'party': return social.partyOp(this, sess, m);
      case 'guild': return social.guildOp(this, sess, m);
      case 'market': return social.marketOp(this, sess, m);
      case 'pvp': return pvp.pvpOp(this, sess, m);
      case 'dungeon': return dungeons.dungeonOp(this, sess, m);
      case 'leaveInstance': if (inst && inst.kind !== 'field' && inst.kind !== 'town' && !inst.isPvp) this.returnToWorld(sess); return;
      case 'logout': this.saveUnitToChar(sess); pvp.leaveQueues(this, sess); social.onLogout(this, sess); if (inst && u) inst.removeUnit(u); this.online.delete(sess.char.id); sess.char = null; sess.unit = null; sess.inst = null; saveDB(); return this.sendCharList(sess);
      case 'ping': return this.send(sess, { t: 'pong', c: m.c });
      case 'dev': return this.devOp(sess, m);
      case 'gm': return gm.gmOp(this, sess, m);
      case 'settings': { const v = JSON.stringify(m.value ?? null); if (typeof m.key !== 'string' || !/^[a-z]{1,16}$/.test(m.key) || v.length > 8000) return; c0(sess).settings = c0(sess).settings || {}; c0(sess).settings[m.key] = m.value; return; }
    }
  }

  // Developer/test commands (enabled only with DEV=1)
  devOp(sess, m) {
    if (process.env.DEV !== '1' && !sess.isGM) return this.err(sess, 'dev commands disabled');
    const c = sess.char;
    if (m.op === 'level') { c.level = Math.max(1, Math.min(MAX_LEVEL, m.n | 0)); c.exp = 0; }
    if (m.op === 'gold') c.gold += Math.max(0, m.n | 0);
    if (m.op === 'runes') for (const r of Object.keys(m.runes || {})) c.runes[r] = (c.runes[r] || 0) + (m.runes[r] | 0);
    if (m.op === 'mats') for (const k of ['ore', 'dust', 'shard', 'essence', 'core', 'mythril']) c.materials[k] = (c.materials[k] || 0) + 100;
    if (m.op === 'item') { const it = generateItem(Math.random, { ilvl: c.level, slot: m.slot, rarity: m.rarity, classId: c.classId }); if (c.inv.length < INVENTORY_SIZE) c.inv.push(it); }
    if (m.op === 'warp' && MAPS[m.map]) return this.enterField(sess, m.map, null, null);
    if (m.op === 'npc' && sess.inst?.def?.npcs) { const n = sess.inst.def.npcs.find((x) => x.type === m.type); if (n && sess.unit) { sess.unit.x = n.x; sess.unit.y = n.y + 40; } }
    if (m.op === 'equipBest') for (const slot of ['weapon', 'chest', 'helm', 'gloves', 'boots', 'amulet', 'ring1', 'ring2', 'belt', 'offhand']) c.equip[slot] = generateItem(Math.random, { ilvl: c.level, slot: slot.startsWith('ring') ? 'ring' : slot, rarity: 'epic', classId: c.classId, weaponType: CLASS_BY_ID[c.classId].weapons[0] });
    this.refreshUnit(sess); this.sendChar(sess);
  }

  playerCast(sess, m) {
    const u = sess.unit, inst = sess.inst, c = sess.char;
    if (!u || u.dead || inst.safe) return;
    if (isCC(u) || u.statuses.has('silence')) return;
    if (u.lockUntil > inst.time + 0.05) return;
    const slot = m.slot === 'u' ? 'u' : Math.max(0, Math.min(HOTBAR_SIZE - 1, m.slot | 0));
    const id = slot === 'u' ? c.build.ult : c.build.hotbar[slot];
    if (!id) return;
    const spec = u.skillSpecs[id]; if (!spec) return;
    if (inst.mode?.canCast && !inst.mode.canCast(u)) return;
    // cooldown / charges
    if (spec.charges > 1) {
      const ch = u.charges[id] || (u.charges[id] = { n: spec.charges, next: 0 });
      if (ch.n <= 0) return;
    } else if ((u.cd[id] || 0) > inst.time) return;
    // resource
    let cost = spec.cost;
    const bloodmagic = u.stats.ks?.has('bloodmagic');
    if (spec.costHp || bloodmagic) { const hc = (u.hpMax * cost) / (bloodmagic ? 300 : 150); if (u.hp <= hc + 1) return; u.hp -= hc; }
    else { if (u.mp < cost) return; u.mp -= cost; }
    if (spec.charges > 1) { const ch = u.charges[id]; ch.n--; if (ch.n < spec.charges && !ch.next) ch.next = inst.time + spec.cd; u.cd[id] = inst.time + 0.25; }
    else u.cd[id] = inst.time + spec.cd;
    if (u.stats.ks?.has('spellweaver')) { u.weave = (u.weave || 0) + 1; if (u.weave >= 5) { u.weave = 0; u.cd[id] = inst.time + 0.2; } }
    if (u.stats.leg?.has('set_conduit')) for (const k in u.cd) if (k !== id) u.cd[k] -= 0.3;
    u.lockUntil = inst.time + Math.max(0.12, spec.windup || 0.1);
    u.lastCombat = inst.time;
    // build-dynamic keystones
    u.elemChain = [...new Set([spec.el, ...(u.elemChain || [])])].slice(0, 4);
    if (u.lastSkill && u.lastSkill !== id) u.flowStacks = Math.min(5, (u.flowStacks || 0) + 1); else u.flowStacks = 0;
    u.lastSkill = id;
    let tx = +m.x, ty = +m.y;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) { tx = u.x + Math.cos(u.facing) * 100; ty = u.y + Math.sin(u.facing) * 100; }
    castSkill(inst, u, spec, tx, ty);
    u.castCount++;
    if (u.stats.leg?.has('meteor') && u.castCount % 10 === 0) {
      const e = inst.nearestEnemy(u, 600);
      if (e) inst.area({ owner: u.id, team: u.team, x: e.x, y: e.y, shape: 'circle', r: 110, spec: { ...spec, dmg: 400, el: 'fire', behavior: 'ground', mech: 'burn' }, mult: 1, delay: 0.8, show: true });
    }
    if (u.stats.leg?.has('thundertreads') && u.treads >= 1500) {
      u.treads = 0;
      inst.area({ owner: u.id, team: u.team, x: u.x, y: u.y, shape: 'circle', r: 180, spec: { ...spec, dmg: 250, el: 'lightning', behavior: 'nova', mech: 'shock' }, mult: 1, delay: 0.05, follow: u.id, show: true });
    }
    if (spec.kind === 'ultimate') inst.fx({ k: 'ult', id: u.id, n: spec.name, el: spec.el }, u);
  }
  playerDodge(sess, m) {
    const u = sess.unit, inst = sess.inst;
    if (!u || u.dead || isCC(u) || u.dodgeReady > inst.time) return;
    let dx = +m.dx || 0, dy = +m.dy || 0; const l = Math.hypot(dx, dy);
    if (l < 0.01) { dx = Math.cos(u.facing); dy = Math.sin(u.facing); } else { dx /= l; dy /= l; }
    const cdMul = 1 - (u.stats.dodgeCd || 0) / 100 - (u.stats.ks?.has('blur') ? 0.3 : 0);
    u.dodgeReady = inst.time + 2.6 * Math.max(0.3, cdMul);
    u.dodge = { dx, dy, until: inst.time + 0.2 };
    u.iframesUntil = inst.time + 0.32;
    u.momentumUntil = inst.time + 3;
    u.lockUntil = 0;
    if (u.stats.leg?.has('set_shadowdancer')) u.guaranteedCrit = true;
    inst.fx({ k: 'dodge', id: u.id, dx, dy }, u);
  }

  updatePlayerUnit(inst, u, dt) {
    const s = u.stats;
    if (u.dead) { if (u.kind === 'bot' && u.respawnAt && inst.time >= u.respawnAt && inst.mode?.respawnBot) inst.mode.respawnBot(u); return; }
    const inCombat = inst.time - u.lastCombat < 5;
    u.mp = Math.min(u.mpMax, u.mp + s.mpRegen * dt * (inCombat ? 1 : 2));
    if (u.hp < u.hpMax && s.hpRegen > 0) u.hp = Math.min(u.hpMax, u.hp + s.hpRegen * dt * (inCombat || inst.isPvp ? 1 : 4));
    for (const [id, ch] of Object.entries(u.charges)) { const sp = u.skillSpecs?.[id]; if (ch.next && inst.time >= ch.next && sp) { ch.n = Math.min(sp.charges, ch.n + 1); ch.next = ch.n < sp.charges ? inst.time + sp.cd : 0; } }
    if (u.bladeOrbit && !u.orbitActive) { u.orbitActive = true; inst.orbits.push({ id: inst.nextId(), owner: u.id, team: u.team, count: 3, r: 70, spec: { dmg: 35, el: 'physical', behavior: 'orbit' }, mult: 1, until: 1e12, tick: 0.4, next: 0, el: 'physical' }); inst.fx({ k: 'orbit', id: -u.id, owner: u.id, n: 3, r: 70, dur: 99999, el: 'physical' }, u); }
    if (u.kind === 'bot') pvp.botThink(this, inst, u, dt);
    if (isCC(u)) return;
    const ox = u.x, oy = u.y;
    if (u.dodge) {
      const sp = 760 * dt;
      [u.x, u.y] = moveWithCollision(inst.L, u.x, u.y, u.dodge.dx * sp, u.dodge.dy * sp, 9);
      if (inst.time >= u.dodge.until) u.dodge = null;
    } else if (u.lockUntil <= inst.time && (u.input.mx || u.input.my)) {
      let sp = s.move * dt * (u.gmSpeed || 1);
      if (u.statuses.has('slow')) sp *= 0.6;
      if (u.statuses.has('chill')) sp *= 0.8;
      [u.x, u.y] = moveWithCollision(inst.L, u.x, u.y, u.input.mx * sp, u.input.my * sp, 9);
      u.facing = Math.atan2(u.input.my, u.input.mx);
    }
    if (u.aimX != null && !u.input.mx && !u.input.my) u.facing = Math.atan2(u.aimY - u.y, u.aimX - u.x);
    const moved = Math.hypot(u.x - ox, u.y - oy); u.treads += moved;
    if (u.kind === 'player' && (inst.kind === 'field' || inst.kind === 'town') && inst.time > (u.portalReady || 0)) {
      for (const e of inst.L.exits) if ((u.x - e.x) ** 2 + (u.y - e.y) ** 2 < 34 * 34) {
        const target = MAPS[e.to]; if (!target) continue;
        if (target.kind === 'field' && u.level < target.lv[0] - 25) { if (!u.warnedExit) { this.err(u.sess, `ต้องการเลเวล ${target.lv[0] - 25}+ เพื่อเข้า ${target.name}`); u.warnedExit = true; } u.x -= (e.side === 'w' ? -40 : 40); continue; }
        u.warnedExit = false;
        const sess = u.sess; inst.timer(0, () => this.enterField(sess, e.to, null, null, e.side === 'w' ? 'e' : 'w'));
        return;
      }
    }
  }

  // ---------- rewards ----------
  onMonsterKilled(inst, mon, killer) {
    let owner = killer; if (owner && owner.owner) owner = inst.units.get(owner.owner) || null;
    const eligible = new Set();
    if (mon.boss && mon.contrib) {
      for (const [cid, dmg] of mon.contrib) if (dmg >= mon.hpMax * 0.01) { const s = this.online.get(cid); if (s && s.inst === inst) eligible.add(s); }
    }
    if (owner && owner.kind === 'player' && owner.sess) {
      eligible.add(owner.sess);
      for (const ps of social.partySessions(this, owner.sess)) if (ps.inst === inst && ps.unit && (ps.unit.x - mon.x) ** 2 + (ps.unit.y - mon.y) ** 2 < 1400 ** 2) eligible.add(ps);
    }
    if (!eligible.size) return;
    const partyBonus = 1 + 0.15 * (eligible.size - 1);
    const mult = (mon.boss ? (mon.bossKind === 'raid' ? 120 : mon.bossKind === 'world' ? 150 : 40) : mon.elite ? 4 : 1) * (inst.expMul || 1);
    for (const s of eligible) {
      const c = s.char; const st = s.unit.stats;
      const diff = c.level - mon.lv;
      const pen = diff > 15 ? Math.max(0.1, 1 - (diff - 15) * 0.06) : diff < -20 ? 0.5 : 1;
      const exp = Math.round(this.rates.exp * (monsterExp(mon.lv) * mult * pen * partyBonus * (1 + (st.expBonus || 0) / 100)) / eligible.size * (mon.boss ? eligible.size : 1));
      this.giveExp(s, exp);
      const gold = Math.round(this.rates.gold * monsterGold(mon.lv) * (mon.boss ? 25 : 1) * (1 + (st.goldFind || 0) / 100));
      c.gold += gold;
      inst.fx({ k: 'gold', id: s.unit.id, v: gold }, s.unit);
      for (const d of rollLoot(mon, c, st, { rate: this.rates.drop, treasure: inst.mods.includes('treasure'), abyss: inst.kind === 'abyss', mf: inst.mfBonus || 0 })) {
        const a = Math.random() * 6.28, r = 10 + Math.random() * 30;
        const id = inst.nextId();
        inst.drops.set(id, { id, owner: c.id, x: mon.x + Math.cos(a) * r, y: mon.y + Math.sin(a) * r, payload: d, label: d.label, color: d.color, expire: inst.time + 120 });
      }
      player.questProgress(this, s, mon);
      social.guildProgress(this, s, mon.boss ? 'boss' : 'kill', 1);
      this.markDirty(s);
    }
    if (mon.boss) {
      const names = [...eligible].map((s) => s.char.name).join(', ');
      if (mon.world || mon.bossKind === 'raid') this.announce(`🏆 ${mon.name} ถูกปราบโดย ${names}!`);
      else inst.fx({ k: 'msg', text: `${mon.name} ถูกปราบแล้ว!`, c: '#ffd84a', big: 1 });
    }
  }
  giveExp(sess, exp) {
    const c = sess.char;
    if (c.level >= MAX_LEVEL) {
      c.masteryExp += exp;
      while (c.masteryExp >= expToNext(MAX_LEVEL)) { c.masteryExp -= expToNext(MAX_LEVEL); c.mastery++; this.msg(sess, `Mastery Level ${c.mastery}!`, '#ffd84a'); }
      return;
    }
    c.exp += exp;
    let up = false;
    while (c.level < MAX_LEVEL && c.exp >= expToNext(c.level)) { c.exp -= expToNext(c.level); c.level++; up = true; }
    if (up) {
      this.refreshUnit(sess);
      if (sess.unit) { sess.unit.hp = sess.unit.hpMax; sess.unit.mp = sess.unit.mpMax; sess.inst.fx({ k: 'lvl', id: sess.unit.id }, sess.unit); }
      this.msg(sess, `เลเวลอัพ! ตอนนี้เลเวล ${c.level} (ได้แต้มสกิลและแต้ม Passive)`, '#7fe8ff');
      const newSk = classSkills(c.classId).filter((s) => s.unlock === c.level);
      for (const s of newSk) this.msg(sess, `ปลดล็อกสกิลใหม่: ${s.name}`, '#a0ffb0');
      if (c.level % 50 === 0) this.announce(`${c.name} ไปถึงเลเวล ${c.level} แล้ว!`);
    }
  }

  onPlayerDeath(inst, u, killer) {
    u.dead = true; u.dodge = null; u.statuses.clear(); u.shield = 0;
    if (inst.mode?.onPlayerDeath && inst.mode.onPlayerDeath(u, killer)) return;
    u.respawnAt = inst.time + 3;
    if (u.kind !== 'player') return;
    const c = u.sess.char;
    if (inst.kind === 'field') {
      for (const it of Object.values(c.equip)) if (it) it.dur = Math.max(0, it.dur - ECONOMY.deathDurability);
      const loss = Math.floor(expToNext(c.level) * 0.01); c.exp = Math.max(0, c.exp - loss);
      this.err(u.sess, `คุณตายแล้ว! ความทนทานอุปกรณ์ -${ECONOMY.deathDurability}% และ EXP -${loss}`);
      this.refreshUnit(u.sess);
    }
  }
  respawn(sess) {
    const u = sess.unit, inst = sess.inst;
    if (!u || !u.dead || inst.time < (u.respawnAt || 0)) return;
    if (inst.mode?.respawn && inst.mode.respawn(u)) return;
    if (inst.kind === 'field' || inst.kind === 'town') {
      sess.char.hp = Math.round(u.hpMax * 0.5);
      this.enterField(sess, this.regionTown(inst.key), null, null);
      return;
    }
    u.dead = false; u.hp = u.hpMax * 0.6; u.mp = u.mpMax; const sp = inst.mode?.spawnPoint?.(u) || [inst.L.pxW / 2, inst.L.pxH / 2]; u.x = sp[0]; u.y = sp[1]; u.invuln = inst.time + 2;
  }
}
export { healUnit, addStatus };

const c0 = (sess) => sess.char;
