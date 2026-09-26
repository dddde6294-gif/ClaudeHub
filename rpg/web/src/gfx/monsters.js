'use strict';
// Monster & boss sprite drawers.
//
//   RPG.Monsters[id] = { w, h, ax, ay, frames:{idle,walk,attack}, draw(P, pal, anim, frame, ctx) }
//     drawn facing RIGHT; the renderer mirrors for left.  anim: 'idle'|'walk'|'windup'|'attack'|'cast'
//     pal = enemy palette {main, dark, light, eye, accent, ...} (any keys the drawer wants)
//   RPG.Monsters.sprite(id, pal, anim, frame, flip) -> canvas
//   RPG.Monsters.draw(ctx, e)   draws enemy entity e (uses e.def.sprite, e.def.pal, e.anim, e.frame, e.face, e.flash)
(function (R) {
  const U = R.U, G = R.G;
  const M = R.Monsters = {};

  const sh = U.shade;

  M.slime = {
    w: 24, h: 20, ax: 12, ay: 18, frames: { idle: 2, walk: 4, windup: 1, attack: 1 },
    draw(P, p, anim, f) {
      let sq = 0;
      if (anim === 'walk') sq = [0, 2, 0, -2][f];
      if (anim === 'idle') sq = f ? 1 : 0;
      if (anim === 'windup') sq = 3;
      if (anim === 'attack') sq = -3;
      const w = 9 + Math.max(0, sq), h = 7 - sq;
      const cy = 17 - h;
      P.ellipse(12, cy + 1, w, h, sh(p.main, -0.2));
      P.ellipse(12, cy, w - 1, h - 1, p.main);
      P.ellipse(9, cy - 2, 3, 2, sh(p.main, 0.35));
      P.px(8, cy - 3, '#ffffff');
      P.rect(13, cy, 2, 3, p.eye || '#101018'); P.rect(17, cy, 2, 3, p.eye || '#101018');
      P.px(13, cy, '#ffffff'); P.px(17, cy, '#ffffff');
      if (p.crown) { P.rect(8, cy - h - 2, 8, 3, p.crown); P.px(8, cy - h - 3, p.crown); P.px(12, cy - h - 4, p.crown); P.px(15, cy - h - 3, p.crown); }
      if (p.core) P.rect(10, cy + 1, 3, 3, p.core);
    },
  };

  M.wolf = {
    w: 34, h: 24, ax: 16, ay: 21, frames: { idle: 2, walk: 4, windup: 1, attack: 1 },
    draw(P, p, anim, f) {
      const m = p.main, d = sh(m, -0.3), l = sh(m, 0.25);
      const bob = anim === 'walk' ? [0, -1, 0, -1][f] : 0;
      const lunge = anim === 'attack' ? 4 : anim === 'windup' ? -2 : 0;
      const crouch = anim === 'windup' ? 2 : 0;
      const y = 8 + bob + crouch;
      // legs
      const lp = anim === 'walk' ? [[0, 2], [2, 0], [0, 2], [2, 0]][f] : [0, 0];
      P.rect(9 + lunge, y + 7, 3, 6 - lp[0] - crouch, d); P.rect(22 + lunge, y + 7, 3, 6 - lp[1] - crouch, d);
      P.rect(12 + lunge, y + 7, 3, 6 - lp[1] - crouch, m); P.rect(25 + lunge, y + 7, 3, 6 - lp[0] - crouch, m);
      // body
      P.rect(8 + lunge, y, 20, 8, m); P.rect(8 + lunge, y, 20, 2, l); P.rect(8 + lunge, y + 6, 20, 2, d);
      // tail
      P.rect(3 + lunge, y - 1, 6, 3, m); P.rect(2 + lunge, y - 3, 3, 3, l);
      // head
      P.rect(25 + lunge, y - 5, 8, 7, m); P.rect(31 + lunge, y - 2, 3, 4, l); P.rect(25 + lunge, y - 7, 2, 3, d); P.rect(28 + lunge, y - 7, 2, 3, d);
      P.px(30 + lunge, y - 3, p.eye || '#ffd040');
      P.px(33 + lunge, y - 2, '#101010');
      if (anim === 'attack' || anim === 'windup') { P.rect(31 + lunge, y + 2, 3, 1, '#ffffff'); P.px(31 + lunge, y + 3, '#a02020'); }
      if (p.stripe) { P.rect(12 + lunge, y, 2, 5, p.stripe); P.rect(17 + lunge, y, 2, 5, p.stripe); P.rect(22 + lunge, y, 2, 5, p.stripe); }
    },
  };

  M.goblin = {
    w: 28, h: 28, ax: 14, ay: 26, frames: { idle: 2, walk: 4, windup: 1, attack: 1 },
    draw(P, p, anim, f) {
      const m = p.main, d = sh(m, -0.3), l = sh(m, 0.25), cl = p.cloth || '#6a4a2a';
      const bob = anim === 'walk' ? [0, -1, 0, -1][f] : anim === 'idle' ? f : 0;
      const y = 8 + bob;
      const lp = anim === 'walk' ? [[0, 2], [0, 0], [2, 0], [0, 0]][f] : [0, 0];
      P.rect(10, y + 12, 3, 6 - lp[0], d); P.rect(15, y + 12, 3, 6 - lp[1], d);
      P.rect(9, y + 6, 10, 7, cl); P.rect(9, y + 11, 10, 1, sh(cl, -0.3));
      // head w/ big ears
      P.rect(8, y - 3, 12, 9, m); P.rect(8, y - 3, 12, 2, l); P.rect(4, y - 2, 4, 3, m); P.rect(20, y - 2, 4, 3, m); P.px(3, y - 3, m); P.px(24, y - 3, m);
      P.px(16, y, p.eye || '#ff3030'); P.px(18, y, p.eye || '#ff3030'); P.rect(15, y + 3, 4, 1, d); P.px(16, y + 4, '#ffffff');
      // weapon arm
      const sw = anim === 'windup' ? -6 : anim === 'attack' ? 5 : 0;
      P.rect(19, y + 7, 3, 4, m);
      if (p.weapon === 'bow') { P.rect(22, y + 1, 2, 12, '#8a5a30'); P.rect(21, y + 1, 1, 12, '#e8e0d0'); }
      else if (p.weapon === 'staff') { P.rect(22, y - 4, 2, 18, '#6a4424'); P.circle(23, y - 5, 2, p.accent || '#60ff60'); }
      else { P.rect(21, y + 2 + sw, 2, 8, '#a0a0a8'); P.rect(20, y + 9 + sw, 4, 1, '#6a4424'); }
      if (p.helm) { P.rect(8, y - 5, 12, 3, p.helm); P.px(14, y - 7, p.helm); }
    },
  };

  M.skeleton = {
    w: 28, h: 32, ax: 14, ay: 30, frames: { idle: 2, walk: 4, windup: 1, attack: 1 },
    draw(P, p, anim, f) {
      const b = p.main || '#e8e0d0', d = sh(b, -0.3);
      const bob = anim === 'walk' ? [0, -1, 0, -1][f] : 0;
      const y = 6 + bob;
      const lp = anim === 'walk' ? [[0, 2], [0, 0], [2, 0], [0, 0]][f] : [0, 0];
      P.rect(11, y + 16, 2, 8 - lp[0], b); P.rect(15, y + 16, 2, 8 - lp[1], b);
      P.rect(10, y + 15, 8, 2, d);
      P.rect(13, y + 8, 2, 8, b);
      for (let i = 0; i < 3; i++) P.rect(10, y + 9 + i * 2, 8, 1, b);
      P.rect(9, y + 8, 10, 1, b);
      // skull
      P.rect(9, y - 1, 10, 9, b); P.rect(10, y + 8, 8, 1, d); P.rect(11, y + 2, 3, 3, '#101018'); P.rect(15, y + 2, 3, 3, '#101018');
      P.px(12, y + 3, p.eye || '#ff4040'); P.px(16, y + 3, p.eye || '#ff4040'); P.rect(12, y + 6, 5, 1, '#101018');
      const sw = anim === 'windup' ? -6 : anim === 'attack' ? 4 : 0;
      P.rect(18, y + 9, 2, 5, b); P.rect(7, y + 9, 2, 6, b);
      if (p.weapon === 'bow') { P.rect(20, y + 3, 2, 14, '#6a5030'); P.rect(19, y + 3, 1, 14, '#c8c0b0'); }
      else if (p.weapon === 'staff') { P.rect(20, y - 4, 2, 22, '#3a2a4a'); P.circle(21, y - 5, 2, p.accent || '#b070ff'); }
      else { P.rect(20, y + 2 + sw, 2, 12, '#b0b0b8'); P.rect(19, y + 12 + sw, 4, 1, '#5a4a3a'); P.rect(20, y + 2 + sw, 1, 12, '#e0e0e8'); }
      if (p.shield) { P.rect(4, y + 9, 5, 7, p.shield); P.rect(5, y + 11, 3, 3, sh(p.shield, 0.3)); }
      if (p.helm) { P.rect(8, y - 3, 12, 4, p.helm); P.rect(8, y - 3, 12, 1, sh(p.helm, 0.3)); }
    },
  };

  M.bat = {
    w: 28, h: 20, ax: 14, ay: 18, frames: { idle: 4, walk: 4, windup: 1, attack: 1 },
    draw(P, p, anim, f) {
      const m = p.main, d = sh(m, -0.3);
      const flap = anim === 'windup' ? 0 : [0, 3, 6, 3][f % 4];
      const y = 6;
      P.ellipse(14, y + 3, 4, 4, m); P.rect(12, y - 2, 2, 3, m); P.rect(15, y - 2, 2, 3, m);
      P.px(13, y + 2, p.eye || '#ff3030'); P.px(16, y + 2, p.eye || '#ff3030'); P.px(14, y + 5, '#ffffff'); P.px(15, y + 5, '#ffffff');
      for (let i = 0; i < 9; i++) { const yy = y + 1 - flap + Math.round(i * flap / 6); P.rect(10 - i, yy, 1, 4 - Math.floor(i / 3), d); P.rect(18 + i, yy, 1, 4 - Math.floor(i / 3), d); }
    },
  };

  M.spider = {
    w: 30, h: 22, ax: 15, ay: 18, frames: { idle: 2, walk: 4, windup: 1, attack: 1 },
    draw(P, p, anim, f) {
      const m = p.main, d = sh(m, -0.35), l = sh(m, 0.25);
      const y = 10;
      for (let i = 0; i < 4; i++) {
        const o = anim === 'walk' ? ((i + f) % 2) * 2 : 0;
        P.line(12, y + 1, 4 - i, y - 3 + i * 3 + o, d); P.line(4 - i, y - 3 + i * 3 + o, 3 - i, y + 4 + i * 2 + o, d);
        P.line(18, y + 1, 26 + i, y - 3 + i * 3 - o, d); P.line(26 + i, y - 3 + i * 3 - o, 27 + i, y + 4 + i * 2 - o, d);
      }
      P.ellipse(12, y + 1, 6, 5, m); P.ellipse(20, y + 2, 4, 3, m); P.ellipse(11, y - 1, 3, 2, l);
      if (p.mark) { P.rect(10, y + 1, 3, 2, p.mark); }
      for (const [x, yy] of [[21, y + 1], [23, y + 1], [22, y + 3]]) P.px(x, yy, p.eye || '#ff3030');
      if (anim === 'windup' || anim === 'attack') { P.rect(23, y + 4, 1, 2, '#ffffff'); P.rect(21, y + 4, 1, 2, '#ffffff'); }
    },
  };

  // Generic big humanoid used for knights/golems/bosses when nothing specific exists.
  M.brute = {
    w: 44, h: 48, ax: 22, ay: 45, frames: { idle: 2, walk: 4, windup: 1, attack: 1, cast: 1 },
    draw(P, p, anim, f) {
      const m = p.main, d = sh(m, -0.3), l = sh(m, 0.25), a = p.accent || '#c03030';
      const bob = anim === 'walk' ? [0, -1, 0, -1][f] : anim === 'idle' ? f : 0;
      const y = 8 + bob;
      const lp = anim === 'walk' ? [[0, 3], [0, 0], [3, 0], [0, 0]][f] : [0, 0];
      P.rect(14, y + 24, 6, 13 - lp[0], d); P.rect(24, y + 24, 6, 13 - lp[1], d);
      P.rect(12, y + 8, 20, 17, m); P.rect(12, y + 8, 20, 3, l); P.rect(12, y + 22, 20, 3, d);
      P.rect(18, y + 11, 8, 8, a);
      P.rect(15, y - 4, 14, 12, m); P.rect(15, y - 4, 14, 3, l);
      P.rect(18, y + 1, 3, 2, p.eye || '#ffd040'); P.rect(24, y + 1, 3, 2, p.eye || '#ffd040');
      const up = anim === 'windup' ? -10 : anim === 'attack' ? 6 : anim === 'cast' ? -12 : 0;
      P.rect(6, y + 9, 6, 14, m); P.rect(32, y + 9 + Math.min(0, up), 6, 14, m);
      P.rect(32, y + 21 + up, 8, 6, d);
      if (p.horns) { P.rect(13, y - 8, 3, 6, p.horns); P.rect(28, y - 8, 3, 6, p.horns); P.px(12, y - 9, p.horns); P.px(31, y - 9, p.horns); }
      if (p.weapon) { P.rect(38, y + 2 + up, 3, 26, p.weapon); P.rect(36, y + 2 + up, 7, 6, sh(p.weapon, 0.2)); }
    },
  };

  // ---- cache + draw ----------------------------------------------------------
  function palKey(p) { let s = ''; for (const k in p) s += k + p[k]; return s; }
  M.sprite = function (id, pal, anim, frame, flip) {
    const d = M[id] || M.slime;
    const fr = d.frames && d.frames[anim] ? frame % d.frames[anim] : 0;
    const an = d.frames && d.frames[anim] ? anim : 'idle';
    const k = 'mon|' + id + '|' + palKey(pal) + '|' + an + fr;
    const spr = G.sprite(k, d.w + 2, d.h + 2, (ctx) => { ctx.translate(1, 1); d.draw(G.painter(ctx), pal, an, fr, ctx); }, { outline: true });
    return flip ? G.mirror(spr, k) : spr;
  };

  M.draw = function (ctx, e) {
    const def = e.def;
    const id = def.sprite || 'slime';
    const d = M[id] || M.slime;
    const flip = e.face < 0;
    let spr = M.sprite(id, def.pal || {}, e.anim || 'idle', e.frame || 0, flip);
    if (e.flash > 0) spr = G.flash(spr, id + e.anim + e.frame + flip + palKey(def.pal || {}), e.flashColor || '#ffffff');
    const s = def.scale || 1;
    const ax = flip ? d.w - d.ax : d.ax;
    const x = Math.round(e.x - (ax + 1) * s), y = Math.round(e.y - e.z - (d.ay + 1) * s);
    if (e.alpha != null && e.alpha < 1) ctx.globalAlpha = e.alpha;
    if (s !== 1) ctx.drawImage(spr, x, y, Math.round(spr.width * s), Math.round(spr.height * s));
    else ctx.drawImage(spr, x, y);
    ctx.globalAlpha = 1;
  };
})(window.RPG);
