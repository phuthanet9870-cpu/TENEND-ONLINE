# TENEND ONLINE

Online Action RPG บนเว็บ (HTML5 Canvas + Node.js WebSocket) • มุมมอง Top-down 3/4 • กราฟิก Pixel Art (วาดด้วยโค้ดทั้งหมด ไม่ต้องใช้ไฟล์ภาพ)
แนวฟาร์มของแบบ Ragnarok + Build แบบ ARPG + PvP + Guild War

```bash
npm install
npm start            # http://localhost:8080
npm test             # integration test แบบ headless (เล่นวนลูปหลักทั้งหมดอัตโนมัติ)
```

ตัวแปรแวดล้อม (Environment)

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `PORT` | 8080 | พอร์ตเซิร์ฟเวอร์ |
| `DATA_DIR` | `./data` | ที่เก็บฐานข้อมูล JSON |
| `PVP_BOT_FILL` | 25 | วินาทีที่รอในคิว PvP ก่อนเติมบอทฝึกซ้อม (แมตช์ที่มีบอทจะไม่นับ Ranked) |
| `RAID_MIN_PLAYERS` | 4 | จำนวนผู้เล่นขั้นต่ำของ Raid (ตั้งเป็น 1 ไว้ทดสอบ) |
| `GUILDWAR_MIN` | 1 | จำนวนขั้นต่ำต่อฝั่งของ Guild War ก่อนเติมบอท |
| `DEV` | - | `1` = เปิดคำสั่งทดสอบ (`G.send({t:'dev',op:'level',n:300})` ใน console) |

## ปุ่มควบคุม

WASD เดิน • เมาส์เล็ง • คลิกซ้าย/ขวา = สกิลช่อง 1/2 • `1-6` สกิล • `R` อัลติเมท • `Space` หลบ (อมตะชั่วขณะ) • `F` Counter/Parry • `Q`/`T` ยา • `Z` เก็บของ • `E` คุย NPC
เมนู: `I` กระเป๋า • `C` ตัวละคร • `K` สกิล • `N` รูน • `P` Passive Tree • `B` Build Presets • `J` เควสต์ • `O` ปาร์ตี้ • `G` กิลด์ • `V` PvP • `M` แผนที่ • `H` ช่วยเหลือ • `Enter` แชท (`/w ชื่อ`, `/p`, `/g`, `/world`)

## สิ่งที่มีในเกม

| ระบบ | รายละเอียด |
|---|---|
| คลาส | 10 คลาส: Warrior, Paladin, Ranger, Assassin, Arcanist, Necromancer, Cleric, Shaman, Gunslinger, Monk |
| สกิล | คลาสละ 100 สกิล = **Active 90 + Ultimate 10** (รวม 1,000 สกิล) ทุกสกิลมี ID คงที่ พฤติกรรม ธาตุ กลไกเฉพาะ และระดับ Rank 1–20 |
| Support Runes | 39 รูนส่วนกลาง เปลี่ยน **รูปแบบ** สกิล เช่น Split, Chain, Fork, Echo, Nova/Trap/Totem/Orbit/Spirit Conversion, Gravity Well, Mirror, Cascade, Element Shift ฯลฯ (ช่องรูน 1/2/3 ที่ Rank 1/8/16) • ฟิวส์ 3 รูนเป็นรูนระดับสูงขึ้น |
| Passive Tree | 7 สาย: อาวุธ (แยก melee/ranged/magic) • ธาตุ (8 ธาตุ + เจาะเกราะ) • ความเร็ว • คริติคอล • ดูดเลือด • ป้องกัน • **สายประจำคลาส** พร้อม Keystone ที่เปลี่ยนวิธีเล่น (Berserker, Blood Magic, Momentum, Critical Cascade, Legion, Totem Lord, Sniper, Spellweaver …) |
| Build | Reset Build ด้วยทองในเกม (ฟรีก่อน Lv20) • Build Preset 6 ช่อง ติดแท็ก PvE/PvP สลับได้นอกการต่อสู้ |
| โลก | 5 เมืองหลัก • 30 แมพฟาร์ม (Lv 1–300) • มอนสเตอร์ 90 ชนิด + Elite • บอสแมพทุกแมพ • บอสโลก 3 ตัวเกิดตามเวลา |
| ดันเจี้ยน | Story (1–4) 5 แห่ง • Abyss (1–4) ชั้นไม่สิ้นสุด สุ่ม Modifier • Boss Hunt (1–4) เลือกบอสได้ 13 ตัว • Raid (4–8) 2 แห่ง • Guild Boss |
| กลไกบอส | ท่าที่ต้องหลบ (พื้นแดง) • ท่า **Counter** (พื้นทอง → กด F ในจังหวะ = บอสมึน + จุดอ่อน x2) • ชาร์จชนกำแพงแล้วมึน • จุดอ่อนชั่วคราว • เปลี่ยนเฟสตาม HP • เรียกลูกน้อง • วาร์ป • Enrage |
| ไอเทม | Common → Magic → Rare → Epic → Legendary → Mythic • Random Affix 50+ ชนิด • Legendary 18 แบบที่เปลี่ยนพฤติกรรมสกิล (เช่น Dash ทิ้งเงาระเบิด) • Mythic 5 แบบพร้อมข้อแลกเปลี่ยน • Set 6 ชุด (โบนัส 2/4 ชิ้น) • การ์ดมอนสเตอร์ฝัง Socket |
| คราฟต์ | Craft (เลือกช่อง/ตัวเร่ง/เซ็ต) • Reroll Affix • ตีบวก +1..+10 • เจาะ Socket • ซ่อม • แยกชิ้นส่วน |
| เศรษฐกิจ | ดรอปตัดสินโดยเซิร์ฟเวอร์เท่านั้น (Personal Loot) • ตัวดูดทอง: ค่าซ่อม ค่าคราฟต์ ค่าตีบวก ค่ารีเซ็ต ค่าวาร์ป ค่าวางขาย 1% ค่าธรรมเนียมตลาด 6% • Mythic ผูกบัญชี • Shared Stash ข้ามตัวละคร • Marketplace |
| PvP | Duel 1v1 / Arena 3v3 (Ranked, Elo, แรงก์ Bronze→Grandmaster, **Normalize ค่าอุปกรณ์**) • Battleground 10v10 (ยึด 3 จุด) • ค่าปรับ PvP แยกจาก PvE (ดาเมจ สตัน ดูดเลือด จำนวนสมุน ฮีล โล่) • ไม่มี PvP บังคับในแมพฟาร์ม |
| กิลด์ | สร้าง/ตรา/ตำแหน่ง 4 ระดับ • Level & Contribution • เควสต์ประจำวัน • Guild Boss • คลังพร้อมบันทึก • สกิลกิลด์ (ไม่เพิ่มพลังต่อสู้ถาวร) • อันดับ & รางวัลฤดูกาล |
| Guild War 20v20 | ขั้น 1 แย่ง Control Point 3 จุด → เปิดประตู • ขั้น 2 ทำลาย Guardian Crystal • ขั้น 3 ยึด Core ก่อนหมดเวลา • ผู้ชนะได้ทรัพยากรกิลด์ + ของตกแต่งฤดูกาล |
| อื่นๆ | ปาร์ตี้ 8 คน (แชร์ EXP/ของ) • แชท 5 ช่อง • เควสต์ล่ามอน/บอส • เลเวล 1–300 + Mastery Level |

## สถาปัตยกรรม

```
shared/      โค้ด/ข้อมูลที่ใช้ร่วมกันทั้ง Browser และ Server (ES Modules)
  constants.js  ค่าคงที่ เศรษฐกิจ PvP ธาตุ สถานะ
  classes.js    นิยาม 10 คลาส (9 สายสกิล + 10 อัลติเมท + passive ประจำคลาส)
  skills.js     ตัวสร้างสกิล (สาย × 10 variant) + resolveSkill() รวม rank/รูน/keystone/legendary
  runes.js      Support Runes (แต่ละอันคือฟังก์ชันแปลง spec ของสกิล)
  passives.js   Passive Tree แบบ data-driven
  items.js      ฐานไอเทม affix legendary mythic set วัตถุดิบ
  stats.js      คำนวณค่าสถานะ (รวม normalize สำหรับ Ranked PvP)
  world.js      เมือง แมพ มอนสเตอร์ การ์ด บอส ดันเจี้ยน เควสต์
  mapgen.js     สร้างแผนที่แบบ deterministic (client/server ได้ผลเหมือนกัน ไม่ต้องส่ง tile)
server/      Authoritative game server
  index.js      HTTP + WebSocket
  game.js       session, การเคลื่อนที่, ร่ายสกิล, EXP/ดรอป, ตาย/เกิด
  instance.js   จำลองแมพ: AI มอนสเตอร์, AI บอส (telegraph/counter/phase), projectile, area, snapshot
  combat.js     ดาเมจ สถานะ minion totem orbit
  modes.js      ประชากรมอนในแมพฟาร์ม บอสแมพ บอสโลก
  dungeons.js   Story / Abyss / Hunt / Raid / Guild Boss
  pvp.js        คิว จับคู่ Arena/BG/Guild War และบอท
  player.js     Build, ไอเทม, คราฟต์, NPC, เควสต์
  social.js     แชท ปาร์ตี้ กิลด์ ตลาด
  loot.js       ตารางดรอป (เซิร์ฟเวอร์เท่านั้น)
client/      index.html + js/ (main, render, sprites, ui)
```

หลักการสำคัญ: Browser ส่งแค่ **input** (ทิศทาง, ร่ายสกิลช่องไหน, หลบ, เก็บของ) — เซิร์ฟเวอร์เป็นผู้ตัดสินตำแหน่ง ดาเมจ คูลดาวน์ ทรัพยากร ดรอป และการซื้อขายทั้งหมด
Snapshot ส่ง 10 ครั้ง/วินาที เฉพาะสิ่งที่อยู่ในรัศมีมองเห็น (interest management) และ projectile ถูกจำลองฝั่ง client เพื่อลด bandwidth

## การต่อยอด

- **เพิ่มคลาส**: เพิ่ม object ใน `CLASSES` (`shared/classes.js`) — 9 schools + 10 ultimates + passives แล้วเพิ่มอาวุธใน `WEAPON_TYPES` ระบบจะสร้าง 100 สกิลให้อัตโนมัติ (ถ้าต้องการชุดหัว pixel art ใหม่ เพิ่มใน `HEAD` ที่ `client/js/sprites.js`)
- **เพิ่มรูน**: เพิ่ม object ใน `RUNES` พร้อม `apply(spec)` — สกิลเดิมไม่ต้องแก้
- **เพิ่มโหนด Passive**: ต่อท้าย chain ใน `BRANCHES` หรือเพิ่ม branch ใหม่ — ID เดิมไม่เปลี่ยน save เดิมใช้ได้ (โหนดที่ถูกลบจะถูกล้างอัตโนมัติ)
- **เพิ่ม Legendary**: เพิ่มใน `LEGENDARIES` (items.js) และใส่ผลใน `LEGENDARY_SKILL_MODS` (skills.js) หรือใน combat
- **เพิ่มบอส/ท่าบอส**: เพิ่มใน `BOSSES` / `BOSS_ATTACKS` ใน `world.js`
- **เพิ่มแมพ/ภูมิภาค**: เพิ่มใน `REGIONS` ใน `world.js`
- อนาคต: Guild Territory, Castle Customization, สงครามข้ามเซิร์ฟเวอร์, Guild Alliance (มีฟิลด์ `alliance` เตรียมไว้), ย้ายฐานข้อมูลเป็น PostgreSQL/Redis (แทน `server/db.js` โดยคง API เดิม)
