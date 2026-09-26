'use strict';
// World maps. Coordinates are in tiles (16px). See game/world.js makeBuilder() for the builder API.
(function (R) {
  const Maps = R.Maps = R.Maps || {};
  R.addMap = function (id, d) { d.id = id; Maps[id] = d; return d; };
  const add = R.addMap;

  // ---------------------------------------------------------------- Havenbrook
  add('town', {
    name: 'Havenbrook', subtitle: 'A quiet village', w: 52, h: 38, level: 1, music: 'town', safe: true, outdoor: true, dustColor: '#b09468',
    weather: 'leaves',
    build(M) {
      M.fill('grass');
      M.noiseFill(0.12, (n) => (n > 0.72 ? 'darkgrass' : null));
      // plaza + roads
      M.rect(20, 14, 12, 9, 'cobble');
      M.path([[0, 18], [20, 18]], 'path', 3);
      M.path([[32, 18], [52, 18]], 'path', 3);
      M.path([[26, 0], [26, 14]], 'path', 3);
      M.path([[26, 23], [26, 38]], 'path', 3);
      // pond
      M.circle(42, 30, 4, 'water', 2);
      M.circle(42, 30, 5.2, 'shallow', 1.5);
      M.circle(42, 30, 4, 'water', 2);
      // buildings (bottom-centre tile coordinates)
      M.prop('bighouse', 17, 12, 0);
      M.prop('smithy', 36, 12); M.prop('anvil', 40, 13); M.prop('barrel', 32, 12); M.prop('crate', 33, 12);
      M.prop('shop', 16, 29, 0); M.prop('inn', 36, 30);
      M.prop('house', 8, 8, 1); M.prop('house', 8, 29, 2); M.prop('house', 45, 8, 3);
      M.prop('well', 26, 17);
      M.prop('stall', 22, 22, 0); M.prop('stall', 30, 22, 1);
      for (const [x, y] of [[20, 14], [31, 14], [20, 22], [31, 22]]) M.prop('lamp', x, y);
      for (let x = 2; x < 14; x++) M.prop('fence', x, 34);
      M.prop('statue', 26, 13);
      M.waypoint('town', 23, 18, 'Havenbrook');
      M.point('wp:town', 23, 19);
      M.reserve(18, 13, 16, 12);
      M.reserve(0, 16, 52, 5); M.reserve(24, 0, 5, 38);
      M.scatter('tree', 45, { on: ['grass', 'darkgrass'], minDist: 2 });
      M.scatter('bush', 20, { on: ['grass', 'darkgrass'] });
      M.scatter('flowers', 30, { on: ['grass'] });
      M.scatter('lily', 4, { on: ['water'], area: [37, 26, 10, 9] });
      // npcs
      M.npc('elder', 25, 16);
      M.npc('smith', 38, 14);
      M.npc('alchemist', 17, 31);
      // exits
      M.exit(51, 16, 1, 5, 'forest', 'west');
      M.point('start', 26, 20);
      M.point('east', 49, 18);
      M.sign(47, 16, 'East: The Whisperwood.\nBeware of slimes.');
    },
  });

  // ---------------------------------------------------------------- Whisperwood
  add('forest', {
    name: 'The Whisperwood', subtitle: 'Level 1-4', w: 80, h: 60, level: 2, music: 'field', outdoor: true, dustColor: '#7a5c3a',
    weather: 'fireflies', tint: 'rgba(10,40,20,0.08)',
    build(M) {
      M.fill('grass');
      M.noiseFill(0.08, (n) => (n > 0.6 ? 'darkgrass' : n < 0.3 ? 'dirt' : null));
      M.path([[0, 30], [20, 30], [34, 22], [40, 8], [40, 0]], 'path', 2, 4);
      M.path([[34, 22], [55, 32], [79, 30]], 'path', 2, 4);
      // river
      M.path([[60, 0], [58, 20], [64, 40], [60, 60]], 'water', 3, 6);
      M.rect(56, 30, 10, 3, 'bridge');
      M.circle(20, 45, 5, 'water', 2);
      M.reserve(0, 27, 36, 6); M.reserve(30, 0, 14, 26); M.reserve(34, 26, 46, 10);
      M.scatter('tree', 220, { minDist: 1.6 });
      M.scatter('bush', 60);
      M.scatter('mushroom', 25);
      M.scatter('rock', 20);
      M.scatter('flowers', 40);
      M.scatter('lily', 6, { on: ['water'], area: [14, 40, 12, 12] });
      // grotto entrance (north)
      M.rect(37, 1, 7, 3, 'cave');
      M.prop('boulder', 36, 3); M.prop('boulder', 44, 3);
      M.exit(38, 0, 5, 2, 'grotto', 'south', { label: 'Enter the Slime Grotto', prompt: true, color: '#60ff80' });
      M.point('grotto', 40, 5);
      M.waypoint('forest', 30, 28, 'Whisperwood Crossing');
      // monsters
      M.spawn('slime', 12, 26, { count: 4, radius: 4, level: 1 });
      M.spawn('slime', 24, 38, { count: 5, radius: 5, level: 1 });
      M.spawn('wolf', 48, 14, { count: 3, radius: 4, level: 2 });
      M.spawn('wolf', 70, 50, { count: 3, radius: 4, level: 3 });
      M.spawn('goblin', 70, 16, { count: 3, radius: 4, level: 3, elite: 0.2 });
      M.spawn('goblin_archer', 72, 12, { count: 2, radius: 3, level: 3 });
      M.spawn('slime', 40, 44, { count: 5, radius: 6, level: 2 });
      M.chest('forest_1', 8, 50, { loot: ['potion_small', 'copper_ring'], gold: 25 });
      M.chest('forest_2', 76, 6, { loot: ['chain_mail'], gold: 40, tier: 'iron' });
      M.exit(0, 27, 1, 6, 'town', 'east');
      M.point('west', 2, 30);
      M.point('south', 40, 4);
    },
  });

  // ---------------------------------------------------------------- Slime Grotto
  add('grotto', {
    name: 'Slime Grotto', subtitle: 'Level 3-4', w: 44, h: 40, level: 3, music: 'dungeon', dark: 0.82, ambient: '#050a08', playerLight: 100, dustColor: '#5a4c52',
    weather: 'spores',
    build(M) {
      M.fill('cavewall');
      // carve cave with noise
      M.noiseFill(0.13, (n, x, y) => (n > 0.47 && x > 1 && y > 1 && x < M.w - 2 && y < M.h - 2 ? 'cave' : null));
      // guaranteed corridors & rooms
      M.path([[22, 38], [22, 30], [12, 24], [14, 12], [22, 8]], 'cave', 3, 3);
      M.path([[22, 30], [32, 22], [30, 10], [22, 8]], 'cave', 3, 3);
      M.circle(22, 7, 6, 'cave', 1.5); // boss room
      M.circle(12, 24, 4, 'cave', 1);
      M.circle(32, 22, 4, 'cave', 1);
      M.circle(20, 7, 2, 'swamp'); M.circle(25, 8, 2, 'swamp');
      M.rect(20, 36, 5, 4, 'cave');
      M.scatter('crystal', 18, { on: ['cave'], minDist: 3 });
      M.scatter('stalagmite', 25, { on: ['cave'] });
      M.scatter('mushroom', 20, { on: ['cave'] });
      M.scatter('bones', 8, { on: ['cave'] });
      M.prop('torch', 20, 34); M.prop('torch', 24, 34);
      M.spawn('slime', 12, 24, { count: 4, radius: 2, level: 3, respawn: 90 });
      M.spawn('bat', 32, 22, { count: 3, radius: 2, level: 3, respawn: 90 });
      M.spawn('slime', 26, 16, { count: 3, radius: 2, level: 3, respawn: 90 });
      M.boss('slime_king', 22, 6);
      M.chest('grotto_1', 34, 20, { loot: ['potion_small', 'ether_small'], gold: 35 });
      M.exit(20, 39, 5, 1, 'forest', 'grotto');
      M.point('south', 22, 36);
    },
  });
})(window.RPG);
