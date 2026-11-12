// ===== PvP: Duel 1v1, Arena 3v3 (ranked, normalized gear), Battleground 10v10, Guild War 20v20, bots =====
import { PVP_MODES, TILE } from '../shared/constants.js';
import { arenaLayout, canStand } from '../shared/mapgen.js';
import { CLASSES, CLASS_BY_ID } from '../shared/classes.js';
import { classSkills, resolveSkill } from '../shared/skills.js';
import { computeStats, monsterStats } from '../shared/stats.js';
import { generateItem } from '../shared/items.js';
import { castSkill, isCC } from './combat.js';
import { db, saveDB } from './db.js';
import * as social from './social.js';

const inWorld = (s) => s.inst && (s.inst.kind === 'field' || s.inst.kind === 'town');

export function pvpOp(game, sess, m) {
  if (m.op === 'queue') {
    const mode = m.mode; if (!PVP_MODES[mode]) return;
    if (!inWorld(sess)) return game.err(sess, 'ต้องอยู่ในเมืองหรือแมพปกติ');
    if (sess.char.level < 20) return game.err(sess, 'PvP เปิดที่เลเวล 20');
    leaveQueues(game, sess);
    game.queues[mode].push({ sess, at: game.time });
    game.msg(sess, `เข้าคิว ${PVP_MODES[mode].th} แล้ว (ถ้าไม่มีผู้เล่นพอ จะเติมบอทฝึกซ้อมใน ${game.config.pvpBotFill} วินาที)`, '#7fe8ff');
    return sendStatus(game, sess);
  }
  if (m.op === 'leave') { leaveQueues(game, sess); return sendStatus(game, sess); }
  if (m.op === 'status') return sendStatus(game, sess);
  if (m.op === 'ladder') {
    const mode = m.mode === 'arena3' ? 'arena3' : 'duel';
    const list = Object.values(db.chars).filter((c) => c.pvpStats && (c.pvpStats.wins + c.pvpStats.losses) > 0).sort((a, b) => (b.rating?.[mode] || 1000) - (a.rating?.[mode] || 1000)).slice(0, 50)
      .map((c) => ({ name: c.name, cls: c.classId, r: c.rating?.[mode] || 1000, w: c.pvpStats.wins, l: c.pvpStats.losses, tier: tierName(c.rating?.[mode] || 1000) }));
    return game.send(sess, { t: 'ladder', mode, list });
  }
}
function sendStatus(game, sess) { const q = Object.entries(game.queues).filter(([k, l]) => k !== 'guildwar' && l.some((e) => e.sess === sess)).map(([k]) => k); game.send(sess, { t: 'pvpStatus', queues: q }); }
export function leaveQueues(game, sess) { for (const k of ['duel', 'arena3', 'bg10']) game.queues[k] = game.queues[k].filter((e) => e.sess !== sess && e.sess.char); }
export const tierName = (r) => (r >= 2200 ? 'Grandmaster' : r >= 1900 ? 'Master' : r >= 1700 ? 'Diamond' : r >= 1500 ? 'Platinum' : r >= 1300 ? 'Gold' : r >= 1100 ? 'Silver' : 'Bronze');

export function matchmake(game) {
  for (const mode of ['duel', 'arena3', 'bg10']) {
    const q = game.queues[mode] = game.queues[mode].filter((e) => e.sess.char && game.sessions.has(e.sess) && inWorld(e.sess));
    const size = PVP_MODES[mode].size, need = size * 2;
    if (q.length >= need) {
      q.sort((a, b) => (a.sess.char.rating?.[mode] || 1000) - (b.sess.char.rating?.[mode] || 1000));
      const group = q.splice(0, need);
      createMatch(game, mode, group.map((e) => e.sess), 0);
    } else if (q.length && game.time - q[0].at > game.config.pvpBotFill) {
      const group = q.splice(0, q.length);
      createMatch(game, mode, group.map((e) => e.sess), need - group.length);
    }
  }
  // guild war
  const gq = game.queues.guildwar = game.queues.guildwar.filter((e) => db.guilds[e.guildId]);
  if (gq.length >= 2) { const [a, b] = gq.splice(0, 2); createGuildWar(game, a.guildId, b.guildId); }
  else if (gq.length === 1 && game.time - gq[0].at > game.config.pvpBotFill * 2) { const [a] = gq.splice(0, 1); createGuildWar(game, a.guildId, null); }
}

function balanceTeams(sessList, mode) {
  const sorted = [...sessList].sort((a, b) => (b.char.rating?.[mode] || 1000) - (a.char.rating?.[mode] || 1000));
  const A = [], B = [];
  sorted.forEach((s, i) => ((i % 4 === 0 || i % 4 === 3) ? A : B).push(s));
  return [A, B];
}

export function createMatch(game, mode, sessList, bots) {
  const def = PVP_MODES[mode];
  const L = arenaLayout(mode);
  const ranked = def.ranked && bots === 0;
  const inst = game.createInstance({ kind: 'pvp', key: 'arena:' + mode, layout: L, pvp: true, name: def.th });
  inst.layoutSpec = { key: 'arena:' + mode, def: { w: L.w, h: L.h, biome: L.biome, kind: 'instance', pillars: mode === 'duel' ? 4 : 14 } };
  inst.normalize = def.ranked; // ranked modes: normalized gear stats
  inst.mode = mode === 'bg10' ? new BattlegroundMode(game, inst, def) : new ArenaMode(game, inst, mode, def, ranked);
  const [A, B] = balanceTeams(sessList, mode);
  for (const s of A) { const [x, y] = inst.mode.base('A'); game.moveToInstance(s, inst, x, y, 'A'); }
  for (const s of B) { const [x, y] = inst.mode.base('B'); game.moveToInstance(s, inst, x, y, 'B'); }
  let a = A.length, b = B.length;
  const avg = Math.round(sessList.reduce((t, s) => t + s.char.level, 0) / sessList.length);
  for (let i = 0; i < bots; i++) { const team = a <= b ? 'A' : 'B'; team === 'A' ? a++ : b++; const [x, y] = inst.mode.base(team); makeBot(game, inst, team, def.ranked ? 300 : avg, x, y); }
  for (const s of sessList) game.msg(s, `เริ่มการแข่งขัน ${def.th}${ranked ? ' (Ranked • Normalized Gear)' : ' (Practice/Unranked)'}!`, '#ff9a2a');
  return inst;
}

// ---------- bots ----------
const BOT_NAMES = ['Ares', 'Nyx', 'Kael', 'Lyra', 'Orin', 'Vex', 'Sora', 'Riven', 'Mira', 'Draven', 'Zed', 'Iris', 'Thorne', 'Kira', 'Fenn', 'Rook'];
export function makeBot(game, inst, team, level, x, y) {
  const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)];
  const skills = classSkills(cls.id).filter((s) => s.unlock <= level);
  const actives = skills.filter((s) => s.kind === 'active' && !['buff', 'summon', 'heal'].includes(s.behavior)).sort(() => Math.random() - 0.5).slice(0, 5);
  const support = skills.find((s) => s.kind === 'active' && ['buff', 'heal'].includes(s.behavior));
  const ult = skills.filter((s) => s.kind === 'ultimate').pop();
  const fake = { classId: cls.id, level, equip: {}, build: { hotbar: [...actives.map((s) => s.id), support?.id].filter(Boolean), ult: ult?.id, runes: {}, passives: { root: 1 } }, skillRanks: {} };
  for (const slot of ['weapon', 'chest', 'helm', 'gloves', 'boots', 'amulet']) fake.equip[slot] = generateItem(Math.random, { ilvl: level, slot, rarity: 'rare', weaponType: cls.weapons[0] });
  const stats = computeStats(fake, { normalize: !!inst.normalize });
  const u = inst.addUnit({
    kind: 'bot', team, name: `${BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]}[AI]`, classId: cls.id, level, x, y, r: 12,
    hp: stats.hpMax, hpMax: stats.hpMax, mp: stats.mpMax, mpMax: stats.mpMax, stats, baseStats: stats, input: { mx: 0, my: 0 }, palette: cls.palette, tint: cls.palette.accent,
    lastCombat: -99, dodgeReady: 0, countering: 0, treads: 0, castCount: 0, weaponType: cls.weapons[0], fake,
  });
  u.skillSpecs = {};
  for (const id of [...fake.build.hotbar, fake.build.ult]) if (id) u.skillSpecs[id] = resolveSkill(skills.find((s) => s.id === id), { rank: Math.min(20, Math.floor(level / 15) + 1), stats, ks: stats.ks, leg: stats.leg, pvp: true });
  u.botNext = 0;
  return u;
}
export function botThink(game, inst, u, dt) {
  if (isCC(u)) return;
  const goal = inst.mode?.botGoal?.(u);
  const tgt = inst.nearestEnemy(u, 650);
  let tx = goal ? goal[0] : u.x, ty = goal ? goal[1] : u.y;
  if (tgt) {
    const d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
    const ids = Object.keys(u.skillSpecs);
    const ready = ids.filter((id) => (u.cd[id] || 0) <= inst.time && u.mp >= u.skillSpecs[id].cost);
    const pref = ready.map((id) => u.skillSpecs[id]).find((s) => {
      const r = s.behavior === 'melee' ? s.range + 20 : s.behavior === 'nova' ? s.radius : s.behavior === 'buff' || s.behavior === 'heal' || s.behavior === 'summon' || s.behavior === 'totem' ? 9999 : (s.range || 300);
      return d <= r && (s.behavior !== 'heal' || u.hp < u.hpMax * 0.6);
    });
    if (pref && inst.time >= u.botNext && u.lockUntil <= inst.time) {
      u.cd[pref.id] = inst.time + pref.cd; u.mp -= pref.cost; u.lockUntil = inst.time + Math.max(0.12, pref.windup || 0.1); u.botNext = inst.time + 0.35 + Math.random() * 0.5; u.lastCombat = inst.time;
      castSkill(inst, u, pref, tgt.x + (Math.random() - 0.5) * 30, tgt.y + (Math.random() - 0.5) * 30);
    }
    const melee = Object.values(u.skillSpecs).filter((s) => s.behavior === 'melee' || s.behavior === 'dash').length >= 2;
    const want = melee ? 60 : 260;
    if (d > want) { tx = tgt.x; ty = tgt.y; } else if (d < want * 0.6) { tx = u.x - (tgt.x - u.x); ty = u.y - (tgt.y - u.y); } else { tx = u.x + Math.cos(inst.time + u.id) * 50; ty = u.y + Math.sin(inst.time + u.id) * 50; }
    if (u.dodgeReady <= inst.time && u.hp < u.hpMax * 0.8 && Math.random() < 0.01) { const a = Math.random() * 6.28; u.dodge = { dx: Math.cos(a), dy: Math.sin(a), until: inst.time + 0.2 }; u.iframesUntil = inst.time + 0.3; u.dodgeReady = inst.time + 3; }
  }
  const dx = tx - u.x, dy = ty - u.y, l = Math.hypot(dx, dy);
  u.input.mx = l > 12 ? dx / l : 0; u.input.my = l > 12 ? dy / l : 0;
}

// ---------- Arena (duel / 3v3) ----------
class ArenaMode {
  constructor(game, inst, mode, def, ranked) { this.game = game; this.inst = inst; this.modeId = mode; this.def = def; this.ranked = ranked; this.timeLeft = def.time; this.over = false; this.countdown = 5; }
  info() { return { pvp: this.modeId, ranked: this.ranked }; }
  base(team) { const L = this.inst.L; return [team === 'A' ? 4 * TILE : (L.w - 5) * TILE, (L.h / 2) * TILE + (Math.random() - 0.5) * 120]; }
  canCast() { return this.countdown <= 0 && !this.over; }
  update(dt) {
    if (this.over) { this.endT -= dt; if (this.endT <= 0 && !this.closed) { this.closed = true; for (const p of [...this.inst.players]) this.game.returnToWorld(p.sess); this.inst.ended = true; } return; }
    if (this.countdown > 0) { this.countdown -= dt; for (const u of this.inst.units.values()) if (u.input) { u.input.mx = 0; u.input.my = 0; } return; }
    this.timeLeft -= dt;
    const alive = { A: 0, B: 0 }, hp = { A: 0, B: 0 };
    for (const u of this.inst.units.values()) if ((u.kind === 'player' || u.kind === 'bot') && !u.dead) { alive[u.team]++; hp[u.team] += u.hp / u.hpMax; }
    if (alive.A === 0 || alive.B === 0 || this.timeLeft <= 0) this.finish(alive.A === 0 ? 'B' : alive.B === 0 ? 'A' : hp.A >= hp.B ? 'A' : 'B');
  }
  onPlayerDeath(u) { u.respawnAt = 1e9; return true; }
  respawn() { return true; }
  finish(winner) {
    this.over = true; this.endT = 8;
    const players = [...this.inst.players];
    const rating = (team) => { const t = players.filter((p) => p.team === team); return t.length ? t.reduce((a, p) => a + (p.sess.char.rating?.[this.modeId] || 1000), 0) / t.length : 1000; };
    const rA = rating('A'), rB = rating('B');
    for (const p of players) {
      const c = p.sess.char; const win = p.team === winner;
      c.pvpStats = c.pvpStats || { wins: 0, losses: 0, kills: 0 };
      win ? c.pvpStats.wins++ : c.pvpStats.losses++;
      const honor = win ? 60 : 20; c.honor = (c.honor || 0) + honor;
      let delta = 0;
      if (this.ranked) {
        const my = p.team === 'A' ? rA : rB, op = p.team === 'A' ? rB : rA;
        const exp = 1 / (1 + Math.pow(10, (op - my) / 400));
        delta = Math.round(32 * ((win ? 1 : 0) - exp));
        c.rating[this.modeId] = Math.max(0, (c.rating[this.modeId] || 1000) + delta);
      }
      this.game.msg(p.sess, `${win ? '🏆 ชนะ!' : 'แพ้...'} +${honor} Honor${this.ranked ? ` • เรตติ้ง ${delta >= 0 ? '+' : ''}${delta} (${c.rating[this.modeId]} ${tierName(c.rating[this.modeId])})` : ''}`, win ? '#ffd84a' : '#ff8a8a');
      if (win) social.guildProgress(this.game, p.sess, 'pvp', 1);
      this.game.markDirty(p.sess);
    }
    saveDB();
  }
  onKill(t, killer) { if (killer?.sess && (t.kind === 'player' || t.kind === 'bot')) killer.sess.char.pvpStats.kills++; }
  state() { return { pvp: this.modeId, t: Math.ceil(this.countdown > 0 ? this.countdown : this.timeLeft), cd: this.countdown > 0 ? 1 : 0, over: this.over ? 1 : 0 }; }
}

// ---------- Battleground 10v10 (3 control points) ----------
class BattlegroundMode {
  constructor(game, inst, def) {
    this.game = game; this.inst = inst; this.def = def; this.timeLeft = def.time; this.score = { A: 0, B: 0 }; this.over = false; this.countdown = 8;
    this.points = [[14, 25], [40, 25], [66, 25]].map(([x, y], i) => ({ id: i, name: ['ป้อมตะวันตก', 'แท่นกลาง', 'ป้อมตะวันออก'][i], x: x * TILE, y: y * TILE, owner: null, prog: 0 }));
  }
  info() { return { pvp: 'bg10' }; }
  base(team) { const L = this.inst.L; return [team === 'A' ? 4 * TILE : (L.w - 5) * TILE, (L.h / 2) * TILE + (Math.random() - 0.5) * 300]; }
  canCast() { return this.countdown <= 0 && !this.over; }
  botGoal(u) { const tgt = this.points.filter((p) => p.owner !== u.team).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]; return tgt ? [tgt.x, tgt.y] : null; }
  update(dt) {
    if (this.over) { this.endT -= dt; if (this.endT <= 0 && !this.closed) { this.closed = true; for (const p of [...this.inst.players]) this.game.returnToWorld(p.sess); this.inst.ended = true; } return; }
    if (this.countdown > 0) { this.countdown -= dt; return; }
    this.timeLeft -= dt;
    for (const pt of this.points) {
      const n = { A: 0, B: 0 };
      for (const u of this.inst.units.values()) if ((u.kind === 'player' || u.kind === 'bot') && !u.dead && (u.x - pt.x) ** 2 + (u.y - pt.y) ** 2 < 130 * 130) n[u.team]++;
      const diff = n.A - n.B;
      if (n.A && !n.B) pt.prog = Math.min(100, pt.prog + 18 * dt * Math.min(3, n.A));
      if (n.B && !n.A) pt.prog = Math.max(-100, pt.prog - 18 * dt * Math.min(3, n.B));
      if (pt.prog >= 100 && pt.owner !== 'A') { pt.owner = 'A'; this.announce(`ทีมฟ้ายึด ${pt.name}!`); }
      if (pt.prog <= -100 && pt.owner !== 'B') { pt.owner = 'B'; this.announce(`ทีมแดงยึด ${pt.name}!`); }
      if (pt.owner) this.score[pt.owner] += 4 * dt;
      void diff;
    }
    if (this.score.A >= this.def.score || this.score.B >= this.def.score || this.timeLeft <= 0) this.finish(this.score.A >= this.score.B ? 'A' : 'B');
  }
  announce(text) { for (const p of this.inst.players) this.game.msg(p.sess, text, '#ff9a2a'); }
  onKill(t, killer) { if ((t.kind === 'player' || t.kind === 'bot') && killer && killer.team) this.score[killer.team] = (this.score[killer.team] || 0) + 10; }
  onPlayerDeath(u) { u.respawnAt = this.inst.time + 6; return true; }
  respawn(u) { u.dead = false; u.hp = u.hpMax; u.mp = u.mpMax; [u.x, u.y] = this.base(u.team); u.invuln = this.inst.time + 2; return true; }
  respawnBot(u) { this.respawn(u); }
  finish(w) {
    this.over = true; this.endT = 10;
    for (const p of this.inst.players) { const c = p.sess.char; const win = p.team === w; c.honor = (c.honor || 0) + (win ? 150 : 50); c.gold += win ? c.level * 30 : c.level * 10; this.game.msg(p.sess, `${win ? '🏆 ทีมของคุณชนะ Battleground!' : 'ทีมของคุณแพ้'} คะแนน ${Math.round(this.score.A)} : ${Math.round(this.score.B)}`, win ? '#ffd84a' : '#ff8a8a'); if (win) social.guildProgress(this.game, p.sess, 'pvp', 1); this.game.markDirty(p.sess); }
  }
  state() { return { pvp: 'bg10', t: Math.ceil(this.countdown > 0 ? this.countdown : this.timeLeft), cd: this.countdown > 0 ? 1 : 0, score: [Math.round(this.score.A), Math.round(this.score.B)], max: this.def.score, pts: this.points.map((p) => [p.x, p.y, p.owner || '', Math.round(p.prog), p.name]) }; }
}

// ---------- Guild War 20v20: Control Points -> Gate -> Guardian Crystals -> Core ----------
export function createGuildWar(game, gA, gB) {
  const L = arenaLayout('guildwar');
  const inst = game.createInstance({ kind: 'pvp', key: 'arena:guildwar', layout: L, pvp: true, name: 'Guild War' });
  inst.layoutSpec = { key: 'arena:guildwar', def: { w: L.w, h: L.h, biome: L.biome, kind: 'instance', pillars: 14 } };
  const ga = db.guilds[gA], gb = gB ? db.guilds[gB] : { id: null, name: 'Shadow Legion (AI)', tag: 'AI' };
  const attackersFirst = Math.random() < 0.5;
  const att = attackersFirst ? ga : gb, def = attackersFirst ? gb : ga;
  inst.mode = new GuildWarMode(game, inst, att, def);
  const sideOf = (g) => (g === att ? 'A' : 'B');
  const pick = (g) => (g.id ? [...game.sessions].filter((s) => s.char?.guildId === g.id && inWorld(s)).slice(0, 20) : []);
  const teams = { A: pick(att), B: pick(def) };
  for (const t of ['A', 'B']) for (const s of teams[t]) { const [x, y] = inst.mode.base(t); game.moveToInstance(s, inst, x, y, t); game.msg(s, `⚔ Guild War เริ่มแล้ว! ${att.name} (บุก) vs ${def.name} (ป้องกัน)`, '#ff9a2a'); }
  const lv = Math.max(20, Math.round([...teams.A, ...teams.B].reduce((a, s) => a + s.char.level, 0) / Math.max(1, teams.A.length + teams.B.length)));
  for (const t of ['A', 'B']) {
    const g = t === 'A' ? att : def;
    if (!g.id) for (let i = 0; i < 6; i++) { const [x, y] = inst.mode.base(t); makeBot(game, inst, t, lv, x, y); }
    else if (teams[t].length < game.config.guildWarMin) for (let i = teams[t].length; i < game.config.guildWarMin; i++) { const [x, y] = inst.mode.base(t); makeBot(game, inst, t, lv, x, y); }
  }
  inst.mode.spawnCrystals(lv, teams.A.length + teams.B.length + 6);
  return inst;
}
class GuildWarMode {
  constructor(game, inst, att, def) {
    this.game = game; this.inst = inst; this.att = att; this.def = def; this.stage = 1; this.timeLeft = 900; this.over = false; this.countdown = 10; this.coreProg = 0; this.holdTime = 0;
    this.gateX = 58 * TILE;
    this.points = [[24, 14], [24, 30], [24, 46]].map(([x, y], i) => ({ id: i, name: ['จุดเหนือ', 'จุดกลาง', 'จุดใต้'][i], x: x * TILE, y: y * TILE, owner: 'B', prog: -100 }));
    this.core = { x: 82 * TILE, y: 30 * TILE };
    this.crystals = [];
  }
  info() { return { pvp: 'guildwar', att: this.att.name, def: this.def.name }; }
  base(team) { return team === 'A' ? [4 * TILE, (30 + (Math.random() - 0.5) * 16) * TILE] : [74 * TILE, (30 + (Math.random() - 0.5) * 12) * TILE]; }
  canCast() { return this.countdown <= 0 && !this.over; }
  spawnCrystals(lv, scale) {
    for (const [x, y] of [[68, 18], [68, 42]]) {
      const st = monsterStats(lv, { hp: 3 * scale, dmg: 0, spd: 0, el: 'arcane' });
      const c = this.inst.addUnit({ kind: 'monster', team: 'B', name: 'Guardian Crystal', sprite: 'crystal', tint: '#9a5cff', el: 'arcane', lv, x: x * TILE, y: y * TILE, r: 22, hp: st.hpMax, hpMax: st.hpMax, mp: 0, mpMax: 0, stats: st, baseStats: st, static: true, ai: 'none', atkReady: 0, home: { x: x * TILE, y: y * TILE } });
      this.crystals.push(c);
    }
  }
  botGoal(u) {
    if (u.team === 'B') return this.stage === 1 ? [this.points[1].x + 100, this.points[1].y] : [this.core.x - 200, this.core.y];
    if (this.stage === 1) { const p = this.points.find((q) => q.owner !== 'A') || this.points[1]; return [p.x, p.y]; }
    if (this.stage === 2) { const c = this.crystals.find((x) => !x.dead); return c ? [c.x, c.y] : [this.core.x, this.core.y]; }
    return [this.core.x, this.core.y];
  }
  update(dt) {
    if (this.over) { this.endT -= dt; if (this.endT <= 0 && !this.closed) { this.closed = true; for (const p of [...this.inst.players]) this.game.returnToWorld(p.sess); this.inst.ended = true; } return; }
    if (this.countdown > 0) { this.countdown -= dt; return; }
    this.timeLeft -= dt;
    const fighters = [...this.inst.units.values()].filter((u) => (u.kind === 'player' || u.kind === 'bot') && !u.dead);
    // gate barrier: attackers cannot pass while closed
    if (this.stage === 1) for (const u of fighters) if (u.team === 'A' && u.x > this.gateX) u.x = this.gateX;
    if (this.stage === 1) {
      for (const pt of this.points) {
        const n = { A: 0, B: 0 };
        for (const u of fighters) if ((u.x - pt.x) ** 2 + (u.y - pt.y) ** 2 < 130 * 130) n[u.team]++;
        if (n.A && !n.B) pt.prog = Math.min(100, pt.prog + 14 * dt * Math.min(3, n.A));
        if (n.B && !n.A) pt.prog = Math.max(-100, pt.prog - 14 * dt * Math.min(3, n.B));
        if (pt.prog >= 100 && pt.owner !== 'A') { pt.owner = 'A'; this.announce(`ฝ่ายบุกยึด ${pt.name}!`); }
        if (pt.prog <= -100 && pt.owner !== 'B') { pt.owner = 'B'; this.announce(`ฝ่ายป้องกันยึด ${pt.name} คืน!`); }
      }
      const owned = this.points.filter((p) => p.owner === 'A').length;
      if (owned >= 2) this.holdTime += dt * (owned === 3 ? 3 : 1);
      if (this.holdTime >= 45) { this.stage = 2; this.announce('🏰 ประตูปราสาทถูกเปิด! ทำลาย Guardian Crystal ทั้งสอง!'); }
    } else if (this.stage === 2) {
      if (this.crystals.every((c) => c.dead)) { this.stage = 3; this.announce('💎 Crystal ถูกทำลาย! ยึด Core กลางป้อมให้สำเร็จ!'); }
    } else if (this.stage === 3) {
      const n = { A: 0, B: 0 };
      for (const u of fighters) if ((u.x - this.core.x) ** 2 + (u.y - this.core.y) ** 2 < 150 * 150) n[u.team]++;
      if (n.A && !n.B) this.coreProg += dt * 100 / 30;
      if (this.coreProg >= 100) return this.finish('A');
    }
    if (this.timeLeft <= 0) this.finish('B');
  }
  announce(text) { for (const p of this.inst.players) this.game.msg(p.sess, text, '#ff9a2a'); }
  onPlayerDeath(u) { u.respawnAt = this.inst.time + 8; return true; }
  respawn(u) { u.dead = false; u.hp = u.hpMax; u.mp = u.mpMax; [u.x, u.y] = this.base(u.team); u.invuln = this.inst.time + 3; return true; }
  respawnBot(u) { this.respawn(u); }
  finish(w) {
    this.over = true; this.endT = 12;
    const wg = w === 'A' ? this.att : this.def, lg = w === 'A' ? this.def : this.att;
    if (wg.id && db.guilds[wg.id]) { const g = db.guilds[wg.id]; g.funds += 100000; g.warWins = (g.warWins || 0) + 1; g.seasonPts = (g.seasonPts || 0) + 100; g.warRating = (g.warRating || 1000) + 25; social.addGuildExp(g, 5000); g.cosmetics = [...new Set([...(g.cosmetics || []), `Conqueror Banner S${db.season.id}`])]; g.log.unshift({ t: Date.now(), text: `ชนะ Guild War vs ${lg.name}` }); }
    if (lg.id && db.guilds[lg.id]) { const g = db.guilds[lg.id]; g.funds += 20000; g.seasonPts = (g.seasonPts || 0) + 20; g.warRating = Math.max(0, (g.warRating || 1000) - 25); g.log.unshift({ t: Date.now(), text: `แพ้ Guild War vs ${wg.name}` }); }
    for (const p of this.inst.players) {
      const c = p.sess.char; const win = p.team === w;
      c.materials.guildsigil = (c.materials.guildsigil || 0) + (win ? 10 : 3); c.honor = (c.honor || 0) + (win ? 300 : 80);
      this.game.msg(p.sess, win ? `🏆 กิลด์ ${wg.name} พิชิต Guild War! ได้รับ Guild Sigil x10 และของตกแต่งประจำฤดูกาล` : `กิลด์ ${wg.name} ชนะ Guild War`, win ? '#ffd84a' : '#ff8a8a');
      this.game.markDirty(p.sess);
    }
    this.game.announce(`⚔ Guild War: ${wg.name} เอาชนะ ${lg.name}!`);
    saveDB();
  }
  state() {
    return { pvp: 'guildwar', stage: this.stage, t: Math.ceil(this.countdown > 0 ? this.countdown : this.timeLeft), cd: this.countdown > 0 ? 1 : 0, hold: Math.round(this.holdTime), core: Math.round(this.coreProg), gateX: this.stage === 1 ? this.gateX : null, att: this.att.name, def: this.def.name,
      pts: this.stage === 1 ? this.points.map((p) => [p.x, p.y, p.owner || '', Math.round(p.prog), p.name]) : [], crystals: this.crystals.map((c) => [c.id, c.dead ? 0 : 1]), corePos: [this.core.x, this.core.y] };
  }
}
export { CLASS_BY_ID, canStand };
