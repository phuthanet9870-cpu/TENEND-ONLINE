// ===== UI v2: icon-driven panels (no text dropdowns), RO-style inventory, PoE-style passive tree, illustrated world map =====
import { CLASS_BY_ID } from '/shared/classes.js';
import { recipeOf, describeFx } from './skillfx.js';
import { classSkills, getSkill, resolveSkill, MAX_SKILL_RANK, runeSlotsForRank, FAMILIES, classDisciplines, TRAITS, MOD_TH } from '/shared/skills.js';
import { RUNES, RUNE_BY_ID, runeFits } from '/shared/runes.js';
import { buildPassiveTree, passivePointsFor, spentPoints } from '/shared/passives.js';
import { STAT_TH, SLOT_TH, SETS, MATERIALS, WEAPON_TYPES, POTIONS } from '/shared/items.js';
import { RARITY_INFO, ELEMENT_INFO, ECONOMY, RARITIES, HOTBAR_SIZE } from '/shared/constants.js';
import { MAPS, BOSSES, MONSTERS, REGION_LIST, WORLD_BOSSES, cardFor, TOWNS } from '/shared/world.js';
import { itemIconURL, matIconURL, runeIconURL, slotIcon, weaponIcon, bossPortrait, charSprite, weaponSprite, drawEmblem, cardIcon } from './sprites.js';
import { fmt } from './render.js';
import { AUTO_DEFAULT } from './auto.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (src, cls = '') => `<img class="ico ${cls}" src="${src}" alt="">`;
const statLine = (k, v) => `${STAT_TH[k] || k} ${v >= 0 ? '+' : ''}${Math.round(v * 10) / 10}`;
const EQ_LEFT = ['helm', 'amulet', 'weapon', 'gloves', 'ring1'];
const EQ_RIGHT = ['chest', 'offhand', 'belt', 'boots', 'ring2'];
const GEAR_SLOTS = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'];
const INV_CATS = { all: ['🎒', 'ทั้งหมด'], equip: ['⚔', 'อุปกรณ์'], card: ['🃏', 'การ์ด'], use: ['🧪', 'ใช้งาน'], mat: ['⛏', 'วัตถุดิบ'], rune: ['💠', 'รูน'] };
const slotPic = (s) => slotIcon(s === 'ring1' || s === 'ring2' ? 'ring' : s, '#6a6480', '#3a3450');

export function installUI2(UI) {
  const P = UI.prototype;
  UI.__origSmith = P.p_smith; UI.__origGM = P.p_gm;
  const origAct = P.act, origHover = P.onHover, origWin = P.win, origGuild = P.p_guild, origMap = P.p_map;

  // ---------- generic icon picker (replaces <select>) ----------
  P.pick = function (name, opts, panel, cls = '') {
    this.pk = this.pk || {};
    if (this.pk[name] == null || !opts.some((o) => o.v === this.pk[name] && !o.disabled)) this.pk[name] = (opts.find((o) => !o.disabled) || opts[0])?.v;
    const sel = this.pk[name];
    return `<div class="picker ${cls}">${opts.map((o) => `<button class="pk ${o.v === sel ? 'on' : ''}" data-act="pk" data-n="${name}" data-v="${esc(o.v)}" data-p="${panel}" ${o.disabled ? 'disabled' : ''} title="${esc(o.tip || o.label)}">${o.icon || ''}${o.label != null ? `<span>${esc(o.label)}</span>` : ''}</button>`).join('')}</div>`;
  };

  // ---------- windows: tile new windows side-by-side instead of stacking ----------
  P.win = function (id, title, html, w = 560) {
    const isNew = !document.getElementById('w-' + id);
    const el = origWin.call(this, id, title, html, w);
    if (isNew) {
      const W = Math.min(w, window.innerWidth - 20); let x = 10, top = 80;
      const others = [...document.querySelectorAll('.win')].filter((e) => e !== el);
      if (others.length === 1 && others[0].offsetWidth + W + 28 <= window.innerWidth && others[0].offsetLeft + others[0].offsetWidth + 8 + W > window.innerWidth - 10) others[0].style.left = '10px';
      if (others.length) { const right = Math.max(...others.map((e) => e.offsetLeft + e.offsetWidth)); x = right + 8; if (x + W > window.innerWidth - 10) { x = Math.max(10, (window.innerWidth - W) / 2 + (others.length % 4) * 28); top = 80 + (others.length % 4) * 28; } }
      else x = Math.max(10, (window.innerWidth - W) / 2);
      el.style.left = x + 'px'; el.style.top = top + 'px';
    }
    return el;
  };

  P.itemIcon = function (it, ref, extra = '') {
    if (!it) return `<div class="it empty" ${extra}></div>`;
    const col = RARITY_INFO[it.rarity]?.color || '#ccc';
    return `<div class="it r-${it.rarity}" style="--c:${col}" data-tip="item:${ref}" data-act="item" data-ref="${ref}" ${extra}>${img(itemIconURL(it))}${it.refine ? `<em>+${it.refine}</em>` : ''}${it.locked ? '<i>🔒</i>' : ''}${it.dur != null && it.dur < 30 ? '<u>!</u>' : ''}${(it.cards || []).length ? `<b class="sock">${'●'.repeat(it.cards.length)}</b>` : ''}</div>`;
  };
  P.stackIcon = function (key, url, n, color = '#8a84a0', act = 'stack') { return `<div class="it" style="--c:${color}" data-tip="stack:${key}" data-act="${act}" data-k="${key}">${img(url)}<small class="cnt">${fmt(n)}</small></div>`; };

  // ---------- Inventory (Ragnarok-style: character doll + categorised backpack) ----------
  P.p_inventory = function () {
    const c = this.G.char; const cat = this.ctx.invCat || 'all'; const d = c.derived;
    const eq = (s) => `<div class="eqs">${c.equip[s] ? this.itemIcon(c.equip[s], 'equip:' + s) : `<div class="it empty" title="${SLOT_TH[s]}">${img(slotPic(s), 'ghost')}</div>`}<small>${SLOT_TH[s]}</small></div>`;
    const cells = [];
    if (cat === 'all' || cat === 'equip' || cat === 'card') c.inv.forEach((it, i) => { if (cat === 'all' || (cat === 'equip' && it.type === 'gear') || (cat === 'card' && it.type === 'card')) cells.push(this.itemIcon(it, 'inv:' + i)); });
    if (cat === 'all' || cat === 'use') for (const k of ['hp', 'mp']) if (c.potions[k]) cells.push(this.stackIcon('pot:' + k, matIconURL(k), c.potions[k], k === 'hp' ? '#e83a3a' : '#3a7ae8', 'stackUse'));
    if (cat === 'all' || cat === 'mat') for (const [k, m] of Object.entries(MATERIALS)) if (c.materials[k]) cells.push(this.stackIcon('mat:' + k, matIconURL(k), c.materials[k], m.color));
    if (cat === 'all' || cat === 'rune') for (const r of RUNES) if (c.runes[r.id]) cells.push(this.stackIcon('rune:' + r.id, runeIconURL(r.id, r.tier), c.runes[r.id], ['#7fe8ff', '#c25cff', '#ff9a2a'][r.tier - 1], 'stackRune'));
    while (cells.length < 48 || cells.length % 8) cells.push('<div class="it empty"></div>');
    const npcHint = { shop: '💰 คลิกไอเทม → ขาย', stash: '📦 คลิกไอเทม → ฝากคลัง', market: '⚖ คลิกไอเทม → วางขาย', smith: '🔨 คลิกไอเทม → ตีบวก/Reroll' }[this.ctx.npc];
    const others = [...document.querySelectorAll('.win')].filter((e) => e.id !== 'w-inventory').reduce((a, e) => a + e.offsetWidth + 8, 0);
    const invW = Math.max(560, Math.min(880, window.innerWidth - 30 - others));
    const el = this.win('inventory', '🎒 ตัวละคร & กระเป๋า [I]', `<div class="ro-inv">
      <div class="ro-panel ro-char"><div class="ro-head">ตัวละคร</div>
        <div class="doll"><div class="dcol">${EQ_LEFT.map(eq).join('')}</div><div class="dmid"><canvas id="dollcv" width="150" height="230"></canvas>
          <div class="dstats"><span>⚔ ${fmt(d.atk)}</span><span>🛡 ${fmt(d.armor)}</span><span>❤ ${fmt(d.hpMax)}</span><span>🎯 ${d.crit}%</span></div></div><div class="dcol">${EQ_RIGHT.map(eq).join('')}</div></div>
        <div class="cur-row">${img(matIconURL('gold'))}<b>${fmt(c.gold)}</b><span class="dim">ทอง</span><span>🏅 ${fmt(c.honor || 0)}</span></div></div>
      <div class="ro-panel ro-bag"><div class="ro-head">กระเป๋า ${npcHint ? `<small class="npc-hint">${npcHint}</small>` : ''}</div>
        <div class="bag-wrap"><div class="bag-grid">${cells.join('')}</div>
          <div class="bag-tabs">${Object.entries(INV_CATS).map(([k, [ic, lb]]) => `<button class="${k === cat ? 'on' : ''}" data-act="invCat" data-c="${k}"><i>${ic}</i>${lb}</button>`).join('')}</div></div>
        <div class="bag-foot"><span class="cap">ช่อง ${c.inv.length}/60</span><button class="mini" data-act="sortInv">↕ เรียง</button><button class="mini alt" data-act="salvageJunk">♻ แยกของธรรมดา</button></div></div></div>`, invW);
    const cv = el.querySelector('#dollcv'); if (cv) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; const cls = CLASS_BY_ID[c.classId]; const gr = x.createRadialGradient(75, 120, 10, 75, 120, 110); gr.addColorStop(0, '#3a3058'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 150, 230); x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(75, 205, 44, 12, 0, 0, 7); x.fill(); x.drawImage(charSprite(cls.id, cls.palette, 0), 21, 20, 108, 180); x.save(); x.translate(108, 130); x.rotate(0.5); x.drawImage(weaponSprite(c.equip.weapon?.wtype || cls.weapons[0]), -6, -15, 80, 40); x.restore(); }
  };

  // ---------- Skills: tabs by mechanic family with icons; rune picker with rune icons ----------
  P.p_skills = function () {
    const c = this.G.char; const cls = CLASS_BY_ID[c.classId]; const all = classSkills(c.classId);
    const tabs = [...classDisciplines(c.classId).map((d) => [d.id, d.icon, d.title, all.filter((s) => s.school === d.id).length]), ['ultimate', '🌟', 'Ultimate', 10]];
    const trait = TRAITS[c.classId];
    const tab = this.ctx.skFam && tabs.some((t) => t[0] === this.ctx.skFam) ? this.ctx.skFam : tabs[0][0];
    const list = tab === 'ultimate' ? all.filter((s) => s.kind === 'ultimate') : all.filter((s) => s.school === tab);
    const spent = Object.values(c.skillRanks).reduce((a, r) => a + r - 1, 0), total = c.level - 1 + c.mastery;
    const sel = this.selSkill && getSkill(this.selSkill);
    let detail = '<div class="empty-detail">👈 เลือกสกิลจากรายการ<br><small>ลากสกิลไปวางที่ Hotbar ได้ทันที</small></div>';
    if (sel) {
      const rank = c.skillRanks[sel.id] || 1; const runes = c.build.runes[sel.id] || [];
      const spec = resolveSkill(sel, { rank, runes, stats: this.stats, ks: this.stats.ks, leg: this.stats.leg });
      const slots = runeSlotsForRank(rank); const locked = sel.unlock > c.level;
      const usage = {}; for (const l of Object.values(c.build.runes)) for (const r of l) if (r) usage[r] = (usage[r] || 0) + 1;
      const owned = RUNES.filter((r) => (c.runes[r.id] || 0) > 0 && runeFits(r, sel.behavior));
      const stats = [['📈', 'Rank', `${rank}/${MAX_SKILL_RANK}`], ['💥', 'ดาเมจ', spec.dmg ? Math.round(spec.dmg) + '%' : '-'], ['⏱', 'คูลดาวน์', spec.cd.toFixed(1) + 'วิ'], ['💧', cls.resource.name, Math.round(spec.cost)], spec.radius ? ['◎', 'รัศมี', Math.round(spec.radius)] : null, spec.range ? ['📏', 'ระยะ', Math.round(spec.range)] : null, spec.multiHit > 1 ? ['✖', 'จำนวนครั้ง', spec.multiHit] : null, spec.count > 1 ? ['🔢', 'จำนวน', spec.count] : null, spec.chain ? ['🔗', 'กระโดด', spec.chain] : null, spec.heal ? ['❤', 'ฮีล', Math.round(spec.heal) + '%'] : null].filter(Boolean);
      detail = `<div class="sk-head">${this.skIcon(sel, 1)}<div><h3>${esc(sel.name)}</h3><div class="tags"><span class="tag2">${sel.kind === 'ultimate' ? '🌟 ULTIMATE' : (tabs.find((t) => t[0] === sel.school) || ['', '', ''])[1] + ' ' + (tabs.find((t) => t[0] === sel.school) || ['', '', ''])[2]}</span><span class="tag2" style="color:${ELEMENT_INFO[spec.el].color}">● ${ELEMENT_INFO[spec.el].th}</span><span class="tag2">🔓 Lv ${sel.unlock}</span></div></div></div>
        <p class="sk-desc">${esc(sel.desc)}</p><div class="fx-line"><span>✨ ${esc(describeFx(recipeOf(sel.n)))}</span><button class="mini" data-act="fxPreview" data-n="${sel.n}">▶ ดูเอฟเฟกต์</button></div>${(sel.mods || []).length ? `<div class="tags">${sel.mods.map((m) => `<span class="tag2">✦ ${esc(MOD_TH[m] || m)}</span>`).join('')}</div>` : ''}
        <p class="dim">⭐ ลักษณะเฉพาะคลาส: <b>${esc(trait.name)}</b> — ${esc(trait.th)}</p>
        <div class="stat-tiles">${stats.map(([i, a, b]) => `<div><i>${i}</i><span>${a}</span><b>${b}</b></div>`).join('')}</div>
        ${locked ? `<p class="err">🔒 ต้องการเลเวล ${sel.unlock}</p>` : `${sel.kind === 'ultimate' ? `<div class="row"><button data-act="equipSkill" data-slot="u" data-id="${sel.id}">${c.build.ult === sel.id ? '✔ ใส่อยู่ช่อง R' : '⬇ ใส่ช่องอัลติเมท [R]'}</button>` : `<h4>⬇ ใส่ลง Hotbar <small class="dim">คลิกช่อง • หรือลากจากรายการ</small></h4>
        <div class="slotpick">${Array.from({ length: HOTBAR_SIZE }, (_, i) => { const id = c.build.hotbar[i]; const s2 = id && getSkill(id); return `<div class="${id === sel.id ? 'me' : id ? 'used' : ''}" data-act="equipSkill" data-slot="${i}" data-id="${sel.id}" title="${s2 ? esc(s2.name) : 'ว่าง'}">${s2 ? `<span class="mini-ic">${s2.icon || ''}</span>` : ''}<kbd>${this.slotName(i)}</kbd></div>`; }).join('')}</div>
        <div class="row"><button class="mini" data-act="equipFree" data-id="${sel.id}">⬇ ช่องว่างถัดไป</button>`}
        <button class="mini gold" data-act="rankSkill" data-id="${sel.id}" ${rank >= MAX_SKILL_RANK || spent >= total ? 'disabled' : ''}>⬆ Rank +1</button></div>
        <h4>💠 Support Runes <small class="dim">${slots}/3 ช่อง • ปลดล็อกช่องที่ Rank 8 และ 16</small></h4>
        <div class="rune-slots">${Array.from({ length: 3 }, (_, i) => { const r = runes[i] && RUNE_BY_ID[runes[i]]; if (i >= slots) return `<div class="rs lock">🔒<small>Rank ${i === 1 ? 8 : 16}</small></div>`; return `<div class="rs ${r ? 'on' : ''} ${this.ctx.runeSlot === i ? 'pick' : ''}" data-act="runeSlot" data-i="${i}">${r ? `${img(runeIconURL(r.id, r.tier))}<b data-tip="rune:${r.id}">${r.name}</b><button class="mini alt" data-act="unsocketRune" data-id="${sel.id}" data-idx="${i}">✕</button>` : '<span class="plus">＋</span><small>คลิกเพื่อเลือกรูน</small>'}</div>`; }).join('')}</div>
        ${this.ctx.runeSlot != null && this.ctx.runeSlot < slots ? `<div class="rune-pick">${owned.map((o) => { const left = (c.runes[o.id] || 0) - (usage[o.id] || 0); return `<button class="pk" data-act="socketRune2" data-id="${sel.id}" data-idx="${this.ctx.runeSlot}" data-r="${o.id}" ${left <= 0 ? 'disabled' : ''} data-tip="rune:${o.id}">${img(runeIconURL(o.id, o.tier))}<span>${o.name}</span><small>${left}</small></button>`; }).join('') || '<span class="dim">ยังไม่มีรูนที่ใช้กับสกิลนี้ได้</span>'}</div>` : ''}
        ${spec.runes.length ? `<p class="dim">✔ รูนที่ทำงาน: ${spec.runes.map((r) => RUNE_BY_ID[r].th).join(' / ')}</p>` : ''}`}`;
    }
    this.win('skills', `📘 สกิล [K] — แต้มสกิล ${total - spent}/${total}`, `<div class="trait-bar">⭐ <b>${esc(trait.name)}</b> <span>${esc(trait.th)}</span></div><div class="icon-tabs">${tabs.map(([k, ic, lb, n]) => `<button class="${k === tab ? 'on' : ''}" data-act="skFam" data-f="${k}"><i>${ic}</i><span>${lb}</span><small>${n}</small></button>`).join('')}</div>
      <div class="sk-wrap"><div class="sk-list">${list.map((s) => `<div class="sk-row ${s.id === this.selSkill ? 'sel' : ''} ${s.unlock > c.level ? 'locked' : ''}" data-act="selSkill" data-id="${s.id}" ${s.unlock <= c.level ? `draggable="true" data-drag-skill="${s.id}"` : ''}>${this.skIcon(s)}<div><b>${esc(s.name)}</b><small>${s.unlock > c.level ? '🔒' : '✔'} Lv${s.unlock} • R${c.skillRanks[s.id] || 1}${(c.build.runes[s.id] || []).filter(Boolean).length ? ' • 💠' + (c.build.runes[s.id] || []).filter(Boolean).length : ''}</small></div>${c.build.ult === s.id ? '<em>R</em>' : c.build.hotbar.includes(s.id) ? `<em>${this.slotName(c.build.hotbar.indexOf(s.id))}</em>` : ''}</div>`).join('')}</div><div class="sk-detail">${detail}</div></div>`, 860);
  };
  P.skIcon = function (s, big) { const col = ELEMENT_INFO[s.el].color; return `<div class="sk ${big ? 'big' : ''} ${s.kind === 'ultimate' ? 'u' : ''}" style="--c:${col}">${s.icon || '✦'}</div>`; };

  // ---------- Runes window with icons ----------
  P.p_runes = function () {
    const c = this.G.char; const usage = {}; for (const l of Object.values(c.build.runes)) for (const r of l) if (r) usage[r] = (usage[r] || 0) + 1;
    this.ctx.fuse = this.ctx.fuse || [];
    this.win('runes', '💠 Support Runes [N]', `<div class="rune-list">${RUNES.map((r) => `<div class="rune ${c.runes[r.id] ? '' : 'none'} ${this.ctx.fuse.includes(r.id) ? 'sel' : ''}" data-tip="rune:${r.id}" data-act="fusePick" data-id="${r.id}">${img(runeIconURL(r.id, r.tier))}<div><b>${r.name}</b> <small class="t${r.tier}">T${r.tier}</small><span>${c.runes[r.id] || 0}${usage[r.id] ? ` (ใช้ ${usage[r.id]})` : ''}</span><p>${r.th}</p></div></div>`).join('')}</div>
      <div class="fuse-bar"><span>⚗ ฟิวส์ 3 รูน → รูนระดับสูงขึ้น</span>${[0, 1, 2].map((i) => { const id = this.ctx.fuse[i]; return `<div class="fslot">${id ? img(runeIconURL(id, RUNE_BY_ID[id].tier)) : '＋'}</div>`; }).join('')}<button data-act="fuse" ${this.ctx.fuse.length === 3 ? '' : 'disabled'}>⚗ ฟิวส์</button><button class="alt" data-act="fuseClear">ล้าง</button></div>`, 820);
  };

  // ---------- Blacksmith with icon pickers ----------
  P.p_smith = function () {
    const c = this.G.char; this.ctx.stab = this.ctx.stab || 'craft';
    const tabs = { craft: ['⚒', 'คราฟต์'], enhance: ['✨', 'ตีบวก / Reroll / Socket'], repair: ['🔧', 'ซ่อม'] };
    let body = '';
    if (this.ctx.stab === 'craft') {
      const slotPick = this.pick('cslot', GEAR_SLOTS.map((s) => ({ v: s, label: SLOT_TH[s], icon: img(s === 'weapon' ? weaponIcon(CLASS_BY_ID[c.classId].weapons[0], '#c8d0d8') : slotIcon(s)) })), 'smith', 'big');
      const wt = this.pk.cslot === 'weapon' ? `<h4>ชนิดอาวุธ</h4>${this.pick('cwt', CLASS_BY_ID[c.classId].weapons.map((w) => ({ v: w, label: WEAPON_TYPES[w].name, icon: img(weaponIcon(w, '#c8d0d8')) })), 'smith', 'big')}` : '';
      const cat = this.pick('ccat', [{ v: '', label: 'ไม่มี (Magic+)', icon: img(matIconURL('ore')) }, { v: 'core', label: 'Boss Core x1 (Epic+)', icon: img(matIconURL('core')) }, { v: 'essence', label: 'Essence x3 (Legendary สูง)', icon: img(matIconURL('essence')) }, { v: 'set', label: 'Core x3 (เซ็ต Epic)', icon: img(matIconURL('guildsigil')) }], 'smith', 'big');
      const sets = this.pk.ccat === 'set' ? `<h4>เลือกเซ็ต</h4>${this.pick('cset', Object.entries(SETS).filter(([, st]) => st.slots.some((sl) => sl.startsWith(this.pk.cslot))).map(([k, st]) => ({ v: k, label: st.name, icon: `<span class="set-ic">${st.slots.map((sl) => img(slotIcon(sl.replace(/\d/, '')), 'tiny')).join('')}</span>`, tip: `${st.name}: ${st.th4}` })), 'smith', 'big')}` : '';
      const ilvl = Math.min(c.level, this.pk.cilvl || c.level);
      body = `<h4>ช่องอุปกรณ์</h4>${slotPick}${wt}<h4>ตัวเร่ง</h4>${cat}${sets}
        <div class="row">iLvl <input type="range" id="cilvl" min="1" max="${c.level}" value="${ilvl}" data-pkr="cilvl"><b>${ilvl}</b></div>
        <div class="cost-row">${img(matIconURL('gold'))}${fmt(ECONOMY.craftGold(ilvl))} ${img(matIconURL('ore'))}${3 + Math.floor(ilvl / 15)} ${img(matIconURL('dust'))}${1 + Math.floor(ilvl / 40)}<button class="gold" data-act="craft2">⚒ คราฟต์</button></div>`;
    } else return UI.__origSmith.call(this);
    this.win('smith', '🔨 ช่างตีเหล็ก', `<div class="icon-tabs">${Object.entries(tabs).map(([k, [i, l]]) => `<button class="${k === this.ctx.stab ? 'on' : ''}" data-act="stab" data-t="${k}"><i>${i}</i><span>${l}</span></button>`).join('')}</div>${body}<div class="mats">${Object.entries(MATERIALS).map(([k]) => `<span>${img(matIconURL(k), 'tiny')}${c.materials[k] || 0}</span>`).join('')}</div>`, 520);
  };

  // ---------- Market filters as icons ----------
  P.p_market = function () {
    const m = this.ctx.market;
    const slotPk = this.pick('mslot', [{ v: '', label: 'ทั้งหมด', icon: '🎒' }, ...GEAR_SLOTS.map((s) => ({ v: s, icon: img(slotIcon(s)), tip: SLOT_TH[s] })), { v: 'card', icon: img(cardIcon('card_x_slime')), tip: 'การ์ด' }], 'market', 'small');
    const rarPk = this.pick('mrar', [{ v: '', label: 'ทุกระดับ' }, ...RARITIES.map((r) => ({ v: r, label: RARITY_INFO[r].th, icon: `<i class="dot" style="background:${RARITY_INFO[r].color}"></i>` }))], 'market', 'small');
    this.win('market', '⚖ ตลาดกลาง', `<div class="row"><input id="mq" placeholder="🔍 ค้นหาชื่อไอเทม" value="${esc(this.ctx.mq || '')}" style="flex:1"><button class="mini" data-act="mSearch2">ค้นหา</button></div>${slotPk}${rarPk}
      ${!m ? 'กำลังโหลด...' : `<div class="mk">${m.list.map((l) => `<div class="mk-row">${this.itemIcon(l.item, 'mk:' + l.id)}<div><b style="color:${RARITY_INFO[l.item.rarity].color}">${esc(l.item.name)}</b><br><small>👤 ${esc(l.seller)} • iLv${l.item.ilvl || '-'}</small></div><b class="price">${img(matIconURL('gold'), 'tiny')}${fmt(l.price)}</b>${l.mine ? `<button class="mini alt" data-act="mCancel" data-id="${l.id}">✕ ยกเลิก</button>` : `<button class="mini gold" data-act="mBuy" data-id="${l.id}">🛒 ซื้อ</button>`}</div>`).join('') || '<p class="dim">ไม่พบสินค้า</p>'}</div><small>${m.total} รายการ</small>`}`, 660);
  };

  // ---------- Guild creation with emblem pickers ----------
  P.p_guild = function () {
    if (this.G.char.guild) return origGuild.call(this);
    const emb = (shape, icon, color) => { const cv = document.createElement('canvas'); cv.width = cv.height = 40; drawEmblem(cv.getContext('2d'), 20, 20, 32, { shape, icon, color }); return cv.toDataURL(); };
    const color = this.pk?.gcolor || '#d83a2a', shape = this.pk?.gshape || 'shield', icon = this.pk?.gicon || 'sword';
    const r = this.ctx.granking;
    this.win('guild', '🏰 กิลด์ [G]', `<h4>ก่อตั้งกิลด์ <small class="dim">Lv20+ • ${fmt(ECONOMY.guildCreate)} ทอง</small></h4>
      <div class="row"><input id="gname" placeholder="ชื่อกิลด์" maxlength="20"><input id="gtag" placeholder="ตัวย่อ" maxlength="4" style="width:80px"><img class="ico big" src="${emb(shape, icon, color)}"></div>
      <h4>รูปทรงตรา</h4>${this.pick('gshape', ['shield', 'circle', 'diamond', 'star'].map((s) => ({ v: s, icon: img(emb(s, icon, color)) })), 'guild', 'big')}
      <h4>สัญลักษณ์</h4>${this.pick('gicon', ['sword', 'skull', 'crown', 'dragon', 'sun', 'moon'].map((s) => ({ v: s, icon: img(emb(shape, s, color)) })), 'guild', 'big')}
      <h4>สี</h4>${this.pick('gcolor', ['#d83a2a', '#3a7ad8', '#3aa85a', '#9a3ad8', '#d8a83a', '#2a2a3a', '#d83a9a', '#3ad8c8'].map((col) => ({ v: col, icon: `<i class="swatch" style="background:${col}"></i>` })), 'guild', 'small')}
      <div class="row"><button class="gold" data-act="guildCreate2">🏰 ก่อตั้งกิลด์</button></div>
      <h4>🏆 อันดับกิลด์</h4>${this.rankTable(r)}`, 620);
  };

  // ---------- Build presets: tag chips ----------
  P.p_builds = function () {
    const c = this.G.char; const cost = c.level < 20 ? 0 : ECONOMY.resetBuild(c.level);
    const ps = Array.from({ length: 6 }, (_, i) => c.presets[i]);
    this.win('builds', '📋 Build Presets [B]', `<div class="presets">${ps.map((p, i) => `<div class="preset ${p ? '' : 'empty'}"><div class="ph"><b>${p ? esc(p.name) : `ช่อง ${i + 1}`}</b>${p ? `<span class="tag ${p.tag}">${p.tag === 'PvP' ? '⚔ PvP' : '🌲 PvE'}</span>` : '<span class="dim">ว่าง</span>'}</div>${p ? `<small>📘 ${p.hotbar.filter(Boolean).length} สกิล • 🌳 ${Object.keys(p.passives).length - 1} โหนด • 💠 ${Object.values(p.runes).flat().filter(Boolean).length} รูน</small>` : ''}
      <div class="row"><input id="pn${i}" placeholder="ชื่อ" value="${p ? esc(p.name) : ''}" maxlength="24" style="width:110px">${this.pick('pt' + i, [{ v: 'PvE', label: '🌲 PvE' }, { v: 'PvP', label: '⚔ PvP' }], 'builds', 'small')}</div>
      <div class="row"><button class="mini" data-act="savePreset2" data-i="${i}">💾 บันทึก</button>${p ? `<button class="mini gold" data-act="loadPreset" data-i="${i}">📂 โหลด</button><button class="mini alt" data-act="delPreset" data-i="${i}">🗑</button>` : ''}</div></div>`).join('')}</div>
      <h4>♻ Reset Build</h4><div class="row"><button data-act="reset" data-what="passives">🌳 Passive (${fmt(cost)})</button><button data-act="reset" data-what="skills">📘 Rank สกิล (${fmt(cost)})</button><button data-act="reset" data-what="all">♻ ทั้งหมด (${fmt(Math.round(cost * 1.5))})</button></div>`, 660);
  };

  // ---------- Dungeons: boss portraits ----------
  P.p_dungeon = function () {
    const d = this.ctx.dungeons; const c = this.G.char;
    const types = { story: ['📖', 'Story Dungeon', '1-4 คน • เนื้อเรื่อง บอส กลไกเฉพาะ'], abyss: ['🕳', 'Abyss Dungeon', '1-4 คน • ชั้นสุ่มไม่สิ้นสุด + Modifier'], hunt: ['🎯', 'Boss Hunt', '1-4 คน • สู้บอสตรงๆ เน้นอ่านท่า'], raid: ['👑', 'Raid', '4-8 คน • บอสหลายเฟส กลไกทีม'] };
    if (!d) return this.win('dungeon', '🚪 ประตูดันเจี้ยน', 'กำลังโหลด...', 680);
    const tab = this.ctx.dgTab || 'story';
    let body = '';
    if (tab === 'hunt') body = `<h4>เลือกบอส</h4>${this.pick('hboss', d.bosses.map((b) => { const B = BOSSES[b.id]; return { v: b.id, icon: img(bossPortrait(B.sprite, B.tint), 'big'), label: `Lv${b.lv}`, tip: b.name, disabled: c.level < b.lv - 15 }; }), 'dungeon', 'portraits')}<p><b>${esc(BOSSES[this.pk.hboss]?.name || '')}</b></p><button class="gold" data-act="enterDungeon2" data-id="hunt">⚔ เข้าล่าบอส</button>`;
    else body = d.list.filter((x) => x.type === tab).map((x) => { const B = BOSSES[x.boss]; return `<div class="dg-card">${B ? img(bossPortrait(B.sprite, B.tint), 'big') : img(bossPortrait('demon', '#9a5cff'), 'big')}<div><b>${esc(x.name)}</b> <small class="dim">${esc(x.th)}</small><br><small>🔓 Lv${x.lv} • 👥 ${x.players[0]}-${x.players[1]} คน${B ? ` • 👑 ${esc(B.name)}` : ''}</small>${x.story ? `<br><small class="dim">${esc(x.story)}</small>` : ''}${tab === 'abyss' ? `<br><small>🏅 ชั้นสูงสุด ${c.abyssBest || 0}</small> <input id="abfloor" type="number" min="1" value="${(c.abyssBest || 0) + 1}" style="width:60px">` : ''}</div><button class="gold" data-act="enterDungeon2" data-id="${x.id}">⚔ เข้า</button></div>`; }).join('');
    this.win('dungeon', '🚪 ประตูดันเจี้ยน', `<div class="icon-tabs">${Object.entries(types).map(([k, [i, l, s]]) => `<button class="${k === tab ? 'on' : ''}" data-act="dgTab" data-t="${k}" title="${s}"><i>${i}</i><span>${l}</span></button>`).join('')}</div><p class="dim">${types[tab][2]}</p>${body}`, 680);
  };

  // ---------- Auto: chips instead of selects ----------
  const origAuto = P.p_auto;
  P.p_auto = function () {
    if ((this.ctx.autoTab || 'hunt') !== 'hunt') return origAuto.call(this);
    const A = this.G.auto; const cfg = A.cfg; const mons = A.monsterChoices();
    const chips = (key, opts) => `<div class="picker small">${opts.map(([v, l]) => `<button class="pk ${cfg[key] === v ? 'on' : ''}" data-act="autoSet" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const tog = (key, l) => `<button class="pk tog ${cfg[key] ? 'on' : ''}" data-act="autoTog" data-k="${key}">${cfg[key] ? '✅' : '⬜'} ${l}</button>`;
    const body = `<div class="row"><button class="${A.on ? 'gold' : ''}" data-act="autoToggle">${A.on ? '⏹ หยุดออโต้' : '▶ เริ่มออโต้'} [U]</button><span class="dim">${A.on ? '🟢 กำลังทำงาน' : '⚪ หยุดอยู่'}</span></div>
      <h4>🎯 เป้าหมาย</h4>${chips('targets', [['all', '👾 ทุกตัว'], ['list', '☑ เลือกเอง'], ['boss', '👑 เฉพาะบอส']])}
      <div class="picker portraits">${mons.map((n) => { const mt = Object.values(MONSTERS).find((m) => m.name === n) || Object.values(BOSSES).find((b) => b.name === n); const on = cfg.list.includes(n); return `<button class="pk ${on ? 'on' : ''}" data-act="autoMon" data-n="${esc(n)}" title="${esc(n)}">${mt ? img(bossPortrait(mt.sprite || mt.kind, mt.tint)) : ''}<span>${esc(n)}</span></button>`; }).join('')}</div>
      <h4>⚖ ตีตัวไหนก่อน</h4>${chips('priority', [['nearest', '📍 ใกล้สุด'], ['lowhp', '💔 HP น้อยสุด'], ['highlv', '⬆ เลเวลสูงสุด']])}<div class="picker small">${tog('bossFirst', 'ตีบอสก่อน')}${tog('avoidElite', 'ไม่ตี Elite')}</div>
      <h4>🗺 พื้นที่ล่า</h4>${chips('anchor', [['start', '📌 รอบจุดเริ่ม'], ['self', '🚶 รอบตัวเรา']])}<div class="row">📏 <input type="range" min="0" max="6000" step="250" data-auto="radius" value="${cfg.radius}"><b>${cfg.radius ? cfg.radius + ' px' : 'ทั้งแมพ'}</b></div>
      <h4>🛠 ตัวช่วย</h4><div class="picker small">${tog('loot', '💰 เก็บของ')}${tog('dodge', '💨 หลบพื้นแดง')}${tog('counter', '🛡 Counter ท่าทอง')}${tog('useUlt', '🌟 ใช้อัลติเมท')}</div>
      <div class="row">${img(matIconURL('hp'), 'tiny')} ใช้ยา HP ต่ำกว่า <input type="number" min="0" max="95" data-auto="potHp" value="${cfg.potHp}" style="width:60px">% ${img(matIconURL('mp'), 'tiny')} ทรัพยากร <input type="number" min="0" max="95" data-auto="potMp" value="${cfg.potMp}" style="width:60px">%</div>`;
    this.win('auto', '🤖 ตั้งค่าออโต้ [Y]', `<div class="icon-tabs"><button class="on" data-act="autoTab" data-t="hunt"><i>🎯</i><span>เป้าหมาย & การล่า</span></button><button data-act="autoTab" data-t="skill"><i>📘</i><span>ลำดับสกิล</span></button></div>${body}`, 660);
  };

  // ---------- GM with pickers ----------
  P.p_gm = function () {
    const g = this.ctx.gm; const tab = this.ctx.gmTab || 'players';
    if (!this.G.char.gm) return this.win('gm', '👑 GM', '<p class="err">คุณไม่มีสิทธิ์ GM</p>', 400);
    if (!g) return this.win('gm', '👑 GM Panel', 'กำลังโหลด...', 820);
    if (tab !== 'give' && tab !== 'world') return UI.__origGM.call(this);
    const tabs = { players: ['👥', 'ผู้เล่น'], give: ['🎁', 'ให้ของ/แก้ตัวละคร'], world: ['🌍', 'โลก & มอนสเตอร์'], server: ['🖥', 'เซิร์ฟเวอร์'], log: ['📜', 'บันทึก'] };
    let body = '';
    const target = `<h4>🎯 เป้าหมาย</h4>${this.pick('gmt', g.players.map((p) => ({ v: p.name, label: p.name, icon: `<span>${p.gm ? '👑' : '👤'}</span>` })), 'gm', 'small')}`;
    if (tab === 'give') body = target + `<div class="gm-grid">
      <div class="gm-card"><h4>⬆ เลเวล & ค่าเงิน</h4><div class="row"><input id="gmlv" type="number" value="300" style="width:70px"><button class="mini" data-act="gmpv2" data-a="level" data-src="gmlv">ตั้งเลเวล</button></div><div class="row"><input id="gmgold" type="number" value="1000000" style="width:110px"><button class="mini" data-act="gmpv2" data-a="gold" data-src="gmgold">${img(matIconURL('gold'), 'tiny')}ทอง</button><button class="mini" data-act="gmpv2" data-a="honor" data-src="gmgold">🏅</button><button class="mini" data-act="gmpv2" data-a="exp" data-src="gmgold">EXP</button></div></div>
      <div class="gm-card"><h4>🎁 สร้างไอเทม</h4>${this.pick('gmslot', [{ v: 'all', label: 'ครบชุด', icon: '🎒' }, ...GEAR_SLOTS.map((s) => ({ v: s, icon: img(slotIcon(s)), tip: SLOT_TH[s] }))], 'gm', 'small')}${this.pick('gmrar', RARITIES.map((r) => ({ v: r, label: RARITY_INFO[r].th, icon: `<i class="dot" style="background:${RARITY_INFO[r].color}"></i>` })), 'gm', 'small')}<div class="row"><input id="gmilvl" type="number" placeholder="iLvl" style="width:70px"><button class="mini gold" data-act="gmItem2">สร้าง</button></div></div>
      <div class="gm-card"><h4>📦 ทรัพยากร</h4><div class="picker small"><button class="pk" data-act="gmp2" data-a="mats">${img(matIconURL('ore'), 'tiny')} วัตถุดิบ</button><button class="pk" data-act="gmp2" data-a="runes">${img(runeIconURL('echo', 3), 'tiny')} รูนทุกแบบ</button><button class="pk" data-act="gmp2" data-a="potions">${img(matIconURL('hp'), 'tiny')} ยา</button><button class="pk" data-act="gmp2" data-a="repair">🔧 ซ่อม</button></div></div>
      <div class="gm-card"><h4>💫 สถานะ</h4><div class="picker small"><button class="pk" data-act="gmp2" data-a="heal">❤ ฮีล</button><button class="pk" data-act="gmp2" data-a="revive">✨ ชุบ</button><button class="pk" data-act="gmp2" data-a="kill">☠ สังหาร</button><button class="pk" data-act="gmp2" data-a="resetBuild">♻ รีเซ็ต Build</button><button class="pk" data-act="gmp2" data-a="clearInv">🗑 ล้างกระเป๋า</button><button class="pk" data-act="gmp2" data-a="unmute">🔊 ปลดใบ้</button></div></div></div>
      <h4>🗺 ส่งผู้เล่นไปแมพ</h4><div class="map-btns">${Object.values(MAPS).map((m) => `<button class="pk" data-act="gmpWarp2" data-m="${m.id}">${m.kind === 'town' ? '🏰' : '🌲'} ${esc(m.name)}</button>`).join('')}</div>`;
    if (tab === 'world') {
      const here = MAPS[this.G.inst?.key]; const region = here?.region;
      const mons = Object.values(MONSTERS).filter((m) => !region || m.id.startsWith(region));
      body = `<div class="gm-grid"><div class="gm-card"><h4>🧙 ตัว GM</h4><div class="picker small"><button class="pk tog ${g.self?.god ? 'on' : ''}" data-act="gmSelf" data-k="god">${g.self?.god ? '✅' : '⬜'} อมตะ</button><button class="pk tog ${g.self?.invis ? 'on' : ''}" data-act="gmSelf" data-k="invis">${g.self?.invis ? '✅' : '⬜'} ล่องหน</button></div><div class="row">💨 <input type="range" min="0.5" max="5" step="0.5" value="${g.self?.speed || 1}" data-gmself="speed"> x${g.self?.speed || 1}</div></div>
        <div class="gm-card"><h4>📢 ประกาศ</h4><div class="row"><input id="gmann" placeholder="ข้อความ" style="flex:1"><button class="mini gold" data-act="gmAnn">ประกาศ</button></div><h4>📈 อัตราเกม</h4><div class="row">EXP x<input id="gmre" type="number" step="0.5" value="${g.rates.exp}" style="width:50px"> ดรอป x<input id="gmrd" type="number" step="0.5" value="${g.rates.drop}" style="width:50px"> ทอง x<input id="gmrg" type="number" step="0.5" value="${g.rates.gold}" style="width:50px"><button class="mini gold" data-act="gmRates">ใช้</button></div></div></div>
        <h4>👾 เสกมอนสเตอร์ <small class="dim">(ภูมิภาคนี้ • ที่ตำแหน่งคุณ)</small></h4>${this.pick('gmmon', mons.map((m) => ({ v: m.id, icon: img(bossPortrait(m.kind, m.tint)), label: `Lv${m.lv}`, tip: m.name })), 'gm', 'portraits')}
        <div class="row">จำนวน <input id="gmn" type="number" value="5" style="width:50px"> Lv <input id="gmmlv" type="number" placeholder="อัตโนมัติ" style="width:80px"><button class="pk tog ${this.pk?.gmelite ? 'on' : ''}" data-act="pkTog" data-n="gmelite" data-p="gm">${this.pk?.gmelite ? '✅' : '⬜'} Elite</button><button class="mini gold" data-act="gmSpawn2">✨ เสก</button><button class="mini alt" data-act="gm" data-op="killAll">☠ ฆ่าทั้งแมพ</button><button class="mini alt" data-act="gm" data-op="clearSpawns">🧹 ลบที่เสก</button></div>
        <h4>👑 เสกบอส</h4>${this.pick('gmboss', Object.values(BOSSES).map((b) => ({ v: b.id, icon: img(bossPortrait(b.sprite, b.tint)), label: `Lv${b.lv}`, tip: b.name })), 'gm', 'portraits')}
        <div class="row">HP x<input id="gmbhp" type="number" value="1" step="0.5" style="width:60px"><button class="pk tog ${this.pk?.gmworld ? 'on' : ''}" data-act="pkTog" data-n="gmworld" data-p="gm">${this.pk?.gmworld ? '✅' : '⬜'} บอสโลก</button><button class="mini gold" data-act="gmBoss2">👑 เสกบอส</button></div>
        <h4>🐉 เรียกบอสโลกทันที</h4><div class="picker small">${WORLD_BOSSES.map((w) => `<button class="pk" data-act="gmWB2" data-id="${w.id}">${img(bossPortrait(BOSSES[w.base].sprite, BOSSES[w.base].tint))}<span>${esc(w.name)}</span></button>`).join('')}</div>
        <h4>🧭 วาร์ป GM</h4><div class="map-btns">${Object.values(MAPS).map((m) => `<button class="pk ${m.id === this.G.inst?.key ? 'on' : ''}" data-act="gmWarp2" data-m="${m.id}">${m.kind === 'town' ? '🏰' : '🌲'} ${esc(m.name)}</button>`).join('')}</div>`;
    }
    this.win('gm', '👑 GM Panel [F9]', `<div class="icon-tabs">${Object.entries(tabs).map(([k, [i, l]]) => `<button class="${k === tab ? 'on' : ''}" data-act="gmTab" data-t="${k}"><i>${i}</i><span>${l}</span></button>`).join('')}</div>${body}`, 860);
  };

  // ---------- PoE-style passive tree ----------
  P.p_passives = function () {
    const c = this.G.char; const tree = buildPassiveTree(c.classId);
    const pts = passivePointsFor(c.level, c.mastery) - spentPoints(c.build.passives);
    const W = Math.min(1100, window.innerWidth - 60), H = Math.min(680, window.innerHeight - 200);
    const el = this.win('passives', `🌳 Passive Skill Tree [P] — แต้มว่าง ${pts}`, `<div class="legend">${tree.branches.map((b) => `<span style="color:${b.color}">${b.icon} ${b.th}</span>`).join('')}</div><canvas id="treecv" width="${W}" height="${H}"></canvas><div class="row small dim"><span>🖱 ลากเพื่อเลื่อน • ล้อเมาส์ซูม • คลิกโหนดเพื่อลงแต้ม</span><span>• เล็ก = Minor</span><span>◉ Notable</span><span>◈ Keystone</span><button class="mini alt" data-act="treeCenter">🎯 กลับกลาง</button></div>`, W + 30);
    const cv = el.querySelector('#treecv');
    if (this.treeCv !== cv) { this.treeCv = cv; this.treeView = this.treeView || { x: W / 2, y: H / 2, z: Math.min(W, H) / 3900 }; this.bindTree(cv, tree); }
  };
  P.nodeTip = function (n) { const a = this.G.char.build.passives[n.id] || 0; const t = { minor: 'Minor', notable: 'Notable', keystone: 'Keystone', root: 'Origin' }[n.type]; return `<b style="color:${n.color || '#fff'}">${n.icon || ''} ${esc(n.name === 'Minor' ? 'Passive' : n.name)}</b><br><small>${t} • ${a ? '✔ เปิดแล้ว' : 'ยังไม่เปิด'}</small><br>${esc(n.desc || '')}`; };
  P.drawTree = function () {
    const cv = this.treeCv; if (!cv || !document.body.contains(cv)) return;
    const c = this.G.char; const tree = buildPassiveTree(c.classId); const A = c.build.passives; const v = this.treeView; const t = performance.now() / 1000;
    const x = cv.getContext('2d');
    const bg = x.createRadialGradient(cv.width / 2, cv.height / 2, 50, cv.width / 2, cv.height / 2, cv.width * 0.8); bg.addColorStop(0, '#1a1428'); bg.addColorStop(1, '#07060c'); x.fillStyle = bg; x.fillRect(0, 0, cv.width, cv.height);
    x.save(); x.translate(v.x, v.y); x.scale(v.z, v.z);
    const reach = (n) => n.id === 'root' || n.req.some((r) => r === 'root' || A[r]);
    // edges: arcs inside ring clusters, gentle curves elsewhere
    const drawn = new Set();
    for (const n of tree.nodes) for (const r of n.req) {
      const p = tree.byId[r]; if (!p) continue; const key = [n.id, r].sort().join('|'); if (drawn.has(key)) continue; drawn.add(key);
      const on = (A[n.id] || n.id === 'root') && (A[r] || r === 'root');
      x.strokeStyle = on ? n.color || '#e8d8b8' : 'rgba(190,170,130,0.55)'; x.lineWidth = on ? 5 : 3;
      if (on) { x.shadowColor = n.color; x.shadowBlur = 8; }
      x.beginPath();
      if (n.ring && p.ring && n.ring.cx === p.ring.cx && n.ring.cy === p.ring.cy) {
        const R = n.ring; let a1 = Math.atan2(p.y - R.cy, p.x - R.cx), a2 = Math.atan2(n.y - R.cy, n.x - R.cx); let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        x.arc(R.cx, R.cy, R.r, a1, a1 + da, da < 0);
      } else { const mx = (n.x + p.x) / 2, my = (n.y + p.y) / 2; const dx = n.x - p.x, dy = n.y - p.y; const bend = 0.12; x.moveTo(p.x, p.y); x.quadraticCurveTo(mx - dy * bend, my + dx * bend, n.x, n.y); }
      x.stroke(); x.shadowBlur = 0;
    }
    // centre portrait
    const cls = CLASS_BY_ID[c.classId];
    x.save(); x.beginPath(); x.arc(0, 0, 100, 0, 7); x.clip(); const pg = x.createRadialGradient(0, -20, 10, 0, 0, 110); pg.addColorStop(0, cls.palette.accent); pg.addColorStop(0.5, '#2a3a2a'); pg.addColorStop(1, '#0a0a10'); x.fillStyle = pg; x.fillRect(-110, -110, 220, 220); x.imageSmoothingEnabled = false; x.drawImage(charSprite(cls.id, cls.palette, 0), -54, -95, 108, 180); x.restore();
    x.strokeStyle = '#b89a5a'; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 102, 0, 7); x.stroke(); x.strokeStyle = '#5a4a2a'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 110, 0, 7); x.stroke();
    for (let i = 0; i < tree.branches.length; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / tree.branches.length; x.fillStyle = tree.branches[i].color; x.beginPath(); x.arc(Math.cos(a) * 110, Math.sin(a) * 110, 7, 0, 7); x.fill(); x.strokeStyle = '#2a2010'; x.stroke(); }
    x.font = 'bold 16px Kanit, Tahoma'; x.textAlign = 'center'; x.fillStyle = '#ffe9a0'; x.fillText(cls.name, 0, 125);
    // nodes
    for (const n of tree.nodes) {
      if (n.id === 'root') continue;
      const a = A[n.id] || 0, ok = reach(n), hov = this.treeHover === n;
      const R = n.type === 'keystone' ? 22 : n.type === 'notable' ? 15 : 9;
      if (a) { x.shadowColor = n.color; x.shadowBlur = 16 + Math.sin(t * 3) * 4; }
      x.fillStyle = a ? n.color : ok ? '#3a3250' : '#221c30';
      x.strokeStyle = a ? '#fff8d8' : ok ? n.color : '#7a6e90'; x.lineWidth = hov ? 4 : n.type === 'minor' ? 2 : 3;
      x.beginPath(); x.arc(n.x, n.y, R, 0, 7); x.fill(); x.stroke(); x.shadowBlur = 0;
      if (n.type !== 'minor') { x.strokeStyle = a ? '#ffe9a0' : '#8a7a5a'; x.lineWidth = 2; x.beginPath(); x.arc(n.x, n.y, R + 5, 0, 7); x.stroke(); if (n.type === 'keystone') { x.beginPath(); for (let i = 0; i < 8; i++) { const q = (i / 8) * Math.PI * 2; x.moveTo(n.x + Math.cos(q) * (R + 5), n.y + Math.sin(q) * (R + 5)); x.lineTo(n.x + Math.cos(q) * (R + 11), n.y + Math.sin(q) * (R + 11)); } x.stroke(); } }
      if (n.type !== 'minor' || v.z > 0.9) { x.font = `${n.type === 'keystone' ? 20 : n.type === 'notable' ? 15 : 9}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = a || ok ? 1 : 0.7; x.fillText(n.icon || '•', n.x, n.y + 1); x.globalAlpha = 1; }
      if (n.type !== 'minor' && v.z > 0.45) { x.font = 'bold 12px Kanit, Tahoma'; x.textBaseline = 'alphabetic'; x.fillStyle = a ? '#ffe9a0' : '#a89a80'; x.fillText(n.name, n.x, n.y + R + (n.type === 'keystone' ? 26 : 20)); }
    }
    x.restore();
  };
  UI.prototype.__treeCenter = function () { if (!this.treeCv) return; this.treeView = { x: this.treeCv.width / 2, y: this.treeCv.height / 2, z: Math.min(this.treeCv.width, this.treeCv.height) / 3900 }; };

  // ---------- Map: area tab (original) + illustrated world tab ----------
  P.p_map = function () {
    if ((this.ctx.mapTab || 'area') === 'area') return origMap.call(this);
    const sel = this.ctx.wmSel || this.G.inst?.key || 'town_aurelia';
    const el = this.win('map', '🗺 แผนที่โลก — Tenend • 35 โซน', `<div class="icon-tabs"><button data-act="mapTab" data-t="area"><i>📍</i><span>พื้นที่นี้</span></button><button class="on" data-act="mapTab" data-t="world"><i>🌍</i><span>แผนที่โลก</span></button></div>
      <div class="wm-wrap"><div class="wm-canvas"><canvas id="worldcv" width="760" height="540"></canvas><div class="wm-zoom"><button class="mini alt" data-act="wmZoom" data-z="1">＋</button><span>${Math.round((this.ctx.wmZ || 1) * 100)}%</span><button class="mini alt" data-act="wmZoom" data-z="-1">－</button></div><div class="wm-legend"><span>🟡 เปิดให้เล่น</span><span>🏰 เมือง</span><span>📍 คุณอยู่ที่นี่</span></div></div>
      <div class="wm-side">${this.worldInfo(sel)}</div></div>`, 1140);
    const cv = el.querySelector('#worldcv');
    if (this.wmCv !== cv) { this.wmCv = cv; this.bindWorld(cv); }
    this.drawWorld();
  };
  P.worldInfo = function (id) {
    const m = MAPS[id]; if (!m) return '';
    const here = id === this.G.inst?.key;
    const reg = REGION_LIST.find((r) => r.id === m.region);
    let html = `<small class="dim">${m.kind === 'town' ? '🏰 เมือง • เขตปลอดภัย' : '🌲 แมพฟาร์ม'}</small><h2>${esc(m.name)}</h2><small>${esc(reg?.th || '')}</small><div class="tags"><span class="tag2 ok">เปิดให้เล่น</span>${here ? '<span class="tag2 here">📍 คุณอยู่ที่นี่</span>' : ''}<span class="tag2">Lv ${m.lv[0]}${m.kind === 'field' ? '–' + m.lv[1] : '+'}</span></div>`;
    if (m.kind === 'field') {
      html += `<h4>👾 มอนสเตอร์และของดรอป</h4>${m.monsters.map((mid) => { const mo = MONSTERS[mid]; const cd = cardFor('card_' + mid); return `<div class="wm-mon">${img(bossPortrait(mo.kind, mo.tint))}<div><b>${esc(mo.name)}</b> <small style="color:${ELEMENT_INFO[mo.el].color}">● ${ELEMENT_INFO[mo.el].th}</small><br><small>Lv${mo.lv} • ${img(cardIcon('card_' + mid), 'tiny')} ${esc(cd?.name || '')}</small></div></div>`; }).join('')}`;
      const B = BOSSES[m.fieldBoss]; html += `<h4>👑 บอสแมพ</h4><div class="wm-mon">${img(bossPortrait(B.sprite, B.tint))}<div><b>${esc(B.name)}</b><br><small>เกิดทุก ${Math.round(m.bossRespawn / 60)} นาที</small></div></div>`;
      const wb = WORLD_BOSSES.filter((w) => w.map === id); if (wb.length) html += `<h4>🐉 บอสโลก</h4>${wb.map((w) => `<div class="wm-mon">${img(bossPortrait(BOSSES[w.base].sprite, BOSSES[w.base].tint))}<div><b>${esc(w.name)}</b><br><small>ทุก ${Math.round(w.every / 60)} นาที</small></div></div>`).join('')}`;
    } else {
      html += `<h4>🛎 บริการ & NPC</h4><div class="svc">${m.npcs.map((n) => `<span>${{ shop: '🛒', smith: '🔨', stash: '📦', market: '⚖', guild: '🏰', arena: '⚔', dungeon: '🚪', teleport: '🌀', quest: '📜', build: '📘' }[n.type] || '•'} ${esc(n.name)}</span>`).join('')}</div>`;
    }
    html += `<h4>🔗 เชื่อมต่อกับ</h4><div class="svc">${m.exits.map((e) => `<button class="pk" data-act="wmSel" data-id="${e.to}">🌀 ${esc(MAPS[e.to].name)} <small>Lv${MAPS[e.to].lv[0]}</small></button>`).join('')}</div><p class="dim">เดินทางด้วยการเดินผ่านประตูวาร์ป 🌀 หรือที่ NPC นักเคลื่อนย้ายในเมือง</p>`;
    return html;
  };
  // world layout: positions in 0..1 space
  const WPOS = (() => {
    const anchors = { aurelia: [0.47, 0.5], mareth: [0.83, 0.58], frosthold: [0.5, 0.12], sandara: [0.14, 0.72], ember: [0.5, 0.9] };
    const order = ['aurelia', 'mareth', 'frosthold', 'sandara', 'ember'];
    const pos = {};
    order.forEach((r, ri) => {
      const a = anchors[r], b = anchors[order[ri + 1]] || [0.62, 0.95];
      pos['town_' + r] = a;
      for (let i = 1; i <= 6; i++) { const t = i / 7; const wig = Math.sin(i * 1.7 + ri) * 0.06; pos[`${r}_${i}`] = [a[0] + (b[0] - a[0]) * t + wig * (b[1] - a[1]), a[1] + (b[1] - a[1]) * t - wig * (b[0] - a[0])]; }
    });
    return pos;
  })();
  let worldBg = null;
  function paintWorld(W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#1e4a6a'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { x.strokeStyle = 'rgba(160,210,240,0.15)'; const px = (i * 97) % W, py = (i * 53) % H; x.beginPath(); x.arc(px, py, 6, 0.2, 2.6); x.stroke(); }
    // continent
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    x.fillStyle = '#5a8a3a'; x.beginPath();
    for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; const r = 0.42 + Math.sin(a * 3) * 0.04 + Math.sin(a * 7 + 1) * 0.025 + rnd() * 0.02; x.lineTo(W * (0.5 + Math.cos(a) * r * 1.05), H * (0.5 + Math.sin(a) * r * 1.08)); }
    x.closePath(); x.fill(); x.strokeStyle = '#d8c88a'; x.lineWidth = 6; x.stroke();
    const blob = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; const r = 1 + Math.sin(a * 4 + cx * 9) * 0.15; x.lineTo(W * (cx + Math.cos(a) * rx * r), H * (cy + Math.sin(a) * ry * r)); } x.fill(); };
    blob(0.5, 0.15, 0.22, 0.12, '#dfe8f0'); blob(0.15, 0.72, 0.15, 0.15, '#d8b870'); blob(0.5, 0.88, 0.16, 0.1, '#4a2a22'); blob(0.84, 0.56, 0.1, 0.2, '#c8b880'); blob(0.47, 0.5, 0.16, 0.14, '#6aa04a');
    // texture: mountains, trees, dunes, lava
    for (let i = 0; i < 70; i++) { const px = W * (0.32 + rnd() * 0.36), py = H * (0.05 + rnd() * 0.18); x.fillStyle = '#8a98a8'; x.beginPath(); x.moveTo(px - 12, py + 10); x.lineTo(px, py - 12); x.lineTo(px + 12, py + 10); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(px - 4, py - 4); x.lineTo(px, py - 12); x.lineTo(px + 4, py - 4); x.fill(); }
    for (let i = 0; i < 160; i++) { const a = rnd() * 6.28, r = rnd() * 0.25; const px = W * (0.47 + Math.cos(a) * r), py = H * (0.48 + Math.sin(a) * r * 0.9); x.fillStyle = i % 2 ? '#2f6a2a' : '#3a7a32'; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); }
    for (let i = 0; i < 40; i++) { const px = W * (0.05 + rnd() * 0.22), py = H * (0.6 + rnd() * 0.25); x.strokeStyle = '#b89850'; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 8, 3.4, 6); x.stroke(); }
    for (let i = 0; i < 30; i++) { const px = W * (0.38 + rnd() * 0.24), py = H * (0.82 + rnd() * 0.12); x.fillStyle = i % 3 ? '#2a1a16' : '#ff5a1a'; x.beginPath(); x.moveTo(px - 10, py + 8); x.lineTo(px, py - 10); x.lineTo(px + 10, py + 8); x.fill(); }
    x.strokeStyle = '#4a9ad8'; x.lineWidth = 4; x.beginPath(); x.moveTo(W * 0.5, H * 0.22); x.bezierCurveTo(W * 0.42, H * 0.4, W * 0.62, H * 0.55, W * 0.92, H * 0.62); x.stroke();
    return c;
  }
  P.bindWorld = function (cv) {
    let drag = null;
    const toMap = (e) => { const r = cv.getBoundingClientRect(); const z = this.ctx.wmZ || 1, o = this.ctx.wmO || [0, 0]; return [((e.clientX - r.left) * (cv.width / r.width) - o[0]) / z, ((e.clientY - r.top) * (cv.height / r.height) - o[1]) / z]; };
    cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, o: [...(this.ctx.wmO || [0, 0])], moved: false }; });
    cv.addEventListener('mousemove', (e) => { if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; this.ctx.wmO = [drag.o[0] + dx, drag.o[1] + dy]; this.drawWorld(); } });
    cv.addEventListener('mouseup', (e) => { if (drag && !drag.moved) { const [mx, my] = toMap(e); let best = null, bd = 30; for (const [id, p] of Object.entries(WPOS)) { const d = Math.hypot(p[0] * cv.width - mx, p[1] * cv.height - my); if (d < bd) { bd = d; best = id; } } if (best) { this.ctx.wmSel = best; this.renderPanel('map'); } } drag = null; });
    cv.addEventListener('mouseleave', () => { drag = null; });
  };
  P.drawWorld = function () {
    const cv = this.wmCv; if (!cv || !document.body.contains(cv)) return;
    const x = cv.getContext('2d'); const W = cv.width, H = cv.height; if (!worldBg) worldBg = paintWorld(W, H);
    const z = this.ctx.wmZ || 1, o = this.ctx.wmO || [0, 0];
    x.fillStyle = '#123a5a'; x.fillRect(0, 0, W, H); x.save(); x.translate(o[0], o[1]); x.scale(z, z); x.drawImage(worldBg, 0, 0);
    // roads
    x.strokeStyle = '#e8d8a0'; x.lineWidth = 3 / z + 1; x.setLineDash([6, 5]);
    for (const m of Object.values(MAPS)) for (const e of m.exits) { const a = WPOS[m.id], b = WPOS[e.to]; if (!a || !b || m.id > e.to) continue; x.beginPath(); x.moveTo(a[0] * W, a[1] * H); x.lineTo(b[0] * W, b[1] * H); x.stroke(); }
    x.setLineDash([]);
    const sel = this.ctx.wmSel, here = this.G.inst?.key;
    for (const [id, p] of Object.entries(WPOS)) {
      const m = MAPS[id]; const px = p[0] * W, py = p[1] * H; const town = m.kind === 'town';
      x.fillStyle = town ? '#ffd84a' : '#f0c040'; x.strokeStyle = id === sel ? '#fff' : '#5a3a10'; x.lineWidth = id === sel ? 3 : 2;
      x.beginPath(); x.arc(px, py, town ? 9 : 6, 0, 7); x.fill(); x.stroke();
      const label = town ? `🏰 ${m.name}` : m.name, sub = town ? 'ปลอดภัย' : `Lv.${m.lv[0]}–${m.lv[1]}`;
      x.font = 'bold 11px Kanit, Tahoma'; const w = Math.max(x.measureText(label).width, 50) + 12;
      x.fillStyle = id === sel ? 'rgba(120,80,20,0.95)' : 'rgba(70,45,15,0.88)'; x.strokeStyle = '#d8a84a'; x.lineWidth = 1;
      const lx = px + 10, ly = py - 14; x.beginPath(); x.roundRect(lx, ly, w, 28, 5); x.fill(); x.stroke();
      x.fillStyle = '#ffe9b0'; x.textAlign = 'left'; x.fillText(label, lx + 6, ly + 12); x.font = '10px Kanit, Tahoma'; x.fillStyle = '#e8c880'; x.fillText(sub, lx + 6, ly + 24);
      if (id === here) { x.fillStyle = '#ffd84a'; x.beginPath(); x.roundRect(px - 34, py - 34, 68, 16, 4); x.fill(); x.fillStyle = '#3a2a00'; x.font = 'bold 10px Kanit, Tahoma'; x.textAlign = 'center'; x.fillText('📍 คุณอยู่ที่นี่', px, py - 22); }
    }
    x.restore();
  };

  // ---------- chat channel: icon buttons ----------
  P.sendChat = function () {
    const inp = $('#chat-input'); let text = inp.value.trim(); inp.value = ''; inp.blur(); if (!text) return;
    let ch = this.chatSendCh || 'say', to;
    const mm = text.match(/^\/(w|p|g|s|world)\s+(.*)$/i);
    if (mm) { const k = mm[1].toLowerCase(); if (k === 'w') { const sp = mm[2].indexOf(' '); to = mm[2].slice(0, sp); text = mm[2].slice(sp + 1); ch = 'whisper'; } else { ch = { p: 'party', g: 'guild', s: 'say', world: 'world' }[k]; text = mm[2]; } }
    this.send({ t: 'chat', ch, text, to });
  };

  // ---------- dialog choices as icon buttons ----------
  const origAsk = P.ask;
  P.ask = function (text, opts = {}) {
    if (!opts.choices) return origAsk.call(this, text, opts);
    return new Promise((res) => {
      const d = document.createElement('div'); d.className = 'modal';
      d.innerHTML = `<div class="modal-box"><p>${esc(text)}</p><div class="picker big">${opts.choices.map((c, i) => `<button class="pk" data-i="${i}">${c[2] || ''}<span>${esc(c[1])}</span></button>`).join('')}</div><div class="row"><button class="alt" id="modal-no">ยกเลิก</button></div></div>`;
      document.body.appendChild(d);
      const done = (v) => { d.remove(); res(v); };
      d.querySelectorAll('.pk').forEach((b) => { b.onclick = () => done(opts.choices[+b.dataset.i][0]); });
      d.querySelector('#modal-no').onclick = () => done(null);
    });
  };

  // ---------- tooltips for stacked items / rune icons ----------
  P.onHover = function (e) {
    const t = e.target.closest?.('[data-tip]');
    if (t && t.dataset.tip.startsWith('stack:')) {
      const [, kind, id] = t.dataset.tip.split(':'); const c = this.G.char; let h = '';
      if (kind === 'mat') h = `<b style="color:${MATERIALS[id].color}">${MATERIALS[id].th}</b> <small>(${MATERIALS[id].name})</small><br>มีอยู่ ${c.materials[id]} ชิ้น • ใช้คราฟต์/ตีบวก/Reroll ที่ช่างตีเหล็ก`;
      if (kind === 'pot') h = `<b>${POTIONS[id].name}</b><br>${POTIONS[id].th}<br>มีอยู่ ${c.potions[id]} ขวด • คลิกเพื่อใช้ (${id === 'hp' ? 'Q' : 'T'})`;
      if (kind === 'rune') { const r = RUNE_BY_ID[id]; h = `<b style="color:#7fe8ff">💠 ${r.name}</b> <small>Tier ${r.tier}</small><br>${r.th}<br>มีอยู่ ${c.runes[id]} • คลิกเพื่อเปิดหน้ารูน`; }
      return this.showTip(h, e.clientX, e.clientY);
    }
    return origHover.call(this, e);
  };

  // ---------- extra actions ----------
  P.act = function (a, el, e) {
    const d = el?.dataset || {}; const S = this.send; const v = (id) => $('#' + id)?.value; this.pk = this.pk || {};
    switch (a) {
      case 'pk': this.pk[d.n] = d.v; if (d.p === 'chat') { this.chatSendCh = d.v; return this.renderChatCh(); } return this.renderPanel(d.p);
      case 'pkTog': this.pk[d.n] = !this.pk[d.n]; return this.renderPanel(d.p);
      case 'invCat': this.ctx.invCat = d.c; return this.renderPanel('inventory');
      case 'stackUse': return S({ t: 'potion', kind: d.k.split(':')[1] });
      case 'stackRune': return this.openPanel('runes');
      case 'stack': return;
      case 'fxPreview': this.r?.previewSkill(+d.n); return;
      case 'skFam': this.ctx.skFam = d.f; this.ctx.runeSlot = null; return this.renderPanel('skills');
      case 'selSkill': this.selSkill = d.id; this.ctx.runeSlot = null; return this.renderPanel('skills');
      case 'runeSlot': if (e.target.closest('button')) break; this.ctx.runeSlot = this.ctx.runeSlot === +d.i ? null : +d.i; return this.renderPanel('skills');
      case 'socketRune2': this.ctx.runeSlot = null; return S({ t: 'build', op: 'socketRune', id: d.id, idx: +d.idx, rune: d.r });
      case 'craft2': return S({ t: 'npc', op: 'craft', slot: this.pk.cslot, ilvl: +(this.pk.cilvl || this.G.char.level), catalyst: this.pk.ccat || '', set: this.pk.cset, wtype: this.pk.cwt });
      case 'mSearch2': this.ctx.mq = v('mq'); return S({ t: 'market', op: 'browse', q: this.ctx.mq, slot: this.pk.mslot, rarity: this.pk.mrar });
      case 'guildCreate2': return S({ t: 'guild', op: 'create', name: v('gname'), tag: v('gtag'), shape: this.pk.gshape || 'shield', icon: this.pk.gicon || 'sword', color: this.pk.gcolor || '#d83a2a' });
      case 'savePreset2': return S({ t: 'build', op: 'savePreset', idx: +d.i, name: v('pn' + d.i), tag: this.pk['pt' + d.i] || 'PvE' });
      case 'dgTab': this.ctx.dgTab = d.t; return this.renderPanel('dungeon');
      case 'enterDungeon2': return S({ t: 'dungeon', op: 'enter', id: d.id, boss: this.pk.hboss, floor: +(v('abfloor') || 1) });
      case 'autoSet': { const val = d.v; this.saveAuto({ [d.k]: val }); return; }
      case 'autoTog': return this.saveAuto({ [d.k]: !this.G.auto.cfg[d.k] });
      case 'autoMon': { const cfg = this.G.auto.cfg; const list = new Set(cfg.list); list.has(d.n) ? list.delete(d.n) : list.add(d.n); return this.saveAuto({ list: [...list], targets: 'list' }); }
      case 'gmp2': return S({ t: 'gm', op: 'player', name: this.pk.gmt, action: d.a });
      case 'gmpv2': return S({ t: 'gm', op: 'player', name: this.pk.gmt, action: d.a, n: +v(d.src) });
      case 'gmItem2': return S({ t: 'gm', op: 'player', name: this.pk.gmt, action: 'item', slot: this.pk.gmslot, rarity: this.pk.gmrar, ilvl: +v('gmilvl') || 0 });
      case 'gmpWarp2': return S({ t: 'gm', op: 'player', name: this.pk.gmt, action: 'warp', map: d.m });
      case 'gmWarp2': return S({ t: 'gm', op: 'warp', map: d.m });
      case 'gmSpawn2': return S({ t: 'gm', op: 'spawn', tpl: this.pk.gmmon, n: +v('gmn'), lv: +v('gmmlv') || 0, elite: !!this.pk.gmelite });
      case 'gmBoss2': return S({ t: 'gm', op: 'boss', id: this.pk.gmboss, hpMul: +v('gmbhp') || 1, world: !!this.pk.gmworld });
      case 'gmWB2': return S({ t: 'gm', op: 'worldboss', id: d.id });
      case 'gmSelf': return S({ t: 'gm', op: 'self', [d.k]: !this.ctx.gm?.self?.[d.k] });
      case 'treeCenter': this.__treeCenter(); return;
      case 'wmSel': this.ctx.wmSel = d.id; return this.renderPanel('map');
      case 'wmZoom': { const z0 = this.ctx.wmZ || 1; const z = Math.max(0.6, Math.min(3, z0 * (+d.z > 0 ? 1.25 : 0.8))); const o = this.ctx.wmO || [0, 0]; const c = [380, 270]; this.ctx.wmO = [c[0] - ((c[0] - o[0]) * z) / z0, c[1] - ((c[1] - o[1]) * z) / z0]; this.ctx.wmZ = z; return this.renderPanel('map'); }
      case 'cardMenu2': break;
    }
    return origAct.call(this, a, el, e);
  };
  P.renderChatCh = function () {
    const ch = this.chatSendCh || 'say';
    $('#chat-chbtns').innerHTML = [['say', '💬', 'พูด'], ['world', '🌍', 'โลก'], ['party', '👥', 'ปาร์ตี้'], ['guild', '🏰', 'กิลด์']].map(([k, i, l]) => `<button class="${k === ch ? 'on' : ''}" data-act="pk" data-n="chatch" data-v="${k}" data-p="chat" title="ส่งไปช่อง${l}">${i}</button>`).join('');
  };
  P.bindTree = function (cv, tree) {
    let drag = null;
    const hit = (e) => { const r = cv.getBoundingClientRect(); const v = this.treeView; const wx = ((e.clientX - r.left) * (cv.width / r.width) - v.x) / v.z, wy = ((e.clientY - r.top) * (cv.height / r.height) - v.y) / v.z; return tree.nodes.find((n) => n.id !== 'root' && Math.hypot(n.x - wx, n.y - wy) < (n.type === 'keystone' ? 26 : n.type === 'notable' ? 19 : 12)); };
    cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: this.treeView.x, vy: this.treeView.y, moved: false }; });
    cv.addEventListener('mousemove', (e) => { if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; this.treeView.x = drag.vx + dx; this.treeView.y = drag.vy + dy; } const n = hit(e); this.treeHover = n; if (n) this.showTip(this.nodeTip(n), e.clientX, e.clientY); else this.hideTip(); });
    cv.addEventListener('mouseup', (e) => { if (drag && !drag.moved) { const n = hit(e); if (n) this.send({ t: 'build', op: 'allocPassive', node: n.id }); } drag = null; });
    cv.addEventListener('mouseleave', () => { drag = null; this.hideTip(); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const v = this.treeView; const r = cv.getBoundingClientRect(); const mx = (e.clientX - r.left) * (cv.width / r.width), my = (e.clientY - r.top) * (cv.height / r.height); const z = Math.max(0.12, Math.min(2.2, v.z * (e.deltaY < 0 ? 1.12 : 0.89))); v.x = mx - ((mx - v.x) * z) / v.z; v.y = my - ((my - v.y) * z) / v.z; v.z = z; });
  };
  P.onEnterExtra = function () { this.renderChatCh(); };
}
