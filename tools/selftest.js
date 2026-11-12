// Headless integration test: spins up the server, plays through the core loop with a scripted client.
import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PORT = 8123 + Math.floor(Math.random() * 500);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tenend-'));
const srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT, DATA_DIR: DATA, PVP_BOT_FILL: '1', RAID_MIN_PLAYERS: '1', DEV: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let srvErr = '';
srv.stderr.on('data', (d) => { srvErr += d; process.stderr.write('[srv] ' + d); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.error('FAIL:', m); srv.kill(); process.exit(1); };

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const st = { msgs: [], snap: null, char: null, enter: null, you: null, chars: null, other: {} };
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 's') st.snap = m; else if (m.t === 'char') st.char = m.c; else if (m.t === 'enter') { st.enter = m.inst; st.you = m.you; }
    else if (m.t === 'chars') st.chars = m.list; else if (m.t === 'msg' || m.t === 'authErr') st.msgs.push(m.text); else st.other[m.t] = m;
  });
  const send = (o) => ws.send(JSON.stringify(o));
  return { ws, st, send, open: new Promise((r) => ws.on('open', r)) };
}
const me = (st) => st.snap?.u.find((u) => u[0] === st.you);

(async () => {
  await sleep(700);
  const c = client(); await c.open;
  c.send({ t: 'register', user: 'tester', pass: 'pass1234' }); await sleep(300);
  if (!c.st.chars) fail('no char list');
  const classes = ['warrior', 'paladin', 'ranger', 'assassin', 'arcanist', 'necromancer', 'cleric', 'shaman', 'gunslinger', 'monk'];
  for (const cl of classes) c.send({ t: 'createChar', name: 'T' + cl.slice(0, 8), classId: cl });
  await sleep(400);
  if (c.st.chars.length !== 10) fail('expected 10 chars got ' + c.st.chars.length);
  c.send({ t: 'selectChar', id: c.st.chars[0].id }); await sleep(500);
  if (!c.st.enter || c.st.enter.kind !== 'town') fail('not in town');
  console.log('OK login/create/select ->', c.st.enter.name);
  // walk east to exit into field 1
  const t0 = Date.now();
  const { getMapLayout } = await import('../shared/mapgen.js');
  const ex = getMapLayout(c.st.enter.key).exits.find((e) => e.side === 'e');
  while (c.st.enter.kind === 'town' && Date.now() - t0 < 20000) { const m0 = me(c.st); if (m0) { const dx = ex.x - m0[1], dy = ex.y - m0[2], l = Math.hypot(dx, dy) || 1; c.send({ t: 'input', mx: dx / l, my: Math.abs(dy) > 8 ? dy / l : 0 }); } await sleep(100); }
  c.send({ t: 'input', mx: 0, my: 0 });
  if (c.st.enter.kind !== 'field') fail('could not walk to field');
  console.log('OK walked into field ->', c.st.enter.name);
  await sleep(300);
  // fight: chase nearest monster & spam skills
  let kills0 = c.st.char.exp, castN = 0;
  for (let i = 0; i < 300; i++) {
    const s = c.st.snap; const m0 = me(c.st); if (!s || !m0) { await sleep(50); continue; }
    if (m0[4] & (1 << 30)) { c.send({ t: 'respawn' }); await sleep(200); continue; }
    let best = null, bd = 1e9;
    for (const u of s.u) { const meta = c.st.metaAll?.[u[0]]; if (u[0] === c.st.you || (u[4] & (1 << 30))) continue; const d = (u[1] - m0[1]) ** 2 + (u[2] - m0[2]) ** 2; if (d < bd) { bd = d; best = u; } }
    if (best) {
      const d = Math.sqrt(bd);
      c.send({ t: 'input', mx: d > 60 ? (best[1] - m0[1]) / d : 0, my: d > 60 ? (best[2] - m0[2]) / d : 0 });
      if (d < 300) { c.send({ t: 'cast', slot: castN++ % 3, x: best[1], y: best[2] }); }
    }
    if (i % 20 === 0) c.send({ t: 'pickupAll' });
    await sleep(60);
  }
  c.send({ t: 'input', mx: 0, my: 0 }); c.send({ t: 'pickupAll' }); await sleep(400);
  console.log('OK combat: level', c.st.char.level, 'exp', c.st.char.exp, 'gold', c.st.char.gold, 'inv', c.st.char.inv.length, 'mats', JSON.stringify(c.st.char.materials));
  if (c.st.char.level === 1 && c.st.char.exp === kills0) fail('no exp gained from combat');
  // build ops
  c.send({ t: 'dev', op: 'level', n: 60 }); c.send({ t: 'dev', op: 'gold', n: 200000 }); c.send({ t: 'dev', op: 'mats' }); await sleep(300);
  const ch = c.st.char;
  c.send({ t: 'build', op: 'allocPassive', node: 'weapon.train' }); await sleep(150);
  c.send({ t: 'build', op: 'socketRune', id: ch.build.hotbar[0], idx: 0, rune: 'vampiric' }); await sleep(150);
  c.send({ t: 'build', op: 'rankSkill', id: ch.build.hotbar[0] });
  c.send({ t: 'build', op: 'equipSkill', slot: 'u', id: 'warrior.ult.0' });
  c.send({ t: 'build', op: 'savePreset', idx: 0, name: 'Farm', tag: 'PvE' }); await sleep(1500);
  c.send({ t: 'build', op: 'loadPreset', idx: 0 }); await sleep(1200);
  // all skills resolve with every compatible rune
  const { classSkills, resolveSkill } = await import('../shared/skills.js');
  const { RUNES, runeFits } = await import('../shared/runes.js');
  let n = 0; for (const cl of classes) for (const sk of classSkills(cl)) { const rs = RUNES.filter((r) => runeFits(r, sk.behavior)).map((r) => r.id); for (let k = 0; k < rs.length; k += 3) { resolveSkill(sk, { rank: 20, runes: rs.slice(k, k + 3), stats: {} }); n++; } }
  console.log('OK resolved', n, 'skill+rune combos');
  console.log('OK build: passives', JSON.stringify(c.st.char.build.passives), 'runes', JSON.stringify(c.st.char.build.runes), 'presets', c.st.char.presets.length);
  // pvp duel vs bot (practice fill)
  c.send({ t: 'pvp', op: 'queue', mode: 'duel' });
  for (let i = 0; i < 40 && c.st.enter.kind !== 'pvp'; i++) await sleep(100);
  if (c.st.enter.kind !== 'pvp') fail('pvp match not created; msgs=' + c.st.msgs.slice(-3));
  console.log('OK pvp duel started:', c.st.enter.name, JSON.stringify(c.st.snap?.obj || {}));
  for (let i = 0; i < 120; i++) {
    const s = c.st.snap; const m0 = me(c.st);
    const enemy = s?.u.find((u) => u[0] !== c.st.you && !(u[4] & (1 << 30)));
    if (m0 && enemy) { const d = Math.hypot(enemy[1] - m0[1], enemy[2] - m0[2]); c.send({ t: 'input', mx: d > 60 ? (enemy[1] - m0[1]) / d : 0, my: d > 60 ? (enemy[2] - m0[2]) / d : 0 }); c.send({ t: 'cast', slot: i % 3, x: enemy[1], y: enemy[2] }); }
    await sleep(80);
    if (c.st.enter.kind !== 'pvp') break;
  }
  console.log('OK pvp state', JSON.stringify(c.st.snap?.obj || {}), 'last msgs:', c.st.msgs.slice(-2).join(' | '));
  // ---- every skill of every class, each with a random compatible rune ----
  const { RUNES: RL } = await import('../shared/runes.js');
  const allRunes = Object.fromEntries(RL.map((r) => [r.id, 3]));
  let casts = 0;
  for (const ch2 of c.st.chars) {
    c.send({ t: 'logout' }); await sleep(250);
    c.send({ t: 'selectChar', id: ch2.id }); await sleep(400);
    c.send({ t: 'dev', op: 'level', n: 300 }); c.send({ t: 'dev', op: 'equipBest' }); c.send({ t: 'dev', op: 'runes', runes: allRunes }); c.send({ t: 'dev', op: 'warp', map: 'ember_1' }); await sleep(600);
    const skills = classSkills(ch2.classId);
    for (const sk of skills) {
      const slot = sk.kind === 'ultimate' ? 'u' : 0;
      c.send({ t: 'build', op: 'equipSkill', slot, id: sk.id });
      const fits = RL.filter((r) => runeFits(r, sk.behavior));
      const rr = fits[Math.floor(Math.random() * fits.length)];
      if (rr) c.send({ t: 'build', op: 'socketRune', id: sk.id, idx: 0, rune: rr.id });
      await sleep(15);
      const m0 = me(c.st); const tgt = c.st.snap?.u.find((u) => u[0] !== c.st.you && !(u[4] & (1 << 30)));
      c.send({ t: 'cast', slot, x: tgt ? tgt[1] : (m0?.[1] || 0) + 100, y: tgt ? tgt[2] : (m0?.[2] || 0) });
      casts++;
      await sleep(35);
      if (m0 && (m0[4] & (1 << 30))) c.send({ t: 'respawn' });
    }
    await sleep(800);
    console.log('  cast all', skills.length, 'skills of', ch2.classId, srvErr ? '(server stderr!)' : '');
    if (srvErr) fail('server error while casting ' + ch2.classId);
  }
  console.log('OK cast', casts, 'skills across 10 classes');
  // ---- dungeons of every type ----
  for (const [did, extra] of [['story_aurelia', {}], ['abyss', { floor: 4 }], ['hunt', { boss: 'pharaoh' }], ['raid_citadel', {}]]) {
    c.send({ t: 'dev', op: 'warp', map: 'town_aurelia' }); await sleep(500);
    c.send({ t: 'dev', op: 'npc', type: 'dungeon' }); await sleep(200);
    c.send({ t: 'dungeon', op: 'enter', id: did, ...extra }); await sleep(700);
    if (!['dungeon', 'abyss', 'raid'].includes(c.st.enter.kind)) fail('dungeon ' + did + ' not entered: ' + c.st.msgs.slice(-2));
    for (let i = 0; i < 90; i++) {
      const s = c.st.snap; const m0 = me(c.st);
      if (m0 && (m0[4] & (1 << 30))) c.send({ t: 'respawn' });
      const e = s?.u.find((u) => u[0] !== c.st.you && !(u[4] & (1 << 30)));
      if (m0 && e) { const d = Math.hypot(e[1] - m0[1], e[2] - m0[2]); c.send({ t: 'input', mx: d > 80 ? (e[1] - m0[1]) / d : 0, my: d > 80 ? (e[2] - m0[2]) / d : 0 }); c.send({ t: 'cast', slot: i % 2 ? 0 : 'u', x: e[1], y: e[2] }); c.send({ t: 'counter' }); }
      await sleep(70);
    }
    console.log('OK dungeon', did, JSON.stringify(c.st.snap?.obj || {}).slice(0, 160));
    c.send({ t: 'leaveInstance' }); await sleep(400);
  }
  // ---- battleground & guild war with bots ----
  c.send({ t: 'dev', op: 'gold', n: 100000 }); await sleep(100);
  c.send({ t: 'guild', op: 'create', name: 'Testers', tag: 'TST' }); await sleep(1300);
  if (!c.st.char.guild) fail('guild not created: ' + c.st.msgs.slice(-2));
  c.send({ t: 'guild', op: 'donate', gold: 20000 }); c.send({ t: 'guild', op: 'deposit', idx: 0 }); await sleep(1300);
  console.log('OK guild', c.st.char.guild.name, 'lv', c.st.char.guild.level, 'funds', c.st.char.guild.funds, 'storage', c.st.char.guild.storage.length);
  for (const mode of ['bg10', 'guildwar']) {
    if (mode === 'guildwar') c.send({ t: 'guild', op: 'warRegister' }); else c.send({ t: 'pvp', op: 'queue', mode });
    for (let i = 0; i < 60 && c.st.enter.kind !== 'pvp'; i++) await sleep(100);
    if (c.st.enter.kind !== 'pvp') fail(mode + ' not started: ' + c.st.msgs.slice(-3));
    await sleep(mode === 'guildwar' ? 10500 : 8500);
    for (let i = 0; i < 60; i++) { const s = c.st.snap; const m0 = me(c.st); const e = s?.u.find((u) => u[0] !== c.st.you && !(u[4] & (1 << 30))); if (m0 && (m0[4] & (1 << 30))) c.send({ t: 'respawn' }); if (m0 && e) c.send({ t: 'cast', slot: 0, x: e[1], y: e[2] }); c.send({ t: 'input', mx: 1, my: 0 }); await sleep(60); }
    console.log('OK', mode, JSON.stringify(c.st.snap?.obj || {}).slice(0, 200));
    c.send({ t: 'dev', op: 'warp', map: 'town_aurelia' }); await sleep(500);
  }
  // ---- market & crafting ----
  c.send({ t: 'dev', op: 'mats' }); c.send({ t: 'dev', op: 'npc', type: 'smith' }); await sleep(200);
  c.send({ t: 'npc', op: 'craft', slot: 'helm', ilvl: 100, catalyst: 'core' }); await sleep(200);
  c.send({ t: 'npc', op: 'refine', ref: { where: 'equip', slot: 'weapon' } }); c.send({ t: 'npc', op: 'reroll', ref: { where: 'equip', slot: 'weapon' }, affix: 0 }); c.send({ t: 'npc', op: 'repair' }); await sleep(300);
  c.send({ t: 'dev', op: 'npc', type: 'market' }); await sleep(200);
  await sleep(1200); c.send({ t: 'market', op: 'list', idx: c.st.char.inv.length - 1, price: 1234 }); await sleep(1300);
  if (!c.st.other.market || !c.st.other.market.list.length) fail('market listing failed: ' + c.st.msgs.slice(-2));
  console.log('OK craft/refine/market — listings:', c.st.other.market.list.length, 'weapon +' + (c.st.char.equip.weapon.refine || 0));
  if (srvErr.includes('Error')) fail('server errors logged');
  srv.kill(); console.log('SELFTEST PASSED'); process.exit(0);
})().catch((e) => fail(e.stack));
