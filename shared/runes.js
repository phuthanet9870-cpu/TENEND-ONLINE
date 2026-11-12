// ===== Support Runes : Skill Modification system =====
// Runes CHANGE HOW a skill behaves (not only damage). Each rune has:
//   id, name, th (Thai desc), for: behaviors it can attach to (null = any), apply(spec)
// Add a new rune by appending to RUNES — existing skills need no change.
const DMG = ['melee', 'projectile', 'nova', 'ground', 'beam', 'dash', 'leap', 'chain', 'trap', 'orbit', 'barrage', 'totem', 'summon'];
const PROJ = ['projectile', 'barrage'];
const AREA = ['nova', 'ground', 'leap', 'trap', 'heal'];

export const RUNES = [
  { id: 'split', name: 'Split', tier: 1, for: PROJ, th: 'ยิงเพิ่ม +2 ลูก กระจายเป็นพัด ดาเมจต่อลูก -25%', apply: (s) => { s.count += 2; s.spread = Math.max(s.spread, 36); s.dmg *= 0.75; } },
  { id: 'pierce', name: 'Pierce', tier: 1, for: PROJ, th: 'โปรเจกไทล์ทะลุศัตรู +3 ตัว', apply: (s) => { s.pierce += 3; } },
  { id: 'chain', name: 'Chain', tier: 2, for: ['projectile', 'chain', 'beam', 'melee', 'barrage'], th: 'เมื่อโดน กระโดดไปยังศัตรูใกล้เคียง +2 ครั้ง', apply: (s) => { s.chain += 2; s.dmg *= 0.9; } },
  { id: 'homing', name: 'Seeker', tier: 1, for: PROJ, th: 'โปรเจกไทล์ติดตามเป้าหมาย', apply: (s) => { s.homing = true; s.speed *= 0.9; } },
  { id: 'echo', name: 'Echo', tier: 3, for: null, th: 'สกิลร่ายซ้ำอัตโนมัติอีกครั้งหลัง 0.5 วินาที (ดาเมจ 60%)', apply: (s) => { s.echo += 1; s.echoMul = 0.6; s.cd *= 1.15; } },
  { id: 'detonate', name: 'Detonate', tier: 2, for: ['projectile', 'dash', 'barrage', 'chain', 'trap', 'orbit'], th: 'ระเบิดเมื่อจบการทำงาน ทำดาเมจรอบข้าง', apply: (s) => { s.detonate = Math.max(s.detonate, 90); } },
  { id: 'nova', name: 'Nova Conversion', tier: 3, for: ['projectile'], th: 'เปลี่ยนเป็นยิงรอบตัว 8 ทิศ', apply: (s) => { s.radial = true; s.count = Math.max(8, s.count + 6); s.dmg *= 0.6; s.range *= 0.6; } },
  { id: 'fork', name: 'Fork', tier: 2, for: PROJ, th: 'เมื่อโดนเป้าหมาย แตกออกเป็น 2 ลูก', apply: (s) => { s.fork += 1; } },
  { id: 'gravity', name: 'Gravity Well', tier: 2, for: ['ground', 'nova', 'leap', 'trap', 'projectile'], th: 'ดูดศัตรูเข้าหาจุดศูนย์กลาง', apply: (s) => { s.pull = true; } },
  { id: 'linger', name: 'Lingering Field', tier: 1, for: ['ground', 'nova', 'leap', 'projectile', 'dash', 'trap'], th: 'ทิ้งพื้นที่ดาเมจต่อเนื่อง 4 วินาที', apply: (s) => { s.linger += 4; } },
  { id: 'trap', name: 'Trap Conversion', tier: 3, for: ['ground', 'nova', 'projectile'], th: 'เปลี่ยนเป็นกับดัก ระเบิดเมื่อศัตรูเหยียบ (สูงสุด 3 อัน)', apply: (s) => { s.trapMode = true; s.dmg *= 1.3; } },
  { id: 'totem', name: 'Totem Conversion', tier: 3, for: ['projectile', 'chain', 'nova', 'beam', 'ground'], th: 'ปักโทเท็มที่ร่ายสกิลนี้ให้อัตโนมัติ 8 วินาที', apply: (s) => { s.totemMode = true; s.dmg *= 0.55; s.cd = Math.max(s.cd, 6); } },
  { id: 'minion', name: 'Spirit Caster', tier: 3, for: ['projectile', 'chain', 'melee', 'beam'], th: 'อัญเชิญวิญญาณที่ร่ายสกิลนี้ตามคุณ 12 วินาที', apply: (s) => { s.spiritMode = true; s.dmg *= 0.5; s.cd = Math.max(s.cd, 8); } },
  { id: 'overcharge', name: 'Overcharge', tier: 2, for: null, th: 'ร่ายช้าลง 0.4 วิ แต่ดาเมจ +70% และขนาด +30%', apply: (s) => { s.windup += 0.4; s.dmg *= 1.7; s.radius *= 1.3; s.width *= 1.3; } },
  { id: 'rapid', name: 'Rapid Fire', tier: 1, for: null, th: 'คูลดาวน์ -40% ดาเมจ -30%', apply: (s) => { s.cd *= 0.6; s.dmg *= 0.7; } },
  { id: 'charges', name: 'Charges', tier: 2, for: null, th: 'สะสมได้ 3 ชาร์จ คูลดาวน์ +30%', apply: (s) => { s.charges = 3; s.cd *= 1.3; } },
  { id: 'bloodprice', name: 'Blood Price', tier: 2, for: null, th: 'ใช้ HP แทนทรัพยากร ดาเมจ +30%', apply: (s) => { s.costHp = true; s.dmg *= 1.3; } },
  { id: 'vampiric', name: 'Vampiric', tier: 1, for: DMG, th: 'ดูดเลือด 6% ของดาเมจจากสกิลนี้', apply: (s) => { s.leech += 6; } },
  { id: 'ember', name: 'Ember Shift', tier: 1, for: DMG, th: 'เปลี่ยนเป็นธาตุไฟ + เผาไหม้', apply: (s) => { s.el = 'fire'; s.extraStatus.push('burn'); } },
  { id: 'frost', name: 'Frost Shift', tier: 1, for: DMG, th: 'เปลี่ยนเป็นธาตุน้ำแข็ง + หนาวเหน็บ', apply: (s) => { s.el = 'ice'; s.extraStatus.push('chill'); } },
  { id: 'storm', name: 'Storm Shift', tier: 1, for: DMG, th: 'เปลี่ยนเป็นธาตุสายฟ้า + ช็อต', apply: (s) => { s.el = 'lightning'; s.extraStatus.push('shock'); } },
  { id: 'venom', name: 'Venom Shift', tier: 1, for: DMG, th: 'เปลี่ยนเป็นธาตุพิษ + พิษสะสม', apply: (s) => { s.el = 'poison'; s.extraStatus.push('poison'); } },
  { id: 'umbral', name: 'Umbral Shift', tier: 1, for: DMG, th: 'เปลี่ยนเป็นธาตุเงา + ตาบอด', apply: (s) => { s.el = 'shadow'; s.extraStatus.push('blind'); } },
  { id: 'radiant', name: 'Radiant Shift', tier: 1, for: DMG, th: 'เปลี่ยนเป็นธาตุศักดิ์สิทธิ์ + ฮีลตัวเองเมื่อโดน', apply: (s) => { s.el = 'holy'; s.healOnHit += 2; } },
  { id: 'shatter', name: 'Shatter', tier: 2, for: DMG, th: 'ศัตรูที่ถูกแช่แข็ง/หนาว ระเบิดแตกได้รับดาเมจ x2', apply: (s) => { s.shatter = true; } },
  { id: 'execute', name: 'Executioner', tier: 2, for: DMG, th: 'ดาเมจ +100% กับศัตรูที่ HP ต่ำกว่า 25%', apply: (s) => { s.execute = Math.max(s.execute, 0.25); } },
  { id: 'impact', name: 'Impact', tier: 1, for: DMG, th: 'ผลักศัตรูกระเด็น', apply: (s) => { s.knock += 90; } },
  { id: 'barrier', name: 'Barrier', tier: 1, for: null, th: 'ได้โล่ 6% HP สูงสุดเมื่อร่าย', apply: (s) => { s.selfShield += 6; } },
  { id: 'haste', name: 'Haste', tier: 1, for: null, th: 'ร่ายแล้วได้ความเร็วเคลื่อนที่ +30% 2 วินาที', apply: (s) => { s.selfHaste = true; } },
  { id: 'mark', name: "Hunter's Mark", tier: 1, for: DMG, th: 'ตีตราเป้าหมาย รับดาเมจเพิ่ม 15%', apply: (s) => { s.extraStatus.push('mark'); } },
  { id: 'orbitconv', name: 'Orbit Conversion', tier: 3, for: ['projectile'], th: 'โปรเจกไทล์โคจรรอบตัวแทนการยิงออกไป', apply: (s) => { s.orbitMode = true; s.count = Math.max(3, s.count); s.dmg *= 0.5; } },
  { id: 'delay', name: 'Delayed Burst', tier: 2, for: ['ground', 'nova', 'melee', 'leap'], th: 'ระเบิดช้าลง 1 วินาที ดาเมจ +60%', apply: (s) => { s.delay += 1; s.dmg *= 1.6; } },
  { id: 'mirror', name: 'Mirror Image', tier: 3, for: ['projectile', 'beam', 'melee', 'barrage'], th: 'ร่ายสำเนาไปทางด้านหลังพร้อมกัน', apply: (s) => { s.mirror = true; } },
  { id: 'cascade', name: 'Cascade', tier: 2, for: ['ground', 'nova'], th: 'ระเบิดต่อเนื่องเป็นแนว 3 จุด', apply: (s) => { s.cascade = 3; s.dmg *= 0.75; } },
  { id: 'precision', name: 'Precision', tier: 1, for: DMG, th: 'โอกาสคริติคอล +25% สำหรับสกิลนี้', apply: (s) => { s.critBonus += 25; } },
  { id: 'concentrate', name: 'Concentrate', tier: 1, for: DMG, th: 'พื้นที่เล็กลง 30% ดาเมจ +40%', apply: (s) => { s.radius *= 0.7; s.arc *= 0.7; s.dmg *= 1.4; } },
  { id: 'swarm', name: 'Swarm', tier: 2, for: ['summon', 'totem'], th: 'อัญเชิญ/ปักเพิ่ม +2 แต่อ่อนลง 30%', apply: (s) => { s.count += 2; s.dmg *= 0.7; } },
  { id: 'endure', name: 'Endurance', tier: 1, for: ['summon', 'totem', 'buff', 'orbit', 'trap'], th: 'ระยะเวลา +60%', apply: (s) => { s.duration *= 1.6; } },
  { id: 'sanctify', name: 'Sanctify', tier: 2, for: ['heal', 'buff', 'nova'], th: 'แชร์ผลไปยังปาร์ตี้รอบตัว และชำระล้างสถานะผิดปกติ', apply: (s) => { s.aura = Math.max(s.aura, 320); s.cleanse = true; } },
];

export const RUNE_BY_ID = Object.fromEntries(RUNES.map((r) => [r.id, r]));
export const runeFits = (rune, behavior) => !rune.for || rune.for.includes(behavior);
export const runeSlotsForRank = (rank) => (rank >= 16 ? 3 : rank >= 8 ? 2 : 1);
