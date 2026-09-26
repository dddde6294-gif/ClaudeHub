'use strict';
// Enemy definitions.
//
// { id, name, level, hp, atk, def, spd, xp, gold:[min,max], r, height,
//   sprite: RPG.Monsters id, pal: {main, eye, ...}, scale?,
//   ai: RPG.AI id, attack: {...ai params}, aggro, leash,
//   drops: [{item, chance, qty?:[a,b]}],  tags: ['beast','undead',...],
//   knockResist, immune:[statuses], elite?, boss?, update?(e,dt,sm) custom AI, draw?(ctx,e) custom draw,
//   init?(e), onDeath?(e) }
(function (R) {
  const E = R.Enemies = {};
  R.addEnemy = function (d) { d.tags = d.tags || []; E[d.id] = d; return d; };
  const add = R.addEnemy;

  add({ id: 'slime', name: 'Green Slime', level: 1, hp: 22, atk: 6, def: 0, spd: 40, xp: 6, gold: [1, 3], r: 7, height: 12, sprite: 'slime', pal: { main: '#5fd35f' }, ai: 'hopper', attack: { cd: 0.6 }, drops: [{ item: 'slime_gel', chance: 0.5 }, { item: 'potion_small', chance: 0.06 }], tags: ['slime'] });
  add({ id: 'wolf', name: 'Grey Wolf', level: 2, hp: 34, atk: 9, def: 2, spd: 62, xp: 11, gold: [2, 5], r: 7, height: 16, sprite: 'wolf', pal: { main: '#8a8a92', eye: '#ffd040' }, ai: 'melee', attack: { range: 16, windup: 0.35, lunge: 160, cd: 1.1 }, drops: [{ item: 'wolf_pelt', chance: 0.45 }], tags: ['beast'] });
  add({ id: 'goblin', name: 'Goblin Raider', level: 3, hp: 40, atk: 10, def: 3, spd: 48, xp: 14, gold: [3, 8], r: 6, height: 20, sprite: 'goblin', pal: { main: '#6ab04a', cloth: '#7a4a2a' }, ai: 'melee', attack: { range: 16, windup: 0.45, lunge: 90, cd: 1.2 }, drops: [{ item: 'potion_small', chance: 0.1 }], tags: ['goblin'] });
  add({ id: 'goblin_archer', name: 'Goblin Archer', level: 3, hp: 30, atk: 9, def: 2, spd: 45, xp: 14, gold: [3, 8], r: 6, height: 20, sprite: 'goblin', pal: { main: '#5aa04a', cloth: '#4a5a2a', weapon: 'bow' }, ai: 'ranged', attack: { range: 180, keep: 110, windup: 0.6, cd: 2, speed: 170, kind: 'arrow', sound: 'arrow' }, tags: ['goblin'] });
  add({ id: 'bat', name: 'Cave Bat', level: 4, hp: 20, atk: 8, def: 0, spd: 80, xp: 9, gold: [1, 4], r: 6, height: 10, sprite: 'bat', pal: { main: '#5a4a6a' }, ai: 'swarm', attack: { cd: 1.3 }, tags: ['beast', 'flying'] });
  add({ id: 'skeleton', name: 'Skeleton', level: 5, hp: 55, atk: 13, def: 5, spd: 42, xp: 20, gold: [4, 10], r: 6, height: 24, sprite: 'skeleton', pal: { main: '#e8e0d0' }, ai: 'melee', attack: { range: 18, windup: 0.5, lunge: 70, cd: 1.3 }, drops: [{ item: 'potion_small', chance: 0.12 }], tags: ['undead'] });
})(window.RPG);
