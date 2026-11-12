// ===== Social: chat, party, guild (storage/log/skills/quests/boss/war/ranking), marketplace =====
import { db, nextId, saveDB } from './db.js';
import { ECONOMY, GUILD_RANKS, GUILD_STORAGE_SIZE, INVENTORY_SIZE, RARITY_INFO } from '../shared/constants.js';
import { BOSSES } from '../shared/world.js';

export const GUILD_SKILLS = {
  g_exp: { name: 'Guild Wisdom', th: 'EXP +2% ต่อระดับ', max: 5, cost: (l) => 40000 * l, req: (l) => l * 2 },
  g_gold: { name: 'Guild Fortune', th: 'ทองดรอป +3% ต่อระดับ', max: 5, cost: (l) => 40000 * l, req: (l) => l * 2 },
  g_storage: { name: 'Guild Vault', th: 'คลังกิลด์ +20 ช่องต่อระดับ', max: 3, cost: (l) => 60000 * l, req: (l) => l * 3 },
  g_boss: { name: 'Hunting Horn', th: 'รางวัล Guild Boss +15% ต่อระดับ', max: 3, cost: (l) => 80000 * l, req: (l) => 2 + l * 2 },
  g_war: { name: 'War Banner', th: 'ดาเมจ +2% เฉพาะใน Guild War (สูงสุด 3)', max: 3, cost: (l) => 100000 * l, req: (l) => 4 + l * 2 },
};
const GUILD_DAILY = { kill: { n: 300, th: 'สมาชิกกำจัดมอนสเตอร์ 300 ตัว' }, boss: { n: 3, th: 'ปราบบอส 3 ตัว' }, pvp: { n: 5, th: 'ชนะ PvP 5 ครั้ง' }, dungeon: { n: 3, th: 'เคลียร์ดันเจี้ยน 3 ครั้ง' } };
const today = () => new Date().toISOString().slice(0, 10);
const clean = (s, n = 200) => String(s || '').replace(/[<>]/g, '').slice(0, n).trim();

// ---------- chat ----------
export function chat(game, sess, m) {
  const now = Date.now();
  if (sess.lastChat && now - sess.lastChat < 600) return;
  sess.lastChat = now;
  const text = clean(m.text); if (!text) return;
  const c = sess.char;
  const mu = db.accounts[sess.acc]?.mutedUntil || 0;
  if (mu > now) return game.err(sess, `คุณถูกห้ามแชทอีก ${Math.ceil((mu - now) / 60000)} นาที`);
  const out = { t: 'chat', ch: m.ch, from: (sess.isGM ? '[GM] ' : '') + c.name, text, cls: c.classId, gm: sess.isGM ? 1 : 0 };
  switch (m.ch) {
    case 'world': return game.broadcast(out);
    case 'party': { const p = partyOf(game, sess); if (!p) return game.err(sess, 'คุณไม่มีปาร์ตี้'); return game.broadcast(out, (s) => p.members.includes(s.char.id)); }
    case 'guild': if (!c.guildId) return game.err(sess, 'คุณไม่มีกิลด์'); return game.broadcast(out, (s) => s.char.guildId === c.guildId);
    case 'whisper': { const t = [...game.online.values()].find((s) => s.char.name.toLowerCase() === String(m.to || '').toLowerCase()); if (!t) return game.err(sess, 'ไม่พบผู้เล่นออนไลน์'); game.send(t, { ...out, ch: 'whisper' }); return game.send(sess, { ...out, ch: 'whisper', to: t.char.name }); }
    default: out.ch = 'say'; return game.broadcast(out, (s) => s.inst === sess.inst);
  }
}

// ---------- party ----------
export function partyOf(game, sess) { return sess.partyId ? game.parties.get(sess.partyId) : null; }
export function partySessions(game, sess) { const p = partyOf(game, sess); if (!p) return []; return p.members.map((id) => game.online.get(id)).filter((s) => s && s !== sess); }
export function partyView(game, sess) {
  const p = partyOf(game, sess); if (!p) return null;
  return { id: p.id, leader: p.leader, members: p.members.map((id) => { const s = game.online.get(id); return { id, name: s?.char.name || db.chars[id]?.name, cls: s?.char.classId, lv: s?.char.level, online: !!s, map: s?.inst?.name, uid: s?.unit?.id, sameInst: s?.inst === sess.inst }; }) };
}
export function partyChanged(game, sess) { const p = partyOf(game, sess); if (!p) return; for (const id of p.members) { const s = game.online.get(id); if (s) game.markDirty(s); } }
export function partyOp(game, sess, m) {
  const c = sess.char;
  if (m.op === 'invite') {
    const t = [...game.online.values()].find((s) => s.char.name.toLowerCase() === String(m.name || '').toLowerCase());
    if (!t || t === sess) return game.err(sess, 'ไม่พบผู้เล่น');
    if (t.partyId) return game.err(sess, 'ผู้เล่นมีปาร์ตี้อยู่แล้ว');
    let p = partyOf(game, sess);
    if (!p) { p = { id: nextId('p'), leader: c.id, members: [c.id] }; game.parties.set(p.id, p); sess.partyId = p.id; }
    if (p.leader !== c.id) return game.err(sess, 'หัวหน้าปาร์ตี้เท่านั้นที่เชิญได้');
    if (p.members.length >= 8) return game.err(sess, 'ปาร์ตี้เต็ม (8 คน)');
    t.partyInvite = p.id;
    game.send(t, { t: 'invite', kind: 'party', from: c.name });
    game.msg(sess, `ส่งคำเชิญปาร์ตี้ถึง ${t.char.name}`); return partyChanged(game, sess);
  }
  if (m.op === 'accept') {
    const p = game.parties.get(sess.partyInvite); sess.partyInvite = null;
    if (!p || p.members.length >= 8) return game.err(sess, 'คำเชิญหมดอายุ');
    p.members.push(c.id); sess.partyId = p.id; partyChanged(game, sess);
    for (const s of partySessions(game, sess)) game.msg(s, `${c.name} เข้าร่วมปาร์ตี้`);
    return;
  }
  if (m.op === 'decline') { sess.partyInvite = null; return; }
  if (m.op === 'leave') return leaveParty(game, sess);
  if (m.op === 'kick') { const p = partyOf(game, sess); if (!p || p.leader !== c.id) return; const t = game.online.get(m.id); if (t) leaveParty(game, t); else { p.members = p.members.filter((x) => x !== m.id); partyChanged(game, sess); } }
}
function leaveParty(game, sess) {
  const p = partyOf(game, sess); if (!p) return;
  p.members = p.members.filter((id) => id !== sess.char.id); sess.partyId = null; game.markDirty(sess);
  if (p.members.length <= 1) { for (const id of p.members) { const s = game.online.get(id); if (s) { s.partyId = null; game.markDirty(s); game.msg(s, 'ปาร์ตี้ถูกยุบ'); } } game.parties.delete(p.id); return; }
  if (p.leader === sess.char.id) p.leader = p.members[0];
  for (const id of p.members) { const s = game.online.get(id); if (s) { game.markDirty(s); game.msg(s, `${sess.char.name} ออกจากปาร์ตี้`); } }
}

export function onLogin(game, sess) {
  const c = sess.char;
  if (c.guildId && !db.guilds[c.guildId]) c.guildId = null;
  if (c.guildId) game.broadcast({ t: 'chat', ch: 'guild', from: 'ระบบ', text: `${c.name} ออนไลน์` }, (s) => s !== sess && s.char.guildId === c.guildId);
  for (const p of game.parties.values()) if (p.members.includes(c.id)) sess.partyId = p.id;
}
export function onLogout(game, sess) { if (sess.partyId) leaveParty(game, sess); }

// ---------- guild ----------
const guildRankIdx = (r) => GUILD_RANKS.findIndex((x) => x.id === r);
function perm(g, cid, p) { const r = g.members[cid]?.rank; const rk = GUILD_RANKS.find((x) => x.id === r); return rk && (rk.perm.includes('all') || rk.perm.includes(p)); }
export const guildExpNext = (lv) => Math.floor(8000 * Math.pow(lv, 1.6));
export function addGuildExp(g, n) { g.exp += n; while (g.exp >= guildExpNext(g.level) && g.level < 50) { g.exp -= guildExpNext(g.level); g.level++; } }
export function guildView(game, sess) {
  const g = sess.char.guildId && db.guilds[sess.char.guildId]; if (!g) return null;
  return { ...g, members: Object.entries(g.members).map(([id, mm]) => ({ id, ...mm, online: game.online.has(id), lv: db.chars[id]?.level ?? mm.lv })), expNext: guildExpNext(g.level), maxMembers: 20 + g.level * 2, storageMax: GUILD_STORAGE_SIZE + (g.skills.g_storage || 0) * 20, dailyDef: GUILD_DAILY, skillDef: Object.fromEntries(Object.entries(GUILD_SKILLS).map(([k, v]) => [k, { name: v.name, th: v.th, max: v.max, cost: v.cost((g.skills[k] || 0) + 1), req: v.req((g.skills[k] || 0) + 1) }])), log: g.log.slice(0, 40) };
}
function ensureDaily(g) { if (!g.daily || g.daily.date !== today()) g.daily = { date: today(), kill: 0, boss: 0, pvp: 0, dungeon: 0, claimed: {} }; }
export function guildProgress(game, sess, kind, n) {
  const g = sess.char.guildId && db.guilds[sess.char.guildId]; if (!g) return;
  ensureDaily(g); g.daily[kind] = (g.daily[kind] || 0) + n;
  const mm = g.members[sess.char.id]; if (mm) mm.contrib = (mm.contrib || 0) + (kind === 'kill' ? 1 : 20);
}
function notifyGuild(game, g) { for (const s of game.sessions) if (s.char?.guildId === g.id) game.markDirty(s); }
function glog(g, text) { g.log.unshift({ t: Date.now(), text }); if (g.log.length > 200) g.log.length = 200; }

export function leaveGuild(game, sess, silent) {
  const c = sess.char; const g = db.guilds[c.guildId]; if (!g) { c.guildId = null; return; }
  delete g.members[c.id]; c.guildId = null; glog(g, `${c.name} ออกจากกิลด์`);
  if (g.leader === c.id) {
    const next = Object.entries(g.members).sort((a, b) => guildRankIdx(a[1].rank) - guildRankIdx(b[1].rank))[0];
    if (next) { g.leader = next[0]; next[1].rank = 'leader'; glog(g, `${next[1].name} เป็นหัวหน้ากิลด์คนใหม่`); }
    else delete db.guilds[g.id];
  }
  if (!silent) notifyGuild(game, g);
}

export function guildOp(game, sess, m) {
  const c = sess.char; const g = c.guildId && db.guilds[c.guildId];
  const done = () => { if (g) notifyGuild(game, g); game.markDirty(sess); saveDB(); };
  switch (m.op) {
    case 'create': {
      if (g) return game.err(sess, 'คุณมีกิลด์อยู่แล้ว');
      const name = clean(m.name, 20), tag = clean(m.tag, 4).toUpperCase();
      if (name.length < 3 || tag.length < 2) return game.err(sess, 'ชื่อกิลด์ 3-20 ตัว, ตัวย่อ 2-4 ตัว');
      if (Object.values(db.guilds).some((x) => x.name.toLowerCase() === name.toLowerCase() || x.tag === tag)) return game.err(sess, 'ชื่อหรือตัวย่อซ้ำ');
      if (c.level < 20) return game.err(sess, 'ต้องการเลเวล 20');
      if (c.gold < ECONOMY.guildCreate) return game.err(sess, `ต้องใช้ทอง ${ECONOMY.guildCreate}`);
      c.gold -= ECONOMY.guildCreate;
      const id = nextId('g');
      db.guilds[id] = { id, name, tag, emblem: { shape: ['shield', 'circle', 'diamond', 'star'].includes(m.shape) ? m.shape : 'shield', color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#d83a2a', icon: ['sword', 'skull', 'crown', 'dragon', 'sun', 'moon'].includes(m.icon) ? m.icon : 'sword' }, leader: c.id, members: { [c.id]: { rank: 'leader', contrib: 0, name: c.name, cls: c.classId, lv: c.level, joined: Date.now() } }, level: 1, exp: 0, funds: 0, storage: [], log: [], skills: {}, daily: null, warRating: 1000, warWins: 0, seasonPts: 0, cosmetics: [], alliance: null, notice: '', created: Date.now() };
      c.guildId = id; glog(db.guilds[id], `${c.name} ก่อตั้งกิลด์`);
      game.msg(sess, `ก่อตั้งกิลด์ [${tag}] ${name} สำเร็จ!`, '#ffd84a'); game.refreshUnit(sess); return done();
    }
    case 'accept': {
      const ig = db.guilds[sess.guildInvite]; sess.guildInvite = null;
      if (!ig || g) return;
      if (Object.keys(ig.members).length >= 20 + ig.level * 2) return game.err(sess, 'กิลด์เต็ม');
      ig.members[c.id] = { rank: 'recruit', contrib: 0, name: c.name, cls: c.classId, lv: c.level, joined: Date.now() };
      c.guildId = ig.id; glog(ig, `${c.name} เข้าร่วมกิลด์`); notifyGuild(game, ig); game.refreshUnit(sess); return done();
    }
    case 'ranking': {
      const list = Object.values(db.guilds).map((x) => ({ name: x.name, tag: x.tag, level: x.level, members: Object.keys(x.members).length, war: x.warRating || 1000, wins: x.warWins || 0, season: x.seasonPts || 0, emblem: x.emblem })).sort((a, b) => b.season - a.season || b.level - a.level).slice(0, 50);
      return game.send(sess, { t: 'guildRanking', list, season: db.season.id });
    }
  }
  if (!g) return game.err(sess, 'คุณไม่มีกิลด์');
  const me = g.members[c.id];
  switch (m.op) {
    case 'invite': {
      if (!perm(g, c.id, 'invite')) return game.err(sess, 'ไม่มีสิทธิ์เชิญ');
      const t = [...game.online.values()].find((s) => s.char.name.toLowerCase() === String(m.name || '').toLowerCase());
      if (!t || t.char.guildId) return game.err(sess, 'ไม่พบผู้เล่นหรือมีกิลด์แล้ว');
      t.guildInvite = g.id; game.send(t, { t: 'invite', kind: 'guild', from: c.name, guild: g.name }); return game.msg(sess, `เชิญ ${t.char.name} เข้ากิลด์แล้ว`);
    }
    case 'leave': leaveGuild(game, sess); game.refreshUnit(sess); return done();
    case 'kick': case 'promote': case 'demote': {
      const t = g.members[m.id]; if (!t || m.id === c.id) return;
      if (guildRankIdx(t.rank) <= guildRankIdx(me.rank)) return game.err(sess, 'ไม่มีสิทธิ์กับสมาชิกระดับนี้');
      if (m.op === 'kick') { if (!perm(g, c.id, 'kick')) return; delete g.members[m.id]; const ts = game.online.get(m.id); if (ts) { ts.char.guildId = null; game.refreshUnit(ts); } else if (db.chars[m.id]) db.chars[m.id].guildId = null; glog(g, `${c.name} เตะ ${t.name} ออก`); }
      else { if (me.rank !== 'leader' && !(me.rank === 'officer' && m.op === 'promote' && t.rank === 'recruit')) return game.err(sess, 'ไม่มีสิทธิ์'); const i = guildRankIdx(t.rank) + (m.op === 'promote' ? -1 : 1); if (i < 1 || i >= GUILD_RANKS.length) return; t.rank = GUILD_RANKS[i].id; glog(g, `${t.name} เป็น ${GUILD_RANKS[i].th}`); }
      return done();
    }
    case 'transfer': { if (me.rank !== 'leader' || !g.members[m.id]) return; g.members[m.id].rank = 'leader'; me.rank = 'officer'; g.leader = m.id; glog(g, `โอนหัวหน้ากิลด์ให้ ${g.members[m.id].name}`); return done(); }
    case 'notice': if (!perm(g, c.id, 'all')) return; g.notice = clean(m.text, 300); return done();
    case 'emblem': if (me.rank !== 'leader') return; if (/^#[0-9a-f]{6}$/i.test(m.color)) g.emblem.color = m.color; if (['shield', 'circle', 'diamond', 'star'].includes(m.shape)) g.emblem.shape = m.shape; if (['sword', 'skull', 'crown', 'dragon', 'sun', 'moon'].includes(m.icon)) g.emblem.icon = m.icon; return done();
    case 'donate': {
      const n = Math.max(0, Math.floor(+m.gold || 0)); if (!n || c.gold < n) return game.err(sess, 'ทองไม่พอ');
      c.gold -= n; g.funds += n; me.contrib += Math.floor(n / 100); addGuildExp(g, Math.floor(n / 50)); glog(g, `${c.name} บริจาค ${n} ทอง`); return done();
    }
    case 'deposit': {
      const it = c.inv[m.idx | 0]; if (!it) return; if (it.bound) return game.err(sess, 'ไอเทมผูกมัดฝากไม่ได้');
      if (g.storage.length >= GUILD_STORAGE_SIZE + (g.skills.g_storage || 0) * 20) return game.err(sess, 'คลังกิลด์เต็ม');
      c.inv.splice(m.idx | 0, 1); g.storage.push(it); glog(g, `${c.name} ฝาก ${it.name}`); return done();
    }
    case 'withdraw': {
      if (!perm(g, c.id, 'storage')) return game.err(sess, 'ไม่มีสิทธิ์เบิกของ (ต้องเป็นรองหัวหน้าขึ้นไป)');
      const it = g.storage[m.idx | 0]; if (!it) return; if (c.inv.length >= INVENTORY_SIZE) return game.err(sess, 'กระเป๋าเต็ม');
      g.storage.splice(m.idx | 0, 1); c.inv.push(it); glog(g, `${c.name} เบิก ${it.name}`); return done();
    }
    case 'skillUp': {
      if (me.rank !== 'leader') return game.err(sess, 'หัวหน้ากิลด์เท่านั้น');
      const sk = GUILD_SKILLS[m.id]; if (!sk) return; const cur = g.skills[m.id] || 0;
      if (cur >= sk.max) return game.err(sess, 'สูงสุดแล้ว'); if (g.level < sk.req(cur + 1)) return game.err(sess, `ต้องการกิลด์เลเวล ${sk.req(cur + 1)}`);
      if (g.funds < sk.cost(cur + 1)) return game.err(sess, 'เงินกิลด์ไม่พอ');
      g.funds -= sk.cost(cur + 1); g.skills[m.id] = cur + 1; glog(g, `อัปเกรด ${sk.name} เป็นระดับ ${cur + 1}`);
      for (const s of game.sessions) if (s.char?.guildId === g.id) game.refreshUnit(s);
      return done();
    }
    case 'claimDaily': {
      ensureDaily(g); const q = GUILD_DAILY[m.id]; if (!q) return;
      if (g.daily.claimed[m.id]) return game.err(sess, 'รับแล้ววันนี้'); if (g.daily[m.id] < q.n) return game.err(sess, 'ยังไม่สำเร็จ');
      if (!perm(g, c.id, 'quest')) return game.err(sess, 'ไม่มีสิทธิ์');
      g.daily.claimed[m.id] = true; addGuildExp(g, 3000); g.funds += 15000; g.seasonPts = (g.seasonPts || 0) + 5; glog(g, `ทำเควสต์กิลด์: ${q.th} สำเร็จ`); return done();
    }
    case 'boss': {
      if (!perm(g, c.id, 'all') && me.rank !== 'officer') return game.err(sess, 'หัวหน้า/รองหัวหน้าเท่านั้น');
      if (g.lastBoss === today()) return game.err(sess, 'เรียก Guild Boss ได้วันละ 1 ครั้ง');
      if (g.funds < 30000) return game.err(sess, 'เงินกิลด์ไม่พอ (30000)');
      const members = [...game.sessions].filter((s) => s.char?.guildId === g.id && s.inst === sess.inst);
      const bossIds = Object.keys(BOSSES); const bossId = bossIds[Math.min(bossIds.length - 1, Math.floor(g.level / 4))];
      g.funds -= 30000; g.lastBoss = today(); glog(g, `${c.name} เรียก Guild Boss`);
      import('./dungeons.js').then((d) => d.createDungeon(game, members, 'guildboss', { def: { type: 'guildboss', name: `Guild Boss: ${BOSSES[bossId].name}`, lv: 1, players: [1, 60], biome: 'arena', hpMul: 1 + members.length * 0.5 }, bossId }));
      return done();
    }
    case 'warRegister': {
      if (!perm(g, c.id, 'war')) return game.err(sess, 'ไม่มีสิทธิ์ลงทะเบียนสงคราม');
      if (game.queues.guildwar.some((e) => e.guildId === g.id)) return game.err(sess, 'ลงทะเบียนแล้ว');
      game.queues.guildwar.push({ guildId: g.id, at: game.time });
      game.broadcast({ t: 'msg', text: `⚔ กิลด์ลงทะเบียน Guild War แล้ว! รอคู่ต่อสู้ (ถ้าไม่มีจะจับคู่กับกองทัพ AI ใน ${game.config.pvpBotFill * 2} วินาที)`, c: '#ff9a2a' }, (s) => s.char.guildId === g.id);
      return;
    }
    case 'warCancel': game.queues.guildwar = game.queues.guildwar.filter((e) => e.guildId !== g.id); return game.msg(sess, 'ยกเลิกการลงทะเบียน');
  }
}

// ---------- marketplace (server-validated; fees burn gold to control inflation) ----------
export function marketOp(game, sess, m) {
  const c = sess.char;
  const nearMarket = () => sess.inst?.kind === 'town' && sess.inst.def.npcs.some((n) => n.type === 'market' && (n.x - sess.unit.x) ** 2 + (n.y - sess.unit.y) ** 2 < 220 * 220);
  const now = Date.now();
  // expire old listings -> back to seller's account stash
  db.market = db.market.filter((l) => { if (now - l.created < 3 * 86400000) return true; const acc = db.accounts[db.chars[l.seller]?.account]; if (acc) acc.stash.push(l.item); return false; });
  switch (m.op) {
    case 'browse': {
      const q = clean(m.q, 40).toLowerCase();
      let list = db.market.filter((l) => (!q || l.item.name.toLowerCase().includes(q)) && (!m.slot || l.item.slot === m.slot || l.item.type === m.slot) && (!m.rarity || l.item.rarity === m.rarity));
      list.sort((a, b) => (m.sort === 'new' ? b.created - a.created : a.price - b.price));
      const page = Math.max(0, m.page | 0);
      return game.send(sess, { t: 'market', list: list.slice(page * 30, page * 30 + 30).map((l) => ({ id: l.id, item: l.item, price: l.price, seller: l.sellerName, mine: l.seller === c.id })), total: list.length, page, fee: ECONOMY.marketFee });
    }
    case 'list': {
      if (!nearMarket()) return game.err(sess, 'ต้องอยู่ใกล้ตลาดกลาง');
      const it = c.inv[m.idx | 0]; const price = Math.floor(+m.price || 0);
      if (!it || price < 1 || price > 2e9) return;
      if (it.bound) return game.err(sess, 'ไอเทม Mythic ผูกมัดบัญชี ขายในตลาดไม่ได้');
      if (db.market.filter((l) => l.seller === c.id).length >= 15) return game.err(sess, 'ลงขายได้สูงสุด 15 ชิ้น');
      const fee = Math.max(10, Math.floor(price * ECONOMY.marketListFee));
      if (c.gold < fee) return game.err(sess, `ค่าวางขาย ${fee} ทอง`);
      c.gold -= fee; c.inv.splice(m.idx | 0, 1);
      db.market.push({ id: nextId('l'), seller: c.id, sellerName: c.name, item: it, price, created: now });
      game.msg(sess, `วางขาย ${it.name} ราคา ${price} (ค่าวาง ${fee})`); game.markDirty(sess); saveDB();
      return marketOp(game, sess, { op: 'browse', sort: 'new' });
    }
    case 'buy': {
      if (!nearMarket()) return game.err(sess, 'ต้องอยู่ใกล้ตลาดกลาง');
      const i = db.market.findIndex((l) => l.id === m.id); if (i < 0) return game.err(sess, 'สินค้านี้ขายไปแล้ว');
      const l = db.market[i]; if (l.seller === c.id) return game.err(sess, 'ซื้อของตัวเองไม่ได้');
      if (c.gold < l.price) return game.err(sess, 'ทองไม่พอ'); if (c.inv.length >= INVENTORY_SIZE) return game.err(sess, 'กระเป๋าเต็ม');
      db.market.splice(i, 1); c.gold -= l.price; c.inv.push(l.item);
      const proceeds = Math.floor(l.price * (1 - ECONOMY.marketFee));
      const seller = db.chars[l.seller]; if (seller) seller.gold += proceeds;
      const ss = game.online.get(l.seller); if (ss) { game.msg(ss, `💰 ${l.item.name} ขายได้แล้ว! ได้รับ ${proceeds} ทอง (หักค่าธรรมเนียม ${Math.round(ECONOMY.marketFee * 100)}%)`, '#ffd84a'); game.markDirty(ss); }
      game.msg(sess, `ซื้อ ${l.item.name} สำเร็จ`, RARITY_INFO[l.item.rarity]?.color); game.markDirty(sess); saveDB();
      return marketOp(game, sess, { op: 'browse' });
    }
    case 'cancel': {
      const i = db.market.findIndex((l) => l.id === m.id && l.seller === c.id); if (i < 0) return;
      if (c.inv.length >= INVENTORY_SIZE) return game.err(sess, 'กระเป๋าเต็ม');
      c.inv.push(db.market.splice(i, 1)[0].item); game.markDirty(sess); saveDB();
      return marketOp(game, sess, { op: 'browse', sort: 'new' });
    }
  }
}
