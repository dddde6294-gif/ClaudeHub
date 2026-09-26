'use strict';
// Villagers, the two later bosses, the rest of the main story and the side quests.
(function (R) {
  const U = R.U, FX = R.FX;

  // ---------------------------------------------------------------- NPCs
  const C = R.Character;
  function npc(id, name, o) {
    const r = U.rng('npc:' + id);
    const a = Object.assign(C.randomAppearance(r), o.a || {});
    R.addNPC(Object.assign({ id, name, appearance: a, gear: o.gear || {}, wander: o.wander == null ? 24 : o.wander }, o));
  }
  const robe = (c, t) => ({ chest: { style: 'robe', color: c, trim: t || '#d8c060' } });
  const plate = (c) => ({ chest: { style: 'plate', color: c, trim: '#c8a040' }, head: { style: 'full', color: c, trim: '#c8a040' } });

  npc('armorer', 'Hilda', { title: 'Armorer', wander: 0, a: { body: 'b', hair: 'braids', hairColor: '#b5773c' }, gear: { chest: { style: 'chain', color: '#8a929a' } },
    shop: { title: "Hilda's Armory", items: R.shopStock({ slots: ['head', 'chest', 'legs', 'feet', 'hands', 'cape', 'offhand'], rarities: ['common', 'uncommon'], maxLevel: (p) => p.level + 3 }) },
    lines: ['Good armor is the difference between a scar and a funeral.'] });
  npc('arcanist', 'Magister Quill', { title: 'Arcane Vendor', wander: 0, a: { hair: 'long', hairColor: '#d8d8d8', beard: 'long' }, gear: Object.assign(robe('#3a2a6a'), { head: { style: 'wizard', color: '#3a2a6a', trim: '#d8c060' } }),
    shop: { title: 'Arcane Curios', items: R.shopStock({ slots: ['ring', 'amulet', 'consumable'], types: null, maxLevel: (p) => p.level + 3, filter: (it) => it.slot !== 'consumable' || it.use.buff || it.use.teleport || it.use.cure }) },
    lines: ['Rings, amulets, elixirs. Magic you can wear!'] });
  npc('innkeeper', 'Marta', { title: 'Innkeeper', wander: 0, a: { body: 'b', hair: 'bob', hairColor: '#9a2b2b' }, services: ['inn'], serviceLine: 'A warm bed and a hot meal, twenty gold.', lines: ['The Sleepy Boar has the softest beds this side of the mountains.'] });
  npc('trainer', 'Sergeant Vale', { title: 'Trainer', wander: 0, a: { hair: 'short', beard: 'stubble' }, gear: plate('#6a6a72'), services: ['respec'], serviceLine: 'Want to relearn your fighting style?', lines: ['Roll through attacks, not away from them.', 'Your third swing always hits hardest. Remember that.'] });
  npc('guard', 'Guard Tomas', { title: 'Guard', wander: 10, gear: plate('#5a6a8a'), weapon: { type: 'spear', blade: '#c8d0d8' }, lines: ['Stay safe out there.', 'The forest road is east. The swamp beyond it is worse.'] });
  npc('captain', 'Captain Garrick', { title: 'Captain of the Watch', wander: 0, a: { beard: 'full' }, gear: plate('#8a2a2a'), weapon: { type: 'sword', blade: '#e0e0e8', guard: '#c8a040' }, lines: ['My guards can hold the walls. They cannot hunt monsters. That is where you come in.'] });
  npc('pip', 'Pip', { title: 'Village Kid', a: { hair: 'spiky', hairColor: '#e0b55f' }, lines: ['Are you a real hero? Can I hold your sword?'] });
  npc('lottie', 'Lottie', { title: 'Village Kid', a: { body: 'b', hair: 'ponytail', hairColor: '#e05a2a' }, lines: ['Pip says slimes taste like strawberries. Pip is wrong.'] });
  npc('wendel', 'Wendel', { title: 'Heartbroken Farmer', a: { hair: 'bald', beard: 'goatee' }, lines: ['Sigh...'] });
  npc('greta', 'Old Greta', { title: 'Herbalist', a: { body: 'b', hair: 'bob', hairColor: '#d8d8d8' }, gear: robe('#4a6a3a', '#a0c080'), lines: ['Mushrooms! Everything is better with mushrooms.'] });
  npc('fennick', 'Fennick', { title: 'Traveling Bard', a: { hair: 'wild', hairColor: '#b04fc0' }, gear: { cape: { style: 'cape', color: '#8a2a6a', trim: '#ffd040' } }, lines: ['♪ Oh the Slime King wore a crown of gold... ♪', 'Every hero needs a song. Do something worth singing about!'] });
  npc('board', 'Bounty Board', { title: 'Notice Board', wander: 0, static: true, appearance: null,
    drawSprite(ctx, n) { const spr = R.Props.sprite('sign', 0, 0); ctx.drawImage(spr, Math.round(n.x - 9), Math.round(n.y - 17)); },
    lines: ['The board is empty for now. Check back later.'] });
  npc('whiskers', 'Whiskers', { title: 'A Very Good Cat', wander: 30, appearance: null,
    drawSprite(ctx, n) { const f = Math.floor(n.animT * 4) % 2; ctx.fillStyle = '#140c1c'; ctx.fillRect(n.x - 5, n.y - 8, 11, 7); ctx.fillStyle = '#e09040'; ctx.fillRect(n.x - 4, n.y - 7, 9, 5); ctx.fillRect(n.x + 3, n.y - 10, 3, 3); ctx.fillStyle = '#140c1c'; ctx.fillRect(n.x + 4, n.y - 9, 1, 1); ctx.fillStyle = '#e09040'; ctx.fillRect(n.x - 6, n.y - 9 + f, 2, 3); },
    lines: ['Mrrp.', '*purrs loudly*', '*stares at a spot on the wall*'] });
  npc('hermit', 'Old Bram', { title: 'Forest Hermit', a: { hair: 'wild', hairColor: '#d8d8d8', beard: 'long' }, gear: robe('#5a4a3a', '#8a7a5a'), lines: ['The dead do not sleep well in that crypt.'] });
  npc('ghost', 'Lady Elowen', { title: 'Restless Spirit', wander: 12, a: { body: 'b', hair: 'long', hairColor: '#e0f0ff', skin: '#c0d8f0' }, gear: robe('#a0c0e0', '#ffffff'),
    lines: ['...cold... so cold...'] });
  npc('finn', 'Finn', { title: 'Lost Adventurer', a: { hair: 'short' }, gear: { chest: { style: 'leather', color: '#6a4424' } }, lines: ['I only went into the grotto for ONE minute.'] });
  npc('osric', 'Warden Osric', { title: 'Warden of Mirewatch', wander: 0, a: { beard: 'full', beardColor: '#6a6a6a', hairColor: '#6a6a6a' }, gear: plate('#3a5a3a'), weapon: { type: 'spear', blade: '#c8d0d8' }, lines: ['Mirewatch holds. For now.'] });
  npc('nessa', 'Nessa', { title: 'Swamp Witch', a: { body: 'b', hair: 'long', hairColor: '#46a15b', skin: '#9fd4a8' }, gear: Object.assign(robe('#2a4a3a', '#80ff60'), { head: { style: 'wizard', color: '#2a4a3a', trim: '#80ff60' } }), lines: ['Frog legs, bat wings... the usual.'] });
  npc('grub', 'Grub', { title: 'Mudfisher', a: { hair: 'bald', beard: 'stubble' }, lines: ['Nothin\' bites in this swamp. Except the swamp.'] });
  npc('otto', 'Otto', { title: 'Nervous Miller', a: { hair: 'short', beard: 'goatee' }, lines: ['Have you seen my diary? No? Good. I mean — bad. I mean...'] });

  // Village shops stock whatever gear exists near your level.
  if (R.NPCs.smith) R.NPCs.smith.shop = { title: "Brom's Forge", items: R.shopStock({ slots: ['weapon', 'offhand'], rarities: ['common', 'uncommon'], maxLevel: (p) => p.level + 3, filter: (it) => it.slot === 'weapon' || it.classes && (it.classes.includes('warrior')) }) };
  if (R.NPCs.alchemist) R.NPCs.alchemist.shop = { title: "Lysa's Remedies", items: R.shopStock({ slots: ['consumable'], maxLevel: (p) => p.level + 4, filter: (it) => it.use.heal || it.use.mana || it.use.cure }) };

  // ---------------------------------------------------------------- bosses
  // A shared brain: circle the player, fire patterns, telegraph area blasts and summon adds.
  function bossBrain(cfg) {
    return function (e, dt, sm) {
      const p = R.World.player;
      if (!p || p.dead) { e.anim = 'idle'; return; }
      R.World.combatT = 3;
      const m = e.mem;
      const phase2 = e.hp < e.maxHp * 0.5;
      if (phase2 && !m.p2) {
        m.p2 = true; m.cd = 1.2; e.invuln = 1;
        R.Audio.play('bossRoar'); FX.shake(8, 0.6); FX.flash(cfg.color, 0.3);
        FX.ring(e.x, e.y, 5, 90, cfg.color, 0.6, 6);
        R.UI.toast(e.def.name + ' is enraged!', 'bad');
      }
      e.face = p.x > e.x ? 1 : -1;
      m.cd = (m.cd == null ? 1.5 : m.cd) - dt;
      if (m.cast > 0) { m.cast -= dt; e.anim = 'windup'; return; }
      if (m.cd <= 0) {
        const pick = U.choose(cfg.moves);
        pick(e, p, phase2);
        m.cast = 0.4;
        m.cd = (phase2 ? 1.1 : 1.7) + Math.random() * 0.5;
        e.anim = 'attack';
        return;
      }
      const d = U.dist(e.x, e.y, p.x, p.y);
      const a = U.angle(e.x, e.y, p.x, p.y) + (d < cfg.keep ? Math.PI * 0.6 : 0.3);
      e.moveAngle(a, e.def.spd * sm * (phase2 ? 1.3 : 1), dt);
      e.anim = 'walk';
      if (d < e.r + 8) { m.touch = (m.touch || 0) - dt; if (m.touch <= 0) { e.hitPlayer(0.7); m.touch = 0.8; } }
    };
  }
  const ring = (col, n) => (e, p, p2) => { const k = p2 ? n + 6 : n; for (let i = 0; i < k; i++) e.shoot(i / k * U.TAU + e.animT, { speed: 95, color: col, size: 4, dmg: e.atk * 0.7 }); R.Audio.play('magic', { pitch: 0.5 }); };
  const fan = (col, n, st) => (e, p, p2) => { const a = U.angle(e.x, e.y, p.x, p.y); const k = p2 ? n + 2 : n; for (let i = 0; i < k; i++) e.shoot(a + (i - (k - 1) / 2) * 0.18, { speed: 150, color: col, size: 3, dmg: e.atk * 0.8, status: st }); R.Audio.play('zap', { pitch: 0.6 }); };
  const blast = (col, st) => (e, p, p2) => { const n = p2 ? 3 : 1; for (let i = 0; i < n; i++) { const x = p.x + (i ? U.rand(-40, 40) : 0), y = p.y + (i ? U.rand(-30, 30) : 0); e.telegraph(x, y, 32, 1.0, () => { FX.burst(x, y, { n: 25, colors: [col, '#ffffff'], speed: 80, glow: true, up: 30 }); FX.pillar(x, y, col, 0.5, 30); R.Audio.play('explode', { pitch: 1.3 }); R.Combat.hitCircle(x, y, 32, 'enemy', () => e.hitPlayer(1.4, { status: st })); }, col); } };
  const summon = (id, n) => (e, p, p2) => { const k = p2 ? n + 1 : n; if (R.World.enemies.filter((x) => !x.dead && x.id === id).length > 5) return; for (let i = 0; i < k; i++) { const s = R.World.spawnEnemy(id, e.x + U.rand(-40, 40), e.y + U.rand(-30, 30), e.level - 1); if (s) s.state = 'chase'; } FX.burst(e.x, e.y - 20, { n: 30, color: '#b070ff', speed: 80, glow: true }); R.Audio.play('portal'); };

  R.addEnemy({
    id: 'lich', name: 'Mortis', title: 'The Bone Lich', boss: true, level: 9, hp: 1500, atk: 34, def: 8, spd: 34, xp: 900, gold: [150, 250], r: 12, height: 44, scale: 1.8,
    sprite: 'robed', pal: { main: '#2a1a3a', head: 'skull', trim: '#b070ff', accent: '#b070ff', eye: '#ff40ff' }, knockResist: 1, immune: ['stun', 'freeze', 'poison', 'bleed'],
    light: { r: 60, color: '#b070ff' }, tags: ['undead', 'boss'], music: 'boss',
    drops: [{ item: 'potion', chance: 1, qty: [2, 3] }, { item: 'tome_xp', chance: 0.5 }],
    intro: ['Another warm body for my crypt...', 'Kneel, and I will make your bones immortal!'],
    update: bossBrain({ color: '#b070ff', keep: 90, moves: [ring('#b070ff', 12), fan('#80ffff', 5, { slow: { amt: 0.4, dur: 2 } }), blast('#b070ff', null), summon('skeleton', 2)] }),
  });
  R.addEnemy({
    id: 'broodmother', name: 'Vexa', title: 'The Broodmother', boss: true, level: 9, hp: 1800, atk: 36, def: 10, spd: 46, xp: 1200, gold: [200, 300], r: 16, height: 30, scale: 2.6,
    sprite: 'spider', pal: { main: '#3a2a3a', mark: '#e03040', eye: '#80ff40' }, knockResist: 1, immune: ['stun', 'poison'], tags: ['insect', 'boss'], music: 'boss',
    drops: [{ item: 'potion', chance: 1, qty: [3, 4] }],
    intro: ['*The walls of the nest tremble. Hundreds of eyes open in the dark.*', 'Sssso... the little flame-thief comes to my nest.'],
    update: bossBrain({ color: '#80ff40', keep: 60, moves: [fan('#a0ff60', 5, { poison: { dps: 12, dur: 4 } }), blast('#80ff40', { poison: { dps: 14, dur: 4 } }), summon('spiderling', 3), ring('#e0e0f0', 10)] }),
  });

  // ---------------------------------------------------------------- quests
  const Q = R.addQuest;
  Q({
    id: 'main_3', name: 'Into the Mirefen', type: 'main', giver: 'elder', level: 5, requires: ['main_2'],
    desc: 'The Slime King held an Ember Shard. Elder Maren believes another lies in the Mirefen Swamp, east of the Whisperwood. Find Warden Osric at Mirewatch.',
    objectives: [{ type: 'reach', map: 'marsh', text: 'Travel to the Mirefen Swamp' }, { type: 'talk', npc: 'osric', lines: ['A traveler from Havenbrook? Maren sent word.', 'Something nests in the northeast of the swamp. Spiders the size of wagons... and a light that burns inside the web.'] }],
    rewards: { xp: 250, gold: 80, gear: { rarity: 'uncommon', level: 6 } },
    dialog: {
      offer: ['That shard you carry... It is a piece of the Ember Crown, which Malgrath the Hollow King shattered long ago.', 'Its twin calls from the Mirefen Swamp. Will you go?'],
      accept: 'Seek Warden Osric at Mirewatch. The swamp road is east of the forest.',
      progress: ['Warden Osric keeps watch in the Mirefen. Find him.'],
      complete: ['Osric sent a raven. You made it there alive, which is more than most.'],
    },
    turnIn: 'osric',
  });
  Q({
    id: 'main_4', name: 'Mother of Spiders', type: 'main', giver: 'osric', level: 8, requires: ['main_3'],
    desc: "The Broodmother's nest lies in the northeast of the Mirefen. Slay her and recover the second Ember Shard.",
    objectives: [{ type: 'kill', target: 'spider', count: 6 }, { type: 'boss', target: 'broodmother' }],
    rewards: { xp: 900, gold: 300, gear: { rarity: 'epic', level: 9 } },
    dialog: {
      offer: ['Her brood grows every night. If we wait, Mirewatch falls.', 'Thin the spiders, then burn out the nest. Will you do it?'],
      accept: 'The nest is northeast. Bring fire, if you have it.',
      progress: ['The nest still stands. I can hear it skittering at night.'],
      complete: ['You... actually did it. The swamp is quiet for the first time in years.', 'Take the shard back to Maren. Havenbrook owes you everything.'],
    },
    onComplete() { R.World.later(1.5, () => R.Story.ending()); },
  });
  const side = (q) => Q(Object.assign({ type: 'side' }, q));
  side({ id: 'side_ring', name: "Wendel's Ring", giver: 'wendel', level: 2, desc: 'Wendel dropped his wedding ring somewhere in the Whisperwood. His wife will kill him. (Her words.)',
    objectives: [{ type: 'collect', item: 'wedding_ring', count: 1 }], rewards: { xp: 70, gold: 50, items: ['elixir_speed'] },
    dialog: { offer: ['I lost my wedding ring in the woods, chasing a very fast goose.', 'Would you look for it? Probably in a chest. Geese love chests.'], accept: 'Bless you!', progress: ['Any luck with the ring?'], complete: ['My ring! My marriage! My life! Thank you!'] } });
  side({ id: 'side_diary', name: "Otto's Secret", giver: 'otto', level: 6, desc: 'Otto lost his diary in the swamp and is very keen that nobody reads it.',
    objectives: [{ type: 'collect', item: 'millers_diary', count: 1 }], rewards: { xp: 180, gold: 120 },
    dialog: { offer: ['My diary. It is somewhere in this swamp. In a chest. Do NOT read it.'], accept: 'Hurry, before someone reads it!', progress: ['Did you read it? You read it, didn\'t you.'], complete: ['You didn\'t read it. Right? ...Right.'] } });
  side({ id: 'side_mush', name: 'Mushroom Madness', giver: 'greta', level: 2, desc: 'Old Greta needs sporeling caps for her famous soup.',
    objectives: [{ type: 'collect', item: 'mushroom_cap', count: 5 }], rewards: { xp: 90, gold: 45, items: ['potion_small', 'potion_small'] },
    dialog: { offer: ['Sporelings in the Whisperwood carry the finest caps. Bring me five!'], accept: 'Mind the spores. They pop.', progress: ['Five caps, dear.'], complete: ['Wonderful! Soup tonight!'] } });
  side({ id: 'side_goblins', name: 'Bounty: Goblin Raiders', giver: 'board', level: 3, desc: 'BOUNTY: Goblins raiding the forest road. 10 gold per goblin, paid by the Captain.',
    objectives: [{ type: 'kill', target: ['goblin', 'goblin_archer', 'goblin_shaman'], count: 8, text: 'Defeat goblins' }], rewards: { xp: 150, gold: 90 },
    dialog: { offer: ['BOUNTY: Goblins raiding the forest road. Report kills to the board.'], accept: '(You tear off a notice.)', progress: ['(The notice flutters in the wind.)'], complete: ['(A pouch of coins has been pinned to the board with your name on it.)'] } });
  side({ id: 'side_boars', name: 'Pork Problem', giver: 'captain', level: 3, desc: 'Wild boars keep charging the guards on patrol.',
    objectives: [{ type: 'kill', target: 'boar', count: 5 }], rewards: { xp: 130, gold: 70, gear: { rarity: 'uncommon', level: 4 } },
    dialog: { offer: ['Boars. Charging my guards. Every. Single. Day.', 'Put down five of them, would you?'], accept: 'Watch for the charge. Roll aside.', progress: ['Still hearing oinks out there.'], complete: ['Peace and quiet at last. Here, you earned this.'] } });
  side({ id: 'side_bats', name: 'Batty', giver: 'finn', level: 4, desc: 'Finn was chased out of the grotto by bats. He would like revenge, by proxy.',
    objectives: [{ type: 'kill', target: 'bat', count: 6 }], rewards: { xp: 120, gold: 60 },
    dialog: { offer: ['Bats! Everywhere! In my hair!', 'Get them back for me. Six should do it.'], accept: 'Avenge my hair!', progress: ['Are they gone?'], complete: ['My hair and I thank you.'] } });
  side({ id: 'side_slime_pets', name: 'Slime Pets', giver: 'pip', level: 1, desc: 'Pip wants slime gel to make a pet slime. This is a bad idea.',
    objectives: [{ type: 'collect', item: 'slime_gel', count: 3 }], rewards: { xp: 40, gold: 15 },
    dialog: { offer: ['Can you bring me slime gel? I want to make a pet slime! Three blobs!'], accept: 'Yay!', progress: ['Three blobs please!'], complete: ['I will name him Gloopus Junior.'] } });
  side({ id: 'side_frogs', name: 'Witch\'s Brew', giver: 'nessa', level: 6, desc: 'Nessa needs frog legs for a potion. She promises it is not for soup.',
    objectives: [{ type: 'collect', item: 'frog_leg', count: 6 }], rewards: { xp: 200, gold: 100, items: ['elixir_arcana', 'ether'] },
    dialog: { offer: ['Six frog legs. For a potion. Not soup. Why does everyone think soup?'], accept: 'The frogs hop in the shallows.', progress: ['Six legs, dearie.'], complete: ['Perfect. Take an elixir. It is definitely not soup.'] } });
  side({ id: 'side_lizards', name: 'Scaly Trouble', giver: 'grub', level: 7, desc: 'Lizardmen keep stealing Grub\'s fish.',
    objectives: [{ type: 'kill', target: 'lizardman', count: 6 }], rewards: { xp: 240, gold: 130, gear: { rarity: 'rare', level: 7 } },
    dialog: { offer: ['Lizardmen took my catch again. Teach \'em some manners?'], accept: 'Six of \'em ought to do.', progress: ['Still missin\' fish.'], complete: ['Ha! Fish for everyone tonight.'] } });
  side({ id: 'side_bones', name: 'Hermit\'s Research', giver: 'hermit', level: 6, desc: 'Old Bram studies the undead. He needs bone dust from the crypt.',
    objectives: [{ type: 'collect', item: 'bone_dust', count: 5 }], rewards: { xp: 200, gold: 90, items: ['potion', 'potion'] },
    dialog: { offer: ['The Forgotten Crypt, in the southeast of the wood. Bring me five pinches of bone dust.'], accept: 'The skeletons will not give it up willingly.', progress: ['Five pinches.'], complete: ['Excellent. For science!'] } });
  side({ id: 'side_lich', name: 'Rest for the Restless', giver: 'ghost', level: 9, desc: 'Lady Elowen\'s spirit is bound by the Bone Lich Mortis. Destroy him to free her.',
    objectives: [{ type: 'boss', target: 'lich' }], rewards: { xp: 700, gold: 250, gear: { rarity: 'epic', level: 9 } },
    dialog: { offer: ['...you can see me? Please... Mortis holds my soul in the crypt below.', 'Destroy him... and let me rest.'], accept: '...thank you...', progress: ['...he still lives... if you can call it that...'], complete: ['I am free. Take my blessing, hero... and my family\'s treasure.'] } });

  // ---------------------------------------------------------------- story
  R.Story = {
    intro() {
      R.UI.dialog([
        { speaker: 'Narrator', text: 'Long ago, the Ember Crown kept the realm\'s eternal flame burning.' },
        { speaker: 'Narrator', text: 'Then Malgrath the Hollow King shattered it, and its shards fell across the land, twisting every creature they touched.' },
        { speaker: 'Narrator', text: 'Now slimes pour from the Whisperwood, and the village of Havenbrook needs a hero.' },
        { speaker: 'Narrator', text: 'Speak with Elder Maren in the village square. Look for the ! above her head.' },
      ]);
    },
    ending() {
      R.UI.dialog([
        { speaker: 'Narrator', text: 'With the Broodmother slain, the second Ember Shard glows in your hand.' },
        { speaker: 'Narrator', text: 'Somewhere far to the north, in the Obsidian Citadel, Malgrath stirs. He has felt his shards returning.' },
        { speaker: 'Narrator', text: 'But that is a story for another day. Havenbrook is safe — thanks to you.' },
        { speaker: 'Narrator', text: 'Thank you for playing Emberfall! You can keep exploring, finish side quests and hunt for legendary loot.' },
      ], () => R.UI.banner('THE END', 'of Chapter One'));
    },
  };
  // Ember Shards drop from the story bosses.
  R.events.on('boss:defeat', (ev) => {
    const shard = { slime_king: 'ember_shard_1', broodmother: 'ember_shard_2' }[ev.id];
    const p = R.World.player;
    if (shard && p && !p.count(shard)) { p.addItem(shard); R.UI.lootToast(R.Items[shard], 1); }
  });
})(window.RPG);
