'use strict';
// Layered humanoid renderer used by the player AND by every human NPC.
// A character is drawn from an `appearance` plus a `gear` object of item looks, in
// 4 facings and several animations, into a cached 32x36 canvas, then outlined.
//
//   RPG.Character.sprite(appearance, gear, dir, anim, frame) -> canvas (32x36)
//      anchor: feet at (16, 33) of the canvas
//   RPG.Character.draw(ctx, x, y, appearance, gear, dir, anim, frame, opts)
//      draws with feet at world (x, y). opts: {flash, alpha, rot}
//
// appearance: {body:'a'|'b', skin, hair (style id), hairColor, eyes, beard, beardColor?, outfit, outfit2}
// gear: { head, chest, legs, feet, hands, cape, offhand }  -> each is an item `look` or undefined
//   look = { style, color, trim, glow?, accent? }   (styles listed in STYLES below)
// dir: 'down' | 'up' | 'left' | 'right'
// anim: 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'dead' | 'roll'
(function (R) {
  const U = R.U, G = R.G;
  const C = R.Character = {};
  const W = 32, H = 36, FX0 = 16, FY0 = 33;
  C.W = W; C.H = H; C.ANCHOR_X = FX0; C.ANCHOR_Y = FY0;

  // ---- customisation options (used by the character creator) ---------------
  C.SKINS = ['#fde0c5', '#f5c9a0', '#e8b088', '#c98e62', '#a36a44', '#7a4a2e', '#553222', '#9fd4a8', '#a9b8e8', '#d8a8e0'];
  C.HAIR_COLORS = ['#2a1d18', '#4a2e1f', '#7a4b2a', '#b5773c', '#e0b55f', '#f2e2a6', '#d8d8d8', '#9a2b2b', '#e05a2a', '#3b5bb5', '#46a15b', '#b04fc0', '#ff8ac0', '#1b1b2e'];
  C.EYE_COLORS = ['#2b4f8a', '#3a7a3a', '#6b4020', '#202020', '#8a2be2', '#c03030', '#d4a017', '#40c0d0'];
  C.OUTFIT_COLORS = ['#6b4a2b', '#3a5a8c', '#7a2e2e', '#2e6b3a', '#5a3a7a', '#8a7a4a', '#3a3a3a', '#c0c0c0', '#b06030', '#2a6a6a'];
  C.HAIR_STYLES = [
    { id: 'short', name: 'Short' }, { id: 'spiky', name: 'Spiky' }, { id: 'long', name: 'Long' },
    { id: 'ponytail', name: 'Ponytail' }, { id: 'mohawk', name: 'Mohawk' }, { id: 'bob', name: 'Bob' },
    { id: 'braids', name: 'Braids' }, { id: 'bald', name: 'Bald' }, { id: 'topknot', name: 'Topknot' },
    { id: 'wild', name: 'Wild' },
  ];
  C.BEARDS = [{ id: 'none', name: 'None' }, { id: 'stubble', name: 'Stubble' }, { id: 'full', name: 'Full' }, { id: 'goatee', name: 'Goatee' }, { id: 'long', name: 'Long' }];
  C.BODIES = [{ id: 'a', name: 'Broad' }, { id: 'b', name: 'Slim' }];

  C.defaultAppearance = function () {
    return { body: 'a', skin: C.SKINS[1], hair: 'short', hairColor: C.HAIR_COLORS[2], eyes: C.EYE_COLORS[0], beard: 'none', outfit: C.OUTFIT_COLORS[0], outfit2: '#d8c8a0' };
  };
  C.randomAppearance = function (rng) {
    const r = rng || Math.random;
    const pick = (a) => a[Math.floor(r() * a.length)];
    return {
      body: pick(['a', 'b']), skin: pick(C.SKINS.slice(0, 7)), hair: pick(C.HAIR_STYLES).id, hairColor: pick(C.HAIR_COLORS),
      eyes: pick(C.EYE_COLORS), beard: r() < 0.3 ? pick(C.BEARDS).id : 'none', outfit: pick(C.OUTFIT_COLORS), outfit2: pick(['#d8c8a0', '#e0e0e0', '#a08060', '#303030']),
    };
  };

  function key(o) { return o ? [o.style, o.color, o.trim, o.glow || '', o.accent || ''].join(',') : '-'; }
  function aKey(a) { return [a.body, a.skin, a.hair, a.hairColor, a.eyes, a.beard, a.outfit, a.outfit2].join(','); }

  // ---- pose: per-frame offsets ---------------------------------------------
  function pose(anim, frame) {
    // body bob, left/right leg lift, arm swing, lean
    const p = { bob: 0, legL: 0, legR: 0, armL: 0, armR: 0, stride: 0, armsUp: 0, lean: 0 };
    if (anim === 'walk') {
      const f = frame % 4;
      p.bob = f === 1 || f === 3 ? -1 : 0;
      p.legL = f === 1 ? -2 : 0; p.legR = f === 3 ? -2 : 0;
      p.armL = f === 1 ? 1 : f === 3 ? -1 : 0; p.armR = -p.armL;
      p.stride = f === 1 ? 1 : f === 3 ? -1 : 0;
    } else if (anim === 'idle') {
      p.bob = frame % 2 === 1 ? 1 : 0;
    } else if (anim === 'attack') {
      p.lean = frame === 0 ? -1 : 1; p.armR = frame === 0 ? -2 : 1; p.legL = frame === 1 ? -1 : 0; p.stride = frame === 1 ? 1 : 0;
    } else if (anim === 'cast') {
      p.armsUp = frame === 0 ? 3 : 5; p.bob = frame === 1 ? -1 : 0;
    } else if (anim === 'hurt') {
      p.lean = -1; p.bob = 1;
    }
    return p;
  }

  // ---- body parts ------------------------------------------------------------
  // All coordinates are for the canvas; feet baseline at y = FY0 (33).
  // Layout facing down: head 10x9 at y 7..15, torso y 16..23, legs y 24..32.

  function drawHairBack(P, a, dir, bob) {
    const c = a.hairColor, d = U.shade(c, -0.3);
    const y = bob;
    if (a.hair === 'long' || a.hair === 'braids') {
      if (dir === 'up') { P.rect(10, 9 + y, 12, 14, c); P.rect(10, 20 + y, 12, 3, d); }
      else if (dir === 'down') { P.rect(10, 10 + y, 12, 12, d); }
      else { P.rect(dir === 'right' ? 10 : 14, 9 + y, 8, 13, d); }
    }
    if (a.hair === 'ponytail') {
      if (dir === 'up') { P.rect(14, 12 + y, 4, 10, c); P.rect(15, 21 + y, 2, 2, d); }
      else if (dir === 'left') { P.rect(20, 10 + y, 3, 3, c); P.rect(21, 13 + y, 3, 8, c); }
      else if (dir === 'right') { P.rect(9, 10 + y, 3, 3, c); P.rect(8, 13 + y, 3, 8, c); }
    }
  }

  function drawHead(P, a, dir, bob, gear) {
    const s = a.skin, sd = U.shade(s, -0.18), sl = U.shade(s, 0.15);
    const y = 7 + bob;
    const helm = gear.head;
    const fullHelm = helm && ['full', 'horned', 'knight', 'skull', 'dragon'].includes(helm.style);
    // head block
    if (dir === 'down') {
      P.rect(11, y + 1, 10, 8, s); P.rect(12, y, 8, 1, s); P.rect(12, y + 9, 8, 1, sd);
      P.rect(20, y + 2, 1, 7, sd); P.rect(11, y + 2, 1, 5, sl);
      if (!fullHelm) {
        // eyes
        P.rect(13, y + 5, 2, 2, '#ffffff'); P.rect(18, y + 5, 2, 2, '#ffffff');
        P.px(14, y + 5, a.eyes); P.px(14, y + 6, a.eyes); P.px(18, y + 5, a.eyes); P.px(18, y + 6, a.eyes);
        P.px(16, y + 7, sd); // nose
        if (a.body === 'b') { P.px(12, y + 5, '#3a2020'); P.px(20, y + 5, '#3a2020'); }
        P.rect(15, y + 8, 2, 1, U.shade(s, -0.35)); // mouth
      }
    } else if (dir === 'up') {
      P.rect(11, y + 1, 10, 8, s); P.rect(12, y, 8, 1, s); P.rect(12, y + 9, 8, 1, sd);
    } else {
      const fx = dir === 'right';
      P.rect(12, y + 1, 9, 8, s); P.rect(13, y, 7, 1, s); P.rect(13, y + 9, 7, 1, sd);
      if (!fullHelm) {
        const ex = fx ? 18 : 13;
        P.rect(ex, y + 5, 2, 2, '#ffffff'); P.px(fx ? ex + 1 : ex, y + 5, a.eyes); P.px(fx ? ex + 1 : ex, y + 6, a.eyes);
        P.px(fx ? 21 : 11, y + 6, s); // nose tip
        P.px(fx ? 19 : 13, y + 8, U.shade(s, -0.35));
        P.px(fx ? 14 : 18, y + 5, sd); // ear
        P.px(fx ? 14 : 18, y + 6, sd);
      }
    }
    // beard
    if (a.beard && a.beard !== 'none' && dir !== 'up' && !fullHelm) {
      const bc = a.beardColor || a.hairColor, bd = U.shade(bc, -0.25);
      const side = dir !== 'down';
      const x0 = side ? (dir === 'right' ? 15 : 12) : 12, w = side ? 6 : 8;
      if (a.beard === 'stubble') { for (let i = 0; i < w; i += 2) P.px(x0 + i, y + 8, bd); P.px(x0 + 1, y + 9, bd); P.px(x0 + w - 2, y + 9, bd); }
      if (a.beard === 'full') { P.rect(x0, y + 6, 1, 3, bc); P.rect(x0 + w - 1, y + 6, 1, 3, bc); P.rect(x0, y + 8, w, 2, bc); P.rect(x0 + 1, y + 10, w - 2, 1, bd); if (!side) P.rect(15, y + 8, 2, 1, U.shade(s, -0.35)); }
      if (a.beard === 'goatee') { P.rect(side ? (dir === 'right' ? 18 : 13) : 15, y + 8, 2, 3, bc); }
      if (a.beard === 'long') { P.rect(x0, y + 7, w, 3, bc); P.rect(x0 + 1, y + 10, w - 2, 3, bc); P.rect(x0 + 2, y + 13, w - 4, 1, bd); }
    }
  }

  function drawHairFront(P, a, dir, bob, gear) {
    const helm = gear.head;
    if (helm && helm.style !== 'circlet' && helm.style !== 'crown') return; // hat hides hair (mostly)
    if (a.hair === 'bald') return;
    const c = a.hairColor, d = U.shade(c, -0.25), l = U.shade(c, 0.25);
    const y = 7 + bob;
    const st = a.hair;
    if (dir === 'down') {
      P.rect(11, y - 1, 10, 3, c); P.rect(12, y - 2, 8, 1, c); P.rect(11, y + 2, 1, 3, c); P.rect(20, y + 2, 1, 3, c);
      P.rect(13, y - 1, 3, 1, l);
      if (st === 'short' || st === 'bob') { P.rect(12, y + 2, 2, 1, c); P.rect(18, y + 2, 2, 1, c); }
      if (st === 'bob') { P.rect(10, y + 1, 2, 7, c); P.rect(20, y + 1, 2, 7, c); P.rect(10, y + 7, 2, 1, d); P.rect(20, y + 7, 2, 1, d); }
      if (st === 'spiky') { P.px(12, y - 3, c); P.px(15, y - 4, c); P.px(16, y - 3, c); P.px(19, y - 3, c); P.rect(11, y + 2, 3, 1, c); P.rect(17, y + 2, 2, 1, c); }
      if (st === 'long' || st === 'braids') { P.rect(10, y, 2, 10, c); P.rect(20, y, 2, 10, c); P.rect(12, y + 2, 3, 1, c); }
      if (st === 'braids') { P.rect(10, y + 10, 2, 4, d); P.rect(20, y + 10, 2, 4, d); P.px(10, y + 14, l); P.px(21, y + 14, l); }
      if (st === 'mohawk') { P.rect(11, y - 1, 10, 2, U.shade(a.skin, -0.1)); P.rect(15, y - 4, 2, 5, c); P.rect(15, y - 4, 1, 2, l); }
      if (st === 'ponytail') { P.rect(12, y + 2, 2, 1, c); P.rect(18, y + 2, 2, 1, c); }
      if (st === 'topknot') { P.rect(14, y - 5, 4, 3, c); P.rect(15, y - 5, 1, 1, l); P.rect(15, y - 2, 2, 1, d); }
      if (st === 'wild') { P.rect(10, y - 2, 12, 4, c); P.px(9, y, c); P.px(22, y, c); P.px(11, y - 3, c); P.px(14, y - 4, c); P.px(18, y - 3, c); P.px(21, y - 2, c); P.rect(10, y + 2, 2, 5, c); P.rect(20, y + 2, 2, 5, c); }
    } else if (dir === 'up') {
      P.rect(11, y - 1, 10, 8, c); P.rect(12, y - 2, 8, 1, c); P.rect(11, y + 7, 10, 1, d);
      P.rect(13, y - 1, 4, 1, l);
      if (st === 'spiky') { P.px(12, y - 3, c); P.px(15, y - 4, c); P.px(19, y - 3, c); }
      if (st === 'mohawk') { P.rect(11, y - 1, 10, 8, U.shade(a.skin, -0.1)); P.rect(15, y - 4, 2, 11, c); }
      if (st === 'topknot') { P.rect(14, y - 5, 4, 3, c); }
      if (st === 'wild') { P.rect(10, y - 2, 12, 10, c); P.px(9, y + 2, c); P.px(22, y + 3, c); }
      if (st === 'bob') { P.rect(10, y + 1, 12, 8, c); P.rect(10, y + 8, 12, 1, d); }
    } else {
      const fx = dir === 'right';
      const back = fx ? 12 : 19;
      P.rect(12, y - 1, 9, 3, c); P.rect(13, y - 2, 7, 1, c);
      P.rect(fx ? 12 : 17, y + 2, 4, 4, c); // back of head hair
      P.rect(fx ? 19 : 12, y + 2, 2, 1, c);   // fringe
      P.rect(fx ? 14 : 15, y - 1, 3, 1, l);
      if (st === 'spiky') { P.px(fx ? 13 : 19, y - 3, c); P.px(16, y - 4, c); P.px(fx ? 19 : 13, y - 3, c); }
      if (st === 'long' || st === 'braids') { P.rect(back - (fx ? 1 : 0), y + 2, 3, 10, c); }
      if (st === 'bob') { P.rect(back - (fx ? 1 : 0), y + 2, 3, 6, c); }
      if (st === 'mohawk') { P.rect(12, y - 1, 9, 3, U.shade(a.skin, -0.1)); P.rect(fx ? 12 : 17, y + 2, 4, 4, U.shade(a.skin, -0.1)); P.rect(13, y - 4, 7, 2, c); }
      if (st === 'topknot') { P.rect(fx ? 13 : 16, y - 5, 4, 3, c); }
      if (st === 'wild') { P.rect(11, y - 2, 11, 4, c); P.rect(fx ? 11 : 17, y + 2, 5, 6, c); P.px(fx ? 10 : 22, y + 3, c); }
    }
  }

  // Helmets / hats
  function drawHelm(P, h, dir, bob) {
    if (!h) return;
    const c = h.color, d = U.shade(c, -0.3), l = U.shade(c, 0.3), t = h.trim || l;
    const y = 7 + bob;
    const side = dir === 'left' || dir === 'right', fx = dir === 'right';
    const x0 = side ? 12 : 11, w = side ? 9 : 10;
    switch (h.style) {
      case 'hood':
        P.rect(x0 - 1, y - 2, w + 2, 5, c); P.rect(x0 - 1, y + 3, 2, 7, c); P.rect(x0 + w - 1, y + 3, 2, 7, c); P.rect(x0 + 1, y - 2, w - 2, 1, l);
        if (dir === 'up') P.rect(x0 - 1, y - 2, w + 2, 12, c), P.rect(x0 + 2, y + 9, w - 4, 3, d);
        if (side) P.rect(fx ? x0 - 1 : x0 + w - 3, y - 2, 4, 12, c);
        P.rect(x0 - 1, y + 2, w + 2, 1, t);
        break;
      case 'wizard':
        P.rect(x0 - 3, y + 1, w + 6, 2, c); P.rect(x0 - 3, y + 2, w + 6, 1, d);
        P.rect(x0 + 1, y - 3, w - 2, 4, c); P.rect(x0 + 2, y - 6, w - 4, 3, c); P.rect(x0 + 3, y - 8, w - 6, 2, c);
        P.rect(x0 + (fx ? w - 3 : 2), y - 10, 3, 2, c); P.px(x0 + (fx ? w : 1), y - 11, c);
        P.rect(x0 + 1, y, w - 2, 1, t); if (h.accent) P.px(x0 + w / 2, y - 4, h.accent);
        break;
      case 'cap':
        P.rect(x0, y - 2, w, 4, c); P.rect(x0 + 1, y - 3, w - 2, 1, c); P.rect(x0 + 2, y - 2, 3, 1, l);
        if (dir === 'down') P.rect(x0 - 1, y + 2, w + 2, 1, d);
        if (side) P.rect(fx ? x0 + w - 2 : x0 - 2, y + 1, 4, 1, d);
        if (h.accent) { P.px(fx ? x0 + 1 : x0 + w - 2, y - 4, h.accent); P.px(fx ? x0 : x0 + w - 1, y - 5, h.accent); }
        break;
      case 'circlet':
        P.rect(x0, y + 1, w, 1, c); if (dir !== 'up') P.px(x0 + (side ? (fx ? w - 3 : 2) : 4), y + 1, h.accent || '#6fd8ff'); if (dir === 'down') P.px(x0 + 5, y + 1, h.accent || '#6fd8ff');
        break;
      case 'crown':
        P.rect(x0 + 1, y - 2, w - 2, 3, c); P.px(x0 + 1, y - 3, c); P.px(x0 + w / 2, y - 4, c); P.px(x0 + w / 2 - 1, y - 3, c); P.px(x0 + w - 2, y - 3, c);
        P.rect(x0 + 1, y, w - 2, 1, d); P.px(x0 + w / 2, y - 1, h.accent || '#e03050');
        break;
      case 'bandana':
        P.rect(x0, y - 1, w, 3, c); P.rect(x0, y + 1, w, 1, d); P.rect(x0 + 2, y - 1, 2, 1, l);
        if (dir !== 'down') P.rect(fx ? x0 - 2 : x0 + w, y + 1, 2, 4, c);
        break;
      case 'leather':
        P.rect(x0, y - 2, w, 5, c); P.rect(x0 + 1, y - 3, w - 2, 1, c); P.rect(x0, y + 2, w, 1, d); P.rect(x0 + 2, y - 2, 3, 1, l);
        if (dir !== 'up') { P.rect(x0 - 1, y + 3, 2, 5, c); P.rect(x0 + w - 1, y + 3, 2, 5, c); }
        break;
      case 'full': case 'knight': case 'horned': case 'skull': case 'dragon': {
        // full helm covering the head
        P.rect(x0 - 1, y - 2, w + 2, 12, c); P.rect(x0, y - 3, w, 1, c);
        P.rect(x0, y - 2, 3, 6, l); P.rect(x0 + w - 1, y - 1, 1, 10, d); P.rect(x0 - 1, y + 9, w + 2, 1, d);
        if (dir === 'down') {
          P.rect(x0 + 1, y + 4, w - 2, 2, '#10101a'); P.rect(x0 + w / 2 - 1, y + 4, 2, 5, d);
          if (h.glow) { P.px(x0 + 2, y + 4, h.glow); P.px(x0 + w - 3, y + 4, h.glow); }
        } else if (side) {
          P.rect(fx ? x0 + 4 : x0, y + 4, w - 4, 2, '#10101a');
          if (h.glow) P.px(fx ? x0 + w - 2 : x0 + 1, y + 4, h.glow);
        } else {
          P.rect(x0 + w / 2 - 1, y - 3, 2, 12, t);
        }
        P.rect(x0 - 1, y + 2, w + 2, 1, t);
        if (h.style === 'knight') { P.rect(x0 + w / 2 - 1, y - 7, 2, 4, h.accent || '#c03030'); P.rect(x0 + w / 2, y - 8, 3, 2, h.accent || '#c03030'); }
        if (h.style === 'horned') {
          const hc = h.accent || '#e8e0c8';
          if (dir === 'down' || dir === 'up') { P.rect(x0 - 3, y, 2, 2, hc); P.rect(x0 - 4, y - 3, 2, 3, hc); P.px(x0 - 3, y - 5, hc); P.rect(x0 + w + 1, y, 2, 2, hc); P.rect(x0 + w + 2, y - 3, 2, 3, hc); P.px(x0 + w + 2, y - 5, hc); }
          else { P.rect(fx ? x0 + 1 : x0 + w - 3, y - 4, 2, 3, hc); P.rect(fx ? x0 - 1 : x0 + w - 1, y - 6, 2, 2, hc); }
        }
        if (h.style === 'skull') { if (dir === 'down') { P.rect(x0 + 1, y - 1, w - 2, 4, '#e8e0d0'); P.rect(x0 + 2, y, 2, 2, '#10101a'); P.rect(x0 + w - 4, y, 2, 2, '#10101a'); } }
        if (h.style === 'dragon') {
          const hc = h.accent || '#ffcf40';
          P.rect(x0 + 2, y - 5, 2, 3, hc); P.rect(x0 + w - 4, y - 5, 2, 3, hc); P.px(x0 + 2, y - 6, hc); P.px(x0 + w - 3, y - 6, hc);
          if (dir === 'down') P.rect(x0 + 3, y + 7, w - 6, 1, hc);
        }
        break;
      }
      default: // simple metal cap
        P.rect(x0, y - 2, w, 4, c); P.rect(x0 + 1, y - 3, w - 2, 1, c); P.rect(x0 + 1, y - 2, 3, 1, l); P.rect(x0, y + 1, w, 1, t);
    }
    if (h.glow && !['full', 'knight', 'horned', 'skull', 'dragon'].includes(h.style)) P.px(x0 + w / 2, y - 1, h.glow);
  }

  function drawLegs(P, a, gear, dir, p) {
    const pants = gear.legs ? gear.legs.color : U.shade(a.outfit, -0.35);
    const pd = U.shade(pants, -0.25);
    const boots = gear.feet ? gear.feet.color : '#4a3020';
    const bd = U.shade(boots, -0.3);
    const y0 = 24 + (p.bob > 0 ? 0 : 0);
    const side = dir === 'left' || dir === 'right';
    if (!side) {
      // left leg
      const lh = 8 + p.legL, rh = 8 + p.legR;
      P.rect(12, y0, 3, lh, pants); P.rect(12, y0 + lh - 3, 3, 3, boots); P.rect(12, y0 + lh - 1, 3, 1, bd);
      P.rect(17, y0, 3, rh, pants); P.rect(17, y0 + rh - 3, 3, 3, boots); P.rect(17, y0 + rh - 1, 3, 1, bd);
      P.rect(14, y0, 1, 3, pd); P.rect(19, y0, 1, lh - 3, pd);
      if (gear.legs && gear.legs.style === 'plate') { P.rect(12, y0 + 3, 3, 1, U.shade(pants, 0.35)); P.rect(17, y0 + 3, 3, 1, U.shade(pants, 0.35)); }
      if (gear.feet && gear.feet.trim) { P.rect(12, y0 + lh - 3, 3, 1, gear.feet.trim); P.rect(17, y0 + rh - 3, 3, 1, gear.feet.trim); }
    } else {
      const fx = dir === 'right';
      const s = p.stride;
      // back leg, front leg
      const bx = 14 - s * 2, fx2 = 15 + s * 2;
      P.rect(bx, y0, 3, 8, pd); P.rect(bx, y0 + 5, 3, 3, bd);
      P.rect(fx2, y0, 3, 8, pants); P.rect(fx2, y0 + 5, 3, 3, boots);
      P.rect(fx ? fx2 + 2 : fx2 - 1, y0 + 7, 2, 1, boots); P.rect(fx ? bx + 2 : bx - 1, y0 + 7, 2, 1, bd);
      if (gear.feet && gear.feet.trim) P.rect(fx2, y0 + 5, 3, 1, gear.feet.trim);
    }
  }

  function drawTorso(P, a, gear, dir, p) {
    const ch = gear.chest;
    const base = ch ? ch.color : a.outfit;
    const b2 = ch ? (ch.trim || U.shade(ch.color, 0.3)) : a.outfit2;
    const d = U.shade(base, -0.28), l = U.shade(base, 0.22);
    const y = 16 + p.bob;
    const side = dir === 'left' || dir === 'right';
    const x0 = side ? 13 : 11, w = side ? 7 : 10;
    const style = ch ? ch.style : 'tunic';
    const slim = a.body === 'b';
    // main block
    P.rect(x0, y, w, 8, base);
    if (!side && slim) { P.px(x0, y + 5, 'rgba(0,0,0,0)'); }
    P.rect(x0 + w - 1, y, 1, 8, d);
    P.rect(x0, y, 1, 6, l);
    if (style === 'robe') {
      // robe extends over legs
      P.rect(x0 - 1, y + 7, w + 2, 8, base); P.rect(x0 + w, y + 7, 1, 8, d); P.rect(x0 - 1, y + 14, w + 2, 1, b2);
      if (!side && dir === 'down') P.rect(x0 + w / 2 - 1, y + 1, 2, 14, b2);
      if (side) P.rect(dir === 'right' ? x0 + w - 2 : x0 + 1, y + 1, 1, 14, b2);
    }
    // belt
    if (style !== 'robe') {
      P.rect(x0, y + 6, w, 1, ch && ch.style === 'plate' ? d : '#3a2418');
      if (dir === 'down') P.px(x0 + w / 2, y + 6, '#d8b040');
    }
    if (dir === 'down' || dir === 'up') {
      if (style === 'tunic') { if (dir === 'down') { P.rect(x0 + 3, y, 4, 2, b2); P.px(x0 + 4, y + 2, b2); } }
      if (style === 'leather') { P.rect(x0 + 1, y + 1, w - 2, 1, l); P.rect(x0 + 2, y + 3, w - 4, 1, d); if (dir === 'down') { P.px(x0 + 3, y + 2, b2); P.px(x0 + 6, y + 2, b2); } }
      if (style === 'chain') { for (let yy = 0; yy < 6; yy++) for (let xx = (yy % 2); xx < w; xx += 2) P.px(x0 + xx, y + yy, yy % 2 ? d : l); }
      if (style === 'plate') { P.rect(x0 + 1, y + 1, w - 2, 4, l); P.rect(x0 + 2, y + 2, w - 4, 2, base); if (dir === 'down') P.rect(x0 + w / 2 - 1, y + 1, 2, 4, b2); P.rect(x0, y + 5, w, 1, d); }
      if (style === 'mage') { if (dir === 'down') { P.rect(x0 + 3, y, 4, 8, b2); P.rect(x0 + 4, y + 1, 2, 6, base); } }
      if (style === 'shadow') { P.rect(x0 + 1, y, 2, 8, d); P.rect(x0 + w - 3, y, 2, 8, d); if (dir === 'down') P.rect(x0 + 3, y + 2, 4, 1, b2); }
    } else {
      if (style === 'plate') { P.rect(x0 + 1, y + 1, w - 2, 4, l); P.rect(x0 + 2, y + 2, w - 4, 2, base); }
      if (style === 'chain') { for (let yy = 0; yy < 6; yy++) for (let xx = (yy % 2); xx < w; xx += 2) P.px(x0 + xx, y + yy, yy % 2 ? d : l); }
      if (style === 'leather') P.rect(x0 + 1, y + 2, w - 2, 1, d);
    }
    if (ch && ch.glow) { P.px(x0 + w / 2, y + 3, ch.glow); if (!side) P.px(x0 + w / 2 - 1, y + 3, ch.glow); }
    return { x0, w, y };
  }

  function drawArm(P, a, gear, dir, p, which) {
    // which: 'L' (screen-left) or 'R'
    const ch = gear.chest;
    const sleeve = ch ? (ch.style === 'robe' || ch.style === 'mage' ? ch.color : U.shade(ch.color, -0.1)) : a.outfit;
    const hand = gear.hands ? gear.hands.color : a.skin;
    const y = 17 + p.bob;
    const side = dir === 'left' || dir === 'right';
    if (!side) {
      const x = which === 'L' ? 9 : 21;
      const sw = which === 'L' ? p.armL : p.armR;
      const up = p.armsUp;
      if (up) {
        P.rect(x, y - up, 2, 6, sleeve); P.rect(x, y - up - 2, 2, 2, hand);
      } else {
        P.rect(x, y + sw, 2, 6, sleeve); P.rect(x, y + 6 + sw, 2, 2, hand);
        P.rect(x + (which === 'L' ? 0 : 1), y + sw, 1, 6, U.shade(sleeve, which === 'L' ? 0.15 : -0.25));
      }
      // pauldrons
      if (ch && (ch.style === 'plate')) { P.rect(x - 1, y - 1, 4, 3, U.shade(ch.color, 0.25)); P.rect(x - 1, y + 1, 4, 1, U.shade(ch.color, -0.3)); if (ch.trim) P.rect(x - 1, y - 1, 4, 1, ch.trim); }
      if (ch && ch.style === 'shadow') P.rect(x - 1, y - 1, 4, 2, U.shade(ch.color, -0.3));
    } else {
      const x = 15 + (dir === 'right' ? p.armR : -p.armR);
      if (p.armsUp) { P.rect(dir === 'right' ? 17 : 13, y - p.armsUp, 2, 6, sleeve); P.rect(dir === 'right' ? 17 : 13, y - p.armsUp - 2, 2, 2, hand); }
      else { P.rect(x, y, 3, 6, sleeve); P.rect(x, y + 6, 3, 2, hand); }
      if (ch && ch.style === 'plate') { P.rect(14, y - 1, 5, 3, U.shade(ch.color, 0.25)); if (ch.trim) P.rect(14, y - 1, 5, 1, ch.trim); }
    }
  }

  function drawCape(P, cape, dir, p, front) {
    if (!cape) return;
    const c = cape.color, d = U.shade(c, -0.3), t = cape.trim;
    const y = 16 + p.bob;
    const sway = p.stride;
    if (dir === 'up' && front) {
      P.rect(10, y, 12, 13, c); P.rect(11, y + 13, 10, 1, c); P.rect(10 + (sway > 0 ? 1 : 0), y + 13, 1, 1, d);
      P.rect(15, y + 1, 1, 12, d); P.rect(18, y + 1, 1, 12, d);
      if (t) P.rect(10, y + 13, 12, 1, t);
      if (cape.glow) { P.px(13, y + 5, cape.glow); P.px(18, y + 8, cape.glow); }
    } else if (dir === 'down' && !front) {
      P.rect(10, y + 1, 12, 13, d);
      if (t) P.rect(10, y + 13, 12, 1, t);
    } else if ((dir === 'left' || dir === 'right') && !front) {
      const fx = dir === 'right';
      const bx = fx ? 9 + sway : 18 - sway;
      P.rect(fx ? 11 : 16, y, 5, 4, c);
      P.rect(bx, y + 3, 5, 11, c); P.rect(bx + (fx ? 0 : 4), y + 3, 1, 11, d);
      if (t) P.rect(bx, y + 13, 5, 1, t);
    }
  }

  function drawShield(P, sh, dir, p, front) {
    if (!sh) return;
    const c = sh.color, d = U.shade(c, -0.3), l = U.shade(c, 0.3), t = sh.trim || '#d8b040';
    const y = 18 + p.bob;
    // held on the character's left arm => screen-right when facing down
    if (dir === 'down' && front) {
      const x = 20;
      P.rect(x, y, 6, 8, c); P.rect(x + 1, y + 8, 4, 1, c); P.rect(x + 2, y + 9, 2, 1, c);
      P.rect(x, y, 6, 1, t); P.rect(x, y, 1, 8, t); P.rect(x + 5, y, 1, 8, d);
      P.rect(x + 2, y + 2, 2, 4, sh.accent || l);
      if (sh.glow) P.px(x + 3, y + 3, sh.glow);
    } else if (dir === 'up' && !front) {
      P.rect(6, y, 6, 8, d); P.rect(7, y + 8, 4, 1, d);
    } else if (dir === 'left' && front) {
      P.rect(9, y - 1, 4, 10, c); P.rect(9, y - 1, 1, 10, t); P.rect(10, y + 3, 2, 3, sh.accent || l);
    } else if (dir === 'right' && !front) {
      P.rect(12, y - 1, 3, 9, d);
    }
  }

  // ---- composition ---------------------------------------------------------
  function compose(ctx, a, gear, dir, anim, frame) {
    const P = G.painter(ctx);
    if (anim === 'dead') {
      // lying down: draw an 'idle down' sprite rotated -> done by caller; here render side pose flat
      ctx.save(); ctx.translate(16, 30); ctx.rotate(-Math.PI / 2); ctx.translate(-16, -30);
      compose(ctx, a, gear, 'right', 'idle', 0); ctx.restore();
      return;
    }
    const p = pose(anim, frame);
    // shadowless; engine draws shadows.
    const behindFirst = dir === 'up';
    drawCape(P, gear.cape, dir, p, false);
    drawHairBack(P, a, dir, p.bob);
    if (behindFirst) { drawShield(P, gear.offhand, dir, p, false); }
    if (dir === 'right') drawShield(P, gear.offhand, dir, p, false);
    if (dir === 'left' || dir === 'right') {
      // far arm first
      const farSleeve = gear.chest ? U.shade(gear.chest.color, -0.35) : U.shade(a.outfit, -0.35);
      P.rect(dir === 'right' ? 14 : 16, 17 + p.bob - p.armR, 2, 6, farSleeve);
    }
    drawLegs(P, a, gear, dir, p);
    drawTorso(P, a, gear, dir, p);
    if (dir === 'down' || dir === 'up') { drawArm(P, a, gear, dir, p, 'L'); drawArm(P, a, gear, dir, p, 'R'); }
    drawHead(P, a, dir, p.bob, gear);
    drawHairFront(P, a, dir, p.bob, gear);
    drawHelm(P, gear.head, dir, p.bob);
    if (dir === 'left' || dir === 'right') drawArm(P, a, gear, dir, p, 'R');
    drawCape(P, gear.cape, dir, p, true);
    if (dir === 'down' || dir === 'left') drawShield(P, gear.offhand, dir, p, true);
  }

  C.sprite = function (a, gear, dir, anim, frame) {
    gear = gear || {};
    const k = 'chr|' + aKey(a) + '|' + key(gear.head) + key(gear.chest) + key(gear.legs) + key(gear.feet) + key(gear.hands) + key(gear.cape) + key(gear.offhand) + '|' + dir + anim + frame;
    return G.sprite(k, W, H, (ctx) => compose(ctx, a, gear, dir, anim, frame), { outline: true });
  };

  // Where the weapon hand is, relative to the feet anchor, for each facing.
  C.handOffset = function (dir, anim, frame) {
    const p = pose(anim || 'idle', frame || 0);
    if (dir === 'down') return { x: 6, y: -9 + p.bob + p.armR };
    if (dir === 'up') return { x: -6, y: -10 + p.bob };
    if (dir === 'right') return { x: 2, y: -9 + p.bob };
    return { x: -2, y: -9 + p.bob };
  };

  C.draw = function (ctx, x, y, a, gear, dir, anim, frame, opts) {
    const spr = C.sprite(a, gear, dir, anim, frame);
    let img = spr;
    if (opts && opts.flash) img = G.flash(spr, 'chr' + aKey(a) + dir + anim + frame + key((gear || {}).chest) + key((gear || {}).head), opts.flash === true ? '#ffffff' : opts.flash);
    if (opts && opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts && opts.rot) {
      ctx.save(); ctx.translate(Math.round(x), Math.round(y - 10)); ctx.rotate(opts.rot);
      ctx.drawImage(img, -FX0, -FY0 + 10); ctx.restore();
    } else {
      ctx.drawImage(img, Math.round(x - FX0), Math.round(y - FY0));
    }
    if (opts && opts.alpha != null) ctx.globalAlpha = 1;
  };

  // Portrait (head + shoulders) for dialogue boxes/UI, scaled by caller.
  C.portrait = function (a, gear) {
    gear = gear || {};
    const spr = C.sprite(a, gear, 'down', 'idle', 0);
    return G.sprite('portrait|' + aKey(a) + key(gear.head) + key(gear.chest), 24, 22, (ctx) => { ctx.drawImage(spr, -4, -2); });
  };
})(window.RPG);
