// ===== Dungeons: Story (1-4), Abyss (1-4, random rooms+modifiers), Boss Hunt (1-4), Raid (4-8), Guild Boss =====
import { DUNGEONS, BOSSES, MONSTERS, ABYSS_MODIFIERS, MAPS } from '../shared/world.js';
import { instanceLayout, randomOpenSpot } from '../shared/mapgen.js';
import { db, saveDB } from './db.js';
import { rollLoot } from './loot.js';
import { RARITY_INFO } from '../shared/constants.js';
import * as social from './social.js';

const near = (u, npcType, inst) => inst.kind === 'town' && inst.def.npcs.some((n) => n.type === npcType && (n.x - u.x) ** 2 + (n.y - u.y) ** 2 < 200 * 200);

export function dungeonOp(game, sess, m) {
  const u = sess.unit, inst = sess.inst, c = sess.char;
  if (m.op === 'list') return game.send(sess, { t: 'dungeons', list: Object.entries(DUNGEONS).map(([id, d]) => ({ id, ...d })), bosses: Object.values(BOSSES).map((b) => ({ id: b.id, name: b.name, lv: b.lv, el: b.el })), abyssBest: db.season.abyss || {} });
  if (m.op !== 'enter') return;
  if (!near(u, 'dungeon', inst)) return game.err(sess, 'ต้องอยู่ใกล้ประตูดันเจี้ยนในเมือง');
  const d = DUNGEONS[m.id]; if (!d) return;
  const party = social.partySessions(game, sess).filter((s) => s.inst === inst);
  const members = [sess, ...party.filter((s) => s !== sess)];
  const [minP, maxP] = d.players;
  const min = d.type === 'raid' ? game.config.raidMinPlayers : minP;
  if (members.length < min) return game.err(sess, `${d.name} ต้องการผู้เล่นอย่างน้อย ${min} คน (ปาร์ตี้ที่อยู่ในเมืองเดียวกัน)`);
  if (members.length > maxP) return game.err(sess, `${d.name} รองรับสูงสุด ${maxP} คน`);
  const party0 = social.partyOf(game, sess);
  if (party0 && party0.leader !== c.id) return game.err(sess, 'หัวหน้าปาร์ตี้เท่านั้นที่เปิดดันเจี้ยนได้');
  for (const s of members) if (s.char.level < d.lv - 10) return game.err(sess, `${s.char.name} เลเวลไม่ถึง (ต้องการ ${d.lv - 10}+)`);
  let bossId = null;
  if (d.type === 'hunt') { bossId = m.boss; const b = BOSSES[bossId]; if (!b) return game.err(sess, 'เลือกบอส'); if (c.level < b.lv - 15) return game.err(sess, `ต้องการเลเวล ${b.lv - 15}+`); }
  createDungeon(game, members, m.id, { bossId, floor: Math.max(1, Math.min(m.floor | 0 || 1, (c.abyssBest || 0) + 1)) });
}

export function createDungeon(game, members, did, opt = {}) {
  const d = DUNGEONS[did] || opt.def;
  const size = d.type === 'raid' ? [70, 46] : d.type === 'hunt' || d.type === 'guildboss' ? [40, 30] : [60, 40];
  const key = `dg:${did}:${Math.random().toString(36).slice(2, 7)}`;
  const L = instanceLayout(key, size, d.biome, d.type === 'hunt' ? 6 : 16);
  const kind = d.type === 'abyss' ? 'abyss' : d.type === 'raid' ? 'raid' : 'dungeon';
  const inst = game.createInstance({ kind, key, layout: L, name: d.name, def: d });
  inst.layoutSpec = { key, def: { w: size[0], h: size[1], biome: d.biome, kind: 'instance', pillars: d.type === 'hunt' ? 6 : 16 } };
  const avgLv = Math.round(members.reduce((a, s) => a + s.char.level, 0) / members.length);
  inst.mode = new DungeonMode(game, inst, d, did, members.length, avgLv, opt);
  const [sx, sy] = inst.mode.spawnPoint();
  for (const s of members) { game.moveToInstance(s, inst, sx + Math.random() * 40, sy + Math.random() * 40); game.msg(s, `เข้าสู่ ${d.name}${d.story ? ' — ' + d.story : ''}`, '#c25cff'); }
  return inst;
}

export class DungeonMode {
  constructor(game, inst, d, did, n, avgLv, opt) {
    this.game = game; this.inst = inst; this.d = d; this.did = did; this.n = n; this.avgLv = avgLv; this.opt = opt;
    this.wave = 0; this.alive = new Set(); this.phase = 'start'; this.timer = 3; this.revives = d.type === 'raid' ? 6 : 99; this.floor = opt.floor || 1;
    this.scale = 1 + 0.65 * (n - 1);
    this.level = d.type === 'abyss' ? Math.max(5, avgLv) : d.type === 'hunt' || d.type === 'guildboss' ? Math.max(BOSSES[opt.bossId]?.lv || 1, avgLv) : Math.max(d.lv, Math.min(avgLv, d.lv + 30));
    if (d.type === 'abyss') this.rollAbyss();
    inst.keepCorpses = false;
  }
  info() { return { type: this.d.type, name: this.d.name, story: this.d.story }; }
  spawnPoint() { return [5 * 32, (this.inst.L.h / 2) * 32]; }
  rollAbyss() {
    const nm = Math.min(5, 1 + Math.floor(this.floor / 3));
    const pool = [...ABYSS_MODIFIERS].sort(() => Math.random() - 0.5);
    this.inst.mods = pool.slice(0, nm).map((m) => m.id);
    this.inst.mfBonus = this.floor * 3;
  }
  spawnGroup(tplId, count, lv) {
    for (let i = 0; i < count; i++) {
      const [x, y] = randomOpenSpot(this.inst.L, Math.random, 4);
      if (x < 12 * 32) { i--; continue; }
      const m = this.inst.spawnMonster(tplId, lv, x, y, { mul: { hp: this.scale }, noRespawn: true });
      m.aggro = 2000; this.alive.add(m.id);
    }
  }
  nextStep() {
    const d = this.d, inst = this.inst;
    if (d.type === 'abyss') {
      const lv = this.level + this.floor * 3;
      if (this.floor % 5 === 0) { this.spawnBossNow(Object.keys(BOSSES)[Math.floor(Math.random() * Object.keys(BOSSES).length)], lv, 0.4 + this.floor * 0.04); this.phase = 'boss'; }
      else {
        const regionMobs = Object.values(MONSTERS).filter((m) => Math.abs(m.lv - lv) < 40);
        const pool = regionMobs.length ? regionMobs : Object.values(MONSTERS);
        const cnt = Math.round((8 + this.floor) * (inst.mods.includes('horde') ? 1.5 : 1));
        for (let g = 0; g < 3; g++) this.spawnGroup(pool[Math.floor(Math.random() * pool.length)].id, Math.ceil(cnt / 3), lv);
        this.phase = 'wave';
      }
      this.broadcast(`ชั้น ${this.floor} — Modifiers: ${inst.mods.map((id) => ABYSS_MODIFIERS.find((x) => x.id === id).th).join(', ')}`);
      return;
    }
    if (d.type === 'hunt' || d.type === 'guildboss') { this.spawnBossNow(this.opt.bossId, this.level, (d.hpMul || 1) * (d.type === 'guildboss' ? 2 : 1)); this.phase = 'boss'; return; }
    if (this.wave < d.waves.length) {
      const [tpl, cnt] = d.waves[this.wave];
      this.spawnGroup(tpl, Math.round(cnt * (1 + 0.3 * (this.n - 1))), this.level);
      this.wave++; this.phase = 'wave';
      this.broadcast(`คลื่นที่ ${this.wave}/${d.waves.length}`);
    } else { this.spawnBossNow(d.boss, this.level + 2, d.hpMul || 1); this.phase = 'boss'; }
  }
  spawnBossNow(bossId, lv, hpMul) {
    const L = this.inst.L;
    const b = this.inst.spawnBoss(bossId, lv, L.pxW * 0.65, L.pxH / 2, { hpMul: hpMul * this.scale, bossKind: this.d.type === 'raid' ? 'raid' : 'dungeon' });
    b.aggro = 3000; this.alive.add(b.id); this.boss = b;
  }
  update(dt) {
    if (this.phase === 'done' || this.phase === 'failed') { this.timer -= dt; if (this.timer <= 0 && !this.closed) { this.closed = true; for (const p of [...this.inst.players]) this.game.returnToWorld(p.sess); this.inst.ended = true; } return; }
    if (this.phase === 'start' || this.phase === 'between') { this.timer -= dt; if (this.timer <= 0) this.nextStep(); return; }
    for (const id of this.alive) { const u = this.inst.units.get(id); if (!u || u.dead) this.alive.delete(id); }
    if (this.alive.size === 0) {
      if (this.d.type === 'abyss') {
        this.complete(false);
        this.floor++; this.rollAbyss(); this.phase = 'between'; this.timer = 4;
        for (const p of this.inst.players) { const c = p.sess.char; if ((c.abyssBest || 0) < this.floor - 1) { c.abyssBest = this.floor - 1; const best = db.season.abyss || (db.season.abyss = {}); if (!best[c.id] || best[c.id].floor < c.abyssBest) best[c.id] = { name: c.name, floor: c.abyssBest, cls: c.classId }; } }
        return;
      }
      if (this.phase === 'boss') { this.complete(true); this.phase = 'done'; this.timer = 25; return; }
      this.phase = 'between'; this.timer = 2.5;
    }
    if ([...this.inst.players].length && [...this.inst.players].every((p) => p.dead) && this.revives <= 0) { this.phase = 'failed'; this.timer = 6; this.broadcast('ทีมล้มเหลว... กำลังออกจากดันเจี้ยน'); }
  }
  complete(final) {
    if (!final) { this.broadcast(`ผ่านชั้น ${this.floor}! ไปชั้นถัดไปใน 4 วินาที`); if (this.floor % 5) return; }
    for (const p of this.inst.players) {
      const s = p.sess; const c = s.char;
      // completion chest: extra personal loot roll from a virtual boss of dungeon level
      const virt = { lv: this.level + (this.d.type === 'abyss' ? this.floor * 3 : 0), boss: true, bossKind: this.d.type === 'raid' ? 'raid' : 'dungeon', tpl: this.d.boss || this.opt.bossId };
      const loot = rollLoot(virt, c, p.stats, { abyss: this.d.type === 'abyss', mf: this.inst.mfBonus || 0 });
      for (const d of loot) { const id = this.inst.nextId(); this.inst.drops.set(id, { id, owner: c.id, x: p.x + (Math.random() - 0.5) * 80, y: p.y + (Math.random() - 0.5) * 80, payload: d, label: d.label, color: d.color, expire: this.inst.time + 120 }); }
      const gold = Math.round(this.level * 40 * (this.d.type === 'raid' ? 4 : 1));
      c.gold += gold;
      if (final) {
        c.clears = c.clears || {}; const first = !c.clears[this.did]; c.clears[this.did] = (c.clears[this.did] || 0) + 1;
        this.game.giveExp(s, Math.round(this.level * this.level * (first ? 6 : 2)));
        this.game.msg(s, `🏆 ${this.d.name} สำเร็จ! +${gold} ทอง${first ? ' (โบนัสเคลียร์ครั้งแรก!)' : ''} — ดันเจี้ยนจะปิดใน 25 วินาที`, '#ffd84a');
        social.guildProgress(this.game, s, 'dungeon', 1);
      }
      this.game.markDirty(s);
    }
  }
  broadcast(text) { for (const p of this.inst.players) this.game.msg(p.sess, text, '#c25cff'); }
  onPlayerDeath(u) { u.respawnAt = this.inst.time + 5; return false; }
  respawn(u) {
    if (this.revives <= 0) { this.game.err(u.sess, 'หมดโควต้าการฟื้นคืนชีพ'); return true; }
    if (this.d.type === 'raid') this.revives--;
    u.dead = false; u.hp = u.hpMax; u.mp = u.mpMax; const [x, y] = this.spawnPoint(); u.x = x; u.y = y; u.invuln = this.inst.time + 2;
    return true;
  }
  state() {
    return { dg: 1, type: this.d.type, wave: this.wave, waves: this.d.waves?.length || 0, floor: this.floor, phase: this.phase, left: this.alive.size, mods: this.inst.mods, revives: this.d.type === 'raid' ? this.revives : null, boss: this.boss && !this.boss.dead ? { n: this.boss.name, hp: Math.round((this.boss.hp / this.boss.hpMax) * 1000), id: this.boss.id } : null, t: this.phase === 'done' ? Math.ceil(this.timer) : null };
  }
}
export { RARITY_INFO, MAPS };
