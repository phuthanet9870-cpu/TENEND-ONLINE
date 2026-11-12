// ===== DOM UI: login, character select, HUD, and all system panels =====
import { CLASSES, CLASS_BY_ID } from '/shared/classes.js';
import { classSkills, getSkill, resolveSkill, BEHAVIOR, MAX_SKILL_RANK, runeSlotsForRank } from '/shared/skills.js';
import { RUNES, RUNE_BY_ID, runeFits } from '/shared/runes.js';
import { buildPassiveTree, passivePointsFor, spentPoints } from '/shared/passives.js';
import { STAT_TH, SLOT_TH, LEGENDARIES, MYTHICS, SETS, MATERIALS, WEAPON_TYPES, REFINE_CHANCE, POTIONS, sellPrice } from '/shared/items.js';
import { RARITY_INFO, ELEMENT_INFO, ECONOMY, PVP_MODES, GUILD_RANKS, expToNext, STATUS, STATUS_BITS, RARITIES, HOTBAR_SIZE, TILE } from '/shared/constants.js';
import { MAPS, TOWNS, DUNGEONS, BOSSES, REGION_LIST, cardFor, QUESTS, MONSTERS, WORLD_BOSSES } from '/shared/world.js';
import { AUTO_DEFAULT } from './auto.js';
import { computeStats } from '/shared/stats.js';
import { charSprite, weaponSprite, drawEmblem } from './sprites.js';
import { fmt } from './render.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BEH_GLYPH = { melee: '⚔', projectile: '➶', nova: '✺', ground: '◎', beam: '═', dash: '»', leap: '⤒', summon: '☥', buff: '✚', chain: 'ϟ', trap: '⌖', orbit: '⟳', heal: '❤', barrage: '⁂', totem: '♜' };
const SLOT_ICON = { weapon: '⚔', offhand: '🛡', helm: '⛑', chest: '🥋', gloves: '🧤', boots: '👢', belt: '➰', amulet: '📿', ring: '💍', ring1: '💍', ring2: '💍', card: '🃏' };
const EQUIP_SLOTS = ['helm', 'amulet', 'weapon', 'chest', 'offhand', 'gloves', 'belt', 'ring1', 'ring2', 'boots'];
const HELP = {
  inventory: 'อุปกรณ์ที่สวมใส่อยู่ทางซ้าย ของในกระเป๋าทางขวา (60 ช่อง) คลิกไอเทมเพื่อดูคำสั่ง: สวมใส่ แยกชิ้นส่วน ขาย ฝากคลัง หรือวางขาย ไอเทมยิ่งสีหายากยิ่งดี: ขาว → ฟ้า → เหลือง → ม่วง → ส้ม → แดง',
  character: 'สรุปค่าสถานะทั้งหมดที่ได้จากเลเวล อุปกรณ์ Passive และเซ็ต ใช้ดูว่า Build ของคุณแข็งแรงตรงไหน',
  skills: 'แต่ละคลาสมี 100 สกิล (9 สาย × 10 + อัลติเมท 10) สกิลปลดล็อกตามเลเวล เลือกสกิลทางซ้าย แล้วคลิกช่องหรือลากไปวางที่ Hotbar ใช้แต้มสกิลเพื่อเพิ่ม Rank และฝังรูนเพื่อเปลี่ยนรูปแบบสกิล',
  runes: 'Support Runes เปลี่ยนการทำงานของสกิล เช่น ยิงแตกเป็นหลายลูก กระโดดไปเป้าอื่น หรือกลายเป็นกับดัก ฝังที่หน้าสกิล [K] และนำ 3 รูนมาฟิวส์เป็นรูนระดับสูงขึ้นได้',
  passives: 'ทุกเลเวลได้ 1 แต้ม ลงแต้มได้เฉพาะโหนดที่เชื่อมกับโหนดที่เปิดแล้ว (เริ่มจาก Origin ตรงกลาง) โหนดรูปเพชร ◆ คือ Keystone ที่เปลี่ยนวิธีเล่น',
  builds: 'บันทึกชุดสกิล รูน และ Passive ไว้ 6 ชุด สลับได้ทันทีนอกการต่อสู้ เช่น ชุดฟาร์ม (PvE) กับชุดสู้คน (PvP) รีเซ็ตแต้มได้ด้วยทอง',
  quests: 'รับเควสต์กำจัดมอนสเตอร์หรือบอสในภูมิภาคปัจจุบัน ความคืบหน้าแสดงที่มุมขวา เมื่อครบให้กลับมาส่งเพื่อรับ EXP ทอง และรูน',
  party: 'รวมทีมสูงสุด 8 คน แบ่ง EXP กัน (ได้โบนัส +15% ต่อคน) และของดรอปแยกให้แต่ละคน หัวหน้าปาร์ตี้เป็นผู้เปิดดันเจี้ยน',
  guild: 'กิลด์มีตำแหน่ง คลังร่วม (บันทึกการฝากถอนทุกครั้ง) สกิลกิลด์ เควสต์รายวัน Guild Boss และ Guild War 20v20',
  pvp: 'PvP แยกจากการฟาร์ม ไม่มีใครฆ่าคุณในแมพปกติได้ Ranked จะปรับค่าอุปกรณ์ทุกคนให้เท่ากัน ผลแพ้ชนะจึงขึ้นกับ Build และฝีมือ',
  dungeon: 'Story = เนื้อเรื่อง+บอส • Abyss = ชั้นสุ่มไม่สิ้นสุด • Boss Hunt = ตีบอสอย่างเดียว • Raid = 4-8 คน บอสหลายเฟส พื้นแดง = หลบ พื้นทอง = กด F Counter',
  shop: 'ซื้อยาและรูนพื้นฐาน ขายของโดยคลิกไอเทมในกระเป๋าแล้วเลือก "ขาย"',
  smith: 'คราฟต์ไอเทมจากวัตถุดิบ ตีบวก +1 ถึง +10 สุ่ม Affix ใหม่ เจาะช่อง Socket และซ่อมอุปกรณ์ (ความทนทานลดเมื่อตาย)',
  stash: 'คลังของใช้ร่วมกันทุกตัวละครในบัญชีเดียวกัน 80 ช่อง',
  market: 'ซื้อขายกับผู้เล่นอื่นผ่านเซิร์ฟเวอร์ ค่าวางขาย 1% และค่าธรรมเนียม 6% เมื่อขายได้',
  teleport: 'วิธีเดียวที่วาร์ปข้ามแมพได้ทันที ไปเมืองหรือแมพฟาร์มที่เลเวลถึง จ่ายด้วยทอง (นอกนั้นต้องเดินผ่านประตูวาร์ป 🌀 ที่ขอบแผนที่)',
  map: 'คลิกตรงไหนบนแผนที่ ตัวละครจะเดินไปเอง (วาร์ปไม่ได้) จุดสีฟ้า 🌀 คือประตูวาร์ปที่เชื่อมไปแมพถัดไป คลิกใกล้ประตูเพื่อเดินไปที่ประตู',
  auto: 'ออโต้จะเดินหา ตี และเก็บของให้ตามที่ตั้งไว้ แท็บ "ลำดับสกิล" ใช้กำหนดว่าจะใช้สกิลไหนก่อนหลัง (ดึงจากสกิลที่ใส่ใน Hotbar) กด U เพื่อเปิด/ปิด',
  gm: 'แผงควบคุมสำหรับผู้ดูแลเกม ทุกคำสั่งถูกบันทึกไว้ในแท็บ "บันทึก GM" และใช้ได้บนเซิร์ฟเวอร์ออนไลน์จริง',
};
const statLine = (k, v) => `${STAT_TH[k] || k} ${v >= 0 ? '+' : ''}${Math.round(v * 10) / 10}`;

export class UI {
  constructor(G, send, renderer) {
    this.G = G; this.send = send; this.r = renderer; this.open = new Set(); this.ctx = {}; this.selSkill = null; this.skillTab = 0; this.chatCh = 'say';
    this.toasts = $('#toasts'); this.tip = $('#tooltip');
    document.addEventListener('click', (e) => this.onClick(e));
    document.addEventListener('mouseover', (e) => this.onHover(e));
    document.addEventListener('mouseout', (e) => { if (e.target.closest?.('[data-tip]')) this.hideTip(); });
    document.addEventListener('mousemove', (e) => { if (this.tip.style.display === 'block') this.placeTip(e.clientX, e.clientY); });
    $('#chat-input').addEventListener('keydown', (e) => { if (e.code === 'Enter') { this.sendChat(); e.preventDefault(); } e.stopPropagation(); });
    try { this.rows = +localStorage.getItem('tenend-hotbar-rows') || 3; } catch { this.rows = 3; }
    this.chatTab = 'all';
    $('#chat-tabs').innerHTML = Object.entries({ all: 'ทั้งหมด', world: 'โลก', party: 'ปาร์ตี้', guild: 'กิลด์', sys: 'ระบบ' }).map(([k, v]) => `<button class="${k === 'all' ? 'on' : ''}" data-act="chatTab" data-t="${k}">${v}</button>`).join('');
    // minimap: click to walk
    $('#minimap').addEventListener('mousedown', (e) => { const t = this.r.miniT; if (!t) return; const r = e.target.getBoundingClientRect(); const [wx, wy] = t.toWorld((e.clientX - r.left) * (e.target.width / r.width), (e.clientY - r.top) * (e.target.height / r.height)); this.G.walkTo(wx, wy); });
    this.bindHotbarDnD();
    this.buildLogin();
  }
  // ---- drag & drop skills onto the 30-slot hotbar ----
  bindHotbarDnD() {
    document.addEventListener('dragstart', (e) => {
      const row = e.target.closest?.('[data-drag-skill]'); const slot = e.target.closest?.('.slot[data-slot]');
      if (row) e.dataTransfer.setData('text/plain', 'skill:' + row.dataset.dragSkill);
      else if (slot) e.dataTransfer.setData('text/plain', 'slot:' + slot.dataset.slot);
    });
    document.addEventListener('dragover', (e) => { const sl = e.target.closest?.('.slot[data-slot]'); if (sl) { e.preventDefault(); sl.classList.add('drop'); } });
    document.addEventListener('dragleave', (e) => { e.target.closest?.('.slot')?.classList.remove('drop'); });
    document.addEventListener('drop', (e) => {
      const data = e.dataTransfer.getData('text/plain'); const sl = e.target.closest?.('.slot[data-slot]'); document.querySelectorAll('.slot.drop').forEach((x) => x.classList.remove('drop'));
      if (!data) return; const c = this.G.char; if (!c) return;
      const [kind, v] = data.split(':'); const id = kind === 'skill' ? v : (v === 'u' ? c.build.ult : c.build.hotbar[+v]);
      if (!sl) { if (kind === 'slot') { e.preventDefault(); this.send({ t: 'build', op: 'equipSkill', slot: v === 'u' ? 'u' : +v, id: null }); } return; }
      e.preventDefault(); if (!id) return;
      const to = sl.dataset.slot === 'u' ? 'u' : +sl.dataset.slot;
      if (kind === 'slot' && to !== 'u' && v !== 'u') { const other = c.build.hotbar[to]; this.send({ t: 'build', op: 'equipSkill', slot: to, id }); if (!other) this.send({ t: 'build', op: 'equipSkill', slot: +v, id: null }); return; }
      this.send({ t: 'build', op: 'equipSkill', slot: to, id });
    });
    document.addEventListener('contextmenu', (e) => { const sl = e.target.closest?.('.slot[data-slot]'); if (sl && this.G.char) { e.preventDefault(); this.send({ t: 'build', op: 'equipSkill', slot: sl.dataset.slot === 'u' ? 'u' : +sl.dataset.slot, id: null }); } });
  }
  // ---------------- screens ----------------
  onConnect() { $('#conn').style.display = 'none'; if (!this.G.char) this.showScreen('login'); }
  onDisconnect() { $('#conn').style.display = 'flex'; this.G.char = null; }
  showScreen(s) { for (const id of ['login', 'charsel']) $('#' + id).style.display = id === s ? 'flex' : 'none'; $('#hud').style.display = s ? 'none' : 'block'; }
  buildLogin() {
    $('#login').innerHTML = `<div class="logo">TENEND<span>ONLINE</span></div><div class="sub">Online Action RPG • HTML5 • 10 Classes • 1000 Skills</div>
      <div class="box"><input id="lu" placeholder="ชื่อผู้ใช้" maxlength="20" autocomplete="username"><input id="lp" type="password" placeholder="รหัสผ่าน" maxlength="64" autocomplete="current-password">
      <div class="row"><button data-act="login">เข้าสู่ระบบ</button><button data-act="register" class="alt">สมัครสมาชิก</button></div><div id="lerr" class="err"></div></div>
      <div class="foot">คลิกเพื่อเดิน / WASD • 1-0, Shift+1-0, Alt+1-0 = Hotbar 30 ช่อง • R อัลติเมท • Space หลบ • F Counter • U ออโต้ • H วิธีเล่น</div>`;
    $('#lp').addEventListener('keydown', (e) => { if (e.code === 'Enter') this.act('login'); });
  }
  buildCharSel(list) {
    this.charList = list; this.newClass = this.newClass || 'warrior';
    const cls = CLASS_BY_ID[this.newClass];
    $('#charsel').innerHTML = `<div class="logo small">TENEND<span>ONLINE</span></div>
      <div class="cs-wrap"><div class="cs-list"><h3>ตัวละครของคุณ (${list.length}/10)</h3>${list.map((c) => `<div class="cs-item"><canvas class="spr" data-spr="${c.classId}" width="36" height="60"></canvas><div><b>${esc(c.name)}</b><br><small>${CLASS_BY_ID[c.classId].name} Lv ${c.level} • ${esc(c.map || '')}</small></div><button data-act="play" data-id="${c.id}">เล่น</button><button class="del" data-act="delchar" data-id="${c.id}">✕</button></div>`).join('') || '<p class="dim">ยังไม่มีตัวละคร สร้างตัวแรกทางขวา →</p>'}</div>
      <div class="cs-create"><h3>สร้างตัวละครใหม่</h3><div class="cls-grid">${CLASSES.map((c) => `<div class="cls ${c.id === this.newClass ? 'sel' : ''}" data-act="pickclass" data-id="${c.id}"><canvas class="spr" data-spr="${c.id}" width="36" height="60"></canvas><div>${c.name}</div><small>${c.th}</small></div>`).join('')}</div>
      <div class="cls-info"><h2 style="color:${cls.palette.accent}">${cls.name} <small>${cls.th} • ${cls.role}</small></h2><p>${cls.desc}</p>
      <p>อาวุธ: ${cls.weapons.map((w) => WEAPON_TYPES[w].name).join(', ')} • ทรัพยากร: <b style="color:${cls.resource.color}">${cls.resource.name}</b> • ธาตุ: ${cls.elements.map((e) => `<span style="color:${ELEMENT_INFO[e].color}">${ELEMENT_INFO[e].th}</span>`).join(' ')}</p>
      <p class="dim">สายสกิล: ${cls.schools.map((s) => s.noun).join(' • ')}</p><p class="dim">อัลติเมท: ${cls.ultimates.map((u) => u.name).join(' • ')}</p></div>
      <div class="row"><input id="cname" placeholder="ชื่อตัวละคร" maxlength="16"><button data-act="create">สร้าง</button></div></div></div>
      <button class="alt" style="position:absolute;top:16px;right:16px" data-act="logoutAcc">ออกจากระบบ</button>`;
    for (const c of document.querySelectorAll('canvas[data-spr]')) { const cl = CLASS_BY_ID[c.dataset.spr]; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(charSprite(cl.id, cl.palette, 0), 0, 0, 36, 60); x.save(); x.translate(26, 34); x.rotate(0.6); x.drawImage(weaponSprite(cl.weapons[0]), -2, -8, 24, 12); x.restore(); }
  }
  onEnter(inst) {
    this.showScreen(null); this.closeAll();
    const lv = Array.isArray(inst.lv) ? inst.lv : null;
    this.banner(inst.name, inst.kind === 'field' && lv ? `Lv ${lv[0]}-${lv[1]}` : inst.kind === 'town' ? 'เขตปลอดภัย' : inst.pvp ? 'PvP' : 'Instance');
    $('#zone').textContent = `${inst.name}${lv ? ` (Lv ${lv[0]}-${lv[1]})` : ''}`;
    $('#leave-btn').style.display = inst.kind !== 'field' && inst.kind !== 'town' && !inst.pvp ? 'block' : 'none';
  }
  banner(title, sub) { const b = $('#banner'); b.innerHTML = `<div>${esc(title)}</div><small>${esc(sub || '')}</small>`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

  onMessage(m) {
    switch (m.t) {
      case 'authErr': $('#lerr').textContent = m.text; break;
      case 'chars': this.G.char = null; this.showScreen('charsel'); this.buildCharSel(m.list); break;
      case 'msg': this.chatLine('ระบบ', m.text, m.c, 'sys'); if (m.big || /⚠|🏆|🐉|⚔|✨/.test(m.text)) this.toast(m.text, m.c); else if (m.c === '#ff6a6a') this.toast(m.text, m.c, 1800); break;
      case 'chat': this.chatLine(m.ch === 'whisper' ? `${m.to ? '→' + m.to : m.from}` : m.from, m.text, { world: '#ffd84a', party: '#7fe8ff', guild: '#a0ffb0', whisper: '#ff9ad8' }[m.ch] || '#ffffff', m.ch); break;
      case 'invite': this.inviteBox(m); break;
      case 'market': this.ctx.market = m; this.renderPanel('market'); break;
      case 'guildRanking': this.ctx.granking = m; this.renderPanel('guild'); break;
      case 'dungeons': this.ctx.dungeons = m; this.renderPanel('dungeon'); break;
      case 'ladder': this.ctx.ladder = m; this.renderPanel('pvp'); break;
      case 'pvpStatus': this.ctx.pvpq = m.queues; this.renderPanel('pvp'); break;
      case 'quests': this.ctx.quests = m; this.renderPanel('quests'); break;
      case 'crafted': this.toast(`คราฟต์: ${m.item.name}`, RARITY_INFO[m.item.rarity].color); break;
      case 'gmState': this.ctx.gm = m; this.renderPanel('gm'); break;
    }
  }
  onChar() {
    const c = this.G.char; if (!c) return;
    this.stats = computeStats(c);
    this.G.auto.refreshSpecs(this.stats);
    this.renderHotbar();
    const cls = CLASS_BY_ID[c.classId];
    $('#pname').innerHTML = `${c.gm ? '<span style="color:var(--gold)">[GM]</span> ' : ''}${esc(c.name)} <small>Lv ${c.level}${c.mastery ? ` ✦${c.mastery}` : ''} • ${cls.th}</small>`;
    $('#mplabel').textContent = cls.resource.name;
    $('#gold').innerHTML = `💰 ${fmt(c.gold)} ทอง • 🏅 ${fmt(c.honor || 0)} Honor`;
    $('#ut-hp small').textContent = c.potions.hp || 0; $('#ut-mp small').textContent = c.potions.mp || 0;
    $('#gm-btn').hidden = !c.gm;
    const pc = $('#portrait').getContext('2d'); pc.imageSmoothingEnabled = false; pc.clearRect(0, 0, 44, 64); pc.drawImage(charSprite(cls.id, cls.palette, 0), 4, 2, 36, 60);
    this.renderParty(); this.renderTracker(); this.renderAutoBtn();
    for (const p of this.open) this.renderPanel(p);
  }
  onSnap(m) {
    const me = this.G.me; if (!me) return;
    $('#hpbar i').style.width = `${(me.hp / me.hpMax) * 100}%`; $('#hpbar span').textContent = `${fmt(me.hp)} / ${fmt(me.hpMax)}${me.sh ? ` (+${fmt(me.sh)})` : ''}`;
    $('#hpbar b').style.width = `${Math.min(100, (me.sh / me.hpMax) * 100)}%`;
    $('#mpbar i').style.width = `${(me.mp / me.mpMax) * 100}%`; $('#mpbar span').textContent = `${me.mp} / ${me.mpMax}`;
    const c = this.G.char; if (c) { const next = expToNext(me.lv); $('#expbar i').style.width = `${Math.min(100, (me.exp / next) * 100)}%`; $('#expbar span').textContent = `EXP ${((me.exp / next) * 100).toFixed(2)}%`; c.gold = me.gold; }
    $('#respawn').style.display = me.dead ? 'flex' : 'none';
    if (me.dead) $('#respawn-t').textContent = me.rs > 0 ? `ฟื้นได้ใน ${me.rs.toFixed(1)} วิ` : 'พร้อมฟื้นคืนชีพ';
    const o = this.G.obj || {};
    const boss = o.boss;
    $('#bossbar').style.display = boss ? 'block' : 'none';
    if (boss) { $('#bossbar i').style.width = `${boss.hp / 10}%`; $('#bossbar span').textContent = `${boss.world ? '🐉 ' : ''}${boss.n} — ${(boss.hp / 10).toFixed(1)}%`; }
    $('#objective').innerHTML = this.objectiveHtml(o);
    $('#tracker').classList.toggle('empty', !$('#objective').innerHTML && !$('#qtrack').innerHTML);
    // target frame
    const t = this.G.auto.target && this.G.units.get(this.G.auto.target);
    $('#targetframe').hidden = !t;
    if (t) { const m = t.meta || {}; $('#tf-name').innerHTML = `${m.b ? '👑 ' : m.e ? '★ ' : ''}${esc(m.n)} <small class="dim">Lv ${m.lv ?? '?'}</small>`; $('#targetframe .bar i').style.width = `${t.hp / 10}%`; $('#targetframe .bar span').textContent = `${(t.hp / 10).toFixed(0)}%`; $('#tf-tags').textContent = `${m.b ? 'บอส • ' : m.e ? 'Elite • ' : ''}${m.k === 'monster' ? 'มอนสเตอร์' : m.k === 'player' || m.k === 'bot' ? 'ผู้เล่นฝั่งตรงข้าม' : ''}${this.G.auto.on ? ' • ออโต้กำลังโจมตี' : ' • กำลังโจมตี (คลิกพื้นเพื่อยกเลิก)'}`; }
    const meu = this.G.units.get(this.G.you); if (meu) $('#coords').textContent = `${Math.floor(meu.x / TILE)}, ${Math.floor(meu.y / TILE)}`;
    const u = this.G.units.get(this.G.you);
    if (u) {
      const st = []; for (let i = 0; i < STATUS_BITS.length; i++) if (u.flags & (1 << i)) st.push(`<span style="background:${STATUS[STATUS_BITS[i]].color}" title="${STATUS[STATUS_BITS[i]].th}">${STATUS[STATUS_BITS[i]].th.slice(0, 2)}</span>`);
      $('#statuses').innerHTML = st.join('');
    }
    $('#ut-dodge small').textContent = me.dodge > 0 ? me.dodge.toFixed(1) : '';
    $('#ut-dodge').style.opacity = me.dodge > 0 ? 0.5 : 1;
  }
  objectiveHtml(o) {
    if (o.dg) return `<b>${esc(this.G.inst?.name)}</b><br>${o.type === 'abyss' ? `ชั้น ${o.floor} • Modifiers: ${(o.mods || []).join(', ')}` : o.type === 'hunt' || o.type === 'guildboss' ? 'ล่าบอส' : `คลื่น ${o.wave}/${o.waves}${o.phase === 'boss' ? ' • บอส!' : ''}`}<br>ศัตรูเหลือ ${o.left}${o.revives != null ? ` • ฟื้นคืนชีพ ${o.revives}` : ''}${o.t ? `<br>ปิดใน ${o.t} วิ` : ''}`;
    if (o.pvp === 'duel' || o.pvp === 'arena3') return `<b>${PVP_MODES[o.pvp].th}</b><br>${o.cd ? `เริ่มใน ${o.t}` : `เวลา ${o.t} วิ`}${o.over ? '<br>จบการแข่งขัน' : ''}`;
    if (o.pvp === 'bg10') return `<b>Battleground 10v10</b><br><span style="color:#4aa8ff">ฟ้า ${o.score[0]}</span> : <span style="color:#ff5a5a">${o.score[1]} แดง</span> / ${o.max}<br>${o.cd ? `เริ่มใน ${o.t}` : `เวลา ${Math.floor(o.t / 60)}:${String(o.t % 60).padStart(2, '0')}`}`;
    if (o.pvp === 'guildwar') return `<b>⚔ Guild War</b><br>บุก: ${esc(o.att)} | รับ: ${esc(o.def)}<br>ขั้น ${o.stage}/3: ${['', `ยึด Control Point (${o.hold}/45)`, 'ทำลาย Guardian Crystal', `ยึด Core ${o.core}%`][o.stage]}<br>${o.cd ? `เริ่มใน ${o.t}` : `เวลา ${Math.floor(o.t / 60)}:${String(o.t % 60).padStart(2, '0')}`}`;
    return '';
  }
  frame() {
    const me = this.G.me; if (!me || !this.G.char) return;
    const els = document.querySelectorAll('#hotbar .slot, #ultslot');
    els.forEach((el) => {
      const i = el.dataset.slot === 'u' ? HOTBAR_SIZE : +el.dataset.slot;
      const cd = me.cds[i]; if (!el.querySelector('.cd')) return; const ov = el.querySelector('.cd'); const tx = el.querySelector('.cdt');
      if (!cd) { ov.style.height = '0'; tx.textContent = ''; el.classList.remove('nomp'); return; }
      const [rem, total, ch, cost] = cd;
      ov.style.height = rem > 0 ? `${Math.min(100, (rem / total) * 100)}%` : '0'; tx.textContent = rem > 0.05 ? rem.toFixed(rem < 2 ? 1 : 0) : (ch != null ? ch : '');
      el.classList.toggle('nomp', me.mp < cost);
    });
    if (this.G.L) this.r.drawMinimap($('#minimap'));
    if (this.open.has('passives')) this.drawTree();
    if (this.open.has('map')) this.drawBigMap();
  }

  // ---------------- HUD pieces ----------------
  renderHotbar() {
    const c = this.G.char; const keyName = (i) => `${i >= 20 ? 'Alt+' : i >= 10 ? '⇧' : ''}${(i % 10 + 1) % 10}`;
    const hb = $('#hotbar');
    hb.innerHTML = Array.from({ length: HOTBAR_SIZE }, (_, i) => { const id = c.build.hotbar[i]; const s = id && getSkill(id); return `<div class="slot r${Math.floor(i / 10)}" data-slot="${i}" draggable="${s ? 'true' : 'false'}" data-tip="skill:${id || ''}" data-act="slotClick">${s ? this.skIcon(s) : ''}<div class="cd"></div><div class="cdt"></div><kbd>${keyName(i)}</kbd></div>`; }).join('');
    // rows: top = Alt row, middle = Shift row, bottom = main row (closest to the bottom edge)
    hb.style.gridTemplateAreas = 'none';
    [...hb.children].forEach((el, i) => { el.style.gridRow = this.rows === 1 ? '1' : String(3 - Math.floor(i / 10)); el.style.gridColumn = String((i % 10) + 1); });
    hb.classList.toggle('collapsed', this.rows === 1);
    $('#ab-toggle').textContent = this.rows === 1 ? '▲ ขยาย (3 แถว)' : '▼ ย่อ (1 แถว)';
    const u = c.build.ult && getSkill(c.build.ult);
    $('#ultslot').innerHTML = `${u ? this.skIcon(u) : '<div class="sk" style="--c:#2a2440;font-size:11px">ULT</div>'}<div class="cd"></div><div class="cdt"></div><kbd>R</kbd>`;
    $('#ultslot').dataset.tip = 'skill:' + (c.build.ult || ''); $('#ultslot').draggable = !!u; $('#ultslot').dataset.act = 'slotClick';
  }
  renderAutoBtn() { $('#ut-auto')?.classList.toggle('on', !!this.G.auto?.on); }
  renderTracker() {
    const c = this.G.char; const act = Object.entries(c.quests?.active || {});
    $('#qtrack').innerHTML = act.length ? `<h5>📜 เควสต์ที่รับ (${act.length})</h5>` + act.map(([id, n]) => { const q = QUESTS[id]; if (!q) return ''; const done = n >= q.count; return `<div class="qt ${done ? 'done' : ''}">${esc(q.name)} <b>${n}/${q.count}</b>${done ? ' ✔ ส่งได้' : ''}<div class="mbar"><i style="width:${Math.min(100, (n / q.count) * 100)}%"></i></div></div>`; }).join('') : '';
  }
  slotName(i) { return `${i >= 20 ? 'A' : i >= 10 ? '⇧' : ''}${(i % 10 + 1) % 10}`; }
  skIcon(s, big) { const col = ELEMENT_INFO[s.el].color; return `<div class="sk ${big ? 'big' : ''} ${s.kind === 'ultimate' ? 'u' : ''}" style="--c:${col}">${BEH_GLYPH[s.behavior]}</div>`; }
  renderParty() {
    const p = this.G.char?.party;
    $('#party').innerHTML = p ? p.members.filter((m) => m.id !== this.G.char.id).map((m) => { const u = m.uid && this.G.units.get(m.uid); return `<div class="pm ${m.online ? '' : 'off'}"><b>${esc(m.name)}</b> <small>Lv${m.lv || '?'} ${m.cls ? CLASS_BY_ID[m.cls].name : ''}</small>${u ? `<div class="mbar"><i style="width:${u.hp / 10}%"></i></div>` : `<small class="dim">${esc(m.map || 'offline')}</small>`}</div>`; }).join('') : '';
  }
  toast(text, color = '#ffe9a0', ms = 3500) { const d = document.createElement('div'); d.className = 'toast'; d.style.color = color; d.textContent = text; this.toasts.appendChild(d); setTimeout(() => d.remove(), ms); while (this.toasts.children.length > 4) this.toasts.firstChild.remove(); }
  chatLine(from, text, color, ch) { const log = $('#chat-log'); const d = document.createElement('div'); d.dataset.ch = ch === 'say' || ch === 'whisper' ? 'all' : ch; if (this.chatTab && this.chatTab !== 'all' && d.dataset.ch !== this.chatTab) d.hidden = true; d.innerHTML = `<b style="color:${color}">[${{ say: 'พูด', world: 'โลก', party: 'ปาร์ตี้', guild: 'กิลด์', whisper: 'กระซิบ', sys: '!' }[ch] || ch}] ${esc(from)}:</b> <span style="color:${ch === 'sys' ? color : '#eee'}">${esc(text)}</span>`; log.appendChild(d); while (log.children.length > 120) log.firstChild.remove(); log.scrollTop = log.scrollHeight; }
  typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); }
  focusChat() { $('#chat-input').focus(); }
  blurChat() { document.activeElement?.blur(); }
  sendChat() {
    const inp = $('#chat-input'); let text = inp.value.trim(); inp.value = ''; inp.blur(); if (!text) return;
    let ch = $('#chat-ch').value, to;
    const mm = text.match(/^\/(w|p|g|s|world)\s+(.*)$/i);
    if (mm) { const k = mm[1].toLowerCase(); if (k === 'w') { const sp = mm[2].indexOf(' '); to = mm[2].slice(0, sp); text = mm[2].slice(sp + 1); ch = 'whisper'; } else { ch = { p: 'party', g: 'guild', s: 'say', world: 'world' }[k]; text = mm[2]; } }
    this.send({ t: 'chat', ch, text, to });
  }
  inviteBox(m) {
    const d = document.createElement('div'); d.className = 'invite';
    d.innerHTML = `${m.kind === 'party' ? `${esc(m.from)} เชิญคุณเข้าปาร์ตี้` : `${esc(m.from)} เชิญคุณเข้ากิลด์ ${esc(m.guild)}`}<div class="row"><button data-act="${m.kind}Accept">ตอบรับ</button><button class="alt" data-act="closeInvite">ปฏิเสธ</button></div>`;
    $('#invites').appendChild(d); setTimeout(() => d.remove(), 30000);
  }

  // in-page dialogs (window.confirm/prompt are blocked inside sandboxed viewers)
  ask(text, opts = {}) {
    return new Promise((res) => {
      const d = document.createElement('div'); d.className = 'modal';
      d.innerHTML = `<div class="modal-box"><p>${esc(text)}</p>${opts.input != null ? `<input id="modal-in" value="${esc(opts.input)}" ${opts.number ? 'type="number"' : ''}>` : ''}${opts.choices ? `<select id="modal-in">${opts.choices.map((c) => `<option value="${esc(c[0])}">${esc(c[1])}</option>`).join('')}</select>` : ''}<div class="row"><button id="modal-ok">ตกลง</button><button class="alt" id="modal-no">ยกเลิก</button></div></div>`;
      document.body.appendChild(d); const inp = d.querySelector('#modal-in'); (inp || d.querySelector('#modal-ok')).focus();
      const done = (v) => { d.remove(); res(v); };
      d.querySelector('#modal-ok').onclick = () => done(inp ? inp.value : true);
      d.querySelector('#modal-no').onclick = () => done(null);
      d.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.code === 'Enter') done(inp ? inp.value : true); if (e.code === 'Escape') done(null); });
    });
  }
  // ---------------- windows ----------------
  win(id, title, html, w = 560) {
    if (HELP[id]) html = `<div class="help-bar">ℹ️ ${HELP[id]}</div>` + html;
    w = Math.min(w, window.innerWidth - 20);
    let el = document.getElementById('w-' + id);
    if (!el) {
      el = document.createElement('div'); el.className = 'win'; el.id = 'w-' + id; el.style.width = w + 'px';
      el.style.left = Math.max(10, (window.innerWidth - w) / 2 + (this.open.size * 24) % 120) + 'px'; el.style.top = 70 + (this.open.size * 24) % 120 + 'px';
      el.innerHTML = `<div class="wt"><span></span><button data-act="close" data-id="${id}">✕</button></div><div class="wb"></div>`;
      $('#windows').appendChild(el); this.drag(el);
    }
    el.querySelector('.wt span').textContent = title;
    const body = el.querySelector('.wb'); const sc = body.scrollTop; body.innerHTML = html; body.scrollTop = sc;
    el.style.zIndex = ++UI.z;
    return el;
  }
  drag(el) { const h = el.querySelector('.wt'); h.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; const ox = e.clientX - el.offsetLeft, oy = e.clientY - el.offsetTop; el.style.zIndex = ++UI.z; const mv = (ev) => { el.style.left = ev.clientX - ox + 'px'; el.style.top = Math.max(0, ev.clientY - oy) + 'px'; }; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); }); }
  toggle(p) { if (this.open.has(p)) this.close(p); else this.openPanel(p); }
  openPanel(p, ctx) { if (ctx) Object.assign(this.ctx, ctx); this.open.add(p); this.renderPanel(p); this.onOpen(p); }
  onOpen(p) {
    if (p === 'market') this.send({ t: 'market', op: 'browse' });
    if (p === 'dungeon') this.send({ t: 'dungeon', op: 'list' });
    if (p === 'quests') this.send({ t: 'quest', op: 'list' });
    if (p === 'pvp') { this.send({ t: 'pvp', op: 'status' }); this.send({ t: 'pvp', op: 'ladder', mode: this.ctx.ladderMode || 'duel' }); }
    if (p === 'guild' && !this.G.char?.guild) this.send({ t: 'guild', op: 'ranking' });
    if (p === 'gm') this.send({ t: 'gm', op: 'state' });
  }
  close(p) { this.open.delete(p); document.getElementById('w-' + p)?.remove(); if (p === 'passives') this.treeCv = null; if (p === 'map') this.mapCv = null; }
  closeAll() { for (const p of [...this.open]) this.close(p); this.hideTip(); $('#ctxmenu').style.display = 'none'; }
  closeTop() { let top = null, z = -1; for (const p of this.open) { const el = document.getElementById('w-' + p); if (el && +el.style.zIndex > z) { z = +el.style.zIndex; top = p; } } if (top) { this.close(top); this.hideTip(); return true; } return false; }
  hotkey(code) { const map = { KeyI: 'inventory', KeyC: 'character', KeyK: 'skills', KeyP: 'passives', KeyB: 'builds', KeyG: 'guild', KeyO: 'party', KeyJ: 'quests', KeyV: 'pvp', KeyM: 'map', KeyH: 'help', KeyN: 'runes', KeyY: 'auto' }; if (map[code]) this.toggle(map[code]); }
  interact() { const me = this.G.units.get(this.G.you); if (!me) return; const n = this.G.npcs.map((n) => [n, Math.hypot(n.x - me.x, n.y - me.y)]).filter(([, d]) => d < 120).sort((a, b) => a[1] - b[1])[0]; if (n) this.openNpc(n[0]); }
  openNpc(n) {
    const map = { shop: ['shop', 'inventory'], smith: ['smith', 'inventory'], stash: ['stash', 'inventory'], market: ['market', 'inventory'], guild: ['guild'], arena: ['pvp'], dungeon: ['dungeon'], teleport: ['teleport'], quest: ['quests'], build: ['builds', 'skills'] }[n.type] || [];
    this.ctx.npc = n.type;
    for (const p of map) this.openPanel(p);
  }

  renderPanel(p) {
    if (!this.open.has(p) || !this.G.char) return;
    const fn = this['p_' + p]; if (fn) fn.call(this);
  }

  // ---- Inventory ----
  itemIcon(it, ref, extra = '') {
    if (!it) return `<div class="it empty" ${extra}></div>`;
    const col = RARITY_INFO[it.rarity]?.color || '#ccc';
    return `<div class="it" style="--c:${col}" data-tip="item:${ref}" data-act="item" data-ref="${ref}" ${extra}><span>${SLOT_ICON[it.type === 'card' ? 'card' : it.slot] || '?'}</span>${it.refine ? `<em>+${it.refine}</em>` : ''}${it.locked ? '<i>🔒</i>' : ''}${it.dur != null && it.dur < 30 ? '<u>!</u>' : ''}</div>`;
  }
  p_inventory() {
    const c = this.G.char;
    const eq = EQUIP_SLOTS.map((s) => `<div class="eqs"><small>${SLOT_TH[s]}</small>${this.itemIcon(c.equip[s], 'equip:' + s)}</div>`).join('');
    const inv = Array.from({ length: 60 }, (_, i) => this.itemIcon(c.inv[i], 'inv:' + i)).join('');
    const mats = Object.entries(MATERIALS).map(([k, m]) => `<span title="${m.name}" style="color:${m.color}">${m.th} ${c.materials[k] || 0}</span>`).join(' • ');
    const mode = { shop: 'คลิกไอเทม → ขาย', stash: 'คลิกไอเทม → ฝากคลัง', market: 'คลิกไอเทม → วางขาย', smith: 'คลิกไอเทม → ตีบวก/Reroll' }[this.ctx.npc] || 'คลิกไอเทมเพื่อดูคำสั่ง';
    this.win('inventory', 'กระเป๋า & อุปกรณ์ [I]', `<div class="inv-wrap"><div class="eq-grid">${eq}</div><div><div class="inv-grid">${inv}</div>
      <div class="row small"><span>💰 ${fmt(c.gold)}</span><span>❤ ${c.potions.hp || 0} 💧 ${c.potions.mp || 0}</span><span class="dim">${mode}</span><button class="mini" data-act="sortInv">เรียง</button><button class="mini alt" data-act="salvageJunk">แยกของ Common/Magic</button></div>
      <div class="mats">${mats}</div></div></div>`, 720);
  }
  p_character() {
    const c = this.G.char, d = c.derived;
    const rows = [['HP', d.hpMax], ['ทรัพยากร', d.mpMax], ['พลังโจมตี', d.atk], ['เกราะ', d.armor], ['คริติคอล', d.crit + '%'], ['ดาเมจคริ', d.critDmg + '%'], ['ความเร็วโจมตี', d.atkSpd + '%'], ['ลดคูลดาวน์', d.cdr + '%'], ['ความเร็ว', d.move], ['ดูดเลือด', d.leech + '%'], ['หลบ', d.dodge + '%'], ['บล็อก', d.block + '%'], ['ฟื้น HP/วิ', d.hpRegen], ['ดาเมจ', '+' + d.dmgAll + '%'], ['โอกาสของดี', d.magicFind + '%']];
    const res = Object.entries(d.res).filter(([k]) => k !== 'physical').map(([k, v]) => `<span style="color:${ELEMENT_INFO[k].color}">${ELEMENT_INFO[k].th} ${v}%</span>`).join(' ');
    const dmg = Object.entries(d.dmgEl).filter(([, v]) => v).map(([k, v]) => `<span style="color:${ELEMENT_INFO[k].color}">${ELEMENT_INFO[k].th} +${v}%</span>`).join(' ');
    this.win('character', `ตัวละคร [C] — ${c.name}`, `<div class="stat-grid">${rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <p><b>ต้านทาน:</b> ${res}</p><p><b>ดาเมจธาตุ:</b> ${dmg || '-'}</p>
      <p><b>Keystones:</b> ${d.ks.join(', ') || '-'}</p><p><b>Legendary/Mythic:</b> ${d.leg.map((l) => LEGENDARIES[l]?.name || MYTHICS[l]?.name || l).join(', ') || '-'}</p><p><b>Set Bonus:</b> ${d.setBonuses.join(', ') || '-'}</p>
      <p><b>PvP:</b> Duel ${c.rating.duel} • Arena ${c.rating.arena3} • ชนะ ${c.pvpStats.wins} แพ้ ${c.pvpStats.losses} • Honor ${c.honor || 0}</p><p><b>Abyss สูงสุด:</b> ชั้น ${c.abyssBest || 0}</p>`, 480);
  }

  // ---- Skills & Runes ----
  p_skills() {
    const c = this.G.char; const cls = CLASS_BY_ID[c.classId]; const all = classSkills(c.classId);
    const tabs = [...cls.schools.map((s) => s.noun), 'Ultimate'];
    const list = this.skillTab < 9 ? all.filter((s) => s.school === cls.schools[this.skillTab].id) : all.filter((s) => s.kind === 'ultimate');
    const spent = Object.values(c.skillRanks).reduce((a, r) => a + r - 1, 0), total = c.level - 1 + c.mastery;
    const sel = this.selSkill && getSkill(this.selSkill);
    let detail = '<p class="dim">เลือกสกิลทางซ้ายเพื่อดูรายละเอียด ใส่ช่อง ฝังรูน และอัปเกรด</p>';
    if (sel) {
      const rank = c.skillRanks[sel.id] || 1; const runes = c.build.runes[sel.id] || [];
      const spec = resolveSkill(sel, { rank, runes, stats: this.stats, ks: this.stats.ks, leg: this.stats.leg });
      const slots = runeSlotsForRank(rank); const locked = sel.unlock > c.level;
      const usage = {}; for (const l of Object.values(c.build.runes)) for (const r of l) if (r) usage[r] = (usage[r] || 0) + 1;
      const owned = RUNES.filter((r) => (c.runes[r.id] || 0) > 0 && runeFits(r, sel.behavior));
      detail = `<div class="sk-head">${this.skIcon(sel, 1)}<div><h3>${esc(sel.name)}</h3><small>${sel.kind === 'ultimate' ? 'ULTIMATE' : 'ACTIVE'} • ${BEHAVIOR[sel.behavior].th} • <span style="color:${ELEMENT_INFO[spec.el].color}">${ELEMENT_INFO[spec.el].th}</span> • ปลดล็อก Lv ${sel.unlock}</small></div></div>
        <p>${esc(sel.desc)}</p>
        <div class="stat-grid">${[['Rank', `${rank}/${MAX_SKILL_RANK}`], ['ดาเมจ', spec.dmg ? Math.round(spec.dmg) + '%' : '-'], ['คูลดาวน์', spec.cd.toFixed(1) + 'วิ'], ['ใช้', Math.round(spec.cost) + ' ' + cls.resource.name], spec.radius ? ['รัศมี', Math.round(spec.radius)] : null, spec.range ? ['ระยะ', Math.round(spec.range)] : null, spec.count > 1 ? ['จำนวน', spec.count] : null, spec.chain ? ['กระโดด', spec.chain] : null, spec.pierce ? ['ทะลุ', spec.pierce] : null, spec.heal ? ['ฮีล', Math.round(spec.heal) + '%'] : null, spec.charges > 1 ? ['ชาร์จ', spec.charges] : null, spec.echo ? ['ซ้ำ', spec.echo] : null].filter(Boolean).map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
        ${locked ? `<p class="err">ต้องการเลเวล ${sel.unlock}</p>` : `${sel.kind === 'ultimate' ? `<div class="row"><button data-act="equipSkill" data-slot="u" data-id="${sel.id}">${c.build.ult === sel.id ? '✔ ใส่อยู่ช่อง R' : 'ใส่ช่องอัลติเมท [R]'}</button>` : `<h4>ใส่ลง Hotbar <small class="dim">(คลิกช่อง หรือลากสกิลจากรายการไปวางที่ Hotbar)</small></h4>
        <div class="slotpick">${Array.from({ length: HOTBAR_SIZE }, (_, i) => { const id = c.build.hotbar[i]; return `<div class="${id === sel.id ? 'me' : id ? 'used' : ''}" data-act="equipSkill" data-slot="${i}" data-id="${sel.id}" title="${id ? esc(getSkill(id)?.name) : 'ว่าง'}">${this.slotName(i)}</div>`; }).join('')}</div>
        <div class="row"><button class="mini" data-act="equipFree" data-id="${sel.id}">ใส่ช่องว่างถัดไป</button>`}
        <button class="mini gold" data-act="rankSkill" data-id="${sel.id}" ${rank >= MAX_SKILL_RANK || spent >= total ? 'disabled' : ''}>Rank +1 (ใช้ 1 แต้ม)</button></div>
        <h4>Support Runes (${slots} ช่อง • เพิ่มที่ Rank 8 / 16)</h4><div class="rune-slots">${Array.from({ length: 3 }, (_, i) => { const r = runes[i] && RUNE_BY_ID[runes[i]]; if (i >= slots) return `<div class="rs lock">🔒 Rank ${i === 1 ? 8 : 16}</div>`; return `<div class="rs ${r ? 'on' : ''}">${r ? `<b data-tip="rune:${r.id}">${r.name}</b><button class="mini alt" data-act="unsocketRune" data-id="${sel.id}" data-idx="${i}">ถอด</button>` : `<select data-act-change="socketRune" data-id="${sel.id}" data-idx="${i}"><option value="">— เลือกรูน —</option>${owned.map((o) => `<option value="${o.id}" ${(usage[o.id] || 0) >= c.runes[o.id] ? 'disabled' : ''}>${o.name} (${(c.runes[o.id] || 0) - (usage[o.id] || 0)}/${c.runes[o.id]})</option>`).join('')}</select>`}</div>`; }).join('')}</div>
        ${spec.runes.length ? `<p class="dim">รูนที่ทำงาน: ${spec.runes.map((r) => RUNE_BY_ID[r].th).join(' / ')}</p>` : ''}`}`;
    }
    this.win('skills', `สกิล [K] — แต้มสกิล ${total - spent}/${total}`, `<div class="tabs">${tabs.map((t, i) => `<button class="${i === this.skillTab ? 'on' : ''}" data-act="skillTab" data-i="${i}">${esc(t)}</button>`).join('')}</div>
      <div class="sk-wrap"><div class="sk-list">${list.map((s) => `<div class="sk-row ${s.id === this.selSkill ? 'sel' : ''} ${s.unlock > c.level ? 'locked' : ''}" data-act="selSkill" data-id="${s.id}" ${s.unlock <= c.level ? `draggable="true" data-drag-skill="${s.id}"` : ''} title="${s.unlock <= c.level ? 'ลากไปวางที่ Hotbar ได้' : 'ยังไม่ปลดล็อก'}">${this.skIcon(s)}<div><b>${esc(s.name)}</b><small>Lv${s.unlock} • R${c.skillRanks[s.id] || 1}${(c.build.runes[s.id] || []).filter(Boolean).length ? ' • ◆' + (c.build.runes[s.id] || []).filter(Boolean).length : ''}</small></div>${c.build.ult === s.id ? '<em>R</em>' : c.build.hotbar.includes(s.id) ? `<em>${this.slotName(c.build.hotbar.indexOf(s.id))}</em>` : ''}</div>`).join('')}</div><div class="sk-detail">${detail}</div></div>`, 820);
  }
  p_runes() {
    const c = this.G.char; const usage = {}; for (const l of Object.values(c.build.runes)) for (const r of l) if (r) usage[r] = (usage[r] || 0) + 1;
    this.ctx.fuse = this.ctx.fuse || [];
    this.win('runes', 'Support Runes [N] — ระบบปรับแต่งสกิล', `<p class="dim">รูนเปลี่ยนพฤติกรรมของสกิล (ไม่ใช่แค่ดาเมจ) ฝังได้ที่หน้าสกิล [K] • ฟิวส์ 3 รูน → รูนระดับสูงขึ้น</p>
      <div class="rune-list">${RUNES.map((r) => `<div class="rune ${c.runes[r.id] ? '' : 'none'}" data-tip="rune:${r.id}" data-act="fusePick" data-id="${r.id}"><b>${r.name}</b> <small>T${r.tier}</small><span>${c.runes[r.id] || 0}${usage[r.id] ? ` (ใช้ ${usage[r.id]})` : ''}</span><p>${r.th}</p></div>`).join('')}</div>
      <div class="row">ฟิวส์: ${this.ctx.fuse.map((id) => RUNE_BY_ID[id].name).join(' + ') || '(คลิกรูน 3 อัน)'} <button data-act="fuse" ${this.ctx.fuse.length === 3 ? '' : 'disabled'}>ฟิวส์</button><button class="alt" data-act="fuseClear">ล้าง</button></div>`, 760);
  }
  // ---- Passive tree ----
  p_passives() {
    const c = this.G.char; const tree = buildPassiveTree(c.classId);
    const pts = passivePointsFor(c.level, c.mastery) - spentPoints(c.build.passives);
    const el = this.win('passives', `Passive Skill Tree [P] — แต้มว่าง ${pts}`, `<div class="legend">${tree.branches.map((b) => `<span style="color:${b.color}">● ${b.th}</span>`).join(' ')}</div><canvas id="treecv" width="860" height="560"></canvas><p class="dim">ลากเพื่อเลื่อน • ล้อเมาส์ซูม • คลิกโหนดเพื่อลงแต้ม • ◆ = Keystone เปลี่ยนวิธีเล่น</p>`, 890);
    const cv = el.querySelector('#treecv'); if (this.treeCv !== cv) { this.treeCv = cv; this.treeView = this.treeView || { x: 430, y: 280, z: 0.85 }; this.bindTree(cv, tree); }
  }
  bindTree(cv, tree) {
    let drag = null;
    const hit = (e) => { const r = cv.getBoundingClientRect(); const v = this.treeView; const wx = (e.clientX - r.left - v.x) / v.z, wy = (e.clientY - r.top - v.y) / v.z; return tree.nodes.find((n) => Math.hypot(n.x - wx, n.y - wy) < (n.keystone ? 14 : 10) + 2); };
    cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: this.treeView.x, vy: this.treeView.y, moved: false }; });
    cv.addEventListener('mousemove', (e) => { if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; this.treeView.x = drag.vx + dx; this.treeView.y = drag.vy + dy; } const n = hit(e); this.treeHover = n; if (n) { this.showTip(this.nodeTip(n), e.clientX, e.clientY); } else this.hideTip(); });
    cv.addEventListener('mouseup', (e) => { if (drag && !drag.moved) { const n = hit(e); if (n) this.send({ t: 'build', op: 'allocPassive', node: n.id }); } drag = null; });
    cv.addEventListener('mouseleave', () => { drag = null; this.hideTip(); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const v = this.treeView; const r = cv.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const z = Math.max(0.4, Math.min(2, v.z * (e.deltaY < 0 ? 1.1 : 0.9))); v.x = mx - ((mx - v.x) * z) / v.z; v.y = my - ((my - v.y) * z) / v.z; v.z = z; });
  }
  nodeTip(n) { const a = this.G.char.build.passives[n.id] || 0; return `<b style="color:${n.color}">${esc(n.name)}</b><br><small>${n.branch} • ${a}/${n.ranks}${n.cond ? ` • ใช้ได้กับอาวุธ ${n.cond}` : ''}</small><br>${esc(n.desc)}`; }
  drawTree() {
    const cv = this.treeCv; if (!cv || !document.body.contains(cv)) return;
    const c = this.G.char; const tree = buildPassiveTree(c.classId); const A = c.build.passives; const v = this.treeView;
    const x = cv.getContext('2d'); x.fillStyle = '#0d0b16'; x.fillRect(0, 0, cv.width, cv.height);
    x.save(); x.translate(v.x, v.y); x.scale(v.z, v.z);
    for (const n of tree.nodes) for (const r of n.req) { const p = tree.byId[r]; if (!p) continue; x.strokeStyle = A[n.id] && A[r] ? n.color : '#3a3448'; x.lineWidth = A[n.id] && A[r] ? 3 : 2; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(n.x, n.y); x.stroke(); }
    for (const n of tree.nodes) {
      const a = A[n.id] || 0; const reach = n.id === 'root' || n.req.some((r) => r === 'root' || A[r]);
      const R = n.id === 'root' ? 16 : n.keystone ? 14 : 10;
      x.fillStyle = a ? n.color || '#fff' : reach ? '#2a2638' : '#16131f'; x.strokeStyle = a ? '#fff' : reach ? n.color || '#888' : '#3a3448'; x.lineWidth = this.treeHover === n ? 3 : 2;
      x.beginPath(); if (n.keystone) { x.moveTo(n.x, n.y - R); x.lineTo(n.x + R, n.y); x.lineTo(n.x, n.y + R); x.lineTo(n.x - R, n.y); x.closePath(); } else x.arc(n.x, n.y, R, 0, 7);
      x.fill(); x.stroke();
      if (n.ranks > 1) { x.fillStyle = a ? '#000' : '#aaa'; x.font = 'bold 9px Tahoma'; x.textAlign = 'center'; x.fillText(`${a}/${n.ranks}`, n.x, n.y + 3); }
      if (v.z > 0.7 && (n.keystone || n.id === 'root')) { x.fillStyle = '#ddd'; x.font = '10px Tahoma'; x.textAlign = 'center'; x.fillText(n.name.replace(' (Keystone)', ''), n.x, n.y + R + 12); }
    }
    x.restore();
  }
  // ---- Build presets ----
  p_builds() {
    const c = this.G.char; const cost = c.level < 20 ? 0 : ECONOMY.resetBuild(c.level);
    const ps = Array.from({ length: 6 }, (_, i) => c.presets[i]);
    this.win('builds', 'Build Presets [B] — สลับชุด PvE / PvP', `<div class="presets">${ps.map((p, i) => `<div class="preset ${p ? '' : 'empty'}"><b>${p ? esc(p.name) : `ช่อง ${i + 1} (ว่าง)`}</b>${p ? `<span class="tag ${p.tag}">${p.tag}</span><small>${p.hotbar.filter(Boolean).length} สกิล • ${Object.keys(p.passives).length - 1} โหนด • ${Object.values(p.runes).flat().filter(Boolean).length} รูน</small>` : ''}
      <div class="row"><input id="pn${i}" placeholder="ชื่อ" value="${p ? esc(p.name) : ''}" maxlength="24"><select id="pt${i}"><option ${p?.tag === 'PvE' ? 'selected' : ''}>PvE</option><option ${p?.tag === 'PvP' ? 'selected' : ''}>PvP</option></select>
      <button class="mini" data-act="savePreset" data-i="${i}">บันทึก Build ปัจจุบัน</button>${p ? `<button class="mini gold" data-act="loadPreset" data-i="${i}">โหลด</button><button class="mini alt" data-act="delPreset" data-i="${i}">ลบ</button>` : ''}</div></div>`).join('')}</div>
      <h4>Reset Build (ใช้ทรัพยากรในเกม • ฟรีก่อน Lv20)</h4><div class="row"><button data-act="reset" data-what="passives">รีเซ็ต Passive (${cost})</button><button data-act="reset" data-what="skills">รีเซ็ต Rank สกิล (${cost})</button><button data-act="reset" data-what="all">รีเซ็ตทั้งหมด (${Math.round(cost * 1.5)})</button></div>`, 640);
  }
  // ---- Quests ----
  p_quests() {
    const q = this.ctx.quests; const c = this.G.char;
    this.win('quests', 'เควสต์ [J]', !q ? 'กำลังโหลด...' : `<div class="qlist">${q.list.map((x) => { const prog = c.quests.active[x.id]; return `<div class="q ${prog != null ? 'act' : ''}"><b>${esc(x.name)}</b> <small>Lv${x.lv} • ${esc(MAPS[x.map]?.name)}</small><br><small>รางวัล: ${fmt(x.reward.exp)} EXP • ${fmt(x.reward.gold)} ทอง${x.reward.rune ? ` • รูน ${RUNE_BY_ID[x.reward.rune].name}` : ''}</small>
      <div class="row">${prog == null ? `<button class="mini" data-act="quest" data-op="accept" data-id="${x.id}">รับเควสต์</button>` : `<span>${prog}/${x.count}</span>${prog >= x.count ? `<button class="mini gold" data-act="quest" data-op="turnin" data-id="${x.id}">ส่ง</button>` : ''}<button class="mini alt" data-act="quest" data-op="abandon" data-id="${x.id}">ยกเลิก</button>`}</div></div>`; }).join('') || '<p class="dim">ไม่มีเควสต์ในภูมิภาคนี้</p>'}</div>`, 560);
  }
  // ---- Party ----
  p_party() {
    const p = this.G.char.party;
    this.win('party', 'ปาร์ตี้ [O] (สูงสุด 8)', `<div class="row"><input id="pinv" placeholder="ชื่อผู้เล่น"><button data-act="partyInvite">เชิญ</button>${p ? '<button class="alt" data-act="partyLeave">ออกจากปาร์ตี้</button>' : ''}</div>
      ${p ? `<div class="mlist">${p.members.map((m) => `<div><b>${m.id === p.leader ? '👑 ' : ''}${esc(m.name)}</b> <small>Lv${m.lv || '?'} ${m.cls ? CLASS_BY_ID[m.cls].name : ''} • ${m.online ? esc(m.map) : 'ออฟไลน์'}</small>${p.leader === this.G.char.id && m.id !== p.leader ? `<button class="mini alt" data-act="partyKick" data-id="${m.id}">เตะ</button>` : ''}</div>`).join('')}</div>` : '<p class="dim">ยังไม่มีปาร์ตี้ — เชิญเพื่อนเพื่อรับ EXP/ของร่วมกัน (โบนัส EXP +15%/คน) และลงดันเจี้ยน</p>'}
      <p class="dim">แชทปาร์ตี้: พิมพ์ /p ข้อความ • กระซิบ: /w ชื่อ ข้อความ</p>`, 480);
  }
  // ---- Guild ----
  p_guild() {
    const g = this.G.char.guild; this.ctx.gtab = this.ctx.gtab || 'info';
    if (!g) {
      const r = this.ctx.granking;
      return this.win('guild', 'กิลด์ [G]', `<h4>ก่อตั้งกิลด์ (Lv20+, ${fmt(ECONOMY.guildCreate)} ทอง)</h4><div class="row"><input id="gname" placeholder="ชื่อกิลด์" maxlength="20"><input id="gtag" placeholder="ตัวย่อ" maxlength="4" style="width:70px"></div>
        <div class="row">รูปตรา <select id="gshape"><option value="shield">โล่</option><option value="circle">วงกลม</option><option value="diamond">เพชร</option><option value="star">ดาว</option></select> สัญลักษณ์ <select id="gicon"><option value="sword">⚔</option><option value="skull">☠</option><option value="crown">♛</option><option value="dragon">🐉</option><option value="sun">☀</option><option value="moon">☾</option></select> สี <input id="gcolor" type="color" value="#d83a2a"><button data-act="guildCreate">ก่อตั้ง</button></div>
        <h4>อันดับกิลด์ ฤดูกาล ${r?.season || ''}</h4>${this.rankTable(r)}`, 600);
    }
    const me = g.members.find((m) => m.id === this.G.char.id); const lead = me?.rank === 'leader', off = lead || me?.rank === 'officer';
    const tabs = { info: 'ข้อมูล', members: 'สมาชิก', storage: 'คลัง', skills: 'สกิลกิลด์', quests: 'เควสต์', war: 'สงคราม', log: 'บันทึก', ranking: 'อันดับ' };
    let body = '';
    const t = this.ctx.gtab;
    if (t === 'info') body = `<div class="ginfo"><canvas id="gemb" width="64" height="64"></canvas><div><h2>[${esc(g.tag)}] ${esc(g.name)}</h2>Level ${g.level} <div class="bar"><i style="width:${(g.exp / g.expNext) * 100}%"></i><span>${fmt(g.exp)}/${fmt(g.expNext)}</span></div>เงินกิลด์ ${fmt(g.funds)} • สมาชิก ${g.members.length}/${g.maxMembers} • War Rating ${g.warRating} • ชนะสงคราม ${g.warWins} • คะแนนฤดูกาล ${g.seasonPts || 0}</div></div>
      <p>📜 ${esc(g.notice || 'ไม่มีประกาศ')}</p>${lead ? `<div class="row"><input id="gnotice" placeholder="ประกาศกิลด์" maxlength="300"><button class="mini" data-act="guildNotice">ตั้งประกาศ</button></div>` : ''}
      <div class="row"><input id="gdon" type="number" placeholder="ทอง" min="1"><button class="mini" data-act="guildDonate">บริจาค (ได้ Contribution + Guild EXP)</button></div>
      <p>ของตกแต่งฤดูกาล: ${(g.cosmetics || []).join(', ') || '-'}</p><p class="dim">Guild Alliance: เร็วๆ นี้</p>
      <div class="row">${off ? '<button data-act="guildBoss">เรียก Guild Boss (30,000 เงินกิลด์ • วันละครั้ง)</button>' : ''}<button class="alt" data-act="guildLeave">ออกจากกิลด์</button></div>`;
    if (t === 'members') body = `<div class="row"><input id="ginv" placeholder="ชื่อผู้เล่น"><button class="mini" data-act="guildInvite">เชิญ</button></div><div class="mlist">${g.members.sort((a, b) => GUILD_RANKS.findIndex((r) => r.id === a.rank) - GUILD_RANKS.findIndex((r) => r.id === b.rank)).map((m) => `<div><span class="${m.online ? 'on' : 'off'}">●</span> <b>${esc(m.name)}</b> <small>${GUILD_RANKS.find((r) => r.id === m.rank).th} • Lv${m.lv} ${CLASS_BY_ID[m.cls]?.name || ''} • Contribution ${m.contrib}</small>${off && m.id !== me.id && m.rank !== 'leader' ? `<button class="mini" data-act="guildRank" data-op="promote" data-id="${m.id}">▲</button><button class="mini" data-act="guildRank" data-op="demote" data-id="${m.id}">▼</button><button class="mini alt" data-act="guildRank" data-op="kick" data-id="${m.id}">เตะ</button>` : ''}${lead && m.id !== me.id ? `<button class="mini gold" data-act="guildRank" data-op="transfer" data-id="${m.id}">มอบหัวหน้า</button>` : ''}</div>`).join('')}</div>`;
    if (t === 'storage') body = `<p class="dim">ฝาก: เปิดกระเป๋าแล้วกดปุ่ม "ฝากกิลด์" ที่ไอเทม • เบิกได้เฉพาะรองหัวหน้าขึ้นไป • ทุกการฝากถอนถูกบันทึก</p><div class="inv-grid">${Array.from({ length: g.storageMax }, (_, i) => this.itemIcon(g.storage[i], 'gstore:' + i)).join('')}</div>`;
    if (t === 'skills') body = Object.entries(g.skillDef).map(([k, s]) => `<div class="q"><b>${s.name}</b> ระดับ ${g.skills[k] || 0}/${s.max}<br><small>${s.th}</small><br>${(g.skills[k] || 0) < s.max ? `<small>อัปเกรด: ${fmt(s.cost)} เงินกิลด์ • ต้องการกิลด์ Lv${s.req}</small> ${lead ? `<button class="mini" data-act="guildSkill" data-id="${k}">อัปเกรด</button>` : ''}` : '<small>สูงสุด</small>'}</div>`).join('');
    if (t === 'quests') body = `<p class="dim">เควสต์ประจำวันของกิลด์ (รีเซ็ตทุกวัน) — สมาชิกทุกคนช่วยกันทำ</p>` + Object.entries(g.dailyDef).map(([k, q]) => { const v = g.daily?.[k] || 0; const done = g.daily?.claimed?.[k]; return `<div class="q"><b>${q.th}</b> ${Math.min(v, q.n)}/${q.n} ${done ? '✔ รับแล้ว' : v >= q.n && off ? `<button class="mini gold" data-act="guildClaim" data-id="${k}">รับรางวัล</button>` : ''}</div>`; }).join('');
    if (t === 'war') body = `<h4>Guild War 20v20 — ยึดป้อม 3 ขั้น</h4><ol><li>แย่ง Control Points 3 จุด (ถือ 2 จุดสะสม 45 วิ) เพื่อเปิดประตูปราสาท</li><li>ทำลาย Guardian Crystal 2 ก้อนของฝ่ายป้องกัน</li><li>ยึด Core กลางป้อม 30 วินาทีก่อนหมดเวลา (15 นาที)</li></ol><p class="dim">ผู้ชนะ: เงินกิลด์ • Guild Sigil • ของตกแต่งประจำฤดูกาล (ไม่มีโบนัสพลังถาวร)</p>${off ? '<div class="row"><button data-act="guildWar">ลงทะเบียนสงคราม</button><button class="alt" data-act="guildWarCancel">ยกเลิก</button></div>' : '<p class="dim">หัวหน้า/รองหัวหน้าเป็นผู้ลงทะเบียน</p>'}`;
    if (t === 'log') body = `<div class="log">${g.log.map((l) => `<div><small>${new Date(l.t).toLocaleString()}</small> ${esc(l.text)}</div>`).join('')}</div>`;
    if (t === 'ranking') { body = this.rankTable(this.ctx.granking); if (!this.ctx.granking) this.send({ t: 'guild', op: 'ranking' }); }
    const el = this.win('guild', `กิลด์ [G] — [${g.tag}] ${g.name}`, `<div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="${k === t ? 'on' : ''}" data-act="gtab" data-t="${k}">${v}</button>`).join('')}</div>${body}`, 640);
    const ec = el.querySelector('#gemb'); if (ec) { const x = ec.getContext('2d'); x.clearRect(0, 0, 64, 64); drawEmblem(x, 32, 32, 52, g.emblem); }
  }
  rankTable(r) { return !r ? 'กำลังโหลด...' : `<table class="tbl"><tr><th>#</th><th>กิลด์</th><th>Lv</th><th>สมาชิก</th><th>War</th><th>ฤดูกาล</th></tr>${r.list.map((g, i) => `<tr><td>${i + 1}</td><td>[${esc(g.tag)}] ${esc(g.name)}</td><td>${g.level}</td><td>${g.members}</td><td>${g.war} (${g.wins}W)</td><td>${g.season}</td></tr>`).join('')}</table>`; }
  // ---- PvP ----
  p_pvp() {
    const q = this.ctx.pvpq || []; const l = this.ctx.ladder; const c = this.G.char;
    this.win('pvp', 'PvP Arena [V]', `<p class="dim">PvP แยกจากการฟาร์ม (ไม่มี PvP บังคับในแมพ) • Ranked ใช้ค่าอุปกรณ์แบบ Normalize แต่สกิล/รูน/Passive เป็นของคุณ • สกิลมีค่าปรับ PvP แยก (สตัน ดูดเลือด สมุน)</p>
      <div class="pvp-modes">${Object.entries(PVP_MODES).map(([k, m]) => `<div class="pm-card"><h3>${m.th}</h3><small>${m.ranked ? 'Ranked • Season Rewards' : 'ยึดจุดสำคัญ 3 จุด'}</small><br>${q.includes(k) ? `<button class="alt" data-act="pvpLeave">ออกจากคิว</button><span class="blink">กำลังหาคู่...</span>` : `<button data-act="pvpQueue" data-mode="${k}">เข้าคิว</button>`}</div>`).join('')}</div>
      <p>เรตติ้งของคุณ: Duel <b>${c.rating.duel}</b> • Arena 3v3 <b>${c.rating.arena3}</b> • Honor ${c.honor || 0}</p>
      <div class="tabs"><button class="${(this.ctx.ladderMode || 'duel') === 'duel' ? 'on' : ''}" data-act="ladder" data-mode="duel">Ladder Duel</button><button class="${this.ctx.ladderMode === 'arena3' ? 'on' : ''}" data-act="ladder" data-mode="arena3">Ladder 3v3</button></div>
      ${l ? `<table class="tbl"><tr><th>#</th><th>ชื่อ</th><th>คลาส</th><th>เรตติ้ง</th><th>แรงก์</th><th>W/L</th></tr>${l.list.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${CLASS_BY_ID[x.cls].name}</td><td>${x.r}</td><td>${x.tier}</td><td>${x.w}/${x.l}</td></tr>`).join('')}</table>` : ''}`, 620);
  }
  // ---- Dungeon ----
  p_dungeon() {
    const d = this.ctx.dungeons; this.ctx.huntBoss = this.ctx.huntBoss || 'kingslime';
    const types = { story: 'Story Dungeon (1-4) — เนื้อเรื่อง บอส และกลไกเฉพาะ', abyss: 'Abyss Dungeon (1-4) — สุ่มห้อง ศัตรู และ Modifier', hunt: 'Boss Hunt (1-4) — ต่อสู้บอสโดยตรง เน้นอ่านท่า', raid: 'Raid Dungeon (4-8) — บอสหลายเฟสและกลไกทีม' };
    this.win('dungeon', 'ประตูดันเจี้ยน', !d ? 'กำลังโหลด...' : Object.entries(types).map(([t, th]) => `<h4>${th}</h4>${d.list.filter((x) => x.type === t).map((x) => `<div class="q"><b>${esc(x.name)}</b> <small>${esc(x.th)} • Lv${x.lv} • ${x.players[0]}-${x.players[1]} คน</small>${x.story ? `<br><small class="dim">${esc(x.story)}</small>` : ''}
      ${t === 'hunt' ? `<div class="row"><select id="huntboss">${d.bosses.map((b) => `<option value="${b.id}" ${b.id === this.ctx.huntBoss ? 'selected' : ''}>${esc(b.name)} (Lv${b.lv})</option>`).join('')}</select></div>` : ''}${t === 'abyss' ? `<br><small>ชั้นสูงสุดของคุณ: ${this.G.char.abyssBest || 0}</small> <input id="abfloor" type="number" min="1" value="${(this.G.char.abyssBest || 0) + 1}" style="width:60px">` : ''}
      <button class="mini" data-act="enterDungeon" data-id="${x.id}">เข้า</button></div>`).join('')}`).join('') + `<p class="dim">บอสมีท่าที่ต้องหลบ (พื้นแดง) • ท่าทอง = กด F Counter ในจังหวะ → บอสมึนและเปิดจุดอ่อน • ชาร์จชนกำแพง = บอสมึน • เฟสเปลี่ยนตาม HP</p>`, 620);
  }
  // ---- Shop ----
  p_shop() {
    const c = this.G.char;
    this.win('shop', 'ร้านค้า', `<h4>ยา</h4>${Object.entries(POTIONS).map(([k, p]) => `<div class="row">${p.name} — ${p.th} (${p.price(c.level)} ทอง/ขวด) <button class="mini" data-act="buyPot" data-k="${k}" data-n="1">x1</button><button class="mini" data-act="buyPot" data-k="${k}" data-n="10">x10</button><button class="mini" data-act="buyPot" data-k="${k}" data-n="50">x50</button></div>`).join('')}
      <h4>Support Runes ระดับ 1 (5,000 ทอง)</h4><div class="row wrap">${RUNES.filter((r) => r.tier === 1).map((r) => `<button class="mini" data-act="buyRune" data-id="${r.id}" data-tip="rune:${r.id}">${r.name}</button>`).join('')}</div>
      <p class="dim">ขายของ: คลิกไอเทมในกระเป๋า → ขาย</p>`, 540);
  }
  // ---- Blacksmith ----
  p_smith() {
    const c = this.G.char; this.ctx.stab = this.ctx.stab || 'craft';
    const sel = this.ctx.smithRef && this.refItem(this.ctx.smithRef);
    let body = '';
    if (this.ctx.stab === 'craft') body = `<div class="row">ช่อง <select id="cslot">${['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'].map((s) => `<option value="${s}">${SLOT_TH[s]}</option>`).join('')}</select> อาวุธ <select id="cwt">${CLASS_BY_ID[c.classId].weapons.map((w) => `<option value="${w}">${WEAPON_TYPES[w].name}</option>`).join('')}</select> iLvl <input id="cilvl" type="number" value="${c.level}" min="1" max="${c.level}" style="width:70px"></div>
      <div class="row">ตัวเร่ง <select id="ccat"><option value="">ไม่มี (Magic+)</option><option value="core">Boss Core x1 (Epic+)</option><option value="essence">Abyss Essence x3 (Rare+, โอกาส Legendary สูง)</option><option value="set">Boss Core x3 + เลือกเซ็ต (Epic Set)</option></select> เซ็ต <select id="cset">${Object.entries(SETS).map(([k, s]) => `<option value="${k}">${s.name} (${s.slots.join('/')})</option>`).join('')}</select></div>
      <p class="dim">ค่าคราฟต์: ทอง ${fmt(ECONOMY.craftGold(c.level))} • แร่เหล็ก ${3 + Math.floor(c.level / 15)} • ผงวิญญาณ ${1 + Math.floor(c.level / 40)}</p><button data-act="craft">คราฟต์</button>`;
    if (this.ctx.stab === 'enhance') body = `<p class="dim">เลือกไอเทม: คลิกไอเทมในกระเป๋าหรือช่องสวมใส่</p>${sel ? `<div class="sel-item">${this.itemTip(sel)}</div>
      <div class="row"><button data-act="refine">ตีบวก +${(sel.refine || 0) + 1} (${REFINE_CHANCE[sel.refine || 0] ?? 0}% • ${fmt(ECONOMY.refineGold(sel.refine || 0, sel.ilvl))} ทอง • แร่ ${2 + (sel.refine || 0)}${(sel.refine || 0) >= 5 ? ' • มิธริล 1' : ''})</button><button data-act="punch">เจาะ Socket (${fmt(ECONOMY.socketPunch(sel.sockets))} ทอง + เศษธาตุ 2)</button></div>
      <h4>Reroll Affix (${fmt(ECONOMY.rerollGold(sel.ilvl))} ทอง + ผงวิญญาณ 3 + เศษธาตุ 1)</h4>${(sel.affixes || []).map((a, i) => `<div class="row">${statLine(a.id, a.v)} <button class="mini" data-act="reroll" data-i="${i}">Reroll</button></div>`).join('')}` : ''}<p class="dim">ตีบวก +5 ขึ้นไปถ้าล้มเหลวระดับจะลด 1 (ไอเทมไม่แตก)</p>`;
    if (this.ctx.stab === 'repair') { let cost = 0; for (const it of Object.values(c.equip)) if (it && it.dur < 100) cost += ECONOMY.repairPerDur(it.ilvl) * (100 - it.dur); body = `<p>ความทนทานลดลง ${ECONOMY.deathDurability}% เมื่อตายในแมพฟาร์ม อุปกรณ์ที่พัง (0%) จะไม่ให้ค่าสถานะ</p>${Object.entries(c.equip).map(([s, it]) => `<div>${SLOT_TH[s]}: ${esc(it.name)} — ${it.dur}%</div>`).join('')}<button data-act="repair">ซ่อมทั้งหมด (${fmt(cost)} ทอง)</button>`; }
    this.win('smith', 'ช่างตีเหล็ก — Crafting', `<div class="tabs">${Object.entries({ craft: 'คราฟต์', enhance: 'ตีบวก / Reroll / Socket', repair: 'ซ่อม' }).map(([k, v]) => `<button class="${k === this.ctx.stab ? 'on' : ''}" data-act="stab" data-t="${k}">${v}</button>`).join('')}</div>${body}
      <div class="mats">${Object.entries(MATERIALS).map(([k, m]) => `<span style="color:${m.color}">${m.th} ${c.materials[k] || 0}</span>`).join(' • ')}</div>`, 600);
  }
  // ---- Stash ----
  p_stash() { const s = this.G.char.stash; this.win('stash', `คลังของ (ใช้ร่วมกันทุกตัวละครในบัญชี) ${s.length}/80`, `<p class="dim">คลิกไอเทมในคลัง → นำออก • คลิกไอเทมในกระเป๋า → ฝาก</p><div class="inv-grid">${Array.from({ length: 80 }, (_, i) => this.itemIcon(s[i], 'stash:' + i)).join('')}</div>`, 600); }
  // ---- Market ----
  p_market() {
    const m = this.ctx.market;
    this.win('market', 'ตลาดกลาง (ซื้อขายผ่านเซิร์ฟเวอร์)', `<div class="row"><input id="mq" placeholder="ค้นหาชื่อไอเทม" value="${esc(this.ctx.mq || '')}"><select id="mslot"><option value="">ทุกช่อง</option>${['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring', 'card'].map((s) => `<option value="${s}" ${this.ctx.mslot === s ? 'selected' : ''}>${SLOT_TH[s] || 'การ์ด'}</option>`).join('')}</select><select id="mrar"><option value="">ทุกระดับ</option>${RARITIES.map((r) => `<option value="${r}" ${this.ctx.mrar === r ? 'selected' : ''}>${RARITY_INFO[r].th}</option>`).join('')}</select><button class="mini" data-act="mSearch">ค้นหา</button></div>
      <p class="dim">ค่าวางขาย 1% • ค่าธรรมเนียมเมื่อขายได้ ${Math.round(ECONOMY.marketFee * 100)}% (ทองส่วนนี้ถูกทำลายเพื่อควบคุมเงินเฟ้อ) • Mythic ผูกมัดบัญชี ขายไม่ได้ • วางขายจากกระเป๋า: คลิกไอเทม → วางขาย</p>
      ${!m ? 'กำลังโหลด...' : `<div class="mk">${m.list.map((l) => `<div class="mk-row">${this.itemIcon(l.item, 'mk:' + l.id)}<div><b style="color:${RARITY_INFO[l.item.rarity].color}">${esc(l.item.name)}</b><br><small>${esc(l.seller)} • iLv${l.item.ilvl || '-'}</small></div><b class="price">${fmt(l.price)} 💰</b>${l.mine ? `<button class="mini alt" data-act="mCancel" data-id="${l.id}">ยกเลิก</button>` : `<button class="mini gold" data-act="mBuy" data-id="${l.id}">ซื้อ</button>`}</div>`).join('') || '<p class="dim">ไม่พบสินค้า</p>'}</div><small>${m.total} รายการ</small>`}`, 640);
  }
  p_teleport() {
    const c = this.G.char;
    const row = (m) => { const cost = ECONOMY.teleportGold * (m.kind === 'town' ? 1 : 2); const lock = c.level < m.lv[0] - 10; return `<div class="row"><span style="flex:1">${m.kind === 'town' ? '🏰' : '🌲'} <b>${esc(m.name)}</b> <small class="dim">Lv ${m.lv[0]}${m.kind === 'field' ? '-' + m.lv[1] : '+'}</small></span><button class="mini" data-act="teleport" data-to="${m.id}" ${lock ? 'disabled title="เลเวลไม่ถึง"' : ''}>${cost} ทอง</button></div>`; };
    this.win('teleport', '🌀 นักเคลื่อนย้าย', REGION_LIST.map((r) => `<h4>${esc(r.town)} <small class="dim">${esc(r.th)}</small></h4>${row(MAPS['town_' + r.id])}${r.maps.map((_, i) => row(MAPS[`${r.id}_${i + 1}`])).join('')}`).join(''), 460);
  }
  // ---- Map: full map of current area, click to walk; world overview ----
  p_map() {
    const tab = this.ctx.mapTab || 'area';
    const el = this.win('map', `🗺 แผนที่ — ${this.G.inst?.name || ''}`, `<div class="tabs"><button class="${tab === 'area' ? 'on' : ''}" data-act="mapTab" data-t="area">แผนที่พื้นที่นี้</button><button class="${tab === 'world' ? 'on' : ''}" data-act="mapTab" data-t="world">แผนที่โลก</button></div>
      ${tab === 'area' ? `<canvas id="bigmap" width="880" height="560"></canvas><div class="row small"><span>⬜ คุณ</span><span style="color:#7fe8ff">● ประตูวาร์ป (คลิกเพื่อเดินไป)</span><span style="color:#ffd84a">■ NPC</span><span style="color:#d86a4a">■ มอนสเตอร์</span><span style="color:#ff3a3a">■ บอส</span><span style="color:#4ad86a">■ เพื่อน</span></div>` :
      REGION_LIST.map((r) => `<h4>🏰 ${esc(r.town)} <small class="dim">${esc(r.th)} • Lv ${r.lv[0]}-${r.lv[1]}</small></h4><div class="wm">${['town_' + r.id, ...r.maps.map((_, i) => `${r.id}_${i + 1}`)].map((id) => { const d = MAPS[id]; return `<span class="${id === this.G.inst?.key ? 'cur' : ''}" title="${d.fieldBoss ? 'บอสแมพ: ' + esc(BOSSES[d.fieldBoss].name) : 'เมือง'}">${esc(d.name)}${d.kind === 'field' ? ` <small>Lv${d.lv[0]}-${d.lv[1]}</small>` : ''}</span>`; }).join(' 🌀 ')}</div>`).join('') + `<p class="dim">บอสโลก: ${WORLD_BOSSES.map((w) => `${esc(w.name)} (${esc(MAPS[w.map].name)})`).join(' • ')}</p>`}`, 910);
    if (tab === 'area') { const cv = el.querySelector('#bigmap'); if (this.mapCv !== cv) { this.mapCv = cv; cv.addEventListener('mousedown', (e) => { const r = cv.getBoundingClientRect(); const [wx, wy] = this.bigT.toWorld((e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)); const ex = this.G.L.exits.find((x) => Math.hypot(x.x - wx, x.y - wy) < 250); this.G.walkTo(ex ? ex.x : wx, ex ? ex.y : wy); }); } }
  }
  drawBigMap() { if (this.mapCv && document.body.contains(this.mapCv)) this.bigT = this.r.drawMap(this.mapCv, null, { big: true }); }
  // ---- Auto settings ----
  p_auto() {
    const c = this.G.char; const A = this.G.auto; const cfg = A.cfg; const tab = this.ctx.autoTab || 'hunt';
    let body = '';
    if (tab === 'hunt') {
      const mons = A.monsterChoices();
      body = `<div class="row"><button class="${A.on ? 'gold' : ''}" data-act="autoToggle">${A.on ? '⏹ หยุดออโต้' : '▶ เริ่มออโต้'} [U]</button><span class="dim">${A.on ? 'กำลังทำงาน' : 'ยังไม่ทำงาน'}</span></div>
        <h4>เป้าหมาย</h4>
        <div class="row"><label class="toggle"><input type="radio" name="at" data-auto="targets" value="all" ${cfg.targets === 'all' ? 'checked' : ''}>มอนสเตอร์ทุกตัว</label><label class="toggle"><input type="radio" name="at" data-auto="targets" value="list" ${cfg.targets === 'list' ? 'checked' : ''}>เฉพาะที่เลือก</label><label class="toggle"><input type="radio" name="at" data-auto="targets" value="boss" ${cfg.targets === 'boss' ? 'checked' : ''}>เฉพาะบอส</label></div>
        <div class="row wrap">${mons.map((n) => `<label class="toggle"><input type="checkbox" data-auto-list="${esc(n)}" ${cfg.list.includes(n) ? 'checked' : ''}>${esc(n)}</label>`).join('') || '<span class="dim">ไม่มีมอนสเตอร์ในพื้นที่นี้</span>'}</div>
        <div class="row">เลือกตัวไหนก่อน <select data-auto="priority"><option value="nearest" ${cfg.priority === 'nearest' ? 'selected' : ''}>ใกล้ที่สุด</option><option value="lowhp" ${cfg.priority === 'lowhp' ? 'selected' : ''}>HP น้อยสุด</option><option value="highlv" ${cfg.priority === 'highlv' ? 'selected' : ''}>เลเวลสูงสุด</option></select>
          <label class="toggle"><input type="checkbox" data-auto="bossFirst" ${cfg.bossFirst ? 'checked' : ''}>ตีบอสก่อนเสมอ</label><label class="toggle"><input type="checkbox" data-auto="avoidElite" ${cfg.avoidElite ? 'checked' : ''}>ไม่ตี Elite ★</label></div>
        <h4>พื้นที่ล่า</h4><div class="row">รัศมี <input type="range" min="0" max="6000" step="250" data-auto="radius" value="${cfg.radius}"> <b>${cfg.radius ? cfg.radius + ' px' : 'ทั้งแมพ'}</b>
          <select data-auto="anchor"><option value="start" ${cfg.anchor === 'start' ? 'selected' : ''}>วนรอบจุดที่เริ่มออโต้</option><option value="self" ${cfg.anchor === 'self' ? 'selected' : ''}>รอบตัวเรา (เดินไปเรื่อยๆ)</option></select></div>
        <h4>ระบบช่วยเหลือ</h4><div class="row wrap"><label class="toggle"><input type="checkbox" data-auto="loot" ${cfg.loot ? 'checked' : ''}>เก็บของอัตโนมัติ</label><label class="toggle"><input type="checkbox" data-auto="dodge" ${cfg.dodge ? 'checked' : ''}>หลบท่าบอส (พื้นแดง)</label><label class="toggle"><input type="checkbox" data-auto="counter" ${cfg.counter ? 'checked' : ''}>กด Counter ท่าสีทอง</label><label class="toggle"><input type="checkbox" data-auto="useUlt" ${cfg.useUlt ? 'checked' : ''}>ใช้อัลติเมทกับบอส/Elite</label></div>
        <div class="row">ใช้ยา HP เมื่อต่ำกว่า <input type="number" min="0" max="95" data-auto="potHp" value="${cfg.potHp}" style="width:60px">% • ยาทรัพยากรต่ำกว่า <input type="number" min="0" max="95" data-auto="potMp" value="${cfg.potMp}" style="width:60px">%</div>`;
    } else {
      const s = c.settings?.askill || {}; const ord = A.order; const off = s.off || [];
      const filled = c.build.hotbar.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
      const full = [...(s.order || []).filter((i) => filled.includes(i)), ...filled.filter((i) => !(s.order || []).includes(i))];
      body = `<p class="dim">ออโต้จะใช้สกิลจากบนลงล่าง: ถ้าสกิลบนสุดยังติดคูลดาวน์หรือทรัพยากรไม่พอ จะไล่ไปใช้อันถัดไป ใช้ ▲▼ เพื่อจัดลำดับ และติ๊กออกเพื่อไม่ให้ออโต้ใช้สกิลนั้น</p>
        ${full.map((i, k) => { const sk = getSkill(c.build.hotbar[i]); const sp = A.specs[i]; return `<div class="ord ${off.includes(i) ? 'off' : ''}"><b>${k + 1}.</b>${this.skIcon(sk)}<span>${esc(sk.name)} <small class="dim">ช่อง ${this.slotName(i)} • ${BEHAVIOR[sk.behavior].th} • CD ${sp ? sp.cd.toFixed(1) : '?'}วิ • ระยะ ${Math.round(A.range(sp))}</small></span><label class="toggle"><input type="checkbox" data-askill-off="${i}" ${off.includes(i) ? '' : 'checked'}>ใช้</label><button class="mini alt" data-act="ordMove" data-i="${i}" data-d="-1">▲</button><button class="mini alt" data-act="ordMove" data-i="${i}" data-d="1">▼</button></div>`; }).join('') || '<p class="dim">ยังไม่มีสกิลใน Hotbar</p>'}
        <div class="row"><button class="mini alt" data-act="ordReset">เรียงตาม Hotbar</button></div>`;
    }
    this.win('auto', '🤖 ตั้งค่าออโต้ [Y]', `<div class="tabs"><button class="${tab === 'hunt' ? 'on' : ''}" data-act="autoTab" data-t="hunt">เป้าหมาย & การล่า</button><button class="${tab === 'skill' ? 'on' : ''}" data-act="autoTab" data-t="skill">ลำดับสกิล</button></div>${body}`, 640);
  }
  saveAuto(patch) { const c = this.G.char; c.settings = c.settings || {}; c.settings.auto = { ...AUTO_DEFAULT, ...(c.settings.auto || {}), ...patch }; this.send({ t: 'settings', key: 'auto', value: c.settings.auto }); this.renderPanel('auto'); }
  saveAskill(patch) { const c = this.G.char; c.settings = c.settings || {}; c.settings.askill = { ...(c.settings.askill || {}), ...patch }; this.send({ t: 'settings', key: 'askill', value: c.settings.askill }); this.renderPanel('auto'); }
  // ---- GM panel ----
  p_gm() {
    const g = this.ctx.gm; const tab = this.ctx.gmTab || 'players';
    if (!this.G.char.gm) return this.win('gm', '👑 GM', '<p class="err">คุณไม่มีสิทธิ์ GM</p>', 400);
    if (!g) return this.win('gm', '👑 GM Panel', 'กำลังโหลด...', 760);
    const tabs = { players: 'ผู้เล่น', give: 'ให้ของ/แก้ตัวละคร', world: 'โลก & มอนสเตอร์', server: 'เซิร์ฟเวอร์', log: 'บันทึก GM' };
    const sel = this.ctx.gmTarget || this.G.char.name;
    const target = `<div class="row">เป้าหมาย <select id="gmt">${g.players.map((p) => `<option ${p.name === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><button class="mini alt" data-act="gmRefresh">รีเฟรช</button></div>`;
    let body = '';
    if (tab === 'players') body = `<table class="tbl"><tr><th>ชื่อ</th><th>บัญชี</th><th>Lv</th><th>คลาส</th><th>ที่อยู่</th><th>ทอง</th><th></th></tr>${g.players.map((p) => `<tr><td>${p.gm ? '👑 ' : ''}${esc(p.name)}${p.muted ? ' 🔇' : ''}</td><td>${esc(p.acc)}</td><td>${p.lv}</td><td>${CLASS_BY_ID[p.cls]?.name}</td><td>${esc(p.map)}</td><td>${fmt(p.gold)}</td><td><button class="mini" data-act="gm" data-op="goto" data-name="${esc(p.name)}">ไปหา</button><button class="mini" data-act="gm" data-op="summon" data-name="${esc(p.name)}">เรียก</button><button class="mini" data-act="gmp" data-a="heal" data-name="${esc(p.name)}">ฮีล</button><button class="mini alt" data-act="gmp" data-a="kick" data-name="${esc(p.name)}">เตะ</button><button class="mini alt" data-act="gmp" data-a="mute" data-n="10" data-name="${esc(p.name)}">ใบ้ 10น.</button><button class="mini alt" data-act="gmBan" data-name="${esc(p.acc)}">แบน</button></td></tr>`).join('')}</table>
      <h4>บัญชีที่ถูกแบน</h4>${g.banned.map((b) => `<div class="row">${esc(b.acc)} <small class="dim">${esc(b.reason || '')}</small><button class="mini" data-act="gm" data-op="unban" data-name="${esc(b.acc)}">ปลดแบน</button></div>`).join('') || '<span class="dim">-</span>'}
      <h4>ผู้มีสิทธิ์ GM</h4><div class="row">${g.gms.map((x) => `<span>👑 ${esc(x)}</span>`).join(' ')}</div><div class="row"><input id="gmacc" placeholder="ชื่อบัญชีหรือชื่อตัวละคร"><button class="mini gold" data-act="gmSetGM" data-v="1">ให้สิทธิ์ GM</button><button class="mini alt" data-act="gmSetGM" data-v="0">ถอดสิทธิ์</button></div>`;
    if (tab === 'give') body = target + `<div class="gm-grid">
      <div class="gm-card"><h4>เลเวล & ค่าเงิน</h4><div class="row"><input id="gmlv" type="number" value="300" style="width:70px"><button class="mini" data-act="gmpv" data-a="level" data-src="gmlv">ตั้งเลเวล</button></div><div class="row"><input id="gmgold" type="number" value="1000000" style="width:110px"><button class="mini" data-act="gmpv" data-a="gold" data-src="gmgold">+ทอง</button><button class="mini" data-act="gmpv" data-a="honor" data-src="gmgold">+Honor</button><button class="mini" data-act="gmpv" data-a="exp" data-src="gmgold">+EXP</button></div></div>
      <div class="gm-card"><h4>ไอเทม</h4><div class="row"><select id="gmslot"><option value="all">ครบชุด</option>${['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'].map((x) => `<option value="${x}">${SLOT_TH[x]}</option>`).join('')}</select><select id="gmrar">${RARITIES.map((r) => `<option value="${r}" ${r === 'legendary' ? 'selected' : ''}>${RARITY_INFO[r].th}</option>`).join('')}</select><input id="gmilvl" type="number" placeholder="iLvl" style="width:60px"><button class="mini gold" data-act="gmItem">สร้าง</button></div></div>
      <div class="gm-card"><h4>ทรัพยากร</h4><div class="row wrap"><button class="mini" data-act="gmp" data-a="mats">+วัตถุดิบ 100</button><button class="mini" data-act="gmp" data-a="runes">+รูนทุกแบบ 3</button><button class="mini" data-act="gmp" data-a="potions">+ยา 100</button><button class="mini" data-act="gmp" data-a="repair">ซ่อมอุปกรณ์</button></div></div>
      <div class="gm-card"><h4>สถานะ</h4><div class="row wrap"><button class="mini" data-act="gmp" data-a="heal">ฮีลเต็ม</button><button class="mini" data-act="gmp" data-a="revive">ชุบชีวิต</button><button class="mini alt" data-act="gmp" data-a="kill">สังหาร</button><button class="mini alt" data-act="gmp" data-a="resetBuild">รีเซ็ต Build</button><button class="mini alt" data-act="gmp" data-a="clearInv">ล้างกระเป๋า</button><button class="mini" data-act="gmp" data-a="unmute">ปลดใบ้</button></div>
        <div class="row"><select id="gmwarp2">${Object.values(MAPS).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select><button class="mini" data-act="gmpWarp">ส่งผู้เล่นไปแมพนี้</button></div></div></div>`;
    if (tab === 'world') {
      const here = MAPS[this.G.inst?.key];
      const mons = Object.values(MONSTERS); const pre = here?.monsters?.[0];
      body = `<div class="gm-grid"><div class="gm-card"><h4>ตัว GM</h4><div class="row wrap"><label class="toggle"><input type="checkbox" data-gmself="god" ${g.self?.god ? 'checked' : ''}>อมตะ (God)</label><label class="toggle"><input type="checkbox" data-gmself="invis" ${g.self?.invis ? 'checked' : ''}>ล่องหน</label></div><div class="row">ความเร็ว <input type="range" min="0.5" max="5" step="0.5" value="${g.self?.speed || 1}" data-gmself="speed"> x${g.self?.speed || 1}</div>
        <div class="row"><select id="gmwarp">${Object.values(MAPS).map((m) => `<option value="${m.id}" ${m.id === this.G.inst?.key ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select><button class="mini" data-act="gmWarp">วาร์ป (GM)</button></div></div>
        <div class="gm-card"><h4>เสกมอนสเตอร์ (ที่ตำแหน่งคุณ)</h4><div class="row"><select id="gmmon">${mons.map((m) => `<option value="${m.id}" ${m.id === pre ? 'selected' : ''}>${esc(m.name)} (Lv${m.lv})</option>`).join('')}</select></div><div class="row">จำนวน <input id="gmn" type="number" value="5" style="width:50px"> Lv <input id="gmmlv" type="number" placeholder="อัตโนมัติ" style="width:70px"><label class="toggle"><input type="checkbox" id="gmelite">Elite</label><button class="mini gold" data-act="gmSpawn">เสก</button></div>
          <div class="row"><select id="gmboss">${Object.values(BOSSES).map((b) => `<option value="${b.id}">${esc(b.name)} (Lv${b.lv})</option>`).join('')}</select> HP x<input id="gmbhp" type="number" value="1" step="0.5" style="width:50px"><label class="toggle"><input type="checkbox" id="gmworld">บอสโลก</label><button class="mini gold" data-act="gmBoss">เสกบอส</button></div>
          <div class="row"><button class="mini alt" data-act="gm" data-op="killAll">ฆ่ามอนทั้งแมพ</button><button class="mini alt" data-act="gm" data-op="clearSpawns">ลบมอนที่ GM เสก</button></div>
          <div class="row"><select id="gmwb">${WORLD_BOSSES.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select><button class="mini" data-act="gmWB">เรียกบอสโลกตอนนี้</button></div></div>
        <div class="gm-card"><h4>ประกาศ</h4><div class="row"><input id="gmann" placeholder="ข้อความถึงผู้เล่นทุกคน" style="flex:1"><button class="mini gold" data-act="gmAnn">ประกาศ</button></div></div>
        <div class="gm-card"><h4>อัตราเกม (อีเวนต์)</h4><div class="row">EXP x<input id="gmre" type="number" step="0.5" value="${g.rates.exp}" style="width:55px"> ดรอป x<input id="gmrd" type="number" step="0.5" value="${g.rates.drop}" style="width:55px"> ทอง x<input id="gmrg" type="number" step="0.5" value="${g.rates.gold}" style="width:55px"><button class="mini gold" data-act="gmRates">ใช้</button></div></div></div>
        <h4>กิลด์</h4><table class="tbl"><tr><th>กิลด์</th><th>Lv</th><th>เงิน</th><th>สมาชิก</th><th></th></tr>${g.guilds.map((x) => `<tr><td>[${esc(x.tag)}] ${esc(x.name)}</td><td>${x.level}</td><td>${fmt(x.funds)}</td><td>${x.members}</td><td><button class="mini" data-act="gmGuild" data-id="${x.id}" data-a="level">ตั้ง Lv</button><button class="mini" data-act="gmGuild" data-id="${x.id}" data-a="funds">ตั้งเงิน</button><button class="mini alt" data-act="gmGuild" data-id="${x.id}" data-a="disband">ยุบ</button></td></tr>`).join('')}</table>`;
    }
    if (tab === 'server') body = `<div class="stat-grid">${Object.entries({ 'ออนไลน์': g.stats.online, 'การเชื่อมต่อ': g.stats.sessions, 'Instance': g.stats.instances, 'Unit จำลองอยู่': g.stats.units, 'บัญชี': g.stats.accounts, 'ตัวละคร': g.stats.chars, 'กิลด์': g.stats.guilds, 'สินค้าในตลาด': g.stats.listings, 'Uptime': Math.floor(g.stats.uptime / 60) + ' นาที', 'หน่วยความจำ': g.stats.memMB != null ? g.stats.memMB + ' MB' : '-' }).map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <h4>ตั้งค่าเซิร์ฟเวอร์</h4><div class="row">เติมบอท PvP หลัง <input id="gmc1" type="number" value="${g.config.pvpBotFill}" style="width:60px"> วิ • Raid ขั้นต่ำ <input id="gmc2" type="number" value="${g.config.raidMinPlayers}" style="width:50px"> คน • Guild War ขั้นต่ำ <input id="gmc3" type="number" value="${g.config.guildWarMin}" style="width:50px"><button class="mini gold" data-act="gmConfig">บันทึก</button></div>
      <div class="row"><button data-act="gm" data-op="save">บันทึกฐานข้อมูลตอนนี้</button>${window.TENEND_RESET ? '<button class="alt" data-act="gmWipe">ลบเซฟทั้งหมด (ออฟไลน์)</button>' : ''}</div>`;
    if (tab === 'log') body = `<div class="log">${g.log.map((l) => `<div><small class="dim">${new Date(l.t).toLocaleString()}</small> <b>${esc(l.by)}</b> ${esc(l.text)}</div>`).join('') || '-'}</div>`;
    this.win('gm', '👑 GM Panel [F9]', `<div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" data-act="gmTab" data-t="${k}">${v}</button>`).join('')}</div>${body}`, 820);
  }
  p_help() {
    this.win('help', '❔ วิธีเล่น [H]', `<div class="help"><b>การเคลื่อนที่</b><br>คลิกซ้ายที่พื้น = เดินไปจุดนั้น (หาทางอ้อมสิ่งกีดขวางให้เอง) • กดค้างแล้วลาก = เดินตามเมาส์ • WASD = เดินเอง • คลิกมินิแมพหรือแผนที่ [M] = เดินไปที่นั่น<br>ประตูวาร์ป 🌀 ที่ขอบแผนที่เชื่อมไปแมพถัดไป • วาร์ปข้ามเมืองได้ที่ <b>นักเคลื่อนย้าย</b> ในเมืองเท่านั้น
      <br><br><b>การต่อสู้</b><br>คลิกซ้ายที่มอนสเตอร์ = ล็อกเป้าแล้วตีด้วยสกิลลำดับแรก • Hotbar 30 ช่อง: แถวล่าง 1-0, แถวกลาง Shift+1-0, แถวบน Alt+1-0 (สกิลเล็งตามเมาส์) • คลิกขวา = สกิลช่อง 2 • R อัลติเมท<br>Space หลบ (อมตะชั่วขณะ) • F Counter: ใช้กับท่าสีทองของบอส • Q / T ยา • Z เก็บของรอบตัว • Tab แสดงชื่อของดรอป
      <br><br><b>ออโต้</b><br>U เปิด/ปิด • Y ตั้งค่า: เลือกมอนที่จะตี รัศมี การเก็บของ ใช้ยา หลบท่าบอส และจัดลำดับสกิลที่จะใช้
      <br><br><b>เมนู</b><br>I กระเป๋า • C ตัวละคร • K สกิล (ลากไปวางที่ Hotbar) • N รูน • P Passive Tree • B Build Presets • J เควสต์ • O ปาร์ตี้ • G กิลด์ • V PvP • M แผนที่ • E คุยกับ NPC • Esc ปิดหน้าต่างบนสุด • Enter แชท</div>`, 640);
  }

  // ---------------- tooltips ----------------
  refItem(ref) {
    const c = this.G.char; const [w, k] = ref.split(':');
    if (w === 'inv') return c.inv[+k]; if (w === 'equip') return c.equip[k]; if (w === 'stash') return c.stash[+k];
    if (w === 'gstore') return c.guild?.storage[+k]; if (w === 'mk') return this.ctx.market?.list.find((l) => l.id === k)?.item;
  }
  itemTip(it) {
    if (it.type === 'card') { const cd = cardFor(it.card); return `<b style="color:#ff9ad8">${esc(it.name)}</b><br><small>การ์ด • ฝังลงช่อง Socket</small><br>${Object.entries(cd?.stats || {}).map(([k, v]) => statLine(k, v)).join('<br>')}`; }
    const col = RARITY_INFO[it.rarity].color; const c = this.G.char;
    let h = `<b style="color:${col}">${esc(it.name)}${it.refine ? ` +${it.refine}` : ''}</b><br><small>${RARITY_INFO[it.rarity].th} • ${esc(it.base)} • ${SLOT_TH[it.slot] || it.slot}${it.wtype ? ` (${WEAPON_TYPES[it.wtype].name})` : ''}</small><br><small>iLvl ${it.ilvl} • ต้องการ Lv <span style="color:${it.req > c.level ? '#ff6a6a' : '#ccc'}">${it.req}</span>${it.wtype && !WEAPON_TYPES[it.wtype].classes.includes(c.classId) ? ' • <span style="color:#ff6a6a">คลาสนี้ใช้ไม่ได้</span>' : ''}</small><hr>`;
    for (const [k, v] of Object.entries(it.implicit || {})) h += `<div class="imp">${statLine(k, Math.round(v * (1 + (it.refine || 0) * 0.07 + (it.refine >= 7 ? 0.1 : 0))))}</div>`;
    for (const a of it.affixes || []) h += `<div style="color:#8ab8ff">${statLine(a.id, a.v)}</div>`;
    if (it.legendary) h += `<div style="color:#ff9a2a">★ ${esc(LEGENDARIES[it.legendary].th)}</div>`;
    if (it.mythic) h += `<div style="color:#ff3a5a">✦ ${esc(MYTHICS[it.mythic].th)}</div>`;
    if (it.set) { const s = SETS[it.set]; const n = Object.values(c.equip).filter((e) => e?.set === it.set).length; h += `<div style="color:#5aff7a">เซ็ต ${s.name} (${n}/4)<br><small>(2) ${Object.entries(s.b2).map(([k, v]) => statLine(k, v)).join(', ')}<br>(4) ${Object.entries(s.b4).map(([k, v]) => STAT_TH[k] ? statLine(k, v) : '').filter(Boolean).join(', ')} • ${s.th4}</small></div>`; }
    if (it.sockets) h += `<div>Socket: ${Array.from({ length: it.sockets }, (_, i) => it.cards?.[i] ? `[${esc(cardFor(it.cards[i])?.name || '?')}]` : '[ ว่าง ]').join(' ')}</div>`;
    h += `<small>ความทนทาน ${it.dur}%${it.bound ? ' • ผูกมัดบัญชี' : ''}${it.locked ? ' • ล็อก' : ''}${it.crafted ? ` • คราฟต์โดย ${esc(it.crafted)}` : ''} • ขาย ${sellPrice(it)}</small>`;
    return h;
  }
  skillTip(s) {
    const c = this.G.char; const rank = c.skillRanks[s.id] || 1;
    const spec = resolveSkill(s, { rank, runes: c.build.runes[s.id] || [], stats: this.stats, ks: this.stats?.ks, leg: this.stats?.leg });
    return `<b style="color:${ELEMENT_INFO[spec.el].color}">${esc(s.name)}</b> <small>R${rank} • Lv${s.unlock}</small><br><small>${esc(s.desc)}</small><br>ดาเมจ ${Math.round(spec.dmg)}% • CD ${spec.cd.toFixed(1)}วิ • ใช้ ${Math.round(spec.cost)}${spec.runes.length ? `<br><span style="color:#7fe8ff">รูน: ${spec.runes.map((r) => RUNE_BY_ID[r].name).join(', ')}</span>` : ''}`;
  }
  onHover(e) {
    const t = e.target.closest?.('[data-tip]'); if (!t) return;
    const [kind, ...rest] = t.dataset.tip.split(':'); const key = rest.join(':');
    let html = '';
    if (kind === 'item') { const it = this.refItem(key); if (it) html = this.itemTip(it); if (it && key.startsWith('inv')) { const eq = this.G.char.equip[it.slot === 'ring' ? 'ring1' : it.slot]; if (eq) html += `<hr><small class="dim">สวมใส่อยู่:</small><br>${this.itemTip(eq)}`; } }
    if (kind === 'skill' && key) { const s = getSkill(key); if (s) html = this.skillTip(s); }
    if (kind === 'rune') { const r = RUNE_BY_ID[key]; if (r) html = `<b style="color:#7fe8ff">${r.name}</b> <small>Tier ${r.tier}</small><br>${r.th}<br><small>ใช้กับ: ${r.for ? r.for.join(', ') : 'ทุกสกิล'}</small>`; }
    if (html) this.showTip(html, e.clientX, e.clientY);
  }
  showTip(html, x, y) { this.tip.innerHTML = html; this.tip.style.display = 'block'; this.placeTip(x, y); }
  placeTip(x, y) { const r = this.tip.getBoundingClientRect(); this.tip.style.left = Math.min(window.innerWidth - r.width - 8, x + 16) + 'px'; this.tip.style.top = Math.min(window.innerHeight - r.height - 8, y + 12) + 'px'; }
  hideTip() { this.tip.style.display = 'none'; }

  // ---------------- item context menu ----------------
  itemMenu(ref, x, y) {
    const it = this.refItem(ref); if (!it) return;
    const [w, k] = ref.split(':'); const npc = this.ctx.npc; const o = [];
    if (w === 'inv') {
      if (it.type === 'gear') { o.push(['สวมใส่', 'equip']); if (it.slot === 'ring') o.push(['สวมแหวนช่อง 2', 'equip2']); o.push(['แยกชิ้นส่วน', 'salvage']); }
      if (it.type === 'card') o.push(['ฝังการ์ดลงไอเทมที่สวมใส่...', 'cardMenu']);
      if (npc === 'shop') o.push(['ขาย', 'sell']);
      if (npc === 'stash' && this.open.has('stash')) o.push(['ฝากคลัง', 'stash']);
      if (npc === 'market' && this.open.has('market')) o.push(['วางขายในตลาด', 'mList']);
      if (npc === 'smith' && it.type === 'gear') o.push(['เลือกเพื่อตีบวก/Reroll', 'smithSel']);
      if (this.G.char.guild) o.push(['ฝากคลังกิลด์', 'gDeposit']);
      o.push([it.locked ? 'ปลดล็อก' : 'ล็อก', 'lock'], ['ทิ้ง', 'destroy']);
    } else if (w === 'equip') { o.push(['ถอด', 'unequip']); if (npc === 'smith') o.push(['เลือกเพื่อตีบวก/Reroll', 'smithSel']); }
    else if (w === 'stash') o.push(['นำออกจากคลัง', 'unstash']);
    else if (w === 'gstore') o.push(['เบิกจากคลังกิลด์', 'gWithdraw']);
    else return;
    const m = $('#ctxmenu'); m.innerHTML = o.map(([l, a]) => `<div data-act="imenu" data-a="${a}" data-ref="${ref}">${l}</div>`).join(''); m.style.display = 'block'; m.style.left = x + 'px'; m.style.top = y + 'px';
  }
  imenu(a, ref) {
    const [w, k] = ref.split(':'); const idx = +k; const S = this.send; const it = this.refItem(ref);
    switch (a) {
      case 'equip': return S({ t: 'item', op: 'equip', idx });
      case 'equip2': return S({ t: 'item', op: 'equip', idx, ring: 2 });
      case 'unequip': return S({ t: 'item', op: 'unequip', slot: k });
      case 'salvage': return S({ t: 'item', op: 'salvage', idx });
      case 'sell': return S({ t: 'npc', op: 'sell', idx });
      case 'stash': return S({ t: 'npc', op: 'stash', idx });
      case 'unstash': return S({ t: 'npc', op: 'unstash', idx });
      case 'lock': return S({ t: 'item', op: 'lock', ref: { where: w, idx, slot: k } });
      case 'destroy': this.ask(`ทิ้ง ${it.name}? (กู้คืนไม่ได้)`).then((ok) => ok && S({ t: 'item', op: 'destroy', idx })); return;
      case 'mList': this.ask(`ตั้งราคาขาย ${it.name} (ทอง)`, { input: String(sellPrice(it) * 3), number: true }).then((p) => p && S({ t: 'market', op: 'list', idx, price: +p })); return;
      case 'smithSel': this.ctx.smithRef = ref; this.ctx.stab = 'enhance'; return this.renderPanel('smith');
      case 'gDeposit': return S({ t: 'guild', op: 'deposit', idx });
      case 'gWithdraw': return S({ t: 'guild', op: 'withdraw', idx });
      case 'cardMenu': { const eq = Object.entries(this.G.char.equip).filter(([, e]) => e && (e.cards || []).length < e.sockets); if (!eq.length) return this.toast('ไม่มีอุปกรณ์ที่มีช่อง Socket ว่าง', '#ff6a6a'); this.ask('ฝังการ์ดลงอุปกรณ์ชิ้นไหน?', { choices: eq.map(([sl, e]) => [sl, `${SLOT_TH[sl]}: ${e.name}`]) }).then((ch) => ch && S({ t: 'item', op: 'socketCard', ref: { where: 'equip', slot: ch }, cardIdx: idx })); return; }
    }
  }

  // ---------------- click actions ----------------
  onClick(e) {
    const m = $('#ctxmenu'); if (!e.target.closest('#ctxmenu')) m.style.display = 'none';
    const el = e.target.closest('[data-act]'); if (!el) return;
    this.act(el.dataset.act, el, e);
  }
  act(a, el, e) {
    const d = el?.dataset || {}; const S = this.send; const c = this.G.char; const v = (id) => $('#' + id)?.value;
    switch (a) {
      case 'login': case 'register': return S({ t: a, user: v('lu'), pass: v('lp') });
      case 'pickclass': this.newClass = d.id; return this.buildCharSel(this.charList);
      case 'create': return S({ t: 'createChar', name: v('cname'), classId: this.newClass });
      case 'play': return S({ t: 'selectChar', id: d.id });
      case 'delchar': this.ask('ลบตัวละครนี้ถาวร?').then((ok) => ok && S({ t: 'deleteChar', id: d.id })); return;
      case 'logoutAcc': return location.reload();
      case 'logout': this.closeAll(); return S({ t: 'logout' });
      case 'close': return this.close(d.id);
      case 'menu': return this.toggle(d.p);
      case 'respawn': return S({ t: 'respawn' });
      case 'leaveInst': return S({ t: 'leaveInstance' });
      case 'item': e.stopPropagation(); { const ref = d.ref; const [w] = ref.split(':'); if (w === 'mk') return; if (this.ctx.npc === 'smith' && this.open.has('smith') && (w === 'inv' || w === 'equip') && this.refItem(ref)?.type === 'gear' && e.shiftKey) { this.ctx.smithRef = ref; this.ctx.stab = 'enhance'; return this.renderPanel('smith'); } return this.itemMenu(ref, e.clientX, e.clientY); }
      case 'imenu': $('#ctxmenu').style.display = 'none'; return this.imenu(d.a, d.ref);
      case 'sortInv': return S({ t: 'item', op: 'sort' });
      case 'salvageJunk': { const idxs = c.inv.map((it, i) => [it, i]).filter(([it]) => it.type === 'gear' && ['common', 'magic'].includes(it.rarity) && !it.locked).map(([, i]) => i); if (idxs.length) this.ask(`แยกชิ้นส่วน ${idxs.length} ชิ้น?`).then((ok) => ok && S({ t: 'item', op: 'salvage', idxs })); return; }
      case 'openSkills': return this.openPanel('skills');
      case 'skillTab': this.skillTab = +d.i; return this.renderPanel('skills');
      case 'selSkill': this.selSkill = d.id; return this.renderPanel('skills');
      case 'equipSkill': return S({ t: 'build', op: 'equipSkill', slot: d.slot === 'u' ? 'u' : +d.slot, id: d.id });
      case 'rankSkill': return S({ t: 'build', op: 'rankSkill', id: d.id });
      case 'unsocketRune': return S({ t: 'build', op: 'unsocketRune', id: d.id, idx: +d.idx });
      case 'fusePick': if ((this.ctx.fuse || []).length < 3 && c.runes[d.id]) this.ctx.fuse.push(d.id); return this.renderPanel('runes');
      case 'fuse': S({ t: 'npc', op: 'fuseRunes', runes: this.ctx.fuse }); this.ctx.fuse = []; return;
      case 'fuseClear': this.ctx.fuse = []; return this.renderPanel('runes');
      case 'savePreset': return S({ t: 'build', op: 'savePreset', idx: +d.i, name: v('pn' + d.i), tag: v('pt' + d.i) });
      case 'loadPreset': return S({ t: 'build', op: 'loadPreset', idx: +d.i });
      case 'delPreset': return S({ t: 'build', op: 'deletePreset', idx: +d.i });
      case 'reset': this.ask('ยืนยันการรีเซ็ต? (ใช้ทองตามที่แสดง)').then((ok) => ok && S({ t: 'build', op: 'reset', what: d.what })); return;
      case 'quest': return S({ t: 'quest', op: d.op, id: d.id });
      case 'partyInvite': return S({ t: 'party', op: 'invite', name: v('pinv') });
      case 'partyLeave': return S({ t: 'party', op: 'leave' });
      case 'partyKick': return S({ t: 'party', op: 'kick', id: d.id });
      case 'partyAccept': el.closest('.invite')?.remove(); return S({ t: 'party', op: 'accept' });
      case 'guildAccept': el.closest('.invite')?.remove(); return S({ t: 'guild', op: 'accept' });
      case 'closeInvite': el.closest('.invite')?.remove(); return S({ t: 'party', op: 'decline' });
      case 'gtab': this.ctx.gtab = d.t; return this.renderPanel('guild');
      case 'guildCreate': return S({ t: 'guild', op: 'create', name: v('gname'), tag: v('gtag'), shape: v('gshape'), icon: v('gicon'), color: v('gcolor') });
      case 'guildInvite': return S({ t: 'guild', op: 'invite', name: v('ginv') });
      case 'guildLeave': this.ask('ออกจากกิลด์?').then((ok) => ok && S({ t: 'guild', op: 'leave' })); return;
      case 'guildRank': return S({ t: 'guild', op: d.op, id: d.id });
      case 'guildDonate': return S({ t: 'guild', op: 'donate', gold: +v('gdon') });
      case 'guildNotice': return S({ t: 'guild', op: 'notice', text: v('gnotice') });
      case 'guildSkill': return S({ t: 'guild', op: 'skillUp', id: d.id });
      case 'guildClaim': return S({ t: 'guild', op: 'claimDaily', id: d.id });
      case 'guildBoss': return S({ t: 'guild', op: 'boss' });
      case 'guildWar': return S({ t: 'guild', op: 'warRegister' });
      case 'guildWarCancel': return S({ t: 'guild', op: 'warCancel' });
      case 'pvpQueue': return S({ t: 'pvp', op: 'queue', mode: d.mode });
      case 'pvpLeave': return S({ t: 'pvp', op: 'leave' });
      case 'ladder': this.ctx.ladderMode = d.mode; return S({ t: 'pvp', op: 'ladder', mode: d.mode });
      case 'enterDungeon': return S({ t: 'dungeon', op: 'enter', id: d.id, boss: v('huntboss'), floor: +(v('abfloor') || 1) });
      case 'buyPot': return S({ t: 'npc', op: 'buyPotion', kind: d.k, n: +d.n });
      case 'buyRune': return S({ t: 'npc', op: 'buyRune', rune: d.id });
      case 'stab': this.ctx.stab = d.t; return this.renderPanel('smith');
      case 'craft': return S({ t: 'npc', op: 'craft', slot: v('cslot'), ilvl: +v('cilvl'), catalyst: v('ccat'), set: v('cset'), wtype: v('cwt') });
      case 'refine': case 'punch': { const [w, k] = this.ctx.smithRef.split(':'); return S({ t: 'npc', op: a, ref: { where: w, idx: +k, slot: k } }); }
      case 'reroll': { const [w, k] = this.ctx.smithRef.split(':'); return S({ t: 'npc', op: 'reroll', ref: { where: w, idx: +k, slot: k }, affix: +d.i }); }
      case 'repair': return S({ t: 'npc', op: 'repair' });
      case 'mSearch': this.ctx.mq = v('mq'); this.ctx.mslot = v('mslot'); this.ctx.mrar = v('mrar'); return S({ t: 'market', op: 'browse', q: this.ctx.mq, slot: this.ctx.mslot, rarity: this.ctx.mrar });
      case 'mBuy': return S({ t: 'market', op: 'buy', id: d.id });
      case 'mCancel': return S({ t: 'market', op: 'cancel', id: d.id });
      case 'teleport': return S({ t: 'npc', op: 'teleport', to: d.to });
      // ---- HUD ----
      case 'hotbarToggle': this.rows = this.rows === 1 ? 3 : 1; try { localStorage.setItem('tenend-hotbar-rows', this.rows); } catch { /* ignore */ } return this.renderHotbar();
      case 'slotClick': { const slot = el.dataset.slot === 'u' ? 'u' : +el.dataset.slot; const id = slot === 'u' ? c.build.ult : c.build.hotbar[slot]; if (!id) return this.openPanel('skills'); const me = this.G.units.get(this.G.you); const t = this.G.auto.target && this.G.units.get(this.G.auto.target); const x = t ? t.x : me.x + Math.cos(me.facing) * 120, y = t ? t.y : me.y + Math.sin(me.facing) * 120; return S({ t: 'cast', slot, x: Math.round(x), y: Math.round(y) }); }
      case 'equipFree': return S({ t: 'build', op: 'equipSkill', slot: 'free', id: d.id });
      case 'pot': return S({ t: 'potion', kind: d.k });
      case 'counter': return S({ t: 'counter' });
      case 'autoToggle': this.G.auto.toggle(); return this.renderPanel('auto');
      case 'autoTab': this.ctx.autoTab = d.t; return this.renderPanel('auto');
      case 'ordMove': { const A = this.G.auto; const filled = c.build.hotbar.map((id, i) => (id ? i : -1)).filter((i) => i >= 0); const so = c.settings?.askill?.order || []; const full = [...so.filter((i) => filled.includes(i)), ...filled.filter((i) => !so.includes(i))]; const k = full.indexOf(+d.i), j = k + +d.d; if (j < 0 || j >= full.length) return; [full[k], full[j]] = [full[j], full[k]]; void A; return this.saveAskill({ order: full }); }
      case 'ordReset': return this.saveAskill({ order: [] });
      case 'chatTab': this.chatTab = d.t; document.querySelectorAll('#chat-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === d.t)); document.querySelectorAll('#chat-log > div').forEach((x) => { x.hidden = d.t !== 'all' && x.dataset.ch !== d.t; }); return;
      case 'miniZoom': this.r.miniSpan = Math.max(900, Math.min(9000, (this.r.miniSpan || 2600) * (+d.z > 0 ? 1.4 : 1 / 1.4))); return;
      case 'mapTab': this.ctx.mapTab = d.t; this.mapCv = null; return this.renderPanel('map');
      // ---- GM ----
      case 'gmTab': this.ctx.gmTab = d.t; return this.renderPanel('gm');
      case 'gmRefresh': this.ctx.gmTarget = v('gmt'); return S({ t: 'gm', op: 'state' });
      case 'gm': return S({ t: 'gm', op: d.op, name: d.name });
      case 'gmp': this.ctx.gmTarget = d.name || v('gmt') || this.ctx.gmTarget; return S({ t: 'gm', op: 'player', name: d.name || v('gmt'), action: d.a, n: d.n ? +d.n : undefined });
      case 'gmpv': this.ctx.gmTarget = v('gmt'); return S({ t: 'gm', op: 'player', name: v('gmt'), action: d.a, n: +v(d.src) });
      case 'gmItem': this.ctx.gmTarget = v('gmt'); return S({ t: 'gm', op: 'player', name: v('gmt'), action: 'item', slot: v('gmslot'), rarity: v('gmrar'), ilvl: +v('gmilvl') || 0 });
      case 'gmpWarp': return S({ t: 'gm', op: 'player', name: v('gmt'), action: 'warp', map: v('gmwarp2') });
      case 'gmBan': this.ask(`แบนบัญชี ${d.name}? ใส่เหตุผล`, { input: '' }).then((r) => r != null && S({ t: 'gm', op: 'ban', name: d.name, reason: r })); return;
      case 'gmSetGM': return S({ t: 'gm', op: 'setgm', name: v('gmacc'), value: d.v === '1' });
      case 'gmWarp': return S({ t: 'gm', op: 'warp', map: v('gmwarp') });
      case 'gmSpawn': return S({ t: 'gm', op: 'spawn', tpl: v('gmmon'), n: +v('gmn'), lv: +v('gmmlv') || 0, elite: $('#gmelite')?.checked });
      case 'gmBoss': return S({ t: 'gm', op: 'boss', id: v('gmboss'), hpMul: +v('gmbhp') || 1, world: $('#gmworld')?.checked });
      case 'gmWB': return S({ t: 'gm', op: 'worldboss', id: v('gmwb') });
      case 'gmAnn': return S({ t: 'gm', op: 'announce', text: v('gmann') });
      case 'gmRates': return S({ t: 'gm', op: 'rates', exp: +v('gmre'), drop: +v('gmrd'), gold: +v('gmrg') });
      case 'gmConfig': return S({ t: 'gm', op: 'config', pvpBotFill: +v('gmc1'), raidMinPlayers: +v('gmc2'), guildWarMin: +v('gmc3') });
      case 'gmGuild': if (d.a === 'disband') { this.ask('ยุบกิลด์นี้ถาวร?').then((ok) => ok && S({ t: 'gm', op: 'guild', id: d.id, action: 'disband' })); return; } this.ask(d.a === 'level' ? 'ตั้งเลเวลกิลด์เป็น' : 'ตั้งเงินกิลด์เป็น', { input: d.a === 'level' ? '10' : '1000000', number: true }).then((n) => n != null && S({ t: 'gm', op: 'guild', id: d.id, action: d.a, n: +n })); return;
      case 'gmWipe': this.ask('ลบเซฟทั้งหมดในเบราว์เซอร์นี้? (บัญชี ตัวละคร กิลด์ ทั้งหมด)').then((ok) => ok && window.TENEND_RESET()); return;
    }
  }
}
UI.z = 100;
document.addEventListener('change', (e) => {
  const el = e.target; const ui = window.G.ui;
  if (el.dataset?.actChange === 'socketRune' && el.value) window.G.send({ t: 'build', op: 'socketRune', id: el.dataset.id, idx: +el.dataset.idx, rune: el.value });
  if (el.dataset?.auto) { const k = el.dataset.auto; const val = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value : el.value; ui.saveAuto({ [k]: val }); }
  if (el.dataset?.autoList != null) { const cfg = window.G.auto.cfg; const list = new Set(cfg.list); el.checked ? list.add(el.dataset.autoList) : list.delete(el.dataset.autoList); ui.saveAuto({ list: [...list], targets: 'list' }); }
  if (el.dataset?.askillOff != null) { const off = new Set(window.G.char.settings?.askill?.off || []); const i = +el.dataset.askillOff; el.checked ? off.delete(i) : off.add(i); ui.saveAskill({ off: [...off] }); }
  if (el.dataset?.pkr) { ui.pk = ui.pk || {}; ui.pk[el.dataset.pkr] = +el.value; ui.renderPanel('smith'); }
  if (el.dataset?.gmself) { const k = el.dataset.gmself; window.G.send({ t: 'gm', op: 'self', [k]: el.type === 'checkbox' ? el.checked : +el.value }); }
});
