// ===== Field & Town instance modes (monster population, map bosses, world bosses) =====
import { MONSTERS, WORLD_BOSSES, BOSSES } from '../shared/world.js';
import { randomOpenSpot } from '../shared/mapgen.js';

export class TownMode {
  constructor(game, inst) { this.game = game; this.inst = inst; }
  info() { return { npcs: this.inst.def.npcs }; }
}

export class FieldMode {
  constructor(game, inst) {
    this.game = game; this.inst = inst; this.clock = 0; this.respawns = [];
    const def = inst.def;
    this.bossAt = 45 + Math.random() * 60; this.bossAlive = null;
    this.worldBosses = WORLD_BOSSES.filter((w) => w.map === def.id).map((w) => ({ ...w, at: w.every * 0.5 + Math.random() * 120, alive: null }));
    for (let i = 0; i < def.density; i++) this.spawnOne();
  }
  info() { return { fieldBoss: BOSSES[this.inst.def.fieldBoss]?.name, worldBosses: this.worldBosses.map((w) => w.name) }; }
  spawnOne() {
    const inst = this.inst, def = inst.def, L = inst.L;
    for (let k = 0; k < 20; k++) {
      const [x, y] = randomOpenSpot(L, Math.random, 3);
      if (L.exits.some((e) => (e.x - x) ** 2 + (e.y - y) ** 2 < 320 * 320)) continue;
      const tpl = def.monsters[Math.floor(Math.random() * def.monsters.length)];
      const t = MONSTERS[tpl];
      const lv = Math.max(1, Math.min(def.lv[1], t.lv + Math.floor(Math.random() * Math.max(2, (def.lv[1] - def.lv[0]) / 2))));
      const elite = Math.random() < 0.03;
      const m = inst.spawnMonster(tpl, lv, x, y, { elite, mul: elite ? { hp: 4, dmg: 1.6 } : {}, name: elite ? `★ ${t.name}` : undefined });
      m.fieldSpawn = true;
      return m;
    }
  }
  tick(dt) {
    this.clock += dt;
    if (this.respawns.length) { const due = this.respawns.filter((t) => t <= this.clock); if (due.length) { this.respawns = this.respawns.filter((t) => t > this.clock); for (let i = 0; i < due.length; i++) this.spawnOne(); } }
    if (!this.bossAlive && this.clock >= this.bossAt) {
      const def = this.inst.def; const [x, y] = randomOpenSpot(this.inst.L, Math.random, 6);
      this.bossAlive = this.inst.spawnBoss(def.fieldBoss, def.lv[1], x, y, { hpMul: 1, bossKind: 'field' });
      this.bossAlive.mapBoss = true;
      this.game.broadcast({ t: 'msg', text: `บอสแมพ ${this.bossAlive.name} ปรากฏที่ ${def.name}!`, c: '#ff9a2a' }, (s) => s.inst === this.inst || s.char?.level >= def.lv[0] - 10);
    }
    for (const w of this.worldBosses) {
      if (!w.alive && this.clock >= w.at) {
        const [x, y] = randomOpenSpot(this.inst.L, Math.random, 8);
        const b = BOSSES[w.base];
        w.alive = this.inst.spawnBoss(w.base, Math.max(b.lv, this.inst.def.lv[1] + 10), x, y, { hpMul: w.hpMul, dmgMul: 1.5, name: w.name, world: true, bossKind: 'world' });
        this.inst.alwaysOn = true;
        this.game.announce(`🐉 บอสโลก ${w.name} ปรากฏที่ ${this.inst.def.name}! รวมพลังปราบกันเถอะ`, '#ff5a5a');
      }
    }
  }
  idle(dt) { this.tick(dt); }
  update(dt) { this.tick(dt); }
  onKill(u) {
    if (u.kind !== 'monster') return;
    if (u === this.bossAlive) { this.bossAlive = null; this.bossAt = this.clock + this.inst.def.bossRespawn; return; }
    const w = this.worldBosses.find((x) => x.alive === u);
    if (w) { w.alive = null; w.at = this.clock + w.every; this.inst.alwaysOn = false; return; }
    if (u.fieldSpawn) this.respawns.push(this.clock + 8 + Math.random() * 10);
  }
  state() {
    const out = {};
    if (this.bossAlive && !this.bossAlive.dead) out.boss = { n: this.bossAlive.name, hp: Math.round((this.bossAlive.hp / this.bossAlive.hpMax) * 1000), id: this.bossAlive.id };
    const wb = this.worldBosses.find((w) => w.alive && !w.alive.dead);
    if (wb) out.boss = { n: wb.alive.name, hp: Math.round((wb.alive.hp / wb.alive.hpMax) * 1000), id: wb.alive.id, world: 1 };
    return out;
  }
}
