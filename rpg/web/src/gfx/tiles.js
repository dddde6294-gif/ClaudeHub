'use strict';
// Ground tiles and props (trees, houses, rocks...). All drawn procedurally.
//
//   RPG.Tiles[id] = { color, solid?, water?, liquid?, pri (edge priority), draw(P, rng) }   16x16
//   RPG.Props[id] = { w, h, ax, ay (anchor = base point inside sprite), box:[x,y,w,h] collision
//                     relative to anchor (px) or null, light?:{r,color,flicker}, draw(P, rng, ctx),
//                     variants?: n, anim?: frames, blocksView? }
(function (R) {
  const U = R.U, G = R.G;
  const T = R.Tiles = {};
  const PR = R.Props = {};

  // ---- tiles -----------------------------------------------------------------
  function base(P, c, rng, spots) {
    P.rect(0, 0, 16, 16, c);
    for (const [col, n] of spots) P.speckle(0, 0, 16, 16, col, n, rng);
  }
  T.grass = {
    color: '#4f8a3a', pri: 3, draw(P, r) {
      base(P, '#4f8a3a', r, [['#5c9a42', 14], ['#437a31', 10]]);
      for (let i = 0; i < 4; i++) { const x = r.int(1, 14), y = r.int(2, 14); P.px(x, y, '#6fb050'); P.px(x, y - 1, '#6fb050'); P.px(x + 1, y - 1, '#5c9a42'); }
      if (r.chance(0.12)) { const x = r.int(2, 13), y = r.int(2, 13); const fc = r.pick(['#f0e060', '#e87080', '#ffffff', '#80b0ff']); P.px(x, y, fc); P.px(x - 1, y, U.shade(fc, -0.2)); P.px(x + 1, y, U.shade(fc, -0.2)); P.px(x, y - 1, U.shade(fc, -0.2)); P.px(x, y + 1, '#3a6a28'); }
    },
  };
  T.darkgrass = { color: '#2f5a2a', pri: 3, draw(P, r) { base(P, '#2f5a2a', r, [['#386a30', 14], ['#244a20', 12]]); for (let i = 0; i < 3; i++) { const x = r.int(1, 14), y = r.int(2, 14); P.px(x, y, '#4a7a3a'); P.px(x, y - 1, '#4a7a3a'); } } };
  T.dirt = { color: '#8a6a44', pri: 2, draw(P, r) { base(P, '#8a6a44', r, [['#7a5c3a', 18], ['#9a7a52', 10], ['#6a4c30', 4]]); } };
  T.path = { color: '#b09468', pri: 2, draw(P, r) { base(P, '#b09468', r, [['#a08458', 16], ['#c0a478', 10]]); if (r.chance(0.3)) P.rect(r.int(2, 12), r.int(2, 12), 2, 1, '#8a7048'); } };
  T.sand = { color: '#dcc58a', pri: 2, draw(P, r) { base(P, '#dcc58a', r, [['#ccb57a', 20], ['#ecd59a', 10]]); if (r.chance(0.4)) { const y = r.int(3, 12); P.rect(r.int(1, 6), y, 5, 1, '#c8b070'); } } };
  T.cobble = {
    color: '#8a8a8a', pri: 4, draw(P, r) {
      P.rect(0, 0, 16, 16, '#5a5a62');
      const stones = [[0, 0, 7, 5], [8, 0, 8, 5], [0, 6, 5, 4], [6, 6, 10, 4], [0, 11, 9, 5], [10, 11, 6, 5]];
      for (const [x, y, w, h] of stones) { const c = r.pick(['#8a8a90', '#94949a', '#80808a', '#9a9aa0']); P.rect(x + 1, y + 1, w - 1, h - 1, c); P.rect(x + 1, y + 1, w - 1, 1, U.shade(c, 0.2)); }
    },
  };
  T.stone = { color: '#6a6a72', pri: 4, draw(P, r) { base(P, '#6a6a72', r, [['#5e5e66', 20], ['#76767e', 12]]); if (r.chance(0.3)) P.line(r.int(0, 8), r.int(0, 15), r.int(8, 15), r.int(0, 15), '#55555c'); } };
  T.wood = { color: '#9a6a3a', pri: 5, draw(P, r) { P.rect(0, 0, 16, 16, '#9a6a3a'); for (let y = 0; y < 16; y += 4) { P.rect(0, y, 16, 1, '#6a4422'); P.rect(r.int(0, 12), y + 2, 3, 1, '#8a5a2e'); } P.px(r.int(0, 15), r.int(0, 15), '#b07a44'); } };
  T.carpet = { color: '#8a2a3a', pri: 6, draw(P) { P.rect(0, 0, 16, 16, '#8a2a3a'); P.rect(0, 0, 16, 1, '#c0a040'); P.rect(0, 15, 16, 1, '#c0a040'); for (let i = 2; i < 16; i += 4) P.rect(i, 7, 2, 2, '#c0a040'); } };
  T.water = {
    color: '#2f6fb0', solid: true, water: true, pri: 1, draw(P, r) {
      base(P, '#2f6fb0', r, [['#3a80c0', 14], ['#28609c', 10]]);
      for (let i = 0; i < 2; i++) { const x = r.int(0, 11), y = r.int(1, 14); P.rect(x, y, 4, 1, '#6aa8e0'); }
    },
  };
  T.deepwater = { color: '#1f4f8a', solid: true, water: true, pri: 0, draw(P, r) { base(P, '#1f4f8a', r, [['#24589a', 14], ['#1a4478', 12]]); } };
  T.shallow = { color: '#5a9ac8', pri: 1, water: true, draw(P, r) { base(P, '#5a9ac8', r, [['#68a8d4', 14], ['#4a8ab8', 8]]); } };
  T.snow = { color: '#e8eef6', pri: 3, draw(P, r) { base(P, '#e8eef6', r, [['#d4dcea', 16], ['#ffffff', 10]]); if (r.chance(0.2)) P.rect(r.int(1, 12), r.int(1, 14), 3, 1, '#c4ccda'); } };
  T.ice = { color: '#a8d8f0', pri: 2, draw(P, r) { base(P, '#a8d8f0', r, [['#b8e4f8', 10]]); P.line(r.int(0, 6), r.int(0, 6), r.int(8, 15), r.int(8, 15), '#e0f4ff'); } };
  T.lava = { color: '#d8501a', solid: true, liquid: true, pri: 0, draw(P, r) { base(P, '#d8501a', r, [['#f07020', 20], ['#b03810', 12]]); for (let i = 0; i < 3; i++) P.rect(r.int(0, 12), r.int(0, 15), 3, 1, '#ffb040'); } };
  T.cave = { color: '#4a4046', pri: 2, draw(P, r) { base(P, '#4a4046', r, [['#40363c', 20], ['#564c52', 10]]); if (r.chance(0.2)) P.px(r.int(0, 15), r.int(0, 15), '#6a6070'); } };
  T.cavewall = {
    color: '#2a2228', solid: true, wall: true, pri: 9, draw(P, r) {
      P.rect(0, 0, 16, 16, '#2a2228');
      P.speckle(0, 0, 16, 16, '#342a32', 20, r); P.speckle(0, 0, 16, 16, '#1e181c', 14, r);
      if (r.chance(0.15)) { const x = r.int(2, 13), y = r.int(2, 13); P.px(x, y, '#6fd8ff'); P.px(x + 1, y, '#3a8aaa'); }
    },
  };
  T.wall = { color: '#5a4a44', solid: true, wall: true, pri: 9, draw(P, r) { P.rect(0, 0, 16, 16, '#4a3c38'); for (let y = 0; y < 16; y += 4) { const o = (y / 4) % 2 ? 4 : 0; for (let x = -o; x < 16; x += 8) { P.rect(x + 1, y + 1, 7, 3, r.pick(['#6a5a54', '#62524c', '#72625a'])); } } } };
  T.darkstone = { color: '#2e2a3a', pri: 4, draw(P, r) { P.rect(0, 0, 16, 16, '#2e2a3a'); P.rect(0, 0, 16, 1, '#3a3648'); P.rect(0, 0, 1, 16, '#3a3648'); P.speckle(1, 1, 15, 15, '#26222e', 12, r); if (r.chance(0.1)) P.px(r.int(2, 13), r.int(2, 13), '#8a40c0'); } };
  T.void = { color: '#08060c', solid: true, pri: 10, draw(P) { P.rect(0, 0, 16, 16, '#08060c'); } };
  T.swamp = { color: '#3e5a38', pri: 2, draw(P, r) { base(P, '#3e5a38', r, [['#4a6a40', 14], ['#34503a', 12], ['#5a7a4a', 4]]); if (r.chance(0.3)) P.rect(r.int(1, 10), r.int(2, 13), 4, 2, '#2e4a40'); } };
  T.bridge = { color: '#8a5a30', pri: 7, draw(P, r) { P.rect(0, 0, 16, 16, '#8a5a30'); for (let x = 0; x < 16; x += 4) { P.rect(x, 0, 1, 16, '#5a3a1a'); } P.rect(0, 0, 16, 1, '#6a4420'); P.rect(0, 15, 16, 1, '#6a4420'); P.px(r.int(0, 15), r.int(1, 14), '#a8784a'); } };
  T.ash = { color: '#4a4040', pri: 2, draw(P, r) { base(P, '#4a4040', r, [['#3e3434', 16], ['#5a4e4a', 10], ['#8a3a20', 2]]); } };
  T.obsidian = { color: '#1e1824', pri: 5, draw(P, r) { base(P, '#1e1824', r, [['#2a2232', 12]]); P.line(r.int(0, 15), 0, r.int(0, 15), 15, '#3a2a48'); if (r.chance(0.25)) { const x = r.int(1, 14); P.rect(x, r.int(1, 14), 1, 1, '#ff6020'); } } };

  // ---- world tiles (zones) --------------------------------------------------------
  // helper: brick rows. bh = brick height, bw = brick width
  function bricks(P, r, mortar, cols, bh, bw, tx, ty) {
    P.rect(0, 0, 16, 16, mortar);
    for (let y = 0, row = 0; y < 16; y += bh, row++) {
      const o = ((row + (ty || 0) * Math.ceil(16 / bh)) % 2) ? bw / 2 : 0;
      for (let x = -o; x < 16; x += bw) {
        const c = r.pick(cols);
        P.rect(x + 1, y + 1, bw - 1, bh - 1, c);
        P.rect(x + 1, y + 1, bw - 1, 1, U.shade(c, 0.14));
      }
    }
  }
  T.canopy = {
    color: '#1d3a21', solid: true, pri: 8, draw(P, r) {
      P.rect(0, 0, 16, 16, '#16301b');
      for (let i = 0; i < 5; i++) {
        const x = r.int(0, 15), y = r.int(0, 15), rad = r.int(3, 5), g = r.pick(['#244a28', '#2a5230', '#1f4224', '#2f5a2e']);
        P.circle(x, y, rad, g); P.circle(x - 1, y - 1, rad - 2, U.shade(g, 0.18));
      }
      P.speckle(0, 0, 16, 16, '#3a6a3a', 6, r); P.speckle(0, 0, 16, 16, '#10241a', 8, r);
    },
  };
  T.cliff = {
    color: '#6a5a4a', solid: true, wall: true, pri: 9, draw(P, r) {
      P.rect(0, 0, 16, 16, '#4e4238');
      for (let i = 0; i < 4; i++) { const x = r.int(-2, 12), y = r.int(0, 13), w = r.int(5, 9), c = r.pick(['#6a5a4a', '#74644f', '#5e5042']); P.rect(x, y, w, 4, c); P.rect(x, y, w, 1, U.shade(c, 0.22)); P.rect(x, y + 3, w, 1, U.shade(c, -0.25)); }
      if (r.chance(0.3)) P.rect(r.int(1, 12), r.int(1, 12), 3, 1, '#4a6a3a');
    },
  };
  T.farmland = { color: '#6a4a2c', pri: 2, draw(P, r) { P.rect(0, 0, 16, 16, '#6a4a2c'); for (let y = 1; y < 16; y += 4) { P.rect(0, y, 16, 1, '#4e3620'); P.rect(0, y + 1, 16, 1, '#7e5c38'); } P.speckle(0, 0, 16, 16, '#5a3e24', 10, r); } };
  T.gravel = { color: '#8a8680', pri: 2, draw(P, r) { base(P, '#86827a', r, [['#9a968e', 18], ['#6e6a64', 16], ['#aaa69e', 6]]); } };
  T.mud = { color: '#5a4a32', pri: 2, draw(P, r) { base(P, '#5a4a32', r, [['#4e4028', 18], ['#665638', 10]]); if (r.chance(0.35)) { const x = r.int(1, 10), y = r.int(2, 12); P.ellipse(x + 2, y, 3, 1, '#3e3a26'); P.px(x + 1, y, '#8a8a6a'); } } };
  T.bog = {
    color: '#2e3f2a', solid: true, water: true, pri: 0, draw(P, r) {
      base(P, '#2e3f2a', r, [['#34482e', 14], ['#263626', 12]]);
      if (r.chance(0.4)) { const x = r.int(2, 12), y = r.int(2, 12); P.ellipse(x, y, 3, 1, '#4a6a34'); P.px(x - 1, y, '#6a8a44'); }
      if (r.chance(0.3)) { P.px(r.int(1, 14), r.int(1, 14), '#8aa070'); }
    },
  };
  T.murk = { color: '#4a5a3a', water: true, pri: 1, draw(P, r) { base(P, '#465838', r, [['#52643e', 14], ['#3c4c32', 10]]); if (r.chance(0.3)) P.rect(r.int(1, 10), r.int(2, 13), 4, 1, '#6a7c4c'); } };
  T.planks = { color: '#7a5a34', pri: 7, draw(P, r) { P.rect(0, 0, 16, 16, '#7a5a34'); for (let y = 0; y < 16; y += 4) { P.rect(0, y + 3, 16, 1, '#4a3418'); P.rect(0, y, 16, 1, '#8e6a40'); P.px(r.int(0, 15), y + 1, '#5a3e20'); } P.px(2, 1, '#3a2a18'); P.px(13, 9, '#3a2a18'); } };
  T.web = {
    color: '#4a4448', pri: 3, draw(P, r) {
      base(P, '#443e44', r, [['#3a343a', 18], ['#524a52', 10]]);
      if (r.chance(0.55)) { const c = 'rgba(220,220,230,0.55)'; const x = r.int(0, 15), y = r.int(0, 15); P.line(x, y, r.int(0, 15), r.chance(0.5) ? 0 : 15, c); P.line(x, y, r.chance(0.5) ? 0 : 15, r.int(0, 15), c); P.line(x, y, r.int(0, 15), r.int(0, 15), c); }
    },
  };
  T.cryptfloor = {
    color: '#4a4a54', pri: 4, draw(P, r, x, y) {
      P.rect(0, 0, 16, 16, '#2e2e36');
      const o = (y % 2) * 8;
      for (const [sx, sy, w, h] of [[-o, 0, 16, 8], [16 - o, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) { const c = r.pick(['#4a4a54', '#50505a', '#46464e']); P.rect(sx + 1, sy + 1, w - 1, h - 1, c); P.rect(sx + 1, sy + 1, w - 1, 1, U.shade(c, 0.15)); }
      if (r.chance(0.2)) P.line(r.int(1, 7), r.int(1, 14), r.int(8, 14), r.int(1, 14), '#34343c');
      if (r.chance(0.12)) P.speckle(0, 0, 16, 16, '#3e5a3a', 5, r);
    },
  };
  T.cryptwall = { color: '#2a2a34', solid: true, wall: true, pri: 9, draw(P, r, x, y) { bricks(P, r, '#18181e', ['#2e2e38', '#34343e', '#2a2a32'], 4, 8, x, y); if (r.chance(0.08)) { P.rect(6, 5, 4, 5, '#101014'); P.px(7, 7, '#e0d8c8'); P.px(8, 7, '#e0d8c8'); } } };
  T.sandstone = {
    color: '#c8a870', pri: 4, draw(P, r) {
      P.rect(0, 0, 16, 16, '#9a7c4c');
      for (const [sx, sy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) { const c = r.pick(['#c8a870', '#c09e66', '#d0b07a']); P.rect(sx + 1, sy + 1, 7, 7, c); P.rect(sx + 1, sy + 1, 7, 1, U.shade(c, 0.12)); }
      P.speckle(0, 0, 16, 16, '#dcc58a', 6, r);
    },
  };
  T.sandwall = {
    color: '#a07a48', solid: true, wall: true, pri: 9, draw(P, r, x, y) {
      bricks(P, r, '#6a4e2c', ['#a8804c', '#b08a54', '#9a7444'], 5, 8, x, y);
      if (r.chance(0.18)) { const c = '#5a3e20'; const k = r.int(0, 3); P.rect(5, 5, 6, 1, c); if (k === 0) { P.circle(8, 9, 2, c); P.px(8, 9, '#b08a54'); } else if (k === 1) { P.rect(7, 7, 2, 5, c); P.rect(5, 9, 6, 1, c); } else if (k === 2) { P.line(5, 12, 8, 7, c); P.line(8, 7, 11, 12, c); } else { P.rect(6, 7, 1, 5, c); P.rect(9, 7, 1, 5, c); P.px(7, 8, c); P.px(8, 9, c); } }
    },
  };
  T.sandcliff = {
    color: '#b0804a', solid: true, wall: true, pri: 9, draw(P, r) {
      P.rect(0, 0, 16, 16, '#9a6c3c');
      for (let y = 0; y < 16; y += 4) { const c = r.pick(['#b8864e', '#a8783e', '#c09058']); P.rect(0, y, 16, 3, c); P.rect(0, y, 16, 1, U.shade(c, 0.18)); P.rect(r.int(0, 12), y + 2, r.int(2, 5), 1, U.shade(c, -0.25)); }
    },
  };
  T.dune = { color: '#d4b06a', pri: 1, draw(P, r) { base(P, '#d4b06a', r, [['#c8a45e', 16], ['#e0bc78', 10]]); for (let i = 0; i < 2; i++) { const y = r.int(2, 13), x = r.int(0, 8); P.rect(x, y, 6, 1, '#b8945a'); P.rect(x + 1, y - 1, 4, 1, '#e8c888'); } } };
  T.tombfloor = {
    color: '#6a5234', pri: 4, draw(P, r, x, y) {
      P.rect(0, 0, 16, 16, '#3e3020');
      P.rect(1, 1, 15, 15, r.pick(['#6a5234', '#705838', '#644c30']));
      P.rect(1, 1, 15, 1, '#806644');
      if ((x + y) % 4 === 0) { P.rect(6, 6, 4, 4, '#b08a3a'); P.rect(7, 7, 2, 2, '#e0c060'); }
      P.speckle(1, 1, 15, 15, '#5a4428', 8, r);
    },
  };
  T.snowpath = { color: '#c8d2e0', pri: 2, draw(P, r) { base(P, '#c8d2e0', r, [['#b8c4d4', 18], ['#dce4ee', 10]]); if (r.chance(0.35)) { const x = r.int(3, 10), y = r.int(2, 10); P.rect(x, y, 2, 3, '#a8b4c6'); P.rect(x + 3, y + 4, 2, 3, '#a8b4c6'); } } };
  T.snowcliff = {
    color: '#6a7080', solid: true, wall: true, pri: 9, draw(P, r) {
      P.rect(0, 0, 16, 16, '#4e5462');
      for (let i = 0; i < 4; i++) { const x = r.int(-2, 12), y = r.int(3, 13), w = r.int(5, 9), c = r.pick(['#6a7080', '#727a8a', '#5e6474']); P.rect(x, y, w, 4, c); P.rect(x, y, w, 1, U.shade(c, 0.25)); }
      P.rect(0, 0, 16, 3, '#e8eef6'); for (let i = 0; i < 16; i += 2) P.rect(i, 3, 1, r.int(0, 3), '#e8eef6');
    },
  };
  T.icewall = {
    color: '#5a8ab8', solid: true, wall: true, pri: 9, draw(P, r) {
      P.rect(0, 0, 16, 16, '#3a6a98');
      for (let i = 0; i < 4; i++) { const x = r.int(0, 12), y = r.int(0, 12), c = r.pick(['#5a8ab8', '#6a9ac8', '#4e7eac']); P.rect(x, y, r.int(3, 6), r.int(3, 6), c); P.px(x, y, '#c8ecff'); }
      P.line(r.int(0, 15), 0, r.int(0, 15), 15, '#a8d8f8');
    },
  };
  T.frozenlake = {
    color: '#9fd0ec', pri: 1, draw(P, r) {
      base(P, '#9fd0ec', r, [['#b0dcf4', 10], ['#90c4e4', 8]]);
      if (r.chance(0.5)) P.line(r.int(0, 15), r.int(0, 15), r.int(0, 15), r.int(0, 15), '#e4f6ff');
      if (r.chance(0.25)) { const x = r.int(2, 12), y = r.int(2, 12); P.line(x, y, x + 3, y + 2, '#6aa0c8'); P.line(x + 3, y + 2, x + 2, y + 5, '#6aa0c8'); }
    },
  };
  T.icefloor = { color: '#7aa8c8', pri: 2, draw(P, r) { base(P, '#7aa8c8', r, [['#88b4d2', 14], ['#6a98ba', 12]]); if (r.chance(0.3)) P.line(r.int(0, 8), r.int(0, 15), r.int(8, 15), r.int(0, 15), '#b8e0f8'); } };
  T.volcrock = { color: '#3a3034', pri: 2, draw(P, r) { base(P, '#3a3034', r, [['#443a3e', 16], ['#2e2628', 14]]); if (r.chance(0.12)) P.px(r.int(1, 14), r.int(1, 14), '#c04818'); } };
  T.volcwall = {
    color: '#241c20', solid: true, wall: true, pri: 9, draw(P, r) {
      P.rect(0, 0, 16, 16, '#1e171a');
      for (let i = 0; i < 4; i++) { const x = r.int(-2, 12), y = r.int(0, 13), w = r.int(5, 9), c = r.pick(['#2e2428', '#342a2e', '#281f22']); P.rect(x, y, w, 4, c); P.rect(x, y, w, 1, U.shade(c, 0.25)); }
      if (r.chance(0.25)) { const x = r.int(2, 12), y = r.int(2, 12); P.line(x, y, x + 3, y + 2, '#b03810'); P.px(x + 1, y, '#ff7020'); }
    },
  };
  T.lavacrack = {
    color: '#3a2a2a', pri: 3, draw(P, r) {
      base(P, '#342a2c', r, [['#3e3234', 14], ['#2a2224', 12]]);
      let x = r.int(0, 15), y = r.int(0, 15);
      for (let i = 0; i < 6; i++) { const nx = U.clamp(x + r.int(-4, 4), 0, 15), ny = U.clamp(y + r.int(-4, 4), 0, 15); P.line(x, y, nx, ny, '#c04010'); x = nx; y = ny; }
      P.px(x, y, '#ffb040'); P.speckle(0, 0, 16, 16, '#ff7020', 2, r);
    },
  };
  T.citfloor = {
    color: '#2a2436', pri: 4, draw(P, r, x, y) {
      P.rect(0, 0, 16, 16, '#16121e');
      const c = (x + y) % 2 ? '#2a2436' : '#241f30';
      P.rect(1, 1, 15, 15, c); P.rect(1, 1, 15, 1, U.shade(c, 0.2)); P.rect(1, 1, 1, 15, U.shade(c, 0.1));
      if (r.chance(0.25)) { P.line(r.int(2, 8), r.int(2, 14), r.int(8, 14), r.int(2, 14), '#4a2a6a'); }
      if (r.chance(0.06)) P.px(r.int(3, 12), r.int(3, 12), '#b060ff');
    },
  };
  T.citwall = {
    color: '#1a1622', solid: true, wall: true, pri: 9, draw(P, r, x, y) {
      bricks(P, r, '#0c0a10', ['#1e1a28', '#231e2e', '#1a1622'], 8, 8, x, y);
      if (r.chance(0.1)) { P.rect(6, 4, 4, 1, '#9040e0'); P.rect(7, 5, 2, 4, '#9040e0'); P.px(7, 6, '#e0b0ff'); }
    },
  };
  T.royalcarpet = {
    color: '#5a1a3a', pri: 6, draw(P, r, x, y) {
      P.rect(0, 0, 16, 16, '#5a1a3a');
      P.speckle(0, 0, 16, 16, '#4a1430', 10, r);
      const d = '#b08a3a';
      P.line(8, 2, 14, 8, d); P.line(14, 8, 8, 14, d); P.line(8, 14, 2, 8, d); P.line(2, 8, 8, 2, d);
      P.rect(7, 7, 2, 2, '#e0c060');
    },
  };
  T.stonebridge = { color: '#5a5460', pri: 7, draw(P, r) { P.rect(0, 0, 16, 16, '#5a5460'); for (let y = 0; y < 16; y += 4) P.rect(0, y, 16, 1, '#46404c'); P.speckle(0, 0, 16, 16, '#6a6470', 10, r); P.rect(0, 0, 2, 16, '#3a3440'); P.rect(14, 0, 2, 16, '#3a3440'); } };
  T.tilefloor = { color: '#b8a888', pri: 5, draw(P, r, x, y) { const c = (x + y) % 2 ? '#b8a888' : '#a89878'; P.rect(0, 0, 16, 16, c); P.rect(0, 0, 16, 1, U.shade(c, 0.15)); P.rect(0, 15, 16, 1, U.shade(c, -0.2)); P.speckle(0, 0, 16, 16, U.shade(c, -0.1), 6, r); } };

  // Pre-render a whole tile layer to one big canvas, with dithered edges between tiles.
  T.render = function (map) {
    const S = G.TILE;
    const cv = G.canvas(map.w * S, map.h * S);
    const ctx = cv.getContext('2d');
    const P = G.painter(ctx);
    const rng = U.rng('tiles:' + map.id);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const id = map.tiles[y * map.w + x];
      const t = T[id] || T.grass;
      ctx.save(); ctx.translate(x * S, y * S);
      t.draw(P, rng, x, y);
      ctx.restore();
    }
    // edges: higher-priority neighbour bleeds jagged pixels into lower tiles
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const id = map.tiles[y * map.w + x], t = T[id] || T.grass;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of nb) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const nid = map.tiles[ny * map.w + nx];
        if (nid === id) continue;
        const n = T[nid] || T.grass;
        if ((n.pri || 0) <= (t.pri || 0) || n.wall) continue;
        const c = n.color;
        ctx.fillStyle = c;
        for (let i = 0; i < 16; i++) {
          const depth = rng.int(0, 2) + (i % 3 === 0 ? 1 : 0);
          for (let d = 0; d < depth; d++) {
            const px = dx === 1 ? 15 - d : dx === -1 ? d : i;
            const py = dy === 1 ? 15 - d : dy === -1 ? d : i;
            ctx.fillRect(x * S + px, y * S + py, 1, 1);
          }
        }
      }
      // wall tiles get a lit top face and a dark base when the tile below is floor
      if (t.wall && y + 1 < map.h) {
        const below = T[map.tiles[(y + 1) * map.w + x]];
        if (below && !below.wall) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x * S, y * S + 12, 16, 4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x * S, (y + 1) * S, 16, 3); }
      }
      if (t.water && !t.solid === false) { /* noop */ }
      if ((t.water || t.liquid) && y > 0) {
        const above = T[map.tiles[(y - 1) * map.w + x]];
        if (above && !above.water && !above.liquid) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x * S, y * S, 16, 2); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x * S, y * S + 3, 16, 1); }
      }
    }
    return cv;
  };

  // ---- props -----------------------------------------------------------------
  function trunk(P, x, y, h, c) { P.rect(x, y, 4, h, c || '#6a4424'); P.rect(x, y, 1, h, U.shade(c || '#6a4424', 0.2)); P.rect(x + 3, y, 1, h, U.shade(c || '#6a4424', -0.3)); }
  function blob(P, cx, cy, r, c, rng) {
    P.circle(cx, cy, r, c);
    const l = U.shade(c, 0.18), d = U.shade(c, -0.22);
    P.circle(cx - Math.round(r * 0.3), cy - Math.round(r * 0.35), Math.round(r * 0.55), l);
    for (let i = 0; i < r * 2; i++) { const a = rng() * U.TAU, rr = r * (0.5 + rng() * 0.45); P.px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rng() < 0.5 ? d : U.shade(l, 0.15)); }
  }
  PR.tree = {
    w: 32, h: 44, ax: 16, ay: 41, box: [-4, -4, 8, 5], variants: 4,
    draw(P, r) {
      trunk(P, 14, 26, 15);
      const g = r.pick(['#3f7a33', '#4a8a3a', '#3a7040', '#56913c']);
      blob(P, 16, 22, 10, U.shade(g, -0.15), r);
      blob(P, 11, 16, 8, g, r); blob(P, 21, 15, 8, g, r); blob(P, 16, 9, 8, U.shade(g, 0.08), r);
      if (r.chance(0.3)) for (let i = 0; i < 4; i++) P.px(r.int(8, 24), r.int(6, 24), '#e04040');
    },
  };
  PR.pine = {
    w: 28, h: 46, ax: 14, ay: 43, box: [-3, -4, 6, 5], variants: 3,
    draw(P, r, ctx, snow) {
      trunk(P, 12, 34, 9, '#5a3a20');
      const g = r.pick(['#2a5a3a', '#2f6440', '#285236']);
      for (let i = 0; i < 4; i++) {
        const y = 6 + i * 7, w = 5 + i * 3;
        for (let j = 0; j < 9; j++) P.rect(14 - Math.floor(w * j / 9), y + j, Math.floor(w * j / 9) * 2 + 1, 1, j < 3 ? U.shade(g, 0.15) : g);
        P.rect(14 - w + 1, y + 8, w, 1, U.shade(g, -0.3));
        if (snow) P.rect(14 - Math.floor(w * 3 / 9), y + 2, Math.floor(w * 3 / 9) * 2 + 1, 2, '#f4f8ff');
      }
      if (snow) P.rect(13, 5, 3, 3, '#ffffff');
    },
  };
  PR.snowpine = { w: 28, h: 46, ax: 14, ay: 43, box: [-3, -4, 6, 5], variants: 3, draw(P, r, ctx) { PR.pine.draw(P, r, ctx, true); } };
  PR.deadtree = {
    w: 28, h: 40, ax: 14, ay: 37, box: [-3, -4, 6, 5], variants: 3,
    draw(P, r) {
      const c = '#5a4a40';
      trunk(P, 12, 16, 21, c);
      P.line(13, 18, 5, 8, c); P.line(14, 18, 6, 8, c); P.line(15, 14, 22, 5, c); P.line(15, 15, 23, 6, c);
      P.line(8, 11, 4, 12, c); P.line(19, 9, 22, 12, c); P.line(14, 16, 14, 4, c); P.line(15, 16, 15, 4, U.shade(c, -0.2));
    },
  };
  PR.palm = {
    w: 36, h: 48, ax: 18, ay: 45, box: [-3, -4, 6, 5], variants: 2,
    draw(P, r) {
      for (let i = 0; i < 28; i++) P.rect(16 + Math.round(Math.sin(i / 9) * 3), 17 + i, 4, 1, i % 4 ? '#9a7040' : '#7a5028');
      const g = '#3a8a3a';
      for (const [dx, dy] of [[-14, 6], [14, 6], [-10, -6], [10, -6], [0, -9]]) { P.line(18, 16, 18 + dx, 16 + dy, g); P.line(18, 17, 18 + dx, 17 + dy, U.shade(g, -0.2)); P.line(18 + dx * 0.5, 15 + dy * 0.5, 18 + dx, 18 + dy + 2, g); }
      P.circle(17, 18, 2, '#6a4020'); P.px(20, 19, '#6a4020');
    },
  };
  PR.bush = {
    w: 20, h: 16, ax: 10, ay: 14, box: [-6, -4, 12, 4], variants: 3,
    draw(P, r) { const g = r.pick(['#3f7a33', '#4a8a3a', '#56913c']); blob(P, 7, 9, 5, g, r); blob(P, 13, 9, 5, g, r); blob(P, 10, 6, 5, U.shade(g, 0.08), r); if (r.chance(0.4)) for (let i = 0; i < 3; i++) P.px(r.int(4, 16), r.int(4, 12), r.pick(['#e04060', '#4060e0', '#f0f0f0'])); },
  };
  PR.rock = {
    w: 20, h: 16, ax: 10, ay: 14, box: [-7, -5, 14, 5], variants: 3,
    draw(P, r) { const c = r.pick(['#8a8a90', '#7a7a82', '#90887a']); P.ellipse(10, 9, 8, 5, U.shade(c, -0.3)); P.ellipse(10, 8, 7, 5, c); P.ellipse(8, 6, 4, 2, U.shade(c, 0.25)); P.px(13, 10, U.shade(c, -0.2)); },
  };
  PR.boulder = {
    w: 32, h: 28, ax: 16, ay: 25, box: [-12, -8, 24, 8], variants: 2,
    draw(P, r) { const c = r.pick(['#7a7a82', '#827a72']); P.ellipse(16, 16, 14, 10, U.shade(c, -0.3)); P.ellipse(16, 14, 13, 10, c); P.ellipse(12, 10, 6, 4, U.shade(c, 0.22)); P.line(18, 8, 22, 18, U.shade(c, -0.25)); if (r.chance(0.5)) { P.rect(6, 18, 5, 2, '#4a7a3a'); } },
  };
  PR.crystal = {
    w: 20, h: 28, ax: 10, ay: 25, box: [-5, -4, 10, 4], variants: 3, light: { r: 40, color: '#6fd8ff', flicker: 0.1 },
    draw(P, r) {
      const c = r.pick(['#6fd8ff', '#b070ff', '#70ffb0']);
      const shards = [[10, 4, 4, 22], [5, 12, 3, 13], [15, 10, 3, 15]];
      for (const [x, y, w, h] of shards) { P.rect(x - 1, y, w, h, c); P.rect(x - 1, y, 1, h, U.shade(c, 0.5)); P.rect(x + w - 2, y + 2, 1, h - 2, U.shade(c, -0.3)); P.px(x, y - 1, U.shade(c, 0.3)); }
      P.rect(3, 24, 14, 2, '#3a3440');
    },
  };
  PR.stalagmite = { w: 14, h: 22, ax: 7, ay: 20, box: [-4, -3, 8, 3], variants: 2, draw(P, r) { const c = '#5a5058'; for (let y = 0; y < 18; y++) { const w = Math.round(1 + y / 3); P.rect(7 - w, 2 + y, w * 2, 1, y % 5 ? c : U.shade(c, 0.15)); } P.rect(6, 2, 1, 16, U.shade(c, 0.25)); } };
  PR.cactus = { w: 18, h: 26, ax: 9, ay: 24, box: [-3, -3, 6, 3], variants: 2, draw(P, r) { const g = '#4a9a4a'; P.rect(7, 4, 5, 20, g); P.rect(7, 4, 1, 20, U.shade(g, 0.25)); P.rect(2, 10, 3, 7, g); P.rect(2, 15, 5, 2, g); P.rect(14, 8, 3, 6, g); P.rect(12, 12, 5, 2, g); for (let i = 0; i < 6; i++) P.px(r.int(7, 11), r.int(5, 22), '#e8e0a0'); if (r.chance(0.4)) P.rect(8, 2, 3, 2, '#ff70a0'); } };
  PR.bones = { w: 16, h: 10, ax: 8, ay: 8, box: null, variants: 2, draw(P, r) { P.rect(2, 5, 10, 2, '#e8e0d0'); P.rect(1, 4, 2, 4, '#e8e0d0'); P.rect(11, 4, 2, 4, '#e8e0d0'); if (r.chance(0.6)) { P.circle(12, 3, 2, '#e8e0d0'); P.px(11, 3, '#302830'); P.px(13, 3, '#302830'); } } };
  PR.grave = { w: 14, h: 18, ax: 7, ay: 16, box: [-5, -3, 10, 3], variants: 2, draw(P, r) { const c = '#8a8a92'; P.rect(2, 4, 10, 12, c); P.rect(3, 2, 8, 2, c); P.rect(2, 4, 1, 12, U.shade(c, 0.2)); P.rect(6, 6, 2, 6, U.shade(c, -0.3)); P.rect(4, 8, 6, 2, U.shade(c, -0.3)); P.rect(1, 15, 12, 2, '#4a6a3a'); } };
  PR.fence = { w: 16, h: 14, ax: 8, ay: 12, box: [-8, -3, 16, 3], draw(P) { const c = '#8a6038'; P.rect(1, 2, 3, 11, c); P.rect(12, 2, 3, 11, c); P.rect(0, 4, 16, 2, U.shade(c, 0.1)); P.rect(0, 9, 16, 2, U.shade(c, 0.1)); P.rect(1, 2, 3, 1, U.shade(c, 0.3)); P.rect(12, 2, 3, 1, U.shade(c, 0.3)); } };
  PR.lamp = {
    w: 12, h: 30, ax: 6, ay: 28, box: [-2, -2, 4, 2], light: { r: 70, color: '#ffc870', flicker: 0.08 },
    draw(P) { P.rect(5, 8, 2, 20, '#3a3a44'); P.rect(3, 26, 6, 2, '#3a3a44'); P.rect(2, 3, 8, 6, '#3a3a44'); P.rect(3, 4, 6, 4, '#ffd080'); P.rect(4, 5, 2, 2, '#ffffff'); P.rect(1, 2, 10, 1, '#2a2a34'); },
  };
  PR.torch = {
    w: 10, h: 20, ax: 5, ay: 18, box: [-2, -2, 4, 2], light: { r: 60, color: '#ff9a40', flicker: 0.2 }, anim: 3,
    draw(P, r, ctx, f) { P.rect(4, 8, 2, 10, '#5a3a20'); P.rect(3, 7, 4, 2, '#3a3a3a'); const h = [4, 5, 3][f || 0]; P.rect(3, 7 - h, 4, h, '#ff7020'); P.rect(4, 8 - h, 2, h - 1, '#ffd040'); P.px(4 + ((f || 0) % 2), 6 - h, '#ff9a40'); },
  };
  PR.brazier = {
    w: 16, h: 20, ax: 8, ay: 18, box: [-5, -3, 10, 3], light: { r: 80, color: '#ff8a30', flicker: 0.2 }, anim: 3,
    draw(P, r, ctx, f) { P.rect(3, 9, 10, 4, '#4a4a52'); P.rect(2, 8, 12, 1, '#6a6a72'); P.rect(5, 13, 6, 3, '#3a3a42'); P.rect(3, 16, 10, 2, '#3a3a42'); const h = [5, 7, 6][f || 0]; P.rect(4, 8 - h, 8, h, '#ff6020'); P.rect(6, 9 - h, 4, h - 1, '#ffc040'); P.px(7, 7 - h, '#ffe080'); },
  };
  PR.barrel = { w: 14, h: 16, ax: 7, ay: 14, box: [-5, -4, 10, 4], draw(P) { const c = '#8a5a30'; P.rect(2, 2, 10, 13, c); P.rect(1, 4, 12, 9, c); P.rect(2, 4, 10, 1, '#4a4a4a'); P.rect(2, 11, 10, 1, '#4a4a4a'); P.rect(3, 2, 1, 13, U.shade(c, 0.2)); P.rect(10, 2, 1, 13, U.shade(c, -0.25)); P.rect(3, 1, 8, 1, U.shade(c, 0.3)); } };
  PR.crate = { w: 16, h: 16, ax: 8, ay: 14, box: [-7, -5, 14, 5], draw(P) { const c = '#a0763e'; P.rect(1, 2, 14, 13, c); P.rect(1, 2, 14, 2, U.shade(c, 0.25)); P.rect(1, 2, 2, 13, U.shade(c, -0.2)); P.rect(13, 2, 2, 13, U.shade(c, -0.2)); P.rect(1, 13, 14, 2, U.shade(c, -0.2)); P.line(3, 4, 12, 12, U.shade(c, -0.25)); } };
  PR.sign = { w: 16, h: 18, ax: 8, ay: 16, box: [-2, -2, 4, 2], draw(P) { P.rect(7, 8, 2, 9, '#6a4424'); P.rect(1, 2, 14, 8, '#a0763e'); P.rect(1, 2, 14, 1, '#c0965e'); P.rect(3, 4, 10, 1, '#5a3a1a'); P.rect(3, 6, 8, 1, '#5a3a1a'); } };
  PR.well = { w: 28, h: 30, ax: 14, ay: 27, box: [-11, -8, 22, 8], draw(P) { P.ellipse(14, 20, 11, 6, '#7a7a82'); P.ellipse(14, 19, 8, 4, '#1a2a4a'); P.rect(3, 6, 2, 16, '#6a4424'); P.rect(23, 6, 2, 16, '#6a4424'); P.rect(1, 3, 26, 4, '#8a3a2a'); P.rect(1, 3, 26, 1, '#aa5a3a'); P.rect(13, 7, 2, 8, '#8a8a8a'); P.rect(12, 14, 4, 3, '#6a4424'); } };
  PR.anvil = { w: 20, h: 14, ax: 10, ay: 12, box: [-7, -4, 14, 4], draw(P) { const c = '#4a4a55'; P.rect(3, 2, 14, 4, c); P.rect(1, 2, 4, 2, c); P.rect(7, 6, 6, 4, c); P.rect(4, 10, 12, 3, c); P.rect(3, 2, 14, 1, '#7a7a88'); } };
  PR.stall = {
    w: 48, h: 40, ax: 24, ay: 37, box: [-22, -12, 44, 12], variants: 3,
    draw(P, r) {
      const c = r.pick(['#c03a3a', '#3a6ac0', '#3a9a4a', '#c09a2a']);
      P.rect(4, 8, 2, 29, '#6a4424'); P.rect(42, 8, 2, 29, '#6a4424');
      for (let i = 0; i < 44; i += 6) { P.rect(2 + i, 4, 6, 8, (i / 6) % 2 ? c : '#f0e8d8'); P.rect(2 + i, 12, 6, 2, U.shade((i / 6) % 2 ? c : '#f0e8d8', -0.2)); }
      P.rect(2, 24, 44, 12, '#8a5a30'); P.rect(2, 24, 44, 2, '#a8784a');
      for (let i = 0; i < 6; i++) P.circle(8 + i * 6, 22, 2, r.pick(['#e04040', '#f0c040', '#60c040', '#e08040', '#a060e0']));
    },
  };
  PR.tent = { w: 40, h: 32, ax: 20, ay: 29, box: [-17, -10, 34, 10], variants: 2, draw(P, r) { const c = r.pick(['#b89a6a', '#8a6a9a', '#6a8aa0']); for (let y = 0; y < 26; y++) { const w = Math.round(2 + y * 0.72); P.rect(20 - w, 3 + y, w * 2, 1, y < 4 ? U.shade(c, 0.2) : c); } P.rect(17, 14, 6, 15, '#2a1a14'); P.rect(20, 3, 1, 26, U.shade(c, -0.2)); P.px(20, 1, '#8a6a4a'); P.px(20, 2, '#8a6a4a'); } };
  PR.pillar = { w: 16, h: 40, ax: 8, ay: 37, box: [-6, -5, 12, 5], variants: 2, draw(P, r) { const c = r.pick(['#a8a8b0', '#6a6480']); P.rect(2, 34, 12, 4, U.shade(c, -0.2)); P.rect(3, 6, 10, 28, c); P.rect(3, 6, 2, 28, U.shade(c, 0.25)); P.rect(11, 6, 2, 28, U.shade(c, -0.25)); P.rect(1, 2, 14, 4, U.shade(c, 0.1)); if (r.chance(0.5)) { P.rect(6, 12, 1, 10, U.shade(c, -0.35)); P.rect(7, 18, 3, 1, U.shade(c, -0.35)); } } };
  PR.statue = { w: 24, h: 44, ax: 12, ay: 41, box: [-9, -6, 18, 6], draw(P) { const c = '#9a9aa6'; P.rect(3, 32, 18, 10, U.shade(c, -0.25)); P.rect(3, 32, 18, 2, c); P.rect(8, 12, 8, 20, c); P.circle(12, 8, 4, c); P.rect(16, 6, 2, 22, U.shade(c, 0.2)); P.rect(14, 8, 6, 2, U.shade(c, 0.1)); P.rect(8, 12, 2, 20, U.shade(c, 0.2)); P.rect(4, 14, 4, 2, c); } };
  PR.portal = {
    w: 32, h: 44, ax: 16, ay: 41, box: null, light: { r: 90, color: '#b070ff', flicker: 0.15 }, anim: 4,
    draw(P, r, ctx, f) {
      P.rect(3, 6, 5, 35, '#5a5a6a'); P.rect(24, 6, 5, 35, '#5a5a6a'); P.rect(1, 2, 30, 6, '#6a6a7a'); P.rect(1, 2, 30, 1, '#8a8a9a');
      const cols = ['#6a30c0', '#8a50e0', '#b070ff', '#d0a0ff'];
      for (let i = 0; i < 4; i++) P.rect(8 + i, 8 + i, 16 - i * 2, 33 - i, cols[(i + (f || 0)) % 4]);
      P.px(16, 20 + ((f || 0) * 3) % 12, '#ffffff');
    },
  };
  PR.flowers = { w: 16, h: 10, ax: 8, ay: 8, box: null, variants: 4, draw(P, r) { for (let i = 0; i < 5; i++) { const x = r.int(2, 13), y = r.int(2, 7), c = r.pick(['#f0e060', '#e87080', '#ffffff', '#80b0ff', '#ff9a40']); P.px(x, y + 1, '#3a6a28'); P.px(x, y + 2, '#3a6a28'); P.px(x, y, c); P.px(x - 1, y, c); P.px(x + 1, y, c); P.px(x, y - 1, c); } } };
  PR.mushroom = { w: 12, h: 12, ax: 6, ay: 10, box: null, variants: 2, light: { r: 22, color: '#70ffb0', flicker: 0.05 }, draw(P, r) { const c = r.pick(['#e04040', '#a060e0', '#40c0a0']); P.rect(5, 5, 2, 5, '#e8e0d0'); P.ellipse(6, 4, 4, 2, c); P.px(4, 3, '#ffffff'); P.px(7, 4, '#ffffff'); } };
  PR.lily = { w: 12, h: 8, ax: 6, ay: 6, box: null, draw(P) { P.ellipse(6, 4, 5, 2, '#3a8a4a'); P.px(6, 4, '#2a6a3a'); P.px(5, 3, '#f0a0c0'); P.px(6, 2, '#ffffff'); } };
  PR.icecrystal = { w: 20, h: 26, ax: 10, ay: 23, box: [-5, -4, 10, 4], variants: 2, light: { r: 30, color: '#a0e0ff', flicker: 0.05 }, draw(P, r) { const c = '#b8e8ff'; P.rect(8, 4, 5, 19, c); P.rect(8, 4, 1, 19, '#ffffff'); P.rect(3, 12, 4, 11, c); P.rect(14, 9, 4, 14, U.shade(c, -0.15)); P.px(10, 3, '#ffffff'); } };
  PR.lavarock = { w: 20, h: 16, ax: 10, ay: 14, box: [-7, -5, 14, 5], variants: 2, light: { r: 26, color: '#ff6020', flicker: 0.2 }, draw(P, r) { P.ellipse(10, 9, 8, 5, '#2a2028'); P.ellipse(10, 8, 7, 5, '#3a2e34'); P.line(5, 7, 12, 11, '#ff6020'); P.line(9, 5, 14, 8, '#ffa040'); } };
  PR.skullpile = { w: 20, h: 14, ax: 10, ay: 12, box: [-7, -4, 14, 4], draw(P) { for (const [x, y] of [[5, 9], [10, 9], [15, 9], [7, 5], [13, 5], [10, 2]]) { P.circle(x, y, 2, '#e0d8c8'); P.px(x - 1, y, '#302830'); P.px(x + 1, y, '#302830'); } } };
  PR.banner = { w: 12, h: 30, ax: 6, ay: 28, box: [-2, -2, 4, 2], variants: 3, draw(P, r) { const c = r.pick(['#a02a2a', '#2a4aa0', '#6a2a8a']); P.rect(5, 2, 2, 26, '#5a4a3a'); P.rect(1, 3, 10, 1, '#c0a040'); P.rect(2, 4, 8, 14, c); P.rect(2, 18, 3, 2, c); P.rect(7, 18, 3, 2, c); P.rect(5, 8, 2, 5, '#e0c050'); } };
  PR.bed = { w: 18, h: 28, ax: 9, ay: 26, box: [-8, -24, 16, 24], draw(P) { P.rect(1, 2, 16, 24, '#6a4424'); P.rect(2, 3, 14, 6, '#f0f0f0'); P.rect(2, 9, 14, 16, '#3a6ac0'); P.rect(2, 9, 14, 2, '#5a8ae0'); } };
  PR.table = { w: 28, h: 20, ax: 14, ay: 17, box: [-13, -10, 26, 10], draw(P) { P.rect(1, 3, 26, 8, '#8a5a30'); P.rect(1, 3, 26, 2, '#a8784a'); P.rect(2, 11, 3, 7, '#6a4424'); P.rect(23, 11, 3, 7, '#6a4424'); P.rect(10, 1, 4, 3, '#e8e0d0'); P.px(18, 2, '#c03030'); } };
  PR.bookshelf = { w: 24, h: 32, ax: 12, ay: 30, box: [-12, -8, 24, 8], draw(P, r) { P.rect(0, 0, 24, 31, '#5a3a1e'); for (let s = 0; s < 3; s++) { P.rect(2, 3 + s * 9, 20, 7, '#2a1a10'); for (let i = 0; i < 9; i++) P.rect(2 + i * 2 + (i > 4 ? 1 : 0), 4 + s * 9 + (i % 3 === 0 ? 1 : 0), 2, 6 - (i % 3 === 0 ? 1 : 0), r.pick(['#a02a2a', '#2a5aa0', '#2a8a4a', '#a08a2a', '#6a2a8a'])); } } };

  // Buildings: box covers the house body; doors are handled by map exits.
  function house(P, r, o) {
    const W = o.w, wall = o.wall, roof = o.roof;
    const roofH = o.roofH;
    // walls
    P.rect(4, roofH, W - 8, o.h - roofH - 2, wall);
    P.rect(4, roofH, W - 8, 2, U.shade(wall, -0.25));
    for (let y = roofH + 5; y < o.h - 4; y += 5) P.rect(4, y, W - 8, 1, U.shade(wall, -0.12));
    P.rect(4, roofH, 2, o.h - roofH - 2, U.shade(wall, 0.15));
    // timber frame
    if (o.timber) { P.rect(4, roofH, 2, o.h - roofH - 2, '#5a3a20'); P.rect(W - 6, roofH, 2, o.h - roofH - 2, '#5a3a20'); P.rect(4, roofH + 10, W - 8, 2, '#5a3a20'); }
    // roof
    for (let y = 0; y < roofH; y++) {
      const inset = Math.max(0, Math.round((roofH - y) * 0.35) - 2);
      P.rect(inset, y, W - inset * 2, 1, y % 3 === 0 ? U.shade(roof, -0.2) : roof);
    }
    for (let x = 0; x < W; x += 6) P.rect(x, 2, 1, roofH - 2, U.shade(roof, -0.1));
    P.rect(0, roofH - 1, W, 2, U.shade(roof, -0.35));
    // chimney
    if (o.chimney) { P.rect(W - 14, 0, 5, 8, '#7a6a64'); P.rect(W - 15, 0, 7, 2, '#5a4a44'); }
    // door
    const dx = Math.floor(W / 2) - 5;
    P.rect(dx, o.h - 16, 10, 14, '#4a2a14'); P.rect(dx + 1, o.h - 15, 8, 13, '#6a4020'); P.rect(dx + 4, o.h - 15, 1, 13, '#4a2a14'); P.px(dx + 7, o.h - 9, '#e0c050');
    P.rect(dx - 1, o.h - 17, 12, 1, U.shade(wall, -0.3));
    // windows
    for (const wx of [8, W - 18]) {
      P.rect(wx, roofH + 5, 10, 8, '#3a2a1a'); P.rect(wx + 1, roofH + 6, 8, 6, '#ffd890'); P.rect(wx + 1, roofH + 6, 3, 2, '#fff4d0'); P.rect(wx + 4, roofH + 6, 1, 6, '#3a2a1a'); P.rect(wx + 1, roofH + 9, 8, 1, '#3a2a1a');
      P.rect(wx - 1, roofH + 13, 12, 2, '#6a4a2a');
      if (o.flowers) for (let i = 0; i < 4; i++) P.px(wx + 1 + i * 3, roofH + 12, r.pick(['#e04060', '#f0d040', '#ffffff']));
    }
    if (o.sign) { P.rect(W - 12, o.h - 26, 10, 7, '#a0763e'); P.rect(W - 11, o.h - 25, 8, 5, o.sign); }
  }
  PR.house = { w: 64, h: 60, ax: 32, ay: 58, box: [-28, -30, 56, 30], variants: 4, draw(P, r) { house(P, r, { w: 64, h: 60, roofH: 26, wall: r.pick(['#d8c8a0', '#c8b890', '#e0d0b0']), roof: r.pick(['#a03a2a', '#3a5a8a', '#5a7a3a', '#7a4a8a']), timber: r.chance(0.6), chimney: true, flowers: r.chance(0.6) }); } };
  PR.bighouse = { w: 96, h: 72, ax: 48, ay: 70, box: [-44, -36, 88, 36], variants: 2, draw(P, r) { house(P, r, { w: 96, h: 72, roofH: 32, wall: '#c8b8a0', roof: r.pick(['#6a3a2a', '#2a4a6a']), timber: true, chimney: true, flowers: true }); } };
  PR.smithy = { w: 72, h: 60, ax: 36, ay: 58, box: [-32, -30, 64, 30], draw(P, r) { house(P, r, { w: 72, h: 60, roofH: 24, wall: '#8a7a70', roof: '#4a4a52', chimney: true, sign: '#6a6a78' }); P.rect(62, 50, 6, 4, '#ff6020'); } };
  PR.shop = { w: 64, h: 60, ax: 32, ay: 58, box: [-28, -30, 56, 30], variants: 2, draw(P, r) { house(P, r, { w: 64, h: 60, roofH: 26, wall: '#e0d0b0', roof: r.pick(['#3a8a6a', '#8a6a2a']), timber: true, flowers: true, sign: r.pick(['#c04040', '#4060c0']) }); } };
  PR.inn = { w: 96, h: 72, ax: 48, ay: 70, box: [-44, -36, 88, 36], draw(P, r) { house(P, r, { w: 96, h: 72, roofH: 32, wall: '#d8c090', roof: '#8a3a2a', timber: true, chimney: true, flowers: true, sign: '#e0a040' }); } };
  PR.temple = {
    w: 96, h: 80, ax: 48, ay: 78, box: [-44, -40, 88, 40],
    draw(P) {
      const c = '#d8d8e0';
      P.rect(4, 30, 88, 46, c); P.rect(4, 30, 88, 3, U.shade(c, -0.2));
      for (let x = 10; x < 90; x += 16) { P.rect(x, 34, 6, 40, '#f0f0f8'); P.rect(x + 4, 34, 2, 40, U.shade(c, -0.15)); }
      for (let y = 0; y < 28; y++) { const w = Math.round(48 * y / 28); P.rect(48 - w, 2 + y, w * 2, 1, y % 4 ? '#b8b8c8' : '#a0a0b0'); }
      P.circle(48, 18, 5, '#f0d060'); P.circle(48, 18, 3, '#fff0a0');
      P.rect(40, 56, 16, 20, '#3a2a1a'); P.rect(41, 57, 14, 19, '#5a4020'); P.rect(0, 74, 96, 4, U.shade(c, -0.3));
    },
  };
  PR.tower = {
    w: 48, h: 96, ax: 24, ay: 93, box: [-18, -20, 36, 20],
    draw(P) {
      const c = '#6a6078';
      P.rect(6, 24, 36, 70, c); for (let y = 28; y < 92; y += 6) for (let x = 6 + ((y / 6) % 2) * 4; x < 42; x += 8) P.rect(x, y, 7, 5, U.shade(c, (x + y) % 3 ? 0.08 : -0.08));
      for (let y = 0; y < 24; y++) { const w = Math.round(22 * y / 24) + 2; P.rect(24 - w, y, w * 2, 1, y % 3 ? '#4a3a6a' : '#3a2a5a'); }
      P.rect(18, 40, 12, 14, '#20182a'); P.rect(19, 41, 10, 12, '#b070ff'); P.rect(18, 78, 12, 16, '#2a1a10');
    },
  };
  PR.ruinwall = { w: 32, h: 30, ax: 16, ay: 28, box: [-16, -8, 32, 8], variants: 3, draw(P, r) { const c = '#8a847a'; const top = r.int(4, 12); for (let x = 0; x < 32; x += 8) { const h = r.int(top, 26); for (let y = 28 - h; y < 28; y += 4) P.rect(x, y, 7, 3, U.shade(c, r.range(-0.15, 0.1))); } P.rect(0, 26, 32, 2, '#4a6a3a'); } };
  PR.castlewall = { w: 48, h: 48, ax: 24, ay: 46, box: [-24, -14, 48, 14], draw(P) { const c = '#4a4458'; P.rect(0, 10, 48, 36, c); for (let y = 12; y < 46; y += 5) for (let x = (y % 2) * 5; x < 48; x += 10) P.rect(x, y, 9, 4, U.shade(c, ((x + y) % 7) / 40)); for (let x = 0; x < 48; x += 12) P.rect(x, 2, 7, 9, c); P.rect(20, 22, 8, 12, '#1a1424'); P.rect(22, 24, 4, 8, '#ff5030'); } };

  // Render a prop (cached by variant/frame).
  PR.sprite = function (id, variant, frame) {
    const p = PR[id];
    if (!p) return null;
    return G.sprite('prop|' + id + '|' + variant + '|' + (frame || 0), p.w + 2, p.h + 2, (ctx) => {
      ctx.translate(1, 1);
      const P = G.painter(ctx);
      p.draw(P, U.rng(id + ':' + variant), ctx, frame || 0);
    }, { outline: p.outline === false ? null : true });
  };
})(window.RPG);
