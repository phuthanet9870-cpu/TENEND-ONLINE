// ===== Signature skill mechanics =====
// 125 distinct mechanics (Ragnarok-style). Every class picks 90 of them by its affinity,
// so the 90 Active Skills of one class never share a mechanic. Each has its own params,
// special effect (handled in server/sigexec.js + combat.js), icon and VFX style.
//
// S(id, family, name, icon, behavior, params, thaiDesc, opts)
//   opts.el   : fixed element ('class' = class main element)    opts.tier: 1-4 (unlock order)
//   opts.v    : VFX style for the client renderer               opts.names: per-element names
export const FAMILIES = {
  strike: { th: 'โจมตีประชิด', icon: '🗡' },
  sweep: { th: 'กวาดพื้นที่', icon: '🌀' },
  shot: { th: 'ยิงระยะไกล', icon: '🏹' },
  spell: { th: 'เวทธาตุ', icon: '🔮' },
  control: { th: 'ควบคุม', icon: '⛓' },
  buff: { th: 'เสริมพลัง', icon: '✨' },
  heal: { th: 'ฟื้นฟู', icon: '💚' },
  summon: { th: 'อัญเชิญ', icon: '👻' },
  move: { th: 'เคลื่อนที่ & กับดัก', icon: '💨' },
};
export const SIGS = [];
const S = (id, fam, name, icon, b, p, th, opts = {}) => SIGS.push({ id, fam, name, icon, b, p, th, tier: opts.tier || 1, el: opts.el, v: opts.v || fam, names: opts.names });

// ---------------- strike ----------------
S('bash', 'strike', 'Bash', '🔨', 'melee', { dmg: 190, cd: 1.8, arc: 70, mech: 'stun', sp: 1.4 }, 'ฟาดอาวุธอย่างแรงใส่เป้าหมายข้างหน้า มีโอกาสทำให้มึนงง', { v: 'smash' });
S('double', 'strike', 'Double Strike', '⚔', 'melee', { dmg: 100, cd: 0.9, arc: 80, multiHit: 2, interval: 0.15 }, 'ฟันติดกัน 2 ครั้งอย่างรวดเร็ว', { v: 'xslash' });
S('triple', 'strike', 'Triple Blow', '👊', 'melee', { dmg: 85, cd: 2.6, arc: 80, multiHit: 3, interval: 0.18, lastKnock: 160 }, 'คอมโบ 3 จังหวะ จังหวะสุดท้ายกระแทกศัตรูกระเด็น', { v: 'combo', tier: 2 });
S('uppercut', 'strike', 'Uppercut', '⤴', 'melee', { dmg: 175, cd: 5, arc: 60, knockup: 1.1 }, 'ซัดขึ้นฟ้า ศัตรูลอยกลางอากาศและขยับไม่ได้ชั่วครู่', { v: 'launch', tier: 2 });
S('thrust', 'strike', 'Pierce', '🔱', 'beam', { dmg: 185, cd: 2.4, range: 190, width: 34, pierce: 9, windup: 0.12 }, 'แทงทะลุแนวตรง โดนทุกตัวในแนว', { v: 'thrust' });
S('sonic', 'strike', 'Sonic Blow', '💢', 'melee', { dmg: 48, cd: 8, arc: 70, multiHit: 8, interval: 0.07, critBonus: 15 }, 'ปล่อยหมัด/ใบมีด 8 ครั้งในพริบตาใส่ศัตรูข้างหน้า', { v: 'flurry', tier: 3 });
S('execute', 'strike', 'Execution', '💀', 'melee', { dmg: 160, cd: 5, arc: 60, execute: 0.35, execMul: 2.5 }, 'ปลิดชีพ: ดาเมจ x2.5 กับศัตรูที่ HP ต่ำกว่า 35%', { v: 'execute', tier: 3 });
S('sunder', 'strike', 'Armor Break', '🛡', 'melee', { dmg: 125, cd: 6, arc: 70, sunder: 6 }, 'ทุบเกราะ เป้าหมายเกราะลดลง 40% เป็นเวลา 6 วินาที', { v: 'crack', tier: 2 });
S('rend', 'strike', 'Rend', '🩸', 'melee', { dmg: 95, cd: 3, arc: 90, mech: 'bleed', sp: 2.6 }, 'ฉีกเนื้อ ทำให้เลือดไหลรุนแรง', { v: 'rend' });
S('backstab', 'strike', 'Backstab', '🔪', 'melee', { dmg: 270, cd: 7, range: 340, behind: true, guaranteedCrit: true }, 'วาร์ปไปด้านหลังเป้าหมายแล้วแทงคริติคอลแน่นอน', { v: 'shadowstep', tier: 3 });
S('riposte', 'strike', 'Parry Stance', '🤺', 'buff', { cd: 12, cost: 10, duration: 3, parry: 3, buff: { block: 30 } }, 'ตั้งท่าปัดป้อง 3 วินาที การโจมตีประชิดที่โดนจะถูกปัดและผู้โจมตีมึนงง', { v: 'parry', tier: 2 });
S('hook', 'strike', 'Grapple Hook', '🪝', 'projectile', { dmg: 110, cd: 6, speed: 750, range: 480, hook: true }, 'เหวี่ยงตะขอ ดึงศัตรูตัวแรกที่โดนเข้ามาหาตัว', { v: 'chain', tier: 2 });
S('silence', 'strike', 'Silencing Blow', '🤐', 'melee', { dmg: 120, cd: 8, arc: 60, silence: 2.5 }, 'ฟาดที่ลำคอ ศัตรูใช้สกิลไม่ได้ 2.5 วินาที', { v: 'smash', tier: 3 });
S('lunge', 'strike', 'Lunge', '🏇', 'dash', { dmg: 60, cd: 5, range: 200, endHit: 220 }, 'พุ่งเข้าหาแล้วแทงแรงที่ปลายทาง', { v: 'thrust' });
S('crescent', 'strike', 'Crescent Slash', '🌙', 'melee', { dmg: 150, cd: 3, arc: 200, range: 120 }, 'ฟันเป็นรูปจันทร์เสี้ยวกว้าง 200 องศา', { v: 'crescent' });
S('asura', 'strike', 'Asura Strike', '☄', 'melee', { dmg: 300, cd: 30, arc: 50, consumeMp: true, cost: 10 }, 'เผาทรัพยากรทั้งหมด แปลงเป็นหมัดเดียวทำลายล้าง ยิ่งเหลือมากยิ่งแรง', { v: 'asura', tier: 4 });
// ---------------- sweep ----------------
S('cleave', 'sweep', 'Cleave', '🪓', 'melee', { dmg: 140, cd: 1.1, arc: 150, range: 110 }, 'ฟันกวาดเป็นวงกว้างข้างหน้า', { v: 'slash' });
S('whirl', 'sweep', 'Whirlwind', '🌪', 'nova', { dmg: 60, cd: 7, radius: 115, multiHit: 5, interval: 0.22, follow: true }, 'หมุนตัวต่อเนื่อง 5 รอบ ทำดาเมจรอบตัวทุกจังหวะ', { v: 'spin', tier: 2 });
S('magnum', 'sweep', 'Magnum Break', '💥', 'nova', { dmg: 200, cd: 8, radius: 150, knock: 140, enchant: 6 }, 'ระเบิดพลังรอบตัว ผลักศัตรู และติดธาตุให้อาวุธ 6 วินาที', { v: 'explosion', tier: 2, el: 'class' });
S('shockwave', 'sweep', 'Shockwave', '〰', 'nova', { dmg: 110, cd: 7, radius: 80, rings: 3 }, 'คลื่นกระแทก 3 วงขยายออกจากตัว', { v: 'rings', tier: 2 });
S('fissure', 'sweep', 'Fissure', '⛰', 'ground', { dmg: 120, cd: 6, march: 6, step: 70, mech: 'stun', sp: 0.8 }, 'พื้นดินแยกเป็นแนวยาวพุ่งไปข้างหน้า', { v: 'spikes', tier: 2 });
S('bowling', 'sweep', 'Bowling Bash', '🎳', 'melee', { dmg: 170, cd: 4, arc: 70, knock: 230, impactSplash: 90 }, 'ตีศัตรูกระเด็นไปชนพวกเดียวกัน ทำดาเมจจุดที่ตกลง', { v: 'smash', tier: 3 });
S('cyclone', 'sweep', 'Cyclone Charge', '🌀', 'dash', { dmg: 120, cd: 6, range: 280, width: 100 }, 'หมุนตัวพุ่งทะลุแถวศัตรูเป็นแนวกว้าง', { v: 'spin', tier: 2 });
S('tremor', 'sweep', 'Tremor', '🌋', 'nova', { dmg: 90, cd: 6, radius: 210, mech: 'slow' }, 'กระทืบพื้นสั่นสะเทือนวงกว้าง ศัตรูช้าลง', { v: 'rings' });
S('reap', 'sweep', 'Reaping Arc', '🌾', 'melee', { dmg: 130, cd: 3, arc: 180, range: 120, leech: 25 }, 'กวาดเคียวพลังชีวิต ดูดเลือดจากทุกตัวที่โดน', { v: 'crescent', tier: 2 });
S('splitter', 'sweep', 'Earth Splitter', '🪨', 'beam', { dmg: 210, cd: 5, range: 430, width: 52, windup: 0.45 }, 'ผ่าแผ่นดินเป็นแนวตรงไกล', { v: 'crack', tier: 3 });
S('pillarslam', 'sweep', 'Pillar Slam', '🗿', 'ground', { dmg: 240, cd: 9, radius: 90, delay: 0.7, range: 260, mech: 'stun', sp: 1.3 }, 'เรียกเสาหินทุบลงพื้นเป้าหมาย', { v: 'pillar', tier: 3 });
S('vortexslash', 'sweep', 'Vortex Slash', '🌊', 'nova', { dmg: 140, cd: 7, radius: 170, pull: true }, 'ฟันวนดูดศัตรูเข้ามาหาตัว', { v: 'vortex', tier: 3 });
// ---------------- shot ----------------
S('pierceshot', 'shot', 'Piercing Shot', '➶', 'projectile', { dmg: 170, cd: 1.6, speed: 820, pierce: 6 }, 'ยิงทะลุศัตรูหลายตัวในแนวเดียว', { v: 'arrow' });
S('multishot', 'shot', 'Multi Shot', '🎯', 'projectile', { dmg: 80, cd: 1.3, count: 5, spread: 45 }, 'ยิง 5 ลูกเป็นรูปพัด', { v: 'arrow' });
S('ricochet', 'shot', 'Ricochet', '↯', 'projectile', { dmg: 120, cd: 1.8, chain: 4 }, 'กระสุนเด้งไปหาศัตรูตัวถัดไป 4 ครั้ง', { v: 'shard', tier: 2 });
S('splitshot', 'shot', 'Split Shot', '🔀', 'projectile', { dmg: 120, cd: 1.6, fork: 2 }, 'เมื่อโดนเป้าหมาย แตกออกเป็นลูกใหม่', { v: 'arrow' });
S('seeker', 'shot', 'Seeker Volley', '🛰', 'barrage', { dmg: 55, cd: 4, count: 6, homing: true }, 'ปล่อยกระสุนนำวิถี 6 ลูก', { v: 'orb', tier: 2 });
S('arrowstorm', 'shot', 'Arrow Storm', '🌟', 'nova', { dmg: 50, cd: 7, spiral: 3, count: 12 }, 'ยิงเกลียววนรอบตัว 3 รอบ', { v: 'arrow', tier: 3 });
S('sniper', 'shot', 'Sniper Shot', '🔭', 'projectile', { dmg: 520, cd: 9, speed: 1300, range: 1000, windup: 0.9, critBonus: 50, pierce: 2 }, 'เล็งนาน ยิงไกลมากและแรงมาก คริติคอลสูง', { v: 'tracer', tier: 4 });
S('cluster', 'shot', 'Cluster Bomb', '💣', 'projectile', { dmg: 70, cd: 6, speed: 420, range: 400, cluster: 6 }, 'ระเบิดแตกเป็นลูกเล็ก 6 ลูกกระจายรอบจุดตก', { v: 'bomb', tier: 2 });
S('boomerang', 'shot', 'Boomerang', '🪃', 'projectile', { dmg: 125, cd: 2.5, speed: 560, range: 420, pierce: 99, boomerang: true }, 'ขว้างออกไปแล้ววนกลับ โดนศัตรูทั้งไปและกลับ', { v: 'spinblade' });
S('net', 'shot', 'Binding Net', '🕸', 'projectile', { dmg: 60, cd: 7, speed: 650, root: 2.5, radius: 18 }, 'ยิงตาข่าย ศัตรูขยับไม่ได้ 2.5 วินาที', { v: 'net', tier: 2 });
S('timebomb', 'shot', 'Time Bomb', '⏲', 'projectile', { dmg: 230, cd: 8, bomb: 2, radius: 12 }, 'ติดระเบิดไว้กับศัตรู 2 วินาทีต่อมาระเบิดวงกว้าง', { v: 'bomb', tier: 3 });
S('wave', 'shot', 'Shock Wave', '🌊', 'projectile', { dmg: 140, cd: 3.5, speed: 430, radius: 42, pierce: 99, knock: 90, range: 520 }, 'คลื่นพลังกว้างพุ่งทะลุ ผลักทุกตัวที่โดน', { v: 'wave' });
S('fan', 'shot', 'Blade Fan', '🪭', 'projectile', { dmg: 70, cd: 2, count: 7, spread: 70, range: 280 }, 'สาดใบมีด 7 เล่มระยะใกล้', { v: 'dagger' });
S('rainarrow', 'shot', 'Arrow Rain', '🌧', 'ground', { dmg: 45, cd: 5, radius: 150, rain: 12, rainDur: 1 }, 'ห่าลูกธนู 12 ดอกตกใส่พื้นที่เป้าหมาย', { v: 'rain', tier: 2 });
S('doubleshot', 'shot', 'Double Shot', '⏩', 'barrage', { dmg: 105, cd: 1.2, count: 2, interval: 0.1, spread: 2 }, 'ยิง 2 นัดติดกันแม่นยำ', { v: 'arrow' });
S('explosive', 'shot', 'Explosive Shot', '🎆', 'projectile', { dmg: 150, cd: 2.5, detonate: 110 }, 'ลูกระเบิดเมื่อกระทบ ทำดาเมจรอบข้าง', { v: 'bomb' });
S('tracer', 'shot', 'Tracer Round', '🔦', 'projectile', { dmg: 90, cd: 6, speed: 900, lex: true }, 'ตีตราเป้าหมาย ดาเมจครั้งถัดไปที่ได้รับ x2', { v: 'tracer', tier: 2 });
S('chargedshot', 'shot', 'Charged Shot', '🔋', 'projectile', { dmg: 215, cd: 4, speed: 950, knock: 200, windup: 0.4, radius: 16 }, 'ชาร์จพลังแล้วยิง ผลักศัตรูกระเด็นไกล', { v: 'orb', tier: 2 });
// ---------------- spell ----------------
S('fireball', 'spell', 'Burst Orb', '☄', 'projectile', { dmg: 170, cd: 1.8, speed: 460, detonate: 100 }, 'ลูกพลังระเบิดเมื่อกระทบเป้าหมาย', { v: 'orb', names: { fire: 'Fire Ball', ice: 'Frost Orb', lightning: 'Ball Lightning', shadow: 'Dark Orb', holy: 'Holy Orb', arcane: 'Arcane Orb', poison: 'Acid Orb' } });
S('firewall', 'spell', 'Wall', '🧱', 'ground', { dmg: 40, cd: 8, wall: 5, linger: 4, tick: 0.4, range: 300 }, 'สร้างกำแพงธาตุขวางทาง ทำดาเมจศัตรูที่เดินผ่าน', { v: 'wall', tier: 2, names: { fire: 'Fire Wall', ice: 'Ice Wall', lightning: 'Static Wall', poison: 'Thorn Wall', holy: 'Light Barrier', shadow: 'Shadow Wall', arcane: 'Arcane Wall' } });
S('firepillar', 'spell', 'Pillar', '🔥', 'trap', { dmg: 70, cd: 6, radius: 70, erupt: 5 }, 'วางผนึกบนพื้น เมื่อศัตรูเหยียบจะพุ่งขึ้นเป็นเสาธาตุ 5 ครั้ง', { v: 'pillar', tier: 2, names: { fire: 'Fire Pillar', ice: 'Ice Pillar', lightning: 'Thunder Pillar', holy: 'Light Pillar' } });
S('frostnova', 'spell', 'Nova', '❄', 'nova', { dmg: 120, cd: 6, radius: 160, mech: 'freeze', sp: 3 }, 'ระเบิดรอบตัว แช่แข็งศัตรูใกล้ตัว', { v: 'frost', el: 'ice', names: { ice: 'Frost Nova' } });
S('blizzard', 'spell', 'Blizzard', '🌨', 'ground', { dmg: 50, cd: 9, radius: 200, rain: 18, rainDur: 2.5, mech: 'chill' }, 'พายุหิมะ ก้อนน้ำแข็ง 18 ก้อนตกใส่พื้นที่', { v: 'rain', tier: 3, el: 'ice' });
S('icespear', 'spell', 'Spear', '🧊', 'projectile', { dmg: 160, cd: 1.6, speed: 680, pierce: 2, shatter: true }, 'หอกธาตุพุ่งทะลุ ทำลายศัตรูที่ถูกแช่แข็งรุนแรง', { v: 'shard', names: { ice: 'Ice Spear', lightning: 'Lightning Spear', holy: 'Holy Lance', fire: 'Flame Lance', shadow: 'Void Spear' } });
S('bolts', 'spell', 'Bolt', '⚡', 'chain', { dmg: 65, cd: 4, multiHit: 5, interval: 0.12, skyBolt: true, chain: 0 }, 'ฟ้าผ่าลงเป้าหมาย 5 ครั้งต่อเนื่อง', { v: 'bolt', names: { lightning: 'Lightning Bolt', fire: 'Fire Bolt', ice: 'Cold Bolt', holy: 'Judgement Bolt', shadow: 'Shadow Bolt' } });
S('thunderstorm', 'spell', 'Storm', '⛈', 'ground', { dmg: 80, cd: 8, radius: 170, rain: 10, rainDur: 1.6, mech: 'shock', skyBolt: true }, 'สายฟ้าผ่าแบบสุ่มในพื้นที่ 10 ครั้ง', { v: 'storm', tier: 2, el: 'lightning', names: { lightning: 'Thunderstorm' } });
S('chainl', 'spell', 'Chain', '🔗', 'chain', { dmg: 120, cd: 1.4, chain: 5 }, 'สายพลังกระโดดระหว่างศัตรู 5 ตัว', { v: 'bolt', names: { lightning: 'Chain Lightning', holy: 'Chain Heal-Light', shadow: 'Soul Chain', poison: 'Plague Chain' } });
S('jupitel', 'spell', 'Thunder Orb', '🔮', 'projectile', { dmg: 45, cd: 3, speed: 520, orbHits: 6, knock: 120 }, 'ลูกพลังกระแทกหลายครั้งพร้อมผลักศัตรูถอยหลัง', { v: 'orb', tier: 2, names: { lightning: 'Jupitel Thunder' } });
S('static', 'spell', 'Static Field', '🔋', 'nova', { dmg: 60, cd: 10, radius: 190, pctHp: 12 }, 'ลด HP ปัจจุบันของศัตรูรอบตัว 12% (บอสลดน้อยลง)', { v: 'rings', tier: 3, el: 'lightning' });
S('stormgust', 'spell', 'Storm Gust', '🌬', 'ground', { dmg: 55, cd: 10, radius: 190, linger: 3, tick: 0.5, mech: 'freeze', sp: 1.5 }, 'ลมพายุน้ำแข็งหมุนวน ศัตรูที่อยู่นานจะถูกแช่แข็ง', { v: 'blizzard', tier: 3, el: 'ice' });
S('vermilion', 'spell', 'Lord of Vermilion', '🌩', 'ground', { dmg: 60, cd: 12, radius: 240, linger: 3, tick: 0.5, mech: 'blind', range: 600 }, 'สายฟ้าสีชาดถล่มพื้นที่กว้างต่อเนื่อง ทำให้ตาบอด', { v: 'storm', tier: 4, el: 'lightning' });
S('meteorstorm', 'spell', 'Meteor Storm', '🌠', 'ground', { dmg: 170, cd: 12, radius: 230, rain: 6, rainDur: 2, rainR: 80, mech: 'stun', sp: 0.8, range: 600 }, 'อุกกาบาต 6 ลูกถล่มพื้นที่', { v: 'meteor', tier: 4, el: 'fire' });
S('soulstrike', 'spell', 'Soul Strike', '👻', 'barrage', { dmg: 60, cd: 2.4, count: 5, homing: true, interval: 0.08 }, 'ยิงดวงวิญญาณนำวิถี 5 ลูก', { v: 'ghost', el: 'shadow' });
S('napalm', 'spell', 'Napalm Beat', '🎇', 'ground', { dmg: 260, cd: 3, radius: 130, delay: 0.25, splitDmg: true }, 'ระเบิดพลังจิต ดาเมจรวมแบ่งเฉลี่ยให้ทุกตัวในวง', { v: 'explosion', el: 'class' });
S('gravity', 'spell', 'Gravity Field', '🧲', 'ground', { dmg: 70, cd: 9, radius: 180, linger: 3, tick: 0.5, pull: true, pullTick: true }, 'สนามแรงโน้มถ่วง ดึงศัตรูเข้ากลางต่อเนื่อง', { v: 'vortex', tier: 3, el: 'arcane' });
S('blackhole', 'spell', 'Black Hole', '🕳', 'ground', { dmg: 85, cd: 14, radius: 220, linger: 4, tick: 0.4, pull: true, pullTick: true, mech: 'weaken' }, 'หลุมดำกลืนกินทุกอย่างรอบตัว', { v: 'blackhole', tier: 4, el: 'shadow' });
S('tornado', 'spell', 'Tornado', '🌪', 'projectile', { dmg: 50, cd: 6, speed: 180, radius: 40, pierce: 99, range: 600, rehit: 0.4, pullProj: true }, 'พายุหมุนเคลื่อนช้าๆ ดูดและโจมตีซ้ำทุกตัวที่ผ่าน', { v: 'tornado', tier: 2 });
S('earthspike', 'spell', 'Earth Spike', '🗻', 'ground', { dmg: 110, cd: 5, march: 5, step: 80, knockup: 0.6 }, 'หนามหินพุ่งขึ้นเป็นแนว 5 จุด ศัตรูลอยขึ้น', { v: 'spikes', el: 'physical' });
S('heavensdrive', 'spell', "Heaven's Drive", '⛰', 'ground', { dmg: 90, cd: 6, radius: 160, rain: 8, rainDur: 0.8, rainR: 55 }, 'หนามหินผุดขึ้นแบบสุ่มทั่วพื้นที่', { v: 'spikes', tier: 2 });
S('missiles', 'spell', 'Magic Missiles', '✴', 'barrage', { dmg: 40, cd: 3, count: 9, interval: 0.07, homing: true, speed: 520 }, 'ขีปนาวุธเวท 9 ลูกไล่ล่าเป้าหมาย', { v: 'star' });
S('frostbolt', 'spell', 'Frost Bolt', '🥶', 'projectile', { dmg: 140, cd: 1.5, speed: 560, mech: 'chill', slowHit: 3 }, 'ลูกเย็นทำให้ศัตรูช้าลงอย่างมาก', { v: 'shard', el: 'ice' });
S('breath', 'spell', 'Dragon Breath', '🐉', 'melee', { dmg: 75, cd: 7, arc: 60, range: 240, multiHit: 4, interval: 0.2, linger: 2 }, 'พ่นลมหายใจธาตุเป็นรูปกรวยยาว', { v: 'breath', tier: 3 });
S('prism', 'spell', 'Prism Ray', '🌈', 'beam', { dmg: 120, cd: 4, range: 480, width: 24, prismSplit: 3 }, 'ลำแสงแยกเป็น 3 ลำ กระจายเป็นพัด', { v: 'beam', tier: 3, el: 'arcane' });
S('acid', 'spell', 'Acid Rain', '☔', 'ground', { dmg: 35, cd: 9, radius: 190, linger: 4, tick: 0.5, sunder: 3, mech: 'poison' }, 'ฝนกรดกัดกร่อนเกราะและทำให้ติดพิษ', { v: 'cloud', tier: 2, el: 'poison' });
S('holylight', 'spell', 'Holy Light', '✝', 'projectile', { dmg: 175, cd: 1.6, speed: 700, healOnHit: 3 }, 'ลำแสงศักดิ์สิทธิ์ ฟื้น HP ตัวเองเมื่อโดน', { v: 'holy', el: 'holy' });
S('exorcism', 'spell', 'Magnus Exorcismus', '✚', 'ground', { dmg: 70, cd: 12, radius: 170, linger: 4, tick: 0.5, cross: true }, 'ผนึกไม้กางเขนศักดิ์สิทธิ์ ชำระล้างศัตรูต่อเนื่อง', { v: 'cross', tier: 4, el: 'holy' });
// ---------------- control ----------------
S('frostring', 'control', 'Frost Ring', '⭕', 'nova', { dmg: 70, cd: 9, radius: 220, donut: 120, linger: 3, tick: 0.5, mech: 'freeze' }, 'วงแหวนน้ำแข็งล้อมรอบ ศัตรูที่ข้ามวงจะถูกแช่แข็ง', { v: 'frost', tier: 2, el: 'ice' });
S('quagmire', 'control', 'Quagmire', '🟫', 'ground', { dmg: 20, cd: 10, radius: 170, linger: 5, tick: 0.5, slowField: 60, sunder: 1 }, 'บึงโคลน ศัตรูช้าลงมากและเกราะลด', { v: 'swamp', tier: 2 });
S('slowfield', 'control', 'Decrease Agility', '🐌', 'ground', { dmg: 0, cd: 8, radius: 150, debuffSlow: 5 }, 'ลดความเร็วศัตรูในพื้นที่อย่างหนัก 5 วินาที', { v: 'runes' });
S('curse', 'control', 'Curse', '🧿', 'ground', { dmg: 30, cd: 9, radius: 140, mech: 'weaken', extra: ['slow', 'blind'] }, 'คำสาป: อ่อนแรง ช้า และตาบอดพร้อมกัน', { v: 'dark', tier: 2, el: 'shadow' });
S('stonecurse', 'control', 'Stone Curse', '🗿', 'chain', { dmg: 40, cd: 12, chain: 0, petrify: 3.5 }, 'สาปเป้าหมายให้กลายเป็นหิน 3.5 วินาที (บอสต้านทาน)', { v: 'stone', tier: 3 });
S('provoke', 'control', 'Provoke', '😤', 'nova', { dmg: 20, cd: 10, radius: 260, taunt: 5, sunder: 5 }, 'ยั่วยุศัตรูรอบตัวให้หันมาตีคุณ และลดเกราะของพวกมัน', { v: 'shout' });
S('timewarp', 'control', 'Time Warp', '⏳', 'ground', { dmg: 0, cd: 16, radius: 220, linger: 5, tick: 0.5, slowField: 85 }, 'บิดเวลา ศัตรูในพื้นที่แทบหยุดนิ่ง', { v: 'clock', tier: 4, el: 'arcane' });
S('lex', 'control', 'Lex Aeterna', '📜', 'chain', { dmg: 30, cd: 6, chain: 0, lex: true, range: 520 }, 'คัมภีร์นิรันดร์: ดาเมจครั้งถัดไปที่เป้าหมายได้รับ x2', { v: 'runes', tier: 2, el: 'holy' });
S('smoke', 'control', 'Smoke Screen', '💨', 'ground', { dmg: 20, cd: 12, radius: 160, range: 10, mech: 'blind', selfStealth: 2 }, 'ระเบิดควัน ศัตรูตาบอด และคุณหายตัว 2 วินาที', { v: 'cloud', tier: 2 });
S('hush', 'control', 'Hush', '🔇', 'ground', { dmg: 20, cd: 14, radius: 150, silence: 3 }, 'ผนึกเสียง ศัตรูในพื้นที่ใช้สกิลไม่ได้', { v: 'runes', tier: 3 });
S('repulse', 'control', 'Repulse', '🔆', 'nova', { dmg: 80, cd: 8, radius: 170, knock: 260 }, 'ผลักทุกอย่างรอบตัวออกไปไกล', { v: 'rings' });
S('entangle', 'control', 'Entangle', '🌿', 'ground', { dmg: 40, cd: 9, radius: 140, rootArea: 2.5, mech: 'poison' }, 'รากไม้พันขาศัตรูในพื้นที่', { v: 'vines', el: 'poison' });
S('fear', 'control', 'Terrify', '😱', 'nova', { dmg: 30, cd: 12, radius: 200, fear: 2.5 }, 'ทำให้ศัตรูหวาดกลัววิ่งหนี 2.5 วินาที', { v: 'dark', tier: 3, el: 'shadow' });
// ---------------- buff ----------------
S('blessing', 'buff', 'Blessing', '🙏', 'buff', { cd: 25, duration: 15, aura: 380, buff: { dmgAll: 15, crit: 5 } }, 'อวยพรตัวเองและปาร์ตี้ ดาเมจ +15% คริ +5%', { v: 'holy', el: 'holy' });
S('agility', 'buff', 'Swiftness', '🪶', 'buff', { cd: 25, duration: 15, aura: 380, buff: { move: 25, atkSpd: 20 } }, 'ปาร์ตี้เคลื่อนที่เร็ว +25% และโจมตีเร็วขึ้น', { v: 'wind' });
S('endure', 'buff', 'Endure', '🪨', 'buff', { cd: 20, duration: 6, ccImmune: 6, buff: { armorPct: 20 } }, 'อดทน: ต้านทานสถานะควบคุมทุกชนิด 6 วินาที', { v: 'parry' });
S('steelbody', 'buff', 'Steel Body', '🦾', 'buff', { cd: 40, duration: 10, buff: { armorPct: 300, move: -40, res: 30 } }, 'ร่างเหล็ก เกราะ x4 แต่เคลื่อนที่ช้าลง', { v: 'steel', tier: 3 });
S('berserk', 'buff', 'Berserk', '😡', 'buff', { cd: 45, duration: 10, hpCost: 15, buff: { atkSpd: 50, dmgAll: 35, leech: 5 } }, 'คลั่ง: เสีย HP 15% แลกโจมตีเร็วและแรงขึ้นมาก', { v: 'rage', tier: 3 });
S('reflect', 'buff', 'Reflect Shield', '🪞', 'buff', { cd: 25, duration: 8, buff: { reflect: 35 } }, 'สะท้อนดาเมจ 35% กลับใส่ผู้โจมตี', { v: 'parry', tier: 2 });
S('autoguard', 'buff', 'Auto Guard', '🛡', 'buff', { cd: 25, duration: 10, buff: { block: 35 } }, 'มีโอกาสบล็อกการโจมตี +35%', { v: 'parry' });
S('kyrie', 'buff', 'Kyrie Barrier', '🔰', 'buff', { cd: 20, duration: 10, aura: 380, kyrie: 22 }, 'โล่ศักดิ์สิทธิ์ให้ทั้งปาร์ตี้ ดูดซับดาเมจ 22% ของ HP', { v: 'holy', tier: 2, el: 'holy' });
S('enchant', 'buff', 'Weapon Enchant', '🗡', 'buff', { cd: 30, duration: 20, enchant: 20, buff: { dmgAll: 15 } }, 'อาบธาตุให้อาวุธ การโจมตีทั้งหมดเปลี่ยนเป็นธาตุนี้', { v: 'enchant', el: 'class' });
S('magnificat', 'buff', 'Magnificat', '🎶', 'buff', { cd: 40, duration: 20, aura: 380, buff: { mpRegen: 8 } }, 'บทสวดฟื้นทรัพยากรให้ปาร์ตี้เร็วขึ้นมาก', { v: 'note', tier: 2 });
S('lifetap', 'buff', 'Life Tap', '💉', 'buff', { cd: 15, duration: 1, hpCost: 15, mpGain: 50 }, 'แลก HP 15% เป็นทรัพยากร 50%', { v: 'dark' });
S('spheres', 'buff', 'Spirit Spheres', '🔵', 'orbit', { dmg: 30, cd: 20, count: 5, radius: 60, duration: 12, tick: 0.5, buffWith: { crit: 15, critDmg: 25 } }, 'ทรงกลมวิญญาณ 5 ลูกโคจร เพิ่มคริติคอลและโจมตีรอบตัว', { v: 'orb', tier: 2 });
S('cloak', 'buff', 'Cloak', '🫥', 'buff', { cd: 18, duration: 5, selfStealth: 5 }, 'หายตัว 5 วินาที การโจมตีแรกจากความมืดแรงขึ้น 50%', { v: 'shadowstep', tier: 2 });
S('devotion', 'buff', 'Devotion', '🤝', 'buff', { cd: 30, duration: 15, devotion: 15 }, 'รับดาเมจแทนพันธมิตรรอบตัว 30% เป็นเวลา 15 วินาที', { v: 'holy', tier: 3 });
S('focus', 'buff', 'Concentration', '🎯', 'buff', { cd: 30, duration: 12, buff: { crit: 30, critDmg: 40 } }, 'สมาธิแน่วแน่ คริติคอล +30% ดาเมจคริ +40%', { v: 'enchant', tier: 2 });
S('hasteaura', 'buff', 'Haste Aura', '⏱', 'buff', { cd: 40, duration: 15, aura: 380, buff: { cdr: 25 } }, 'ลดคูลดาวน์สกิลทั้งปาร์ตี้ 25%', { v: 'clock', tier: 3 });
S('warcry', 'buff', 'War Cry', '📢', 'buff', { cd: 30, duration: 12, aura: 380, buff: { dmgAll: 20, armorPct: 15 }, refund: 35 }, 'ตะโกนปลุกใจ ปาร์ตี้แรงขึ้น และคืนทรัพยากร 35%', { v: 'shout' });
// ---------------- heal ----------------
S('heal', 'heal', 'Heal', '❤', 'heal', { cd: 3, heal: 160, healTarget: true, radius: 450 }, 'ฟื้นฟู HP ให้พันธมิตรที่ HP น้อยที่สุดในระยะ', { v: 'heal', el: 'holy' });
S('sanctuary', 'heal', 'Sanctuary', '⛪', 'ground', { dmg: 25, cd: 15, radius: 180, linger: 6, tick: 1, healField: true, range: 350 }, 'แดนศักดิ์สิทธิ์ ฟื้น HP ทุกวินาทีและทำร้ายศัตรู', { v: 'holy', tier: 2, el: 'holy' });
S('purify', 'heal', 'Purify', '💧', 'heal', { cd: 10, heal: 60, radius: 380, cleanse: true }, 'ชำระล้างสถานะผิดปกติทั้งปาร์ตี้และฟื้น HP เล็กน้อย', { v: 'heal' });
S('safetywall', 'heal', 'Safety Wall', '🧱', 'ground', { dmg: 0, cd: 18, radius: 110, linger: 6, tick: 0.5, safety: true, range: 300 }, 'กำแพงคุ้มกัน พันธมิตรในวงได้รับโล่ต่อเนื่อง', { v: 'runes', tier: 2 });
S('drain', 'heal', 'Life Drain', '🩸', 'beam', { dmg: 90, cd: 3, range: 380, width: 22, multiHit: 4, interval: 0.15, leech: 45 }, 'ลำแสงดูดชีวิต ดูดเลือด 45% ของดาเมจ', { v: 'drain', el: 'shadow' });
S('renew', 'heal', 'Renew', '🌱', 'buff', { cd: 15, duration: 10, aura: 380, buff: { hpRegen: 40 } }, 'ฟื้น HP ต่อเนื่องให้ทั้งปาร์ตี้ 10 วินาที', { v: 'heal' });
S('massheal', 'heal', 'Mass Heal', '💖', 'heal', { cd: 20, heal: 260, radius: 400 }, 'ฟื้น HP ปริมาณมากให้ทุกคนรอบตัว', { v: 'heal', tier: 3, el: 'holy' });
S('lifelink', 'heal', 'Life Link', '🔗', 'buff', { cd: 25, duration: 10, aura: 380, buff: { leech: 6 } }, 'เชื่อมชีวิตปาร์ตี้ ทุกคนดูดเลือด 6%', { v: 'drain', tier: 2 });
// ---------------- summon ----------------
S('raisedead', 'summon', 'Raise Dead', '💀', 'summon', { dmg: 55, cd: 12, count: 2, duration: 25, minion: 'skeleton' }, 'ปลุกโครงกระดูก 2 ตัวมาต่อสู้', { v: 'dark' });
S('golem', 'summon', 'Summon Golem', '🗿', 'summon', { dmg: 110, cd: 40, count: 1, duration: 40, minion: 'golem' }, 'อัญเชิญโกเลมยักษ์ HP สูงคอยรับดาเมจ', { v: 'pillar', tier: 3 });
S('wolves', 'summon', 'Call Wolves', '🐺', 'summon', { dmg: 60, cd: 15, count: 3, duration: 20, minion: 'wolf' }, 'เรียกฝูงหมาป่า 3 ตัว', { v: 'shout', tier: 2 });
S('familiar', 'summon', 'Spirit Familiar', '🧚', 'summon', { dmg: 70, cd: 14, count: 1, duration: 30, minion: 'spirit' }, 'วิญญาณผู้ช่วยยิงพลังใส่ศัตรู', { v: 'ghost' });
S('decoy', 'summon', 'Decoy', '🎭', 'summon', { dmg: 0, cd: 16, count: 2, duration: 8, minion: 'decoy' }, 'สร้างตัวล่อ 2 ตัว ศัตรูจะหันไปโจมตีตัวล่อ', { v: 'shadowstep', tier: 2 });
S('turret', 'summon', 'Turret', '🔫', 'totem', { dmg: 70, cd: 12, duration: 14, tick: 0.6, count: 1 }, 'ตั้งป้อมปืนยิงอัตโนมัติ', { v: 'tracer' });
S('stormtotem', 'summon', 'Storm Totem', '🗼', 'totem', { dmg: 80, cd: 14, duration: 12, tick: 1.1, count: 1, totemChain: 3 }, 'โทเท็มยิงสายฟ้ากระโดด 3 ตัวทุกวินาที', { v: 'bolt', tier: 2, el: 'lightning' });
S('healtotem', 'summon', 'Healing Totem', '🌿', 'totem', { dmg: 0, cd: 20, duration: 15, tick: 1.5, count: 1, mech: 'heal' }, 'โทเท็มฟื้น HP ให้พันธมิตรรอบ ๆ', { v: 'heal', tier: 2 });
S('falcon', 'summon', 'Falcon Assault', '🦅', 'summon', { dmg: 85, cd: 12, count: 1, duration: 18, minion: 'hawk' }, 'ปล่อยเหยี่ยวจู่โจมเป้าหมายรวดเร็ว', { v: 'wind' });
S('guardian', 'summon', 'Guardian Spirit', '😇', 'summon', { dmg: 50, cd: 25, count: 1, duration: 25, minion: 'angel' }, 'วิญญาณผู้พิทักษ์ ฮีลและยิงศัตรู', { v: 'holy', tier: 3 });
S('drones', 'summon', 'Drone Swarm', '🛸', 'summon', { dmg: 45, cd: 18, count: 3, duration: 18, minion: 'drone' }, 'ปล่อยโดรน 3 ลำยิงสนับสนุน', { v: 'tracer', tier: 3 });
S('wraiths', 'summon', 'Wraith Pact', '👤', 'summon', { dmg: 65, cd: 18, count: 2, duration: 20, minion: 'wraith' }, 'เรียกวิญญาณร้าย 2 ตนโจมตีระยะไกล', { v: 'ghost', tier: 3 });
// ---------------- move & trap ----------------
S('charge', 'move', 'Charge', '🐂', 'dash', { dmg: 120, cd: 5, range: 260, knock: 120 }, 'พุ่งชนศัตรูกระเด็น', { v: 'dashline' });
S('blink', 'move', 'Blink', '✨', 'dash', { dmg: 0, cd: 6, range: 300, teleport: true, selfHaste: true }, 'เทเลพอร์ตไปยังจุดที่เล็ง และวิ่งเร็วขึ้นชั่วครู่', { v: 'sparkle' });
S('leap', 'move', 'Leap Strike', '🦘', 'leap', { dmg: 190, cd: 6, range: 340, radius: 115 }, 'กระโดดข้ามไปทุบพื้นที่ปลายทาง', { v: 'smash' });
S('phantomrush', 'move', 'Phantom Assault', '👥', 'dash', { dmg: 130, cd: 10, range: 420, multiDash: 5 }, 'พุ่งไล่ฟันศัตรูทีละตัวต่อเนื่อง 5 เป้าหมาย', { v: 'shadowstep', tier: 3 });
S('roll', 'move', 'Evasion Roll', '🤸', 'dash', { dmg: 0, cd: 4, range: 170, selfHaste: true, iframe: 0.5 }, 'กลิ้งหลบ อมตะชั่วครู่และวิ่งเร็วขึ้น', { v: 'wind' });
S('blasttrap', 'move', 'Blast Trap', '🧨', 'trap', { dmg: 220, cd: 5, radius: 80 }, 'วางกับดักระเบิดแรงสูง', { v: 'bomb' });
S('freezetrap', 'move', 'Freezing Trap', '🧊', 'trap', { dmg: 90, cd: 7, radius: 90, mech: 'freeze', sp: 3 }, 'กับดักแช่แข็งศัตรูที่เหยียบ', { v: 'frost', el: 'ice' });
S('minefield', 'move', 'Mine Layer', '💣', 'trap', { dmg: 130, cd: 12, radius: 60, mines: 5 }, 'วางทุ่นระเบิด 5 ลูกรอบจุดเป้าหมาย', { v: 'bomb', tier: 3 });
S('caltrops', 'move', 'Caltrops', '📌', 'ground', { dmg: 25, cd: 9, radius: 140, linger: 6, tick: 0.5, mech: 'slow' }, 'โปรยเหล็กแหลม ศัตรูที่เดินผ่านช้าและเจ็บ', { v: 'spikes' });
S('corpse', 'move', 'Corpse Explosion', '⚰', 'ground', { dmg: 180, cd: 4, radius: 100, corpse: 5 }, 'จุดระเบิดศพศัตรูที่ตายรอบพื้นที่ (สูงสุด 5 ศพ)', { v: 'explosion', tier: 2, el: 'shadow' });
S('shadowstep', 'move', 'Shadow Step', '🌑', 'dash', { dmg: 110, cd: 7, range: 380, behind: true, mech: 'blind' }, 'เคลื่อนผ่านเงาไปข้างหลังเป้าหมายและทำให้ตาบอด', { v: 'shadowstep', tier: 2, el: 'shadow' });
S('grapple', 'move', 'Grapple Leap', '🧗', 'dash', { dmg: 80, cd: 8, range: 450, toTarget: true, mech: 'stun', sp: 0.8 }, 'ดึงตัวเองเข้าหาเป้าหมายที่ไกลแล้วทำให้มึน', { v: 'chain', tier: 2 });

export const SIG_BY_ID = Object.fromEntries(SIGS.map((s) => [s.id, s]));

// class affinity per family (0..3) — decides which 90 of the 125 mechanics each class gets
export const CLASS_AFFINITY = {
  warrior: { strike: 3, sweep: 3, shot: 1, spell: 0, control: 1, buff: 3, heal: 1, summon: 0, move: 2 },
  paladin: { strike: 2, sweep: 2, shot: 1, spell: 1, control: 1, buff: 3, heal: 3, summon: 1, move: 1 },
  ranger: { strike: 1, sweep: 0, shot: 3, spell: 1, control: 2, buff: 2, heal: 0, summon: 2, move: 3 },
  assassin: { strike: 3, sweep: 1, shot: 2, spell: 1, control: 2, buff: 2, heal: 0, summon: 1, move: 3 },
  arcanist: { strike: 0, sweep: 0, shot: 2, spell: 3, control: 3, buff: 2, heal: 1, summon: 1, move: 1 },
  necromancer: { strike: 1, sweep: 1, shot: 1, spell: 2, control: 3, buff: 1, heal: 1, summon: 3, move: 2 },
  cleric: { strike: 1, sweep: 0, shot: 1, spell: 2, control: 2, buff: 3, heal: 3, summon: 2, move: 1 },
  shaman: { strike: 1, sweep: 1, shot: 1, spell: 3, control: 2, buff: 2, heal: 2, summon: 3, move: 1 },
  gunslinger: { strike: 0, sweep: 1, shot: 3, spell: 1, control: 2, buff: 2, heal: 0, summon: 2, move: 3 },
  monk: { strike: 3, sweep: 3, shot: 1, spell: 1, control: 1, buff: 2, heal: 2, summon: 0, move: 2 },
};
export const ELEM_ADJ = { physical: '', fire: 'Flame', ice: 'Frost', lightning: 'Thunder', poison: 'Venom', holy: 'Holy', shadow: 'Shadow', arcane: 'Arcane' };
