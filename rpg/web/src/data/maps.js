'use strict';
// World maps. Coordinates are in tiles (16px). See game/world.js makeBuilder() for the builder API.
//
// World layout (exits):
//   town --E--> forest --N--> grotto            (shard 1: slime_king)
//                  |--SE graveyard--> crypt     (optional: lich)
//                  |--E--> marsh --NE--> spider_den (shard 2: broodmother)
(function (R) {
  const Maps = R.Maps = R.Maps || {};
  R.addMap = function (id, d) { d.id = id; Maps[id] = d; return d; };
  const add = R.addMap;
  const QL = () => R.QuestLog;
  const done = (q) => QL() && QL().isDone(q);
  const has = (it) => R.World.player && R.World.player.count(it) > 0;

  // ---- small builder kit ----------------------------------------------------------
  const K = R.MapKit = {
    // reserve every tile of the given types (keeps roads free of scattered props)
    keepTiles(M, types) { for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (types.includes(M.get(x, y))) M.reserve(x, y, 1, 1); },
    rooms(M, floor, list) { for (const [x, y, w, h] of list) M.rect(x, y, w, h, floor); },
    halls(M, floor, list, width) { for (const pts of list) M.path(pts, floor, width || 3); },
    // props at the four inner corners of a room
    corners(M, pid, x, y, w, h) { M.prop(pid, x + 1, y + 1); M.prop(pid, x + w - 2, y + 1); M.prop(pid, x + 1, y + h - 2); M.prop(pid, x + w - 2, y + h - 2); },
    campsite(M, x, y) { M.prop('campfire', x, y); M.prop('bedroll', x - 2, y + 1); M.prop('bedroll', x + 2, y + 1); M.prop('woodpile', x + 3, y - 2); },
  };

  // ================================================================ Havenbrook
  add('town', {
    name: 'Havenbrook', subtitle: 'A quiet village', w: 60, h: 44, level: 1, music: 'town', safe: true, outdoor: true, dustColor: '#b09468',
    weather: 'leaves',
    build(M) {
      M.fill('grass');
      M.noiseFill(0.12, (n) => (n > 0.72 ? 'darkgrass' : null));
      M.border('canopy', 2, [[57, 19, 3, 5], [28, 0, 5, 3]]);
      // roads & plaza
      M.path([[30, 0], [30, 17]], 'path', 3);
      M.path([[38, 21], [60, 21]], 'path', 3);
      M.path([[8, 21], [22, 21]], 'path', 3);
      M.path([[30, 27], [30, 40], [44, 40]], 'path', 3);
      M.path([[12, 21], [12, 30]], 'path', 2);
      M.rect(22, 16, 16, 11, 'cobble');
      // pond
      M.circle(50, 35, 5.4, 'shallow', 1.5); M.circle(50, 35, 4, 'water', 2);
      M.rect(44, 34, 3, 2, 'planks');
      M.prop('boat', 50, 36);
      // farm
      M.rect(3, 31, 13, 9, 'farmland');
      for (let y = 32; y < 40; y += 2) for (let x = 4; x < 15; x += 2) M.prop('crops', x, y, (y / 2) % 3);
      M.prop('scarecrow', 9, 35); M.prop('haystack', 17, 33); M.prop('haystack', 17, 37); M.prop('cart', 18, 30);
      for (let x = 3; x < 16; x++) M.prop('fence', x, 40);
      // buildings (bottom-centre tile coords)
      M.prop('bighouse', 23, 15, 0);                  // Elder's hall
      M.prop('tower', 36, 14);                        // Orin's tower
      M.prop('smithy', 46, 19); M.prop('forge', 41, 19); M.prop('anvil', 51, 19); M.prop('weaponrack', 53, 18);
      M.prop('shop', 46, 29, 1); M.prop('armorstand', 42, 28); M.prop('armorstand', 50, 28);  // armorer
      M.prop('shop', 14, 20, 0); M.prop('barrel', 19, 19); M.prop('crate', 9, 19);          // alchemist
      M.prop('inn', 23, 36); M.prop('bench', 18, 38); M.prop('barrel', 28, 35); M.prop('barrel', 29, 36);
      M.prop('house', 8, 11, 1); M.prop('house', 50, 11, 3); M.prop('house', 41, 10, 2); M.prop('hut', 14, 11, 0);
      // plaza
      M.prop('fountain', 30, 22);
      M.prop('stall', 25, 26, 0); M.prop('stall', 35, 26, 1);
      for (const [x, y] of [[22, 16], [37, 16], [22, 26], [37, 26]]) M.prop('lamp', x, y);
      M.prop('lamp', 44, 22); M.prop('lamp', 16, 22); M.prop('lamp', 32, 32);
      M.waypoint('town', 26, 18, 'Havenbrook');
      // training yard
      M.rect(36, 32, 10, 5, 'dirt');
      M.prop('dummy', 38, 33); M.prop('dummy', 41, 33); M.prop('dummy', 44, 33); M.prop('weaponrack', 40, 36);
      // north gate
      M.prop('gate', 30, 3);
      M.blockRect(26, 1, 3, 3); M.blockRect(32, 1, 3, 3);
      for (let x = 20; x < 27; x++) M.prop('palisade', x, 3);
      for (let x = 34; x < 41; x++) M.prop('palisade', x, 3);
      M.reserve(20, 16, 20, 12);
      K.keepTiles(M, ['path', 'cobble', 'farmland', 'planks', 'dirt']);
      M.scatter('autumntree', 30, { on: ['grass', 'darkgrass'], minDist: 2.5 });
      M.scatter('tree', 16, { on: ['grass', 'darkgrass'], minDist: 2.5 });
      M.scatter('bush', 16, { on: ['grass', 'darkgrass'] });
      M.scatter('flowers', 30, { on: ['grass'] });
      M.scatter('lily', 4, { on: ['water'], area: [45, 30, 10, 10] });
      // people
      M.npc('elder', 24, 17);
      M.npc('smith', 48, 21);
      M.npc('armorer', 46, 31);
      M.npc('alchemist', 14, 22);
      M.npc('arcanist', 36, 16);
      M.npc('innkeeper', 23, 38);
      M.npc('trainer', 42, 35);
      M.npc('guard', 56, 19);
      M.npc('captain', 33, 5);
      M.npc('pip', 28, 29);
      M.npc('lottie', 33, 29);
      M.npc('wendel', 10, 30);
      M.npc('greta', 12, 13);
      M.npc('fennick', 32, 18);
      M.npc('board', 34, 17);
      // exits
      M.exit(59, 19, 1, 5, 'forest', 'west');
      M.point('start', 30, 24);
      M.point('east', 56, 21);
      M.point('north', 30, 5);
      M.sign(55, 18, 'East: The Whisperwood.\nBeware of slimes.');
      M.sign(28, 6, 'North: Frostfang Pass.\nClosed by order of the Elder.');
    },
  });

  // ================================================================ The Whisperwood
  add('forest', {
    name: 'The Whisperwood', subtitle: 'Level 1-4', w: 96, h: 72, level: 2, music: 'field', outdoor: true, dustColor: '#7a5c3a',
    weather: 'fireflies', tint: 'rgba(10,40,20,0.08)',
    build(M) {
      M.fill('grass');
      M.noiseFill(0.08, (n) => (n > 0.6 ? 'darkgrass' : n < 0.3 ? 'dirt' : null));
      M.border('canopy', 2, [[0, 33, 2, 6], [94, 33, 2, 6], [45, 0, 7, 2]]);
      // river
      M.path([[66, 0], [62, 30], [70, 50], [64, 72]], 'water', 4, 5);
      // roads
      M.path([[0, 36], [40, 36], [94, 36]], 'path', 3, 3);
      M.path([[40, 36], [44, 20], [48, 3]], 'path', 3, 3);
      M.path([[40, 36], [26, 22], [18, 16]], 'path', 2, 3);
      M.path([[40, 36], [30, 50], [20, 58]], 'path', 2, 3);
      M.path([[82, 36], [82, 56]], 'path', 2, 2);
      M.rect(58, 33, 12, 7, 'bridge');
      // grotto mouth (north)
      M.rect(44, 0, 9, 4, 'cave');
      M.prop('cavemouth', 48, 3, 0); M.prop('boulder', 43, 4); M.prop('boulder', 53, 4);
      M.exit(45, 0, 7, 1, 'grotto', 'south', { color: '#60ff80' });
      M.point('grotto', 48, 6);
      // Old Mill (NW)
      M.rect(12, 10, 12, 9, 'dirt');
      M.prop('mill', 16, 14); M.prop('ruinwall', 21, 11); M.prop('ruinwall', 12, 17); M.prop('crate', 20, 15); M.prop('barrel', 21, 16);
      M.zone('Old Mill', 17, 15, 5);
      M.chest('mill_diary', 22, 13, { loot: ['millers_diary', 'potion_small'], gold: 15 });
      M.npc('whiskers', 7, 7);
      // hermit hut (SW)
      M.circle(28, 63, 4, 'water', 1.5);
      M.prop('hut', 16, 58, 1); M.prop('cauldron', 20, 59); M.prop('woodpile', 12, 58); M.prop('stump', 22, 57);
      M.npc('hermit', 19, 60);
      // goblin camp (NE)
      M.rect(74, 8, 16, 12, 'dirt');
      M.prop('tent', 77, 11, 0); M.prop('tent', 86, 11, 1); M.prop('campfire', 81, 14); M.prop('crate', 88, 16); M.prop('crate', 75, 17); M.prop('cage', 84, 17);
      for (let x = 73; x < 91; x += 1) if (x < 79 || x > 83) M.prop('palisade', x, 20);
      M.chest('forest_2', 88, 9, { loot: ['potion_small', 'potion_small', 'ether_small'], gold: 60, tier: 'iron' });
      // graveyard (SE) with the crypt
      M.rect(72, 54, 20, 14, 'gravel');
      for (let y = 62; y < 67; y += 2) for (let x = 74; x < 91; x += 3) M.prop(y % 4 ? 'grave' : 'cross', x, y);
      M.prop('mausoleum', 84, 58);
      M.prop('deadtree', 74, 56); M.prop('deadtree', 91, 60); M.prop('candles', 80, 59); M.prop('lamp', 79, 56);
      M.exit(83, 59, 3, 1, 'crypt', 'entrance', { label: 'Enter the Forgotten Crypt', prompt: true, color: '#b070ff' });
      M.point('crypt', 84, 61);
      M.npc('ghost', 78, 60);
      // lost ring
      M.chest('wendel_ring', 6, 64, { loot: ['wedding_ring'], gold: 10 });
      M.chest('forest_1', 34, 66, { loot: ['potion_small', 'copper_ring'], gold: 25 });
      M.waypoint('forest', 38, 33, 'Whisperwood Crossing');
      M.sign(42, 33, 'N: Slime Grotto\nE: Mirefen Swamp\nSE: Old Graveyard\nW: Havenbrook');
      M.reserve(36, 30, 8, 8);
      K.keepTiles(M, ['path', 'bridge', 'gravel', 'cave']);
      M.scatter('tree', 200, { on: ['grass', 'darkgrass', 'dirt'], minDist: 1.7 });
      M.scatter('pine', 30, { on: ['grass', 'darkgrass'], minDist: 2 });
      M.scatter('bush', 60, { on: ['grass', 'darkgrass'] });
      M.scatter('mushroom', 25); M.scatter('rock', 20); M.scatter('flowers', 40, { on: ['grass'] });
      M.scatter('log', 8, { on: ['grass', 'darkgrass'] }); M.scatter('stump', 10, { on: ['grass', 'darkgrass'] });
      M.scatter('lily', 8, { on: ['water'] });
      // monsters
      M.spawn('slime', 12, 30, { count: 4, radius: 4, level: 1 });
      M.spawn('slime', 26, 42, { count: 5, radius: 5, level: 1 });
      M.spawn('slime', 50, 46, { count: 4, radius: 5, level: 2 });
      M.spawn('mushroom', 30, 26, { count: 3, radius: 3, level: 2 });
      M.spawn('wolf', 52, 18, { count: 3, radius: 4, level: 2 });
      M.spawn('wolf', 56, 60, { count: 3, radius: 4, level: 3, elite: 0.1 });
      M.spawn('boar', 36, 56, { count: 3, radius: 4, level: 3 });
      M.spawn('boar', 76, 44, { count: 2, radius: 3, level: 3 });
      M.spawn('goblin', 80, 13, { count: 3, radius: 3, level: 3, elite: 0.2 });
      M.spawn('goblin_archer', 84, 9, { count: 2, radius: 2, level: 3 });
      M.spawn('goblin_shaman', 78, 16, { count: 1, radius: 2, level: 4 });
      // exits
      M.exit(0, 33, 1, 6, 'town', 'east');
      M.exit(95, 33, 1, 6, 'marsh', 'west', { requires: () => done('main_2'), locked: 'Thorny brambles block the swamp road. (Defeat the Slime King first.)' });
      M.point('west', 2, 36);
      M.point('east', 92, 36);
    },
  });

  // ================================================================ Slime Grotto
  add('grotto', {
    name: 'Slime Grotto', subtitle: 'Level 3-5', w: 44, h: 42, level: 3, music: 'dungeon', dark: 0.82, ambient: '#050a08', playerLight: 100, dustColor: '#5a4c52',
    weather: 'spores',
    build(M) {
      M.fill('cavewall');
      M.noiseFill(0.13, (n, x, y) => (n > 0.47 && x > 1 && y > 1 && x < M.w - 2 && y < M.h - 2 ? 'cave' : null));
      M.path([[22, 40], [22, 30], [12, 24], [14, 12], [22, 8]], 'cave', 3, 3);
      M.path([[22, 30], [32, 22], [30, 10], [22, 8]], 'cave', 3, 3);
      M.circle(22, 7, 6, 'cave', 1.5);
      M.circle(12, 24, 4, 'cave', 1); M.circle(32, 22, 4, 'cave', 1);
      M.circle(18, 7, 1.6, 'swamp'); M.circle(27, 8, 1.6, 'swamp');
      M.rect(19, 34, 7, 8, 'cave');
      M.scatter('crystal', 18, { on: ['cave'], minDist: 3 });
      M.scatter('stalagmite', 25, { on: ['cave'] });
      M.scatter('mushroom', 20, { on: ['cave'] });
      M.scatter('bones', 8, { on: ['cave'] });
      M.prop('torch', 19, 35); M.prop('torch', 25, 35);
      M.waypoint('grotto', 24, 37, 'Grotto Mouth');
      M.npc('finn', 34, 20);
      M.spawn('slime', 12, 24, { count: 4, radius: 2, level: 3, respawn: 90 });
      M.spawn('bat', 32, 22, { count: 3, radius: 2, level: 3, respawn: 90 });
      M.spawn('cave_slime', 26, 16, { count: 3, radius: 2, level: 4, respawn: 90 });
      M.spawn('cave_slime', 14, 14, { count: 3, radius: 2, level: 4, respawn: 90 });
      M.boss('slime_king', 22, 6);
      M.chest('grotto_1', 36, 22, { loot: ['potion_small', 'ether_small'], gold: 35 });
      M.exit(19, 41, 7, 1, 'forest', 'grotto');
      M.point('south', 21, 38);
    },
  });

  // ================================================================ Forgotten Crypt
  add('crypt', {
    name: 'Forgotten Crypt', subtitle: 'Level 6-9', w: 56, h: 52, level: 7, music: 'dungeon', dark: 0.86, ambient: '#06040c', playerLight: 95, dustColor: '#4a4a54',
    build(M) {
      M.fill('cryptwall');
      K.rooms(M, 'cryptfloor', [[22, 0, 13, 10], [18, 18, 21, 11], [3, 15, 12, 15], [43, 14, 11, 16], [15, 35, 27, 14]]);
      K.halls(M, 'cryptfloor', [[[28, 9], [28, 19]], [[19, 23], [12, 23]], [[38, 23], [45, 23]], [[28, 28], [28, 36]], [[8, 29], [8, 40], [16, 40]]]);
      M.rect(19, 19, 19, 9, 'cryptfloor');
      M.prop('stairsdown', 28, 2);
      M.waypoint('crypt', 32, 4, 'Crypt Stair');
      M.prop('torch', 23, 7); M.prop('torch', 33, 7);
      // central hall
      for (const x of [21, 25, 31, 35]) { M.prop('pillar', x, 20, 1); M.prop('pillar', x, 26, 1); }
      M.prop('brazier', 28, 21);
      // ossuary (west)
      M.prop('skullpile', 5, 17); M.prop('skullpile', 12, 17); M.prop('skullpile', 5, 28); M.prop('bones', 9, 21); M.prop('bones', 7, 25); M.prop('candles', 10, 16); M.prop('torch', 13, 23);
      M.chest('crypt_1', 8, 19, { loot: ['potion', 'potion'], gold: 90, tier: 'iron' });
      // burial chamber (east)
      for (let y = 16; y < 29; y += 5) { M.prop('sarcophagus', 46, y + 2, 0); M.prop('sarcophagus', 51, y + 2, 0); }
      M.prop('torch', 44, 15); M.prop('torch', 52, 15); M.prop('urn', 48, 28);
      M.chest('crypt_2', 48, 16, { loot: ['potion', 'ether_small'], gold: 120, tier: 'iron' });
      // lich chamber
      for (const x of [18, 24, 32, 38]) { M.prop('pillar', x, 38, 1); M.prop('pillar', x, 46, 1); }
      M.prop('brazier', 20, 42); M.prop('brazier', 36, 42); M.prop('rune', 28, 44); M.prop('coffin', 28, 47);
      M.prop('candles', 16, 36); M.prop('candles', 40, 36);
      M.boss('lich', 28, 42);
      M.chest('crypt_3', 40, 47, { loot: ['potion', 'potion', 'ether_small'], gold: 200, tier: 'gold' });
      M.spawn('skeleton', 28, 23, { count: 4, radius: 4, level: 6 });
      M.spawn('skeleton_archer', 33, 21, { count: 2, radius: 2, level: 6 });
      M.spawn('ghoul', 8, 23, { count: 3, radius: 3, level: 7 });
      M.spawn('wraith', 48, 22, { count: 2, radius: 3, level: 8 });
      M.spawn('bone_mage', 50, 26, { count: 1, radius: 2, level: 8 });
      M.spawn('skeleton_knight', 12, 40, { count: 2, radius: 2, level: 8, elite: 0.3 });
      M.spawn('skeleton', 28, 32, { count: 2, radius: 2, level: 7 });
      M.exit(24, 0, 9, 1, 'forest', 'crypt');
      M.point('entrance', 28, 5);
    },
  });

  // ================================================================ Mirefen Swamp
  add('marsh', {
    name: 'Mirefen Swamp', subtitle: 'Level 5-8', w: 96, h: 80, level: 6, music: 'field', outdoor: true, dustColor: '#4a4a32',
    weather: 'rain', tint: 'rgba(30,50,20,0.16)',
    build(M) {
      M.fill('swamp');
      M.noiseFill(0.1, (n) => (n > 0.66 ? 'bog' : n > 0.58 ? 'murk' : n < 0.3 ? 'mud' : null));
      M.border('canopy', 2, [[0, 37, 2, 6], [45, 78, 7, 2]]);
      // trails (drawn after the bog so they are always walkable)
      M.path([[0, 40], [30, 40], [60, 30], [80, 14]], 'mud', 3, 3);
      M.path([[30, 40], [40, 58], [48, 79]], 'mud', 3, 3);
      M.path([[60, 30], [84, 42]], 'mud', 2, 2);
      M.path([[40, 58], [72, 62]], 'mud', 2, 2);
      // Mirewatch (stilt camp)
      M.rect(22, 33, 17, 12, 'planks');
      M.prop('stilthut', 26, 36, 0); M.prop('stilthut', 35, 36, 1);
      M.prop('campfire', 30, 41); M.prop('barrel', 23, 43); M.prop('crate', 37, 43); M.prop('lamp', 22, 38); M.prop('lamp', 38, 38);
      M.waypoint('marsh', 34, 42, 'Mirewatch');
      M.npc('osric', 28, 39); M.npc('nessa', 33, 39); M.npc('grub', 27, 43); M.npc('otto', 37, 41);
      // witch hut (SE)
      M.rect(68, 58, 10, 8, 'mud');
      M.prop('hut', 73, 61, 1); M.prop('cauldron', 70, 63); M.prop('skull', 76, 63); M.prop('candles', 75, 64);
      M.chest('marsh_1', 77, 60, { loot: ['potion', 'ether_small'], gold: 80 });
      // lizardman ruins (E)
      M.rect(80, 36, 12, 12, 'mud');
      M.prop('ruinwall', 82, 38); M.prop('ruinwall', 88, 38); M.prop('ruinwall', 82, 46); M.prop('pillar', 90, 44); M.prop('skullpile', 86, 42);
      M.chest('marsh_2', 88, 45, { loot: ['potion', 'potion'], gold: 110, tier: 'iron' });
      // spider den mouth (NE)
      M.rect(76, 6, 10, 8, 'mud');
      M.prop('cavemouth', 80, 9, 2); M.prop('web', 75, 10); M.prop('web', 86, 9); M.prop('cocoon', 77, 12); M.prop('eggsac', 84, 12);
      M.exit(78, 8, 5, 2, 'spider_den', 'south', { label: "Enter Broodmother's Nest", prompt: true, color: '#a0ff60' });
      M.point('den', 80, 13);
      M.sign(33, 46, 'Mirewatch\nN-E: Broodmother\'s Nest\nS: Road to Saffar');
      K.keepTiles(M, ['mud', 'planks']);
      M.reserve(20, 31, 21, 16);
      M.scatter('swamptree', 70, { on: ['swamp'], minDist: 2.5 });
      M.scatter('mangrove', 30, { on: ['swamp', 'murk'], minDist: 3 });
      M.scatter('deadtree', 20, { on: ['swamp'] });
      M.scatter('reeds', 70, { on: ['swamp', 'murk'] });
      M.scatter('lily', 30, { on: ['bog'] });
      M.scatter('bigshroom', 12, { on: ['swamp'], minDist: 4 });
      M.scatter('log', 8, { on: ['swamp'] });
      M.spawn('bog_zombie', 14, 46, { count: 3, radius: 4, level: 5 });
      M.spawn('swamp_frog', 46, 50, { count: 4, radius: 5, level: 5 });
      M.spawn('wisp', 56, 20, { count: 3, radius: 4, level: 6 });
      M.spawn('spider', 70, 18, { count: 4, radius: 4, level: 6 });
      M.spawn('venom_spider', 66, 10, { count: 2, radius: 3, level: 7, elite: 0.15 });
      M.spawn('lizardman', 85, 41, { count: 4, radius: 4, level: 7, elite: 0.2 });
      M.spawn('bog_witch', 72, 66, { count: 2, radius: 3, level: 8 });
      M.spawn('bog_zombie', 50, 68, { count: 3, radius: 4, level: 7 });
      M.spawn('swamp_frog', 20, 60, { count: 3, radius: 4, level: 6 });
      M.exit(0, 37, 1, 6, 'forest', 'east');
      M.point('west', 2, 40);
      M.point('south', 48, 76);
    },
  });

  // ================================================================ Broodmother's Nest
  add('spider_den', {
    name: "Broodmother's Nest", subtitle: 'Level 7-9', w: 52, h: 52, level: 8, music: 'dungeon', dark: 0.86, ambient: '#060806', playerLight: 90, dustColor: '#4a4448',
    weather: 'spores',
    build(M) {
      M.fill('cavewall');
      M.noiseFill(0.14, (n, x, y) => (n > 0.5 && x > 2 && y > 2 && x < M.w - 3 && y < M.h - 3 ? 'web' : null));
      K.halls(M, 'web', [[[26, 51], [26, 40], [14, 32], [16, 18], [26, 12]], [[26, 40], [38, 30], [36, 18], [26, 12]], [[14, 32], [6, 40]], [[38, 30], [46, 38]]], 3);
      M.circle(26, 10, 8, 'web', 1.5);
      M.circle(6, 42, 4, 'web', 1); M.circle(46, 40, 4, 'web', 1); M.circle(26, 40, 4, 'web', 1);
      M.rect(23, 44, 7, 8, 'web');
      M.waypoint('spider_den', 28, 46, 'Nest Entrance');
      M.prop('torch', 23, 47); M.prop('torch', 30, 47);
      for (const [x, y] of [[20, 6], [32, 6], [18, 12], [34, 12], [22, 16], [30, 16]]) M.prop('eggsac', x, y);
      M.scatter('web', 16, { on: ['web'], minDist: 4 });
      M.scatter('cocoon', 14, { on: ['web'], minDist: 3 });
      M.scatter('eggsac', 10, { on: ['web'], minDist: 5 });
      M.scatter('bones', 10, { on: ['web'] });
      M.scatter('crystal', 6, { on: ['web'], minDist: 6 });
      M.boss('broodmother', 26, 9);
      M.spawn('spider', 16, 26, { count: 4, radius: 3, level: 7, respawn: 90 });
      M.spawn('spiderling', 36, 24, { count: 6, radius: 3, level: 7, respawn: 60 });
      M.spawn('venom_spider', 26, 38, { count: 2, radius: 2, level: 8, respawn: 90 });
      M.spawn('venom_spider', 46, 40, { count: 2, radius: 2, level: 8, elite: 0.25 });
      M.spawn('spiderling', 6, 42, { count: 5, radius: 3, level: 7 });
      M.chest('den_1', 6, 42, { loot: ['potion', 'potion'], gold: 90 });
      M.chest('den_2', 47, 41, { loot: ['potion', 'ether_small'], gold: 120, tier: 'iron' });
      M.exit(23, 51, 7, 1, 'marsh', 'den');
      M.point('south', 26, 48);
    },
  });
})(window.RPG);
