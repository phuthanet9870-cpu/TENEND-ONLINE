// ===== Hand-designed class skill kits: 10 classes x (90 Active + 10 Ultimate) = 1000 unique skills =====
// Line format:  "Name|form|mods|element"
//   form    = delivery mechanic id from signatures.js (bash, fireball, blizzard, raisedead ...)
//   mods    = comma list of modifiers (see MODS in skills.js): stun, burn, x2, wide, heavy, leech, chain ...
//   element = y physical, f fire, i ice, l lightning, p poison, h holy, s shadow, a arcane (optional)
// Every skill also carries its class trait (see TRAITS), and tools/skillcheck.js verifies that no two
// skills in the whole game share a name or the same form+modifier combination.
export const TRAITS = {
  warrior: { name: 'Rage Engine', th: 'ทุกการโจมตีที่โดนคืน Rage 2% และยิ่ง HP ต่ำยิ่งแรง' },
  paladin: { name: 'Divine Ward', th: 'ทุกการโจมตีที่โดนสร้างโล่ศักดิ์สิทธิ์ 1% ของ HP สูงสุด' },
  ranger: { name: "Hunter's Focus", th: 'ยิ่งเป้าหมายอยู่ไกล ดาเมจยิ่งสูง (สูงสุด +25%)' },
  assassin: { name: 'Venom Edge', th: 'ทุกการโจมตีมีโอกาส 25% ทาพิษใส่เป้าหมาย' },
  arcanist: { name: 'Arcane Resonance', th: 'ใช้สกิลต่างธาตุติดกัน ดาเมจ +6% ต่อธาตุ (สูงสุด 4)' },
  necromancer: { name: 'Soul Harvest', th: 'สังหารศัตรู ฟื้น HP 3% และ Souls 6%' },
  cleric: { name: 'Blessed Touch', th: 'ดาเมจที่ทำ 8% ฟื้นฟูให้พันธมิตรที่ HP น้อยที่สุด' },
  shaman: { name: 'Spirit Surge', th: 'การโจมตีมีโอกาส 15% ช็อตเป้าหมาย สมุน/โทเท็มแรงขึ้น 20%' },
  gunslinger: { name: 'Heat Sink', th: 'ติดคริติคอล ลดคูลดาวน์ทุกสกิล 0.3 วินาที' },
  monk: { name: 'Combo Chain', th: 'โจมตีต่อเนื่องภายใน 2 วิ ดาเมจ +3% ต่อชั้น (สูงสุด 10)' },
};

export const KITS = {
  warrior: {
    disc: [
      ['Swordsmanship', '⚔', ['Bash|bash|stun', 'Magnum Break|magnum|burn|f', 'Double Edge|double|bleed', 'Sword Quicken|triple|haste', 'Mighty Slash|crescent|heavy', 'Cross Cut|cleave|x2', 'Blade Breaker|sunder|crit', 'Counter Edge|riposte|shield', 'Decapitate|execute|bleed', 'Titan Swing|bowling|wide']],
      ['Spear Arts', '🔱', ['Pierce|thrust|crit', 'Spear Stab|lunge|knock', 'Brandish Spear|crescent|wide,knock', 'Spiral Pierce|sonic|sunder', 'Spear Boomerang|boomerang|bleed', 'Impale|thrust|root,heavy', 'Javelin Hurl|pierceshot|knock', 'Skewer Line|splitter|bleed', 'Grapple Spear|hook|stun', 'Halberd Sweep|cleave|slow,wide']],
      ['Fury', '😡', ['Berserk|berserk|', 'Blood Frenzy|berserk|leech', 'Rampage|phantomrush|bleed', 'Savage Roar|warcry|fear', 'Reckless Charge|charge|heavy', 'Bloodbath|reap|heavy', 'Wild Swings|whirl|bleed', 'Pain Tolerance|endure|regen', 'Last Breath|asura|', 'Carnage|cleave|x3']],
      ['Warlord', '📯', ['Provoke|provoke|', 'Battle Cry|warcry|', 'Commanding Shout|blessing|y', 'Rally Banner|hasteaura|', 'Intimidate|fear|weaken', 'Challenge|provoke|lex', 'Iron Will|autoguard|', 'Inspire|agility|', 'Second Wind|lifetap|regen', 'War Drums|magnificat|']],
      ['Earthbreaker', '⛰', ['Ground Slam|shockwave|stun', 'Fissure Strike|fissure|', 'Earthquake|tremor|stun', 'Quake Stomp|tremor|knock', 'Rock Pillar|pillarslam|', 'Seismic Rift|splitter|slow', 'Avalanche|heavensdrive|y', 'Earth Spike|earthspike|y', 'Shatter Ground|fissure|heavy', 'Leap Smash|leap|stun']],
      ['Flame Blade', '🔥', ['Flame Cut|cleave|burn|f', 'Fire Brand|bash|burn|f', 'Searing Thrust|thrust|burn|f', 'Ember Spin|whirl|burn|f', 'Blaze Charge|charge|burn|f', 'Inferno Leap|leap|burn|f', 'Burning Wave|wave|burn|f', 'Flame Pillar|firepillar|f', 'Pyre Wall|firewall|f', 'Fire Enchant|enchant|f']],
      ['Battlefield', '🏃', ['Dash Strike|lunge|crit', 'Shoulder Charge|charge|stun', 'War Leap|leap|knock', 'Sprint|roll|haste', 'Cyclone Charge|cyclone|', 'Whirling Advance|cyclone|bleed', 'Hook Pull|hook|slow', 'Gap Closer|grapple|', 'Tactical Roll|roll|shield', 'Vault Strike|leap|crit']],
      ['Iron Defense', '🛡', ['Steel Body|steelbody|', 'Shield Wall|autoguard|block', 'Bulwark|kyrie|', 'Reflect Guard|reflect|', 'Endure|endure|', 'Fortify|steelbody|regen', 'Taunting Blow|bash|taunt', 'Parry|riposte|', 'Unbreakable|endure|shield', 'Guardian Stance|devotion|']],
      ['Executioner', '💀', ['Guillotine|execute|heavy', 'Mortal Strike|bash|weaken', 'Cleaving Death|cleave|execute', 'Headhunter|lunge|execute', 'Killing Spree|phantomrush|execute', 'Bone Crusher|sunder|stun', 'Deep Wound|rend|heavy', 'Sundering Blow|sunder|wide', 'Final Judgement|asura|crit', 'Doom Strike|uppercut|execute']],
    ],
    ult: ["Titan's Fall|leap|stun,big", 'Bladestorm|whirl|x3,bleed', 'Inferno Rampage|berserk|burn|f', 'Worldbreaker|splitter|heavy,stun', "Warlord's Banner|hasteaura|aura,shield", 'Cataclysm Cleave|cleave|burn,heavy|f', 'Avalanche of Steel|arrowstorm|knock', 'Crimson Frenzy|berserk|leech,heal', 'Volcanic Eruption|meteorstorm|burn|f', 'Last Stand|steelbody|regen,shield'],
  },
  paladin: {
    disc: [
      ['Holy Strikes', '✝', ['Holy Smite|bash|stun|h', 'Grand Cross|exorcism|h', 'Shield Bash|bash|knock', 'Hammer of Faith|double|h', 'Righteous Blow|crescent|h', 'Divine Cleave|cleave|weaken|h', 'Crusader Strike|triple|h', 'Judging Blow|sunder|h', 'Purging Slash|cleave|cleanse|h', 'Holy Execution|execute|h']],
      ['Shield Arts', '🛡', ['Shield Charge|charge|h', 'Shield Boomerang|boomerang|stun', 'Shield Reflect|reflect|h', 'Defender|autoguard|h', 'Shield Chain|ricochet|h', 'Shield Slam|uppercut|h', 'Aegis Wall|safetywall|h', 'Bulwark of Light|kyrie|aura', 'Shield Throw|chargedshot|stun', 'Guard Breaker|sunder|stun']],
      ['Devotion', '🤝', ['Devotion|devotion|h', 'Sacrifice|devotion|regen', 'Martyrdom|lifetap|h', 'Shared Pain|lifelink|h', 'Oath of Protection|kyrie|h', 'Guardian Light|guardian|h', 'Intercede|grapple|shield', 'Vow of Valor|blessing|h', 'Steadfast|endure|h', 'Unyielding|steelbody|h']],
      ['Judgement', '⚖', ['Judgement|bolts|h', 'Divine Verdict|stonecurse|h', 'Condemn|lex|h', 'Sentence|curse|h', 'Retribution|repulse|h', 'Penance Beam|prism|h', 'Holy Lance|icespear|h', 'Smite Evil|holylight|crit', 'Seal of Light|hush|h', 'Banish|fear|h']],
      ['Thunder Oath', '⚡', ['Thunder Oath|chainl|l', 'Storm Hammer|jupitel|l', 'Lightning Smite|bash|shock|l', 'Thunderclap|repulse|shock|l', 'Static Aegis|static|l', 'Storm Charge|charge|shock|l', 'Charged Blade|enchant|l', 'Thunder Spear|thrust|shock|l', 'Tempest Strike|sonic|shock|l', 'Thunderpillar Oath|firepillar|l']],
      ['Sanctuary', '⛪', ['Sanctuary|sanctuary|h', 'Lay on Hands|heal|h', 'Holy Aura|renew|h', 'Cleanse|purify|h', 'Consecration|sanctuary|wide', 'Divine Light|massheal|h', 'Healing Hymn|magnificat|h', 'Restoration|heal|cleanse', 'Benediction|renew|shield', 'Holy Ground|safetywall|regen']],
      ['Crusade', '🏇', ['Crusade|cyclone|h', 'Holy Charge|charge|stun|h', 'Leap of Faith|leap|h', 'Valiant Rush|lunge|h', 'Zealous Advance|phantomrush|h', 'Divine Steed|roll|h', 'Light Dash|blink|h', 'Hallowed March|fissure|h', 'Crusader Wheel|whirl|h', 'Templar Vault|leap|shield']],
      ['Radiance', '☀', ['Radiant Burst|magnum|h', 'Sunflare|explosive|blind|h', 'Light Wave|wave|h', 'Halo Ring|frostring|h', 'Sun Pillar|pillarslam|h', 'Dawn Breaker|splitter|h', 'Blinding Light|smoke|h', 'Solar Flare|napalm|h', 'Searing Light|vermilion|h', 'Celestial Orb|fireball|h']],
      ['Templar', '⛨', ['Templar Strike|double|stun', 'Iron Faith|autoguard|regen', 'Vigilance|focus|h', 'War Prayer|warcry|h', 'Fortress|kyrie|block', 'Holy Bulwark|steelbody|shield', 'Sacred Taunt|provoke|h', 'Crusader Aura|hasteaura|h', 'Justice Hammer|pillarslam|stun', 'Templar Spin|whirl|stun']],
    ],
    ult: ['Wrath of Heaven|meteorstorm|stun|h', 'Divine Intervention|massheal|shield,cleanse|h', 'Storm Crusader|hasteaura|shock|l', 'Hammer of Kings|seeker|stun,big|h', 'Sacred Bastion|safetywall|aura,regen|h', 'Final Verdict|execute|heavy,lex|h', 'Thunder Throne|static|shock,big|l', 'Avatar of Light|blessing|aura,regen|h', 'Celestial Spear|sniper|pierce|h', 'Oathbreaker Charge|cyclone|knock,stun|l'],
  },
  ranger: {
    disc: [
      ['Archery', '🏹', ['Double Strafe|doubleshot|crit', 'Arrow Shower|rainarrow|', 'Charge Arrow|chargedshot|', 'Piercing Arrow|pierceshot|y', 'Multi Arrow|multishot|y', 'Split Arrow|splitshot|y', 'Seeking Arrow|seeker|y', 'Long Shot|sniper|y', 'Rapid Fire|doubleshot|fast', 'Arrow Vulcan|arrowstorm|y']],
      ['Trapping', '🪤', ['Ankle Snare|net|root', 'Land Mine|blasttrap|y', 'Freezing Trap|freezetrap|i', 'Claymore Trap|minefield|y', 'Spike Field|caltrops|bleed', 'Blast Mine|blasttrap|knock', 'Shock Trap|blasttrap|shock|l', 'Flasher|freezetrap|blind', 'Sandman|freezetrap|stun', 'Trap Web|minefield|root']],
      ['Beast Mastery', '🦅', ['Falcon Assault|falcon|', 'Blitz Beat|falcon|x2', 'Call Wolves|wolves|', 'Wolf Pack|wolves|bleed', 'Bear Totem|golem|y', 'Spirit Hawk|familiar|y', 'Beast Bond|lifelink|y', 'Pack Howl|warcry|y', 'Stampede|cyclone|knock', 'Hunter Decoy|decoy|y']],
      ['Venom Arrows', '🧪', ['Venom Arrow|pierceshot|poison|p', 'Toxic Volley|multishot|poison|p', 'Plague Rain|rainarrow|poison|p', 'Acid Shot|explosive|sunder|p', 'Viper Sting|doubleshot|poison|p', 'Toxin Cloud|acid|p', 'Thorn Burst|tremor|poison|p', 'Nettle Net|net|poison|p', 'Fester Arrow|tracer|poison|p', 'Bramble Field|entangle|p']],
      ['Survival', '🌿', ['Evasion Roll|roll|', 'Camouflage|cloak|y', 'Quick Step|blink|y', 'Disengage|roll|knock', 'Hunter Focus|focus|y', 'Wind Walk|agility|y', 'First Aid|heal|y', 'Herbal Remedy|renew|p', 'Nature Ward|kyrie|p', 'Feign Death|decoy|stun']],
      ['Wind Archery', '🌪', ['Gale Shot|wave|y', 'Tornado Arrow|tornado|y', 'Cyclone Volley|arrowstorm|knock', 'Wind Blade|fan|y', 'Zephyr Strike|lunge|y', 'Storm Bow|seeker|shock|l', 'Wind Wall|firewall|slow', 'Updraft|repulse|y', 'Tailwind|hasteaura|y', 'Skyfall Arrow|thunderstorm|l']],
      ['Sharpshooter', '🎯', ['Aimed Shot|sniper|crit', 'Headshot|tracer|crit', 'Weak Spot|tracer|sunder', 'Kill Shot|pierceshot|execute', 'Hunter Mark|lex|y', 'Eagle Eye|focus|crit', 'Ricochet Arrow|ricochet|y', 'Pinning Shot|chargedshot|root', 'Disabling Shot|pierceshot|slow', 'Deadeye Volley|seeker|crit']],
      ['Wilderness', '🌲', ['Entangling Roots|entangle|root', 'Thornwall|firewall|bleed', 'Earthen Spike|earthspike|y', 'Wild Growth|sanctuary|p', 'Rockfall|heavensdrive|stun', 'Grasping Vines|hook|root', 'Swamp Mire|quagmire|p', 'Pollen Haze|smoke|p', 'Rain of Thorns|rainarrow|bleed', 'Moss Shield|autoguard|p']],
      ['Melee Hunter', '🗡', ['Knife Slash|double|y', 'Skinning Cut|rend|y', 'Hatchet Throw|boomerang|y', 'Kick Away|repulse|knock', 'Bayonet Thrust|thrust|y', 'Hunting Spear|lunge|bleed', 'Trapper Hook|hook|y', 'Survival Slash|crescent|y', 'Crippling Blow|sunder|slow', 'Wild Flurry|sonic|y']],
    ],
    ult: ['Hail of Ten Thousand|rainarrow|big,slow', "Hunter's Moon|focus|crit,aura", 'Plague Volley|arrowstorm|poison,big|p', 'Alpha Pack|wolves|bleed,x2', 'Skyfall Barrage|thunderstorm|shock,big|l', 'Verdant Prison|entangle|root,big|p', 'Windrunner|agility|haste,aura', 'Eagle Eye Snipe|sniper|execute,crit', 'Bramble Storm|blizzard|poison|p', 'Ballista Nest|turret|pierce,x2'],
  },
  assassin: {
    disc: [
      ['Dagger Arts', '🗡', ['Sonic Blow|sonic|', 'Double Attack|double|crit', 'Katar Rend|rend|y', 'Quick Slash|crescent|fast', 'Gash|bash|bleed', 'Throat Cut|silence|bleed', 'Dagger Flurry|triple|y', 'Cutthroat|execute|crit', 'Twin Fangs|double|poison|p', 'Blade Fury|cleave|x3']],
      ['Shadow Arts', '🌑', ['Shadow Step|shadowstep|', 'Backstab|backstab|', 'Cloaking|cloak|', 'Shadow Clone|decoy|s', 'Grimtooth|fissure|s', 'Shadow Strike|lunge|blind|s', 'Veil of Night|smoke|', 'Dark Illusion|phantomrush|s', 'Shade Walk|blink|s', 'Umbral Slash|crescent|s']],
      ['Poisons', '☠', ['Enchant Poison|enchant|p', 'Venom Dust|acid|slow', 'Venom Splasher|timebomb|p', 'Poison React|riposte|p', 'Toxic Cloud|smoke|poison|p', 'Envenom|bash|poison|p', 'Deadly Toxin|curse|p', 'Neurotoxin|stonecurse|p', 'Viper Bite|thrust|poison|p', 'Plague Fan|fan|poison|p']],
      ['Throwing', '✴', ['Shuriken|ricochet|s', 'Kunai Volley|multishot|s', 'Fan of Knives|fan|y', 'Throwing Star|boomerang|s', 'Smoke Kunai|explosive|blind', 'Chain Kunai|hook|bleed', 'Needle Rain|rainarrow|s', 'Phantom Shuriken|seeker|s', 'Dagger Storm|arrowstorm|s', 'Explosive Tag|timebomb|f']],
      ['Assassination', '💀', ['Mark for Death|lex|s', 'Death Blow|execute|heavy', 'Silent Kill|backstab|execute', 'Ambush|shadowstep|stun', 'Hamstring|sunder|root', 'Vital Strike|uppercut|crit', 'Death Lotus|whirl|s', 'Blood Price|lifetap|s', 'Coup de Grace|asura|s', 'Final Cut|splitter|s']],
      ['Evasion', '💨', ['Smoke Bomb|smoke|y', 'Tumble|roll|crit', 'Vanish|cloak|haste', 'Flicker|blink|y', 'Shadow Dance|agility|s', 'Mirror Image|decoy|blind', 'Evasive Stance|autoguard|s', 'Escape Artist|endure|s', 'Quick Feet|hasteaura|s', 'Phantom Guard|kyrie|s']],
      ['Blood Arts', '🩸', ['Hemorrhage|rend|heavy', 'Blood Fan|fan|bleed', 'Exsanguinate|drain|bleed', 'Crimson Lotus|whirl|leech', 'Bloodletting|sonic|bleed', 'Sanguine Edge|enchant|s', 'Blood Mist|acid|bleed', 'Vein Rupture|napalm|bleed', 'Blood Spike|earthspike|bleed', 'Red Harvest|reap|bleed']],
      ['Night Hunter', '🦇', ['Bat Swarm|familiar|s', 'Night Terror|fear|s', 'Shadow Bind|net|s', 'Dusk Wave|wave|s', 'Eclipse|blackhole|s', 'Night Fog|quagmire|s', 'Shadow Hook|grapple|s', 'Raven Strike|falcon|s', 'Black Moon|frostring|s', 'Nightmare Rain|thunderstorm|s']],
      ['Ninjutsu', '🥷', ['Fire Jutsu|breath|f', 'Ice Jutsu|frostbolt|i', 'Lightning Jutsu|bolts|l', 'Earth Jutsu|pillarslam|y', 'Wind Jutsu|tornado|y', 'Substitution|decoy|haste', 'Shadow Bind Jutsu|stonecurse|s', 'Ninja Star Storm|missiles|s', 'Kawarimi|roll|shield', 'Ninjutsu Burst|magnum|f']],
    ],
    ult: ['Thousand Cuts|sonic|x2,bleed', 'Eclipse Assassination|backstab|execute,heavy|s', 'Night Veil|cloak|aura,crit|s', 'Venom Apocalypse|acid|poison,big|p', 'Shadow Legion|decoy|x2,blind|s', 'Reaper Lotus|whirl|execute,big|s', 'Void Shuriken|tornado|pull,big|s', 'Silent Death|asura|execute|s', 'Miasma Field|blackhole|poison|p', 'Phantom Rush|phantomrush|crit,x2|s'],
  },
  arcanist: {
    disc: [
      ['Pyromancy', '🔥', ['Fire Bolt|bolts|f', 'Fire Ball|fireball|f', 'Fire Wall|firewall|f', 'Fire Pillar|firepillar|f', 'Meteor Storm|meteorstorm|f', 'Flame Breath|breath|f', 'Fire Nova|magnum|f', 'Inferno Ring|frostring|burn|f', 'Napalm Burst|napalm|f', 'Fire Spiral|arrowstorm|f']],
      ['Cryomancy', '❄', ['Cold Bolt|bolts|i', 'Frost Nova|frostnova|i', 'Ice Spear|icespear|i', 'Storm Gust|stormgust|i', 'Frost Diver|frostbolt|freeze|i', 'Ice Wall|firewall|freeze|i', 'Blizzard|blizzard|i', 'Frost Ring|frostring|i', 'Glacial Spike|earthspike|freeze|i', 'Shatter|static|i']],
      ['Electromancy', '⚡', ['Lightning Bolt|bolts|l', 'Thunderstorm|thunderstorm|l', 'Jupitel Thunder|jupitel|l', 'Chain Lightning|chainl|l', 'Lord of Vermilion|vermilion|l', 'Static Field|static|l', 'Ball Lightning|fireball|l', 'Spark Wave|wave|shock|l', 'Arc Nova|magnum|l', 'Storm Pillar|firepillar|shock|l']],
      ['Arcana', '🔮', ['Soul Strike|soulstrike|a', 'Napalm Beat|napalm|a', 'Magic Missiles|missiles|a', 'Arcane Ray|prism|a', 'Arcane Orb|fireball|a', 'Mana Burst|repulse|a', 'Arcane Barrage|seeker|a', 'Spell Fist|double|a', 'Arcane Wave|wave|a', 'Force Lance|icespear|a']],
      ['Gravity', '🌌', ['Gravity Field|gravity|a', 'Black Hole|blackhole|a', 'Graviton Pull|hook|a', 'Singularity|blackhole|stun', 'Crush|pillarslam|a', 'Repulsion|repulse|knock', 'Meteor Fall|heavensdrive|a', 'Event Horizon|frostring|a', 'Implosion|vortexslash|a', 'Gravity Well|gravity|slow']],
      ['Chronomancy', '⏳', ['Time Warp|timewarp|a', 'Haste|hasteaura|a', 'Slow|slowfield|a', 'Temporal Lock|stonecurse|a', 'Rewind|heal|a', 'Time Bomb|timebomb|a', 'Blink|blink|a', 'Quicken|agility|a', 'Stasis Field|quagmire|a', 'Chrono Echo|missiles|echo']],
      ['Wards', '🔰', ['Mana Shield|kyrie|a', 'Spell Reflect|reflect|a', 'Energy Coat|steelbody|a', 'Magic Barrier|safetywall|a', 'Arcane Ward|autoguard|a', 'Mana Siphon|drain|a', 'Silence|hush|a', 'Counterspell|lex|a', 'Dispel|purify|a', 'Spellward|endure|a']],
      ['Elementalism', '🌈', ['Elemental Converter|enchant|a', 'Prismatic Spray|multishot|a', 'Elemental Chaos|thunderstorm|a', 'Rainbow Ray|prism|wide', 'Tri-Bolt|fireball|x3', 'Steam Burst|napalm|chill|i', 'Magma Pool|acid|burn|f', 'Lightning Rod|turret|l', 'Frost Fire|fireball|freeze|i', 'Storm Orb|jupitel|i']],
      ['Familiars', '🧚', ['Fire Elemental|familiar|f', 'Ice Golem|golem|i', 'Storm Sprite|drones|l', 'Arcane Familiar|familiar|a', 'Summon Phoenix|falcon|f', 'Living Bomb|timebomb|f', 'Spirit Orbs|spheres|a', 'Elemental Totem|stormtotem|f', 'Magic Mirror|decoy|a', 'Wisp Swarm|wraiths|a']],
    ],
    ult: ['Armageddon|meteorstorm|big,stun|f', 'Absolute Zero|frostnova|freeze,big|i', 'Thunder God|vermilion|shock,big|l', 'Arcane Singularity|blackhole|pull,big|a', 'Elemental Avatar|blessing|crit,cdr|a', 'Comet Barrage|seeker|burn,big|f', 'Glacial Spire|stormtotem|freeze|i', 'Prism Annihilator|prism|heavy,x2|a', 'Storm Orbs|spheres|shock,big|l', 'Time Fracture|timewarp|stun,big|a'],
  },
  necromancer: {
    disc: [
      ['Bone Craft', '🦴', ['Bone Spear|icespear|y', 'Bone Spikes|earthspike|y', 'Bone Prison|stonecurse|y', 'Bone Armor|steelbody|y', 'Bone Wall|firewall|y', 'Bone Storm|whirl|y', 'Bone Shards|multishot|y', 'Bone Spirit|seeker|s', 'Ossify|static|y', 'Marrow Burst|explosive|bleed']],
      ['Raise Dead', '💀', ['Raise Skeleton|raisedead|', 'Skeleton Mage|wraiths|i', 'Bone Golem|golem|y', 'Corpse Explosion|corpse|', 'Revenant|familiar|s', 'Ghoul Pack|wolves|poison|p', 'Army Call|raisedead|x2', 'Grave Guard|decoy|s', 'Lich Servant|drones|i', 'Corpse Lance|corpse|pierce']],
      ['Curses', '🧿', ['Curse|curse|', 'Weaken|curse|weaken', 'Decrepify|slowfield|s', 'Amplify Damage|lex|s', 'Iron Maiden|reflect|s', 'Life Tap Curse|drain|s', 'Confuse|fear|s', 'Terror|fear|stun', 'Dim Vision|smoke|s', 'Lower Resist|acid|s']],
      ['Soul Magic', '👻', ['Soul Drain|drain|leech', 'Wraith Strike|soulstrike|s', 'Soul Rend|rend|s', 'Soul Link|lifelink|s', 'Spirit Wave|wave|s', 'Soul Nova|magnum|s', 'Wraith Form|cloak|s', 'Soul Harvest|reap|s', 'Ghost Missiles|missiles|s', 'Specter Ring|frostring|s']],
      ['Plague', '☣', ['Plague Cloud|acid|poison|p', 'Poison Nova|magnum|poison|p', 'Contagion|chainl|p', 'Pestilence|vermilion|p', 'Rot|curse|poison|p', 'Blight|quagmire|p', 'Plague Bearer|familiar|p', 'Toxic Burst|napalm|p', 'Locust Swarm|thunderstorm|p', 'Pus Spray|breath|p']],
      ['Frost Necromancy', '🧊', ['Frost Wraith|wraiths|freeze|i', 'Grave Chill|frostnova|s', 'Death Frost|blizzard|s', 'Ice Coffin|stonecurse|i', 'Frozen Tomb|frostring|freeze', 'Cold Grasp|hook|i', 'Winter Breath|breath|i', 'Rime Spear|icespear|chill', 'Frost Corpse|corpse|i', 'Glacial Bones|earthspike|i']],
      ['Dark Pact', '🩸', ['Dark Pact|lifetap|', 'Blood Ritual|berserk|s', 'Unholy Frenzy|hasteaura|s', 'Death Mark|lex|bleed', 'Sacrificial Lamb|devotion|s', 'Vampiric Touch|bash|leech', 'Dark Bargain|focus|s', 'Blood Boil|tremor|s', 'Crimson Pact|lifelink|regen', 'Desecrate|sanctuary|s']],
      ['Reaping', '🌾', ['Reap|reap|', 'Scythe Spin|whirl|s', 'Death Scythe|crescent|s', 'Grim Harvest|cleave|leech', 'Reaper Charge|charge|s', 'Soul Reap|execute|s', 'Scythe Throw|boomerang|s', 'Death Sweep|cyclone|s', 'Mortal Coil|hook|s', 'Final Harvest|asura|s']],
      ['Shadow Magic', '🌑', ['Shadow Bolt|bolts|s', 'Death Ray|prism|s', 'Void Orb|fireball|s', 'Shadow Pillar|firepillar|s', 'Night Shroud|kyrie|s', 'Dark Nova|repulse|s', 'Shadow Rain|meteorstorm|s', 'Abyss Gate|gravity|s', 'Dark Tendrils|entangle|s', 'Doom|timebomb|s']],
    ],
    ult: ['Army of the Dead|raisedead|x3,bleed', 'Bone Colossus|golem|stun,big', 'Lich Form|steelbody|freeze,aura|i', 'Pandemic|acid|poison,big|p', 'Soul Harvest Nova|magnum|leech,big|s', 'Graveyard|stormtotem|weaken|s', 'Ossuary Storm|arrowstorm|pierce,big', 'Doom Bringer|blackhole|execute|s', 'Winter of Souls|blizzard|freeze,big|i', 'Death Ray Prime|prism|lex,heavy|s'],
  },
  cleric: {
    disc: [
      ['Exorcism', '✝', ['Holy Light|holylight|', 'Magnus Exorcismus|exorcism|', 'Turn Undead|fear|h', 'Lex Divina|hush|h', 'Lex Aeterna|lex|', 'Banishing Light|stonecurse|h', 'Exorcise|static|h', 'Holy Cross|bolts|h', 'Divine Punishment|meteorstorm|h', 'Purging Flame|firewall|h']],
      ['Healing', '❤', ['Heal|heal|', 'Mass Heal|massheal|', 'Renew|renew|', 'Greater Heal|heal|heavy', 'Prayer of Healing|massheal|regen', 'Flash Heal|heal|fast', 'Healing Circle|sanctuary|', 'Holy Word|massheal|cleanse', 'Lifebloom|renew|shield', 'Divine Hymn|magnificat|regen']],
      ['Protection', '🔰', ['Kyrie Eleison|kyrie|', 'Safety Wall|safetywall|', 'Assumptio|steelbody|h', 'Power Word Shield|kyrie|fast', 'Guardian Angel|guardian|', 'Holy Barrier|autoguard|h', 'Divine Shield|endure|h', 'Pneuma|safetywall|wide', 'Sanctified Ground|sanctuary|shield', 'Spirit Ward|reflect|h']],
      ['Blessings', '✨', ['Blessing|blessing|', 'Increase Agility|agility|', 'Magnificat|magnificat|', 'Gloria|focus|h', 'Impositio Manus|enchant|h', 'Aspersio|enchant|crit', 'Suffragium|hasteaura|', 'Angelus|kyrie|aura', 'Benedictio|blessing|regen', 'Holy Fervor|warcry|h']],
      ['Light', '☀', ['Halo|frostring|h', 'Light Burst|magnum|h', 'Radiant Beam|prism|h', 'Solar Beam|splitter|h', 'Holy Nova|repulse|h', 'Penance|seeker|h', 'Blinding Wave|wave|blind|h', 'Sunfire Orb|fireball|h', 'Holy Rain|rainarrow|h', 'Dawn Pillar|pillarslam|h']],
      ['Battle Priest', '🔨', ['Holy Hammer|bash|h', 'Mace Smite|double|h', 'Judging Strike|uppercut|h', 'Blessed Hammer|boomerang|h', 'Hammer Spin|whirl|h', 'Sacred Slam|shockwave|h', 'Righteous Charge|charge|h', 'Zealot Blows|triple|h', 'Faith Leap|leap|h', 'Smiting Wave|tremor|h']],
      ['Cleansing', '💧', ['Purify|purify|', 'Recovery|purify|heal', 'Remove Curse|purify|wide', 'Holy Water|acid|h', 'Baptism|renew|cleanse', 'Spring of Life|sanctuary|regen', 'Rain of Grace|thunderstorm|h', 'Tidal Prayer|wave|heal', 'Pure Spring|heal|cleanse', 'Clarity|magnificat|cleanse']],
      ['Divinity', '😇', ['Choir of Angels|guardian|x2', 'Seraph Familiar|familiar|h', 'Holy Totem|healtotem|', 'Celestial Guard|decoy|h', 'Divine Turret|turret|h', 'Angelic Wings|agility|h', 'Ascension|blink|h', 'Holy Spheres|spheres|h', 'Divine Link|lifelink|h', 'Martyr Prayer|devotion|h']],
      ['Arcane Faith', '🔮', ['Arcane Prayer|soulstrike|a', 'Star Missiles|missiles|a', 'Starfall|heavensdrive|a', 'Moonbeam|holylight|a', 'Astral Ring|frostring|a', 'Celestial Gravity|gravity|a', 'Comet|fireball|a', 'Mana Fountain|magnificat|a', 'Astral Shield|kyrie|a', 'Constellation|chainl|a']],
    ],
    ult: ['Resurrection Light|massheal|shield,big|h', 'Choir Ascendant|guardian|x3|h', 'Divine Hymn Prime|renew|aura,cleanse|h', 'Holy Nova Supreme|magnum|heal,big|h', 'Seraph Wings|agility|heal,aura|h', 'Judgement Day|meteorstorm|stun,lex|h', 'Sacred Pillar|healtotem|regen,big|h', 'Exorcism Prime|exorcism|execute,big|h', 'Arcane Sanctum|safetywall|aura,regen|a', 'Starfall Prime|heavensdrive|blind,big|a'],
  },
  shaman: {
    disc: [
      ['Totems', '🗼', ['Storm Totem|stormtotem|', 'Healing Totem|healtotem|', 'Searing Totem|turret|f', 'Venom Totem|turret|poison|p', 'Frost Totem|stormtotem|i', 'Earth Totem|healtotem|shield', 'Wind Totem|turret|knock', 'Spirit Totem|stormtotem|s', 'Magma Totem|turret|burn|f', 'Grounding Totem|healtotem|cleanse']],
      ['Storm Calling', '⛈', ['Sky Serpent|chainl|', 'Thunder Drum|repulse|stun|l', 'Lightning Shield|reflect|l', 'Call Lightning|bolts|l', 'Storm Caller|thunderstorm|', 'Static Shock|static|l', 'Storm Lash|double|shock|l', 'Lightning Totem Spear|icespear|l', 'Storm Wave|wave|l', 'Tempest|vermilion|']],
      ['Earth', '⛰', ['Spirit Quake|tremor|stun', 'Earth Shock|bash|y', 'Stone Skin|steelbody|y', 'Rock Barrage|heavensdrive|y', 'Earthbind|quagmire|y', 'Boulder Throw|chargedshot|stun', 'Stone Fang|earthspike|', 'Landslide|fissure|y', 'Stone Pillar|pillarslam|y', 'Earth Wall|firewall|y']],
      ['Fire', '🔥', ['Lava Burst|fireball|f', 'Flame Shock|holylight|burn|f', 'Flame Totem Nova|magnum|burn|f', 'Lava Lash|double|burn|f', 'Lava Mire|acid|burn,slow|f', 'Volcanic Spray|breath|f', 'Cinder Spirit|familiar|f', 'Ash Cloud|smoke|f', 'Eruption|pillarslam|burn|f', 'Lava Wave|wave|burn|f']],
      ['Spirits', '👻', ['Spirit Wolves|wolves|', 'Ancestral Spirit|guardian|', 'Spirit Walk|blink|s', 'Feral Spirit|wolves|shock|l', 'Spirit Link|lifelink|', 'Hex|stonecurse|', 'Ancestral Ward|kyrie|s', 'Ghost Wolf|agility|s', 'Ancestral Guidance|blessing|s', 'Spirit Bomb|timebomb|s']],
      ['Water', '💧', ['Healing Rain|sanctuary|', 'Healing Wave|heal|', 'Chain Heal|massheal|', 'Riptide|renew|', 'Tidal Wave|wave|knock', 'Water Shield|kyrie|', 'Frost Shock|frostbolt|i', 'Whirlpool|gravity|i', 'Geyser|pillarslam|i', 'Purifying Water|purify|']],
      ['Wind', '🌪', ['Tornado|tornado|', 'Wind Shear|hush|y', 'Gust|repulse|knock', 'Cyclone|vortexslash|y', 'Windfury|triple|y', 'Wind Rush|hasteaura|y', 'Air Blast|wave|y', 'Squall|blizzard|y', 'Zephyr|roll|y', 'Hurricane|thunderstorm|y']],
      ['Nature', '🌿', ['Venom Spit|frostbolt|poison|p', 'Thorn Vines|entangle|', 'Swamp|quagmire|poison|p', 'Poison Cloud|acid|', 'Insect Swarm|missiles|p', 'Nature Grasp|hook|root', 'Regrowth|renew|p', 'Barkskin|autoguard|p', 'Toxic Bloom|napalm|p', 'Plague Spores|seeker|p']],
      ['Primal', '🐺', ['Primal Strike|bash|shock', 'Stormstrike|sonic|l', 'Primal Fury|berserk|', 'Shamanistic Rage|endure|', 'Feral Lunge|lunge|l', 'Totem Slam|shockwave|y', 'Earthen Might|warcry|y', 'Spirit Claws|rend|s', 'Thunder Leap|leap|shock|l', 'Elemental Mastery|focus|l']],
    ],
    ult: ['Wrath of the Sky|vermilion|stun,big|l', 'Ancestral Host|guardian|x2,heal', 'Volcano Totem|turret|burn,big|f', 'Primal Avatar|berserk|aura,shock|l', 'Hurricane Prime|tornado|pull,x2|y', 'Earthshatter|shockwave|stun,big|y', 'Swamp of Plague|quagmire|poison,big|p', 'Thunderbird|falcon|shock,x2|l', 'Tidal Totem|healtotem|aura,big|i', 'Spirit Walk Prime|phantomrush|shock,haste|l'],
  },
  gunslinger: {
    disc: [
      ['Pistols', '🔫', ['Quick Shot|doubleshot|y', 'Fan the Hammer|multishot|fast', 'Desperado|arrowstorm|y', 'Bullseye|sniper|crit', 'Trick Shot|ricochet|y', 'Dual Shot|doubleshot|x2', 'Piercing Round|pierceshot|y', 'Hollow Point|tracer|bleed', 'Gunslinger Spin|whirl|y', 'High Noon|seeker|crit']],
      ['Rifles', '🎯', ['Railgun|splitter|l', 'Sniper Round|sniper|pierce', 'Charged Round|chargedshot|l', 'Armor Piercer|pierceshot|sunder', 'Marked Target|tracer|y', 'Long Barrel|sniper|slow', 'Tracer Volley|seeker|y', 'Suppressing Fire|rainarrow|slow', 'Shock Round|jupitel|l', 'Rifle Butt|bash|knock']],
      ['Shotgun', '💥', ['Buckshot|fan|knock', 'Dragon Breath|breath|f', 'Slug Shot|chargedshot|y', 'Point Blank|repulse|y', 'Scattergun|multishot|knock', 'Blast Wave|wave|f', 'Double Barrel|fan|x2', 'Shrapnel|cluster|y', 'Spread Shot|fan|slow', 'Close Quarters|cleave|y']],
      ['Explosives', '💣', ['Grenade|explosive|f', 'Cluster Grenade|cluster|f', 'Sticky Bomb|timebomb|f', 'Napalm|acid|burn|f', 'Rocket Launcher|chargedshot|burn|f', 'Mortar|meteorstorm|f', 'Carpet Bomb|heavensdrive|f', 'Flashbang|smoke|stun', 'Incendiary|firewall|f', 'Nuke|napalm|burn|f']],
      ['Engineering', '🔧', ['Turret|turret|', 'Drone Swarm|drones|', 'Tesla Coil|stormtotem|', 'Repair Bot|healtotem|y', 'Mech Suit|steelbody|y', 'Gatling Turret|turret|x2', 'Flame Turret|turret|burn', 'Decoy Bot|decoy|y', 'Shield Generator|safetywall|y', 'Repair Kit|heal|y']],
      ['Traps', '🪤', ['Proximity Mine|blasttrap|f', 'Mine Layer|minefield|f', 'Bear Trap|net|bleed', 'Shock Mine|blasttrap|shock', 'Frost Mine|freezetrap|y', 'Tripwire|caltrops|y', 'Gravity Mine|gravity|y', 'Spike Strip|caltrops|bleed', 'Claymore|minefield|knock', 'EMP Trap|freezetrap|silence']],
      ['Gun-Fu', '🤸', ['Combat Roll|roll|y', 'Slide Shot|lunge|y', 'Gun Kata|sonic|y', 'Pistol Whip|double|stun', 'Akimbo Spin|cyclone|y', 'Backflip|roll|knock', 'Ricochet Dance|phantomrush|y', 'Bullet Time|timewarp|y', 'Quickdraw|focus|y', 'Dodge Roll|blink|y']],
      ['Tech', '⚡', ['Tesla Shot|chainl|l', 'EMP Blast|hush|l', 'Plasma Ball|fireball|l', 'Laser Beam|prism|l', 'Overclock|hasteaura|l', 'Energy Shield|kyrie|l', 'Grav Gun|hook|l', 'Static Net|net|shock', 'Ion Storm|thunderstorm|l', 'Pulse Wave|magnum|l']],
      ['Outlaw', '🤠', ['Lasso|grapple|y', 'Dirty Trick|smoke|blind', 'Bounty Mark|lex|y', 'Wanted Poster|curse|y', 'Showdown|provoke|y', 'Dynamite Toss|timebomb|knock', 'Whiskey Shot|lifetap|y', 'Outlaw Rush|charge|y', 'Six Shooter|missiles|y', 'Last Bullet|execute|y']],
    ],
    ult: ['Orbital Strike|meteorstorm|stun,big|l', 'Mech Drone Squad|drones|x2,shock|l', 'Dead Eye|focus|crit,aura', 'Napalm Carpet|heavensdrive|burn,big|f', 'Siege Cannon|turret|knock,big|f', 'Hyper Railgun|splitter|execute,heavy|l', 'Mega Cluster|cluster|burn,big|f', 'Gatling Fury|arrowstorm|slow,x2', 'Minefield Prime|minefield|stun,big|f', 'Overclock Prime|hasteaura|cdr,aura|l'],
  },
  monk: {
    disc: [
      ['Fist Arts', '👊', ['Triple Attack|triple|y', 'Chain Combo|double|x2', 'Combo Finish|uppercut|y', 'Palm Strike|bash|knock', 'Raging Fist|sonic|y', 'Iron Fist|bash|sunder', 'Dragon Fist|lunge|f', 'Tiger Knuckle|double|bleed', 'Crane Kick|crescent|y', 'Hundred Fists|sonic|x2']],
      ['Chi', '☯', ['Chi Wave|wave|h', 'Chi Burst|magnum|h', 'Spirit Spheres|spheres|', 'Chi Blast|chargedshot|h', 'Ki Explosion|repulse|h', 'Inner Chi|lifetap|h', 'Chi Barrier|kyrie|h', 'Chi Lance|icespear|h', 'Chi Torpedo|seeker|h', 'Focus Chi|focus|h']],
      ['Kicks', '🦵', ['Flying Kick|charge|stun', 'Whirlwind Kick|whirl|y', 'Wind Kick|wave|knock', 'Axe Kick|pillarslam|y', 'Roundhouse|cleave|knock', 'Tornado Kick|cyclone|y', 'Sweep Kick|crescent|slow', 'Dragon Kick|leap|f', 'Rising Kick|uppercut|knock', 'Thousand Kicks|sonic|knock']],
      ['Asura', '☄', ['Asura Strike|asura|', 'Guillotine Fist|execute|y', 'Snap|blink|y', 'Vajra Body|steelbody|', 'Root|endure|y', 'Body Relocation|grapple|y', 'Dangerous Soul|berserk|y', 'Zen|magnificat|h', 'Blade Stop|riposte|y', 'Ki Translation|devotion|h']],
      ['Thunder Palm', '⚡', ['Thunder Palm|bash|shock|l', 'Lightning Fist|double|shock|l', 'Storm Kick|lunge|l', 'Thunder Step|blink|l', 'Static Palm|static|l', 'Lightning Lotus|whirl|shock|l', 'Thunder Spirit|familiar|l', 'Storm Mantra|hasteaura|l', 'Lightning Rush|phantomrush|l', 'Heaven Thunder|bolts|l']],
      ['Holy Mantras', '📿', ['Mantra of Healing|renew|h', 'Mantra of Protection|kyrie|aura', 'Mantra of Conviction|blessing|h', 'Mantra of Evasion|agility|h', 'Healing Palm|heal|h', 'Purifying Palm|purify|h', 'Serenity|endure|regen', 'Sacred Bell|hush|h', 'Mantra of Retribution|reflect|h', 'Prayer Beads|missiles|h']],
      ['Dragon Style', '🐉', ['Dragon Ascent|leap|burn|f', 'Dragon Exhale|breath|f', 'Dragon Claw|rend|f', 'Dragon Tail|crescent|f', 'Dragon Flame Fist|magnum|f', 'Dragon Roar|warcry|f', 'Coiling Dragon|vortexslash|f', 'Dragon Spirit|falcon|f', 'Dragon Scale|steelbody|f', 'Dragon Meteor|meteorstorm|f']],
      ['Wind Steps', '💨', ['Wind Step|roll|haste', 'Gale Palm|repulse|knock', 'Vacuum Palm|vortexslash|y', 'Cyclone Palm|tornado|y', 'Feather Fall|leap|y', 'Shadow Boxing|decoy|y', 'Swift Strikes|triple|fast', 'Wind Step Mantra|hasteaura|y', 'Tempest Rush|cyclone|knock', 'Air Palm|wave|y']],
      ['Iron Body', '🧱', ['Iron Skin|autoguard|y', 'Golden Bell|kyrie|y', 'Stone Stance|steelbody|regen', 'Diamond Mind|endure|shield', 'Immovable|autoguard|block', 'Mountain Stance|tremor|y', 'Earth Palm|shockwave|y', 'Boulder Fist|chargedshot|y', 'Rock Smash|fissure|y', 'Quake Palm|earthspike|y']],
    ],
    ult: ['Seven-Sided Strike|phantomrush|stun,x2', 'Celestial Dragon|breath|burn,big|f', 'Enlightenment|blessing|cdr,aura|h', 'Heaven Palm|pillarslam|stun,big|h', 'Thunder God Monk|whirl|shock,big|l', 'Asura Rage|asura|execute,big', 'Wheel of Life|massheal|shield,aura|h', 'Typhoon Kick|vortexslash|pull,big', 'Spirit Avatar|guardian|stun,x2|h', 'Mountain Breaker|leap|stun,big'],
  },
};

// ---- collision resolver: when an ability (form+mods+element) already exists in an earlier class,
// add this class's next signature modifier so every skill in the game behaves differently ----
const CLASS_FLAVOR = {
  warrior: ['heavy', 'knock', 'bleed', 'stun', 'sunder'], paladin: ['shield', 'stun', 'weaken', 'heal', 'block'],
  ranger: ['slow', 'pierce', 'crit', 'root', 'long'], assassin: ['poison', 'crit', 'blind', 'bleed', 'fast'],
  arcanist: ['echo', 'wide', 'chain', 'freeze', 'lex'], necromancer: ['leech', 'weaken', 'fear', 'poison', 'regen'],
  cleric: ['heal', 'cleanse', 'shield', 'blind', 'regen'], shaman: ['shock', 'regen', 'slow', 'knock', 'chain'],
  gunslinger: ['crit', 'knock', 'fast', 'pierce', 'detonate'], monk: ['x2', 'knock', 'stun', 'haste', 'fast'],
};
const EL = { y: 'physical', f: 'fire', i: 'ice', l: 'lightning', p: 'poison', h: 'holy', s: 'shadow', a: 'arcane' };
export function parseLine(line) {
  let [name, form, mods = '', el = ''] = line.split('|');
  if (/^[yfilphsa]$/.test(mods)) { el = mods; mods = ''; }
  return { name, form, mods: mods.split(',').filter(Boolean), el: EL[el] || null };
}
let resolved = null;
export function resolvedKits() {
  if (resolved) return resolved;
  resolved = {}; const seen = new Set();
  for (const [cls, kit] of Object.entries(KITS)) {
    const out = { disc: [], ult: [] };
    const fix = (e, ult, fallbackEl) => {
      const el = e.el || fallbackEl;
      const key = () => `${ult ? 'U' : 'A'}|${e.form}|${[...e.mods].sort().join(',')}|${el}`;
      let i = 0;
      while (seen.has(key()) && i < 10) { const m = CLASS_FLAVOR[cls][i++ % 5]; if (!e.mods.includes(m)) e.mods.push(m); else if (i > 5) e.mods.push(['big', 'wide', 'long', 'fast', 'heavy'][i % 5]); }
      seen.add(key()); return e;
    };
    for (const [title, icon, lines] of kit.disc) out.disc.push([title, icon, lines.map((l) => fix(parseLine(l), false, '?'))]);
    out.ult = kit.ult.map((l) => fix(parseLine(l), true, '?'));
    resolved[cls] = out;
  }
  return resolved;
}
