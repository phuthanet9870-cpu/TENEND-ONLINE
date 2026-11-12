// ===== Player-owned systems: build (skills/runes/passives/presets), items, crafting, NPC services, quests =====
import { db, saveDB } from './db.js';
import { CLASS_BY_ID } from '../shared/classes.js';
import { classSkills, getSkill, MAX_SKILL_RANK, runeSlotsForRank } from '../shared/skills.js';
import { RUNE_BY_ID, runeFits } from '../shared/runes.js';
import { buildPassiveTree, canAllocate, spentPoints, passivePointsFor } from '../shared/passives.js';
import { generateItem, rollAffix, salvageYield, sellPrice, POTIONS, REFINE_CHANCE, MAX_REFINE, WEAPON_TYPES, SETS } from '../shared/items.js';
import { ECONOMY, INVENTORY_SIZE, STASH_SIZE, HOTBAR_SIZE, RARITY_INFO, RARITIES } from '../shared/constants.js';
import { MAPS, QUESTS, TOWNS } from '../shared/world.js';
import { expToNext } from '../shared/constants.js';

export function migrateChar(c) {
  c.build = c.build || { hotbar: [], ult: null, runes: {}, passives: { root: 1 } };
  while (c.build.hotbar.length < HOTBAR_SIZE) c.build.hotbar.push(null);
  c.presets = c.presets || []; c.materials = c.materials || {}; c.runes = c.runes || {}; c.potions = c.potions || { hp: 0, mp: 0 };
  c.quests = c.quests || { active: {}, done: {} }; c.rating = c.rating || { duel: 1000, arena3: 1000 }; c.pvpStats = c.pvpStats || { wins: 0, losses: 0, kills: 0 };
  c.skillRanks = c.skillRanks || {}; c.inv = c.inv || []; c.equip = c.equip || {};
  // drop references to skills / nodes that no longer exist (safe for future data changes)
  const tree = buildPassiveTree(c.classId);
  for (const k of Object.keys(c.build.passives)) if (!tree.byId[k]) delete c.build.passives[k];
  c.build.hotbar = c.build.hotbar.map((id) => (id && getSkill(id) ? id : null));
  if (c.build.ult && !getSkill(c.build.ult)) c.build.ult = null;
}

const npcNear = (sess, type) => {
  const inst = sess.inst, u = sess.unit;
  return inst && u && inst.kind === 'town' && inst.def.npcs.some((n) => n.type === type && (n.x - u.x) ** 2 + (n.y - u.y) ** 2 < 220 * 220);
};
const skillPointsTotal = (c) => Math.max(0, c.level - 1) + c.mastery;
const skillPointsSpent = (c) => Object.values(c.skillRanks).reduce((a, r) => a + (r - 1), 0);
function runeUsage(c, build = c.build) { const n = {}; for (const list of Object.values(build.runes || {})) for (const r of list) if (r) n[r] = (n[r] || 0) + 1; return n; }
const outOfCombat = (sess) => !sess.unit || sess.inst.time - sess.unit.lastCombat > 4 || sess.inst.safe;

export function buildOp(game, sess, m) {
  const c = sess.char;
  const done = () => { game.refreshUnit(sess); game.markDirty(sess); };
  switch (m.op) {
    case 'equipSkill': {
      const slot = m.slot === 'u' ? 'u' : m.slot | 0;
      if (m.id == null) { if (slot === 'u') c.build.ult = null; else if (slot >= 0 && slot < HOTBAR_SIZE) c.build.hotbar[slot] = null; return done(); }
      const s = getSkill(m.id);
      if (!s || s.classId !== c.classId) return game.err(sess, 'สกิลไม่ถูกต้อง');
      if (s.unlock > c.level) return game.err(sess, `ต้องการเลเวล ${s.unlock}`);
      if (slot === 'u') { if (s.kind !== 'ultimate') return game.err(sess, 'ช่องนี้ใส่ได้เฉพาะ Ultimate'); c.build.ult = s.id; }
      else { if (s.kind !== 'active' || slot < 0 || slot >= HOTBAR_SIZE) return game.err(sess, 'ช่องนี้ใส่ได้เฉพาะ Active Skill'); const prev = c.build.hotbar.indexOf(s.id); if (prev >= 0) c.build.hotbar[prev] = c.build.hotbar[slot]; c.build.hotbar[slot] = s.id; }
      return done();
    }
    case 'rankSkill': {
      const s = getSkill(m.id); if (!s || s.classId !== c.classId || s.unlock > c.level) return;
      const r = c.skillRanks[s.id] || 1;
      if (r >= MAX_SKILL_RANK) return game.err(sess, 'ระดับสูงสุดแล้ว');
      if (skillPointsSpent(c) >= skillPointsTotal(c)) return game.err(sess, 'แต้มสกิลไม่พอ');
      c.skillRanks[s.id] = r + 1; return done();
    }
    case 'socketRune': {
      const s = getSkill(m.id); const rune = RUNE_BY_ID[m.rune];
      if (!s || s.classId !== c.classId || !rune) return;
      if (!runeFits(rune, s.behavior)) return game.err(sess, `รูน ${rune.name} ใช้กับสกิลแบบ ${s.behavior} ไม่ได้`);
      const idx = m.idx | 0; const slots = runeSlotsForRank(c.skillRanks[s.id] || 1);
      if (idx < 0 || idx >= slots) return game.err(sess, `สกิลนี้มีช่องรูน ${slots} ช่อง (เพิ่มที่ Rank 8 และ 16)`);
      const list = c.build.runes[s.id] = c.build.runes[s.id] || [];
      const usage = runeUsage(c); if (list[idx] === rune.id) return;
      if ((usage[rune.id] || 0) >= (c.runes[rune.id] || 0)) return game.err(sess, `มีรูน ${rune.name} ไม่พอ (ใช้อยู่ ${usage[rune.id] || 0}/${c.runes[rune.id] || 0})`);
      if (list.includes(rune.id)) return game.err(sess, 'ใส่รูนซ้ำในสกิลเดียวกันไม่ได้');
      list[idx] = rune.id; return done();
    }
    case 'unsocketRune': { const list = c.build.runes[m.id]; if (list) { list[m.idx | 0] = null; if (!list.some(Boolean)) delete c.build.runes[m.id]; } return done(); }
    case 'allocPassive': {
      const tree = buildPassiveTree(c.classId);
      const e = canAllocate(tree, c.build.passives, m.node, c.level, c.mastery);
      if (e) return game.err(sess, e);
      c.build.passives[m.node] = (c.build.passives[m.node] || 0) + 1; return done();
    }
    case 'reset': {
      if (!outOfCombat(sess)) return game.err(sess, 'รีเซ็ตได้เฉพาะนอกการต่อสู้');
      const cost = c.level < 20 ? 0 : ECONOMY.resetBuild(c.level) * (m.what === 'all' ? 1.5 : 1);
      if (c.gold < cost) return game.err(sess, `ต้องใช้ทอง ${Math.round(cost)}`);
      c.gold -= Math.round(cost);
      if (m.what === 'passives' || m.what === 'all') c.build.passives = { root: 1 };
      if (m.what === 'skills' || m.what === 'all') { c.skillRanks = {}; for (const id of Object.keys(c.build.runes)) c.build.runes[id] = (c.build.runes[id] || []).slice(0, 1); }
      game.msg(sess, `รีเซ็ต Build สำเร็จ (ใช้ทอง ${Math.round(cost)})`);
      return done();
    }
    case 'savePreset': {
      const idx = Math.max(0, Math.min(5, m.idx | 0));
      c.presets[idx] = { name: String(m.name || `Preset ${idx + 1}`).slice(0, 24), tag: m.tag === 'PvP' ? 'PvP' : 'PvE', hotbar: [...c.build.hotbar], ult: c.build.ult, runes: structuredClone(c.build.runes), passives: { ...c.build.passives }, ranks: { ...c.skillRanks }, saved: Date.now() };
      game.msg(sess, `บันทึก Build Preset "${c.presets[idx].name}" แล้ว`);
      return game.markDirty(sess);
    }
    case 'deletePreset': c.presets[m.idx | 0] = null; return game.markDirty(sess);
    case 'loadPreset': {
      const p = c.presets[m.idx | 0]; if (!p) return;
      if (!outOfCombat(sess)) return game.err(sess, 'สลับ Preset ได้เฉพาะนอกการต่อสู้');
      const tree = buildPassiveTree(c.classId);
      const passives = { root: 1 }; let spent = 0; const budget = passivePointsFor(c.level, c.mastery);
      // re-validate allocation in BFS order so removed/added nodes stay consistent
      let progress = true;
      while (progress) { progress = false; for (const [id, r] of Object.entries(p.passives)) { if (passives[id] || id === 'root') continue; const n = tree.byId[id]; if (!n) continue; if (n.req.some((q) => q === 'root' || passives[q])) { const take = Math.min(r, n.ranks, budget - spent); if (take > 0) { passives[id] = take; spent += take; progress = true; } } } }
      const ranks = {}; let rs = 0; const rb = skillPointsTotal(c);
      for (const [id, r] of Object.entries(p.ranks || {})) { const s = getSkill(id); if (!s || s.classId !== c.classId || s.unlock > c.level) continue; const take = Math.min(r - 1, rb - rs, MAX_SKILL_RANK - 1); if (take > 0) { ranks[id] = 1 + take; rs += take; } }
      const runes = {}; const avail = { ...c.runes };
      for (const [id, list] of Object.entries(p.runes || {})) { const s = getSkill(id); if (!s) continue; runes[id] = list.map((r) => (r && avail[r] > 0 ? (avail[r]--, r) : null)); }
      c.build = { hotbar: p.hotbar.map((id) => { const s = id && getSkill(id); return s && s.unlock <= c.level ? id : null; }), ult: p.ult && getSkill(p.ult)?.unlock <= c.level ? p.ult : null, runes, passives };
      c.skillRanks = ranks;
      game.msg(sess, `โหลด Preset "${p.name}" [${p.tag}] แล้ว`);
      return done();
    }
  }
}

// ---------- items ----------
function getRef(c, acc, ref) {
  if (!ref) return null;
  if (ref.where === 'inv') return c.inv[ref.idx | 0] ? { item: c.inv[ref.idx | 0], take: () => c.inv.splice(ref.idx | 0, 1)[0] } : null;
  if (ref.where === 'equip') return c.equip[ref.slot] ? { item: c.equip[ref.slot], take: () => { const it = c.equip[ref.slot]; delete c.equip[ref.slot]; return it; } } : null;
  if (ref.where === 'stash') return acc.stash[ref.idx | 0] ? { item: acc.stash[ref.idx | 0], take: () => acc.stash.splice(ref.idx | 0, 1)[0] } : null;
  return null;
}
export function addToInventory(game, sess, item) {
  const c = sess.char;
  if (c.inv.length >= INVENTORY_SIZE) { game.err(sess, 'กระเป๋าเต็ม!'); return false; }
  c.inv.push(item); return true;
}
function canEquip(c, it) {
  if (it.type !== 'gear') return 'ไม่ใช่อุปกรณ์';
  if (it.req > c.level) return `ต้องการเลเวล ${it.req}`;
  if (it.slot === 'weapon' && !WEAPON_TYPES[it.wtype]?.classes.includes(c.classId)) return `คลาส ${CLASS_BY_ID[c.classId].th} ใช้ ${WEAPON_TYPES[it.wtype]?.name} ไม่ได้`;
  return null;
}

export function itemOp(game, sess, m) {
  const c = sess.char, acc = db.accounts[c.account];
  const done = (refresh = true) => { if (refresh) game.refreshUnit(sess); game.markDirty(sess); };
  switch (m.op) {
    case 'equip': {
      const idx = m.idx | 0; const it = c.inv[idx]; if (!it) return;
      const e = canEquip(c, it); if (e) return game.err(sess, e);
      let slot = it.slot;
      if (slot === 'ring') slot = m.ring === 2 ? 'ring2' : m.ring === 1 ? 'ring1' : !c.equip.ring1 ? 'ring1' : !c.equip.ring2 ? 'ring2' : 'ring1';
      c.inv.splice(idx, 1);
      if (c.equip[slot]) c.inv.push(c.equip[slot]);
      c.equip[slot] = it;
      if (it.mythic) it.bound = true;
      return done();
    }
    case 'unequip': { const it = c.equip[m.slot]; if (!it) return; if (c.inv.length >= INVENTORY_SIZE) return game.err(sess, 'กระเป๋าเต็ม'); delete c.equip[m.slot]; c.inv.push(it); return done(); }
    case 'salvage': {
      const idxs = (Array.isArray(m.idxs) ? m.idxs : [m.idx]).map((x) => x | 0).sort((a, b) => b - a);
      const got = {};
      for (const i of idxs) { const it = c.inv[i]; if (!it || it.type !== 'gear' || it.locked) continue; c.inv.splice(i, 1); for (const [k, v] of Object.entries(salvageYield(it))) if (v) { c.materials[k] = (c.materials[k] || 0) + v; got[k] = (got[k] || 0) + v; } }
      game.msg(sess, `แยกชิ้นส่วนได้: ${Object.entries(got).map(([k, v]) => `${k} x${v}`).join(', ') || '-'}`);
      return done(false);
    }
    case 'lock': { const r = getRef(c, acc, m.ref); if (r) r.item.locked = !r.item.locked; return done(false); }
    case 'destroy': { const it = c.inv[m.idx | 0]; if (!it || it.locked) return; c.inv.splice(m.idx | 0, 1); return done(false); }
    case 'socketCard': {
      const r = getRef(c, acc, m.ref); const card = c.inv[m.cardIdx | 0];
      if (!r || !card || card.type !== 'card' || r.item.type !== 'gear') return;
      if ((r.item.cards || []).length >= r.item.sockets) return game.err(sess, 'ไม่มีช่อง Socket ว่าง (เจาะเพิ่มที่ช่างตีเหล็ก)');
      r.item.cards = [...(r.item.cards || []), card.card];
      c.inv.splice(m.cardIdx | 0, 1);
      game.msg(sess, `ฝัง ${card.name} ลงใน ${r.item.name} แล้ว`);
      return done();
    }
    case 'sort': c.inv.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || (b.ilvl || 0) - (a.ilvl || 0)); return done(false);
  }
}

export function npcOp(game, sess, m) {
  const c = sess.char, acc = db.accounts[c.account];
  const done = (refresh = true) => { if (refresh) game.refreshUnit(sess); game.markDirty(sess); };
  const need = (type) => { if (!npcNear(sess, type)) { game.err(sess, 'ต้องอยู่ใกล้ NPC ที่เกี่ยวข้องในเมือง'); return false; } return true; };
  switch (m.op) {
    // ---- Shop ----
    case 'buyPotion': {
      if (!need('shop')) return; const p = POTIONS[m.kind]; if (!p) return;
      const n = Math.max(1, Math.min(100, m.n | 0)); const cost = p.price(c.level) * n;
      if (c.gold < cost) return game.err(sess, 'ทองไม่พอ');
      c.gold -= cost; c.potions[m.kind] = (c.potions[m.kind] || 0) + n; return done(false);
    }
    case 'sell': {
      if (!need('shop')) return;
      const idxs = (Array.isArray(m.idxs) ? m.idxs : [m.idx]).map((x) => x | 0).sort((a, b) => b - a); let total = 0;
      for (const i of idxs) { const it = c.inv[i]; if (!it || it.locked) continue; total += it.type === 'gear' ? sellPrice(it) : 50; c.inv.splice(i, 1); }
      c.gold += total; game.msg(sess, `ขายได้ ${total} ทอง`); return done(false);
    }
    case 'buyRune': { // basic tier-1 runes sold for honor (PvP currency) or gold
      if (!need('shop')) return; const r = RUNE_BY_ID[m.rune]; if (!r || r.tier > 1) return game.err(sess, 'ร้านขายเฉพาะรูนระดับ 1');
      const cost = 5000; if (c.gold < cost) return game.err(sess, `ต้องใช้ ${cost} ทอง`);
      c.gold -= cost; c.runes[r.id] = (c.runes[r.id] || 0) + 1; game.msg(sess, `ซื้อรูน ${r.name}`); return done(false);
    }
    case 'fuseRunes': { // 3 runes of a tier -> 1 random rune of next tier
      const ids = Array.isArray(m.runes) ? m.runes.slice(0, 3) : [];
      if (ids.length !== 3) return; const need3 = {}; for (const id of ids) need3[id] = (need3[id] || 0) + 1;
      const usage = runeUsage(c);
      for (const [id, n] of Object.entries(need3)) if (!RUNE_BY_ID[id] || (c.runes[id] || 0) - (usage[id] || 0) < n) return game.err(sess, 'รูนไม่พอ (รูนที่ใส่อยู่ใช้ฟิวส์ไม่ได้)');
      const tier = Math.min(3, Math.max(...ids.map((id) => RUNE_BY_ID[id].tier)) + 1);
      for (const [id, n] of Object.entries(need3)) c.runes[id] -= n;
      const pool = Object.values(RUNE_BY_ID).filter((r) => r.tier === tier); const r = pool[Math.floor(Math.random() * pool.length)];
      c.runes[r.id] = (c.runes[r.id] || 0) + 1; game.msg(sess, `ฟิวส์สำเร็จ! ได้รูน ${r.name} (Tier ${r.tier})`, '#7fe8ff'); return done(false);
    }
    // ---- Blacksmith ----
    case 'craft': {
      if (!need('smith')) return;
      const slot = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'].includes(m.slot) ? m.slot : null; if (!slot) return;
      const ilvl = Math.max(1, Math.min(c.level, m.ilvl | 0 || c.level));
      const cost = { gold: ECONOMY.craftGold(ilvl), ore: 3 + Math.floor(ilvl / 15), dust: 1 + Math.floor(ilvl / 40) };
      let minRarity = 'magic', mf = 0, set = null;
      if (m.catalyst === 'core') { cost.core = 1; minRarity = 'epic'; }
      if (m.catalyst === 'essence') { cost.essence = 3; mf = 300; minRarity = 'rare'; }
      if (m.catalyst === 'set' && SETS[m.set]) { cost.core = 3; cost.guildsigil = 0; minRarity = 'epic'; set = m.set; if (!SETS[set].slots.some((s) => s.startsWith(slot))) return game.err(sess, 'ช่องนี้ไม่มีในเซ็ตนี้'); }
      if (!pay(game, sess, cost)) return;
      const it = generateItem(Math.random, { ilvl, slot, classId: c.classId, mf, minRarity, set, weaponType: slot === 'weapon' ? (m.wtype && WEAPON_TYPES[m.wtype]?.classes.includes(c.classId) ? m.wtype : CLASS_BY_ID[c.classId].weapons[0]) : null });
      it.crafted = c.name;
      if (!addToInventory(game, sess, it)) return;
      game.send(sess, { t: 'crafted', item: it });
      game.msg(sess, `คราฟต์สำเร็จ: ${it.name} [${RARITY_INFO[it.rarity].th}]`, RARITY_INFO[it.rarity].color);
      return done(false);
    }
    case 'reroll': {
      if (!need('smith')) return; const r = getRef(c, acc, m.ref); if (!r || r.item.type !== 'gear') return;
      const ai = m.affix | 0; const af = r.item.affixes[ai]; if (!af) return;
      if (!pay(game, sess, { gold: ECONOMY.rerollGold(r.item.ilvl), dust: 3, shard: 1 })) return;
      r.item.affixes[ai] = rollAffix(Math.random, r.item.slot, r.item.ilvl, r.item.affixes.map((a) => a.id));
      r.item.rerolls = (r.item.rerolls || 0) + 1;
      game.msg(sess, `Reroll: ${af.id} → ${r.item.affixes[ai].id} +${r.item.affixes[ai].v}`);
      return done();
    }
    case 'refine': {
      if (!need('smith')) return; const r = getRef(c, acc, m.ref); if (!r || r.item.type !== 'gear') return;
      const cur = r.item.refine || 0; if (cur >= MAX_REFINE) return game.err(sess, 'ตีบวกสูงสุดแล้ว');
      if (!pay(game, sess, { gold: ECONOMY.refineGold(cur, r.item.ilvl), ore: 2 + cur, ...(cur >= 5 ? { mythril: 1 } : {}) })) return;
      if (Math.random() * 100 < REFINE_CHANCE[cur]) { r.item.refine = cur + 1; game.msg(sess, `✨ ตีบวกสำเร็จ! ${r.item.name} +${cur + 1}`, '#a0ffb0'); if (cur + 1 >= 9) game.announce(`${c.name} ตีบวก ${r.item.name} +${cur + 1} สำเร็จ!`); }
      else if (cur >= 5) { r.item.refine = cur - 1; game.err(sess, `ตีบวกล้มเหลว... ระดับลดลงเป็น +${cur - 1}`); }
      else game.err(sess, 'ตีบวกล้มเหลว (ไม่เสียระดับ)');
      return done();
    }
    case 'repair': {
      if (!need('smith')) return;
      let cost = 0; for (const it of Object.values(c.equip)) if (it && it.dur < 100) cost += ECONOMY.repairPerDur(it.ilvl) * (100 - it.dur);
      if (!cost) return game.msg(sess, 'อุปกรณ์ไม่ต้องซ่อม');
      if (c.gold < cost) return game.err(sess, `ต้องใช้ทอง ${cost}`);
      c.gold -= cost; for (const it of Object.values(c.equip)) if (it) it.dur = 100;
      game.msg(sess, `ซ่อมอุปกรณ์ทั้งหมด (${cost} ทอง)`); return done();
    }
    case 'punch': {
      if (!need('smith')) return; const r = getRef(c, acc, m.ref); if (!r || r.item.type !== 'gear') return;
      const max = RARITY_INFO[r.item.rarity].sockets[1] + 1;
      if (r.item.sockets >= max) return game.err(sess, `ไอเทมระดับนี้เจาะได้สูงสุด ${max} ช่อง`);
      if (!pay(game, sess, { gold: ECONOMY.socketPunch(r.item.sockets), shard: 2 })) return;
      r.item.sockets++; game.msg(sess, 'เจาะ Socket สำเร็จ'); return done(false);
    }
    // ---- Stash (shared across account) ----
    case 'stash': { if (!need('stash')) return; const it = c.inv[m.idx | 0]; if (!it) return; if (acc.stash.length >= STASH_SIZE) return game.err(sess, 'คลังเต็ม'); c.inv.splice(m.idx | 0, 1); acc.stash.push(it); return done(false); }
    case 'unstash': { if (!need('stash')) return; const it = acc.stash[m.idx | 0]; if (!it) return; if (c.inv.length >= INVENTORY_SIZE) return game.err(sess, 'กระเป๋าเต็ม'); acc.stash.splice(m.idx | 0, 1); c.inv.push(it); return done(false); }
    // ---- Teleporter ----
    case 'teleport': {
      if (!need('teleport')) return; const t = TOWNS[m.to]; if (!t) return;
      if (c.level < t.lv[0] - 10) return game.err(sess, `ต้องการเลเวล ${t.lv[0] - 10}`);
      if (c.gold < ECONOMY.teleportGold) return game.err(sess, 'ทองไม่พอ');
      c.gold -= ECONOMY.teleportGold; game.enterField(sess, t.id, null, null); return;
    }
  }
}
function pay(game, sess, cost) {
  const c = sess.char;
  for (const [k, v] of Object.entries(cost)) { if (!v) continue; const have = k === 'gold' ? c.gold : (c.materials[k] || 0); if (have < v) { game.err(sess, `ไม่พอ: ${k} ต้องการ ${v} (มี ${have})`); return false; } }
  for (const [k, v] of Object.entries(cost)) { if (!v) continue; if (k === 'gold') c.gold -= v; else c.materials[k] -= v; }
  return true;
}

export function usePotion(game, sess, kind) {
  const u = sess.unit, c = sess.char, inst = sess.inst;
  if (!u || u.dead || !POTIONS[kind] || !(c.potions[kind] > 0) || u.potionReady > inst.time) return;
  if (u.stats.flags?.has('noRegen') && kind === 'hp') return game.err(sess, 'Crown of the Abyss: ฟื้น HP ด้วยยาไม่ได้');
  c.potions[kind]--; u.potionReady = inst.time + 6;
  if (kind === 'hp') { const a = u.hpMax * 0.35 * (inst.isPvp ? 0.5 : 1); u.hp = Math.min(u.hpMax, u.hp + a); inst.fx({ k: 'dmg', id: u.id, v: Math.round(a), h: 1 }, u); }
  else u.mp = Math.min(u.mpMax, u.mp + u.mpMax * 0.4);
  game.markDirty(sess);
}

function applyDrop(game, sess, d) {
  const c = sess.char, p = d.payload;
  if (p.item) { if (!addToInventory(game, sess, p.item)) return false; }
  else if (p.mat) c.materials[p.mat] = (c.materials[p.mat] || 0) + p.n;
  else if (p.rune) { c.runes[p.rune] = (c.runes[p.rune] || 0) + 1; game.msg(sess, `ได้รับ Support Rune: ${RUNE_BY_ID[p.rune].name}!`, '#7fe8ff'); }
  else if (p.potion) c.potions[p.potion] = (c.potions[p.potion] || 0) + p.n;
  if (p.item && ['legendary', 'mythic'].includes(p.item.rarity)) game.announce(`✨ ${c.name} ได้รับ ${p.item.name} [${RARITY_INFO[p.item.rarity].th}]!`, RARITY_INFO[p.item.rarity].color);
  return true;
}
export function pickup(game, sess, id) {
  const inst = sess.inst, u = sess.unit; if (!inst || !u) return;
  const d = inst.drops.get(id | 0);
  if (!d || d.owner !== sess.char.id || (d.x - u.x) ** 2 + (d.y - u.y) ** 2 > 160 * 160) return;
  if (applyDrop(game, sess, d)) { inst.drops.delete(d.id); game.markDirty(sess); }
}
export function pickupAll(game, sess) {
  const inst = sess.inst, u = sess.unit; if (!inst || !u) return;
  for (const d of [...inst.drops.values()]) if (d.owner === sess.char.id && (d.x - u.x) ** 2 + (d.y - u.y) ** 2 < 260 * 260) { if (!applyDrop(game, sess, d)) break; inst.drops.delete(d.id); }
  game.markDirty(sess);
}

// ---------- quests ----------
export function questOp(game, sess, m) {
  const c = sess.char;
  if (m.op === 'list') {
    const region = MAPS[sess.inst?.key]?.region || 'aurelia';
    const list = Object.values(QUESTS).filter((q) => q.region === region && q.lv <= c.level + 5).map((q) => ({ ...q, active: c.quests.active[q.id], reward: questReward(c, q) }));
    return game.send(sess, { t: 'quests', list, active: c.quests.active });
  }
  const q = QUESTS[m.id]; if (!q) return;
  if (m.op === 'accept') {
    if (Object.keys(c.quests.active).length >= 6) return game.err(sess, 'รับเควสต์ได้สูงสุด 6 อัน');
    if (c.quests.active[q.id] != null) return;
    c.quests.active[q.id] = 0; game.msg(sess, `รับเควสต์: ${q.name}`);
  } else if (m.op === 'abandon') delete c.quests.active[q.id];
  else if (m.op === 'turnin') {
    if ((c.quests.active[q.id] ?? -1) < q.count) return game.err(sess, 'เควสต์ยังไม่สำเร็จ');
    delete c.quests.active[q.id]; c.quests.done[q.id] = (c.quests.done[q.id] || 0) + 1;
    const r = questReward(c, q); c.gold += r.gold; game.giveExp(sess, r.exp);
    if (r.rune) c.runes[r.rune] = (c.runes[r.rune] || 0) + 1;
    game.msg(sess, `ส่งเควสต์สำเร็จ! +${r.exp} EXP +${r.gold} ทอง${r.rune ? ` + รูน ${RUNE_BY_ID[r.rune].name}` : ''}`, '#a0ffb0');
  }
  game.markDirty(sess); questOp(game, sess, { op: 'list' });
}
function questReward(c, q) {
  const lv = Math.min(c.level, q.lv + 10);
  const boss = q.target.startsWith('boss:');
  const ids = Object.keys(RUNE_BY_ID);
  return { exp: Math.round(expToNext(lv) * (boss ? 0.6 : 0.18)), gold: Math.round(lv * (boss ? 300 : 60)), rune: boss ? ids[(q.id.length * 7) % ids.length] : null };
}
export function questProgress(game, sess, mon) {
  const c = sess.char;
  for (const qid of Object.keys(c.quests.active)) {
    const q = QUESTS[qid]; if (!q) continue;
    if (q.target === mon.tpl || (mon.boss && q.target === `boss:${mon.tpl}`)) {
      if (c.quests.active[qid] < q.count) { c.quests.active[qid]++; if (c.quests.active[qid] === q.count) game.msg(sess, `เควสต์ "${q.name}" สำเร็จ! กลับไปส่งที่กระดานเควสต์`, '#a0ffb0'); }
    }
  }
}
export { saveDB, classSkills };
