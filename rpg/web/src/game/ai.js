'use strict';
// Enemy AI behaviours. Each is function(e, dt, speedMult) called every frame.
// Enemy defs choose one with `ai: 'melee'` etc., or provide their own `update(e, dt, sm)`.
//
// Common def.attack fields:
//   {range, windup, cd, mult, lunge (px/s dash during strike), radius (aoe), projectile opts, count, spread}
// Useful Enemy helpers: e.moveToward, e.moveAngle, e.hitPlayer(mult), e.shoot(angle, opts), e.telegraph(x,y,r,delay,fn)
(function (R) {
  const U = R.U, FX = R.FX;
  const AI = R.AI = {};

  AI.player = () => R.World.player;
  AI.canSee = function (e, range) {
    const p = R.World.player;
    if (!p || p.dead) return false;
    const d = U.dist(e.x, e.y, p.x, p.y);
    return d < range && R.World.lineOfSight(e.x, e.y - 4, p.x, p.y - 4);
  };

  // Idle / wander / aggro / leash, shared by most behaviours. Returns true if engaged.
  AI.engage = function (e, dt, sm) {
    const p = R.World.player;
    const def = e.def;
    const aggro = def.aggro || 110;
    if (e.state === 'idle' || e.state === 'wander') {
      if (AI.canSee(e, aggro) || (e.lastHit < 0.5)) { e.state = 'chase'; e.alertT = 0.5; FX.text(e.x, e.y - e.height - 10, '!', '#ff4040'); return true; }
      e.stateT -= dt;
      if (e.state === 'wander') {
        const d = e.moveToward(e.wx, e.wy, (def.spd || 40) * 0.4 * sm, dt);
        e.anim = 'walk';
        if (d < 2 || e.stateT <= 0) { e.state = 'idle'; e.stateT = U.rand(1, 3); }
      } else {
        e.anim = 'idle';
        if (e.stateT <= 0 && !def.stationary) { e.state = 'wander'; e.stateT = 3; e.wx = e.home.x + U.rand(-40, 40); e.wy = e.home.y + U.rand(-40, 40); }
      }
      return false;
    }
    // leash
    if (!e.boss && U.dist(e.x, e.y, e.home.x, e.home.y) > (def.leash || 320) && U.dist(p.x, p.y, e.x, e.y) > 80) {
      e.state = 'return';
    }
    if (e.state === 'return') {
      e.anim = 'walk';
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * dt * 0.5);
      if (e.moveToward(e.home.x, e.home.y, (def.spd || 40) * 1.2 * sm, dt) < 4) { e.state = 'idle'; e.stateT = 1; }
      return false;
    }
    if (!p || p.dead) { e.state = 'return'; return false; }
    R.World.combatT = 3;
    return true;
  };

  // Walks up and swings. Wolves/goblins/skeletons.
  AI.melee = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    const range = A.range || e.r + 10;
    e.atkCd -= dt;
    if (e.state === 'windup') {
      e.anim = 'windup';
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = 'strike'; e.stateT = A.strikeT || 0.18; e.anim = 'attack';
        e.hitDone = false;
        e.lungeA = U.angle(e.x, e.y, p.x, p.y);
        R.Audio.play('swing', { pitch: 0.7 });
      }
      return;
    }
    if (e.state === 'strike') {
      e.anim = 'attack';
      e.stateT -= dt;
      if (A.lunge) e.moveAngle(e.lungeA, A.lunge * sm, dt);
      if (!e.hitDone && U.dist(e.x, e.y, p.x, p.y) < range + 6) {
        e.hitDone = true; e.hitPlayer(A.mult || 1, A.status ? { status: A.status } : null);
      }
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = A.recover || 0.4; e.atkCd = A.cd || 1.2; }
      return;
    }
    if (e.state === 'recover') { e.anim = 'idle'; e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; return; }
    // chase
    const d = U.dist(e.x, e.y, p.x, p.y);
    if (d < range && e.atkCd <= 0) {
      e.state = 'windup'; e.stateT = A.windup || 0.4; e.face = p.x > e.x ? 1 : -1;
      return;
    }
    if (d > range * 0.8) {
      // slight strafing so packs spread out
      const a = U.angle(e.x, e.y, p.x, p.y) + Math.sin(e.animT * 2 + e.x) * 0.3;
      e.moveAngle(a, (def.spd || 40) * sm, dt); e.anim = 'walk';
    } else e.anim = 'idle';
  };

  // Keeps distance and fires projectiles. Archers, casters.
  AI.ranged = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    const want = A.keep || 90;
    const d = U.dist(e.x, e.y, p.x, p.y);
    e.atkCd -= dt;
    e.face = p.x > e.x ? 1 : -1;
    if (e.state === 'windup') {
      e.anim = 'windup'; e.stateT -= dt;
      if (e.stateT <= 0) {
        const base = U.angle(e.x, e.y - e.height * 0.5, p.x, p.y - 10);
        const n = A.count || 1;
        for (let i = 0; i < n; i++) {
          const a = base + (n > 1 ? (i - (n - 1) / 2) * (A.spread || 0.25) : 0);
          e.shoot(a, Object.assign({ dmg: e.atk * (A.mult || 1), speed: A.speed || 140, kind: A.kind || 'enemy', color: A.color, size: A.size, status: A.status, homing: A.homing }, A.proj || {}));
        }
        R.Audio.play(A.sound || 'magic', { pitch: 0.8 });
        e.state = 'chase'; e.atkCd = A.cd || 1.8; e.anim = 'attack';
      }
      return;
    }
    if (e.atkCd <= 0 && d < (A.range || 200) && AI.canSee(e, A.range || 200)) {
      e.state = 'windup'; e.stateT = A.windup || 0.5; return;
    }
    let a = U.angle(e.x, e.y, p.x, p.y);
    if (d < want * 0.7) { e.moveAngle(a + Math.PI, (def.spd || 40) * sm, dt); e.anim = 'walk'; }
    else if (d > want * 1.3) { e.moveAngle(a, (def.spd || 40) * sm, dt); e.anim = 'walk'; }
    else { e.moveAngle(a + Math.PI / 2 * (Math.sin(e.animT * 0.8 + e.home.x) > 0 ? 1 : -1), (def.spd || 40) * 0.5 * sm, dt); e.anim = 'walk'; }
  };

  // Fast, jittery flyers (bats, wisps).
  AI.swarm = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) { e.anim = 'walk'; return; }
    const p = R.World.player, def = e.def, A = def.attack || {};
    e.atkCd -= dt; e.anim = 'walk';
    e.z = 6 + Math.sin(e.animT * 6) * 3;
    if (e.state === 'dive') {
      e.stateT -= dt;
      e.moveAngle(e.diveA, (def.spd || 70) * 2.4 * sm, dt);
      if (!e.hitDone && U.dist(e.x, e.y, p.x, p.y) < e.r + 8) { e.hitDone = true; e.hitPlayer(A.mult || 1, A.status ? { status: A.status } : null); }
      if (e.stateT <= 0) { e.state = 'chase'; e.atkCd = A.cd || 1.2; }
      return;
    }
    const d = U.dist(e.x, e.y, p.x, p.y);
    if (d < 60 && e.atkCd <= 0) { e.state = 'dive'; e.stateT = 0.35; e.diveA = U.angle(e.x, e.y, p.x, p.y); e.hitDone = false; return; }
    const a = U.angle(e.x, e.y, p.x, p.y) + Math.sin(e.animT * 3 + e.home.y) * 1.2;
    e.moveAngle(a, (def.spd || 70) * sm, dt);
  };

  // Telegraphs a straight charge. Boars, bulls, knights.
  AI.charger = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    e.atkCd -= dt;
    if (e.state === 'windup') {
      e.anim = 'windup'; e.stateT -= dt;
      if (Math.random() < 0.5) FX.particle({ x: e.x + U.rand(-4, 4), y: e.y, vy: -10, life: 0.3, color: '#c8b090', size: 2 });
      if (e.stateT <= 0) { e.state = 'charge'; e.stateT = A.chargeT || 0.7; e.hitDone = false; R.Audio.play('dodge', { pitch: 0.6 }); }
      return;
    }
    if (e.state === 'charge') {
      e.anim = 'attack'; e.stateT -= dt;
      const moved = e.moveAngle(e.chargeA, (A.speed || 220) * sm, dt);
      if (Math.random() < 0.7) FX.particle({ x: e.x, y: e.y, vx: U.rand(-20, 20), vy: U.rand(-10, 0), life: 0.3, color: '#c8b090', size: 2 });
      if (!e.hitDone && U.dist(e.x, e.y, p.x, p.y) < e.r + 10) { e.hitDone = true; e.hitPlayer(A.mult || 1.4, { knock: 260 }); }
      if (e.stateT <= 0 || !moved) {
        if (!moved) { FX.shake(3, 0.2); e.status.stun = { t: 1, dps: 0, tick: 0 }; FX.burst(e.x, e.y - 8, { n: 10, color: '#c0c0c0', speed: 50 }); }
        e.state = 'recover'; e.stateT = 0.6; e.atkCd = A.cd || 2.5;
      }
      return;
    }
    if (e.state === 'recover') { e.anim = 'idle'; e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; return; }
    const d = U.dist(e.x, e.y, p.x, p.y);
    e.face = p.x > e.x ? 1 : -1;
    if (d < (A.range || 130) && e.atkCd <= 0 && AI.canSee(e, 200)) {
      e.state = 'windup'; e.stateT = A.windup || 0.6; e.chargeA = U.angle(e.x, e.y, p.x, p.y);
      // show the charge lane
      const a = e.chargeA, len = (A.speed || 220) * (A.chargeT || 0.7);
      const sx = e.x, sy = e.y;
      FX.add({ layer: 'ground', life: A.windup || 0.6, draw(ctx, t) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(a); ctx.fillStyle = U.rgba('#ff3030', 0.15 + t * 0.2); ctx.fillRect(0, -e.r, len * t, e.r * 2); ctx.strokeStyle = U.rgba('#ff3030', 0.5); ctx.strokeRect(0, -e.r, len, e.r * 2); ctx.restore(); } });
      return;
    }
    if (d > 30) { e.moveToward(p.x, p.y, (def.spd || 40) * sm, dt); e.anim = 'walk'; } else e.anim = 'idle';
  };

  // Hops toward the player (slimes, frogs). Small aoe on landing if attack.radius.
  AI.hopper = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    e.stateT -= dt;
    if (e.state !== 'hop') {
      e.anim = 'idle';
      if (e.stateT <= 0) { e.state = 'hop'; e.hopT = 0; e.hopA = U.angle(e.x, e.y, p.x, p.y) + U.rand(-0.3, 0.3); e.anim = 'windup'; }
      return;
    }
    e.hopT += dt;
    const dur = A.hopT || 0.5;
    if (e.hopT < 0.15) { e.anim = 'windup'; return; }
    e.anim = 'attack';
    const t = (e.hopT - 0.15) / dur;
    e.z = Math.sin(Math.min(1, t) * Math.PI) * (A.height || 10);
    e.moveAngle(e.hopA, (def.spd || 50) * 1.6 * sm, dt);
    if (t >= 1) {
      e.z = 0; e.state = 'chase'; e.stateT = A.cd || U.rand(0.4, 1.0);
      FX.burst(e.x, e.y, { n: 5, color: (def.pal && def.pal.main) || '#60d060', speed: 30, life: 0.3 });
      if (A.radius) { FX.ring(e.x, e.y, 2, A.radius, (def.pal && def.pal.main) || '#60d060', 0.3); R.Combat.hitCircle(e.x, e.y, A.radius, 'enemy', () => e.hitPlayer(A.mult || 1)); }
      else if (U.dist(e.x, e.y, p.x, p.y) < e.r + 8) e.hitPlayer(A.mult || 1, A.status ? { status: A.status } : null);
    }
  };

  // Stationary turret (totems, plants). Fires patterns.
  AI.turret = function (e, dt, sm) {
    const p = R.World.player, A = e.def.attack || {};
    e.anim = 'idle';
    if (!AI.canSee(e, e.def.aggro || 160)) return;
    R.World.combatT = 3;
    e.atkCd -= dt;
    if (e.atkCd <= 0) {
      e.atkCd = A.cd || 2;
      e.anim = 'attack';
      const n = A.count || 8;
      const base = A.aimed ? U.angle(e.x, e.y, p.x, p.y) : e.animT;
      for (let i = 0; i < n; i++) e.shoot(base + (A.aimed ? (i - (n - 1) / 2) * (A.spread || 0.2) : (i / n) * U.TAU), { dmg: e.atk * (A.mult || 1), speed: A.speed || 90, color: A.color, kind: A.kind || 'enemy' });
      R.Audio.play('magic', { pitch: 0.6 });
    }
  };

  // Teleports around and casts telegraphed AOE under the player.
  AI.caster = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    e.atkCd -= dt;
    e.face = p.x > e.x ? 1 : -1;
    if (e.state === 'cast') {
      e.anim = 'windup'; e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'chase'; e.anim = 'idle'; }
      return;
    }
    const d = U.dist(e.x, e.y, p.x, p.y);
    if (e.atkCd <= 0 && d < (A.range || 180)) {
      e.state = 'cast'; e.stateT = 0.6; e.atkCd = A.cd || 3;
      const col = A.color || '#b070ff';
      const tx = p.x + p.vx * 0.3, ty = p.y + p.vy * 0.3;
      e.telegraph(tx, ty, A.radius || 26, A.delay || 0.9, () => {
        FX.burst(tx, ty, { n: 25, color: col, colors: [col, '#ffffff'], speed: 70, life: 0.5, glow: true, up: 40 });
        FX.pillar(tx, ty, col, 0.4, (A.radius || 26));
        R.Audio.play('zap', { pitch: 0.7 });
        R.Combat.hitCircle(tx, ty, A.radius || 26, 'enemy', () => e.hitPlayer(A.mult || 1.3, A.status ? { status: A.status } : null));
      }, col);
      return;
    }
    if (e.mem.blinkCd == null) e.mem.blinkCd = 3;
    e.mem.blinkCd -= dt;
    if (d < 50 && e.mem.blinkCd <= 0) {
      // blink away
      e.mem.blinkCd = 4;
      FX.burst(e.x, e.y - 10, { n: 16, color: A.color || '#b070ff', speed: 60, glow: true });
      for (let i = 0; i < 8; i++) {
        const a = U.rand(0, U.TAU), nx = e.x + Math.cos(a) * 90, ny = e.y + Math.sin(a) * 90;
        if (!R.World.solidAt(nx, ny)) { e.x = nx; e.y = ny; break; }
      }
      FX.burst(e.x, e.y - 10, { n: 16, color: A.color || '#b070ff', speed: 60, glow: true });
      return;
    }
    if (d > 120) { e.moveToward(p.x, p.y, (def.spd || 35) * sm, dt); e.anim = 'walk'; }
    else e.anim = 'idle';
  };

  // Explodes next to you.
  AI.bomber = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, A = e.def.attack || {};
    if (e.state === 'fuse') {
      e.stateT -= dt; e.anim = 'windup';
      e.flash = Math.floor(e.stateT * 12) % 2 ? 0.05 : 0; e.flashColor = '#ff4020';
      if (e.stateT <= 0) { R.Combat.explode(e.x, e.y, A.radius || 34, e.atk * (A.mult || 2), 'enemy', { color: '#ff8030', source: e }); e.die(); }
      return;
    }
    const d = e.moveToward(p.x, p.y, (e.def.spd || 60) * sm, dt); e.anim = 'walk';
    if (d < 24) { e.state = 'fuse'; e.stateT = A.fuse || 0.8; e.telegraph(e.x, e.y, A.radius || 34, A.fuse || 0.8, () => {}, '#ff6020'); }
  };


  // ---- Bestiary extras ------------------------------------------------------------

  // Crouches (telegraphed landing circle) then leaps onto the player's position. Ghouls, spiders.
  AI.leaper = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    e.atkCd -= dt;
    if (e.state === 'windup') {
      e.anim = 'windup'; e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'leap'; e.stateT = 0; e.hitDone = false; }
      return;
    }
    if (e.state === 'leap') {
      e.stateT += dt; e.anim = 'attack';
      const T = A.leapT || 0.45, k = Math.min(1, e.stateT / T);
      const nx = U.lerp(e.mem.sx, e.mem.tx, k), ny = U.lerp(e.mem.sy, e.mem.ty, k);
      R.World.moveEntity(e, nx - e.x, ny - e.y);
      e.z = Math.sin(k * Math.PI) * (A.height || 16);
      if (k >= 1) {
        e.z = 0; e.state = 'recover'; e.stateT = A.recover || 0.5; e.atkCd = A.cd || 2;
        FX.burst(e.x, e.y, { n: 8, color: '#a09080', speed: 40, life: 0.3 });
        if (U.dist(e.x, e.y, p.x, p.y) < (A.radius || 16) + p.r) e.hitPlayer(A.mult || 1.2, A.status ? { status: A.status } : null);
      }
      return;
    }
    if (e.state === 'recover') { e.anim = 'idle'; e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; return; }
    const d = U.dist(e.x, e.y, p.x, p.y);
    e.face = p.x > e.x ? 1 : -1;
    if (d < (A.range || 90) && d > 20 && e.atkCd <= 0 && AI.canSee(e, 160)) {
      e.state = 'windup'; e.stateT = A.windup || 0.5;
      e.mem.sx = e.x; e.mem.sy = e.y; e.mem.tx = p.x; e.mem.ty = p.y;
      e.telegraph(p.x, p.y, A.radius || 16, (A.windup || 0.5) + (A.leapT || 0.45), () => {}, A.color || '#ff3030');
      return;
    }
    if (d < 20 && e.atkCd <= 0) { e.hitPlayer(0.7); e.atkCd = 1; }
    e.moveAngle(U.angle(e.x, e.y, p.x, p.y) + Math.sin(e.animT * 2 + e.home.x) * 0.5, (def.spd || 50) * sm, dt); e.anim = 'walk';
  };

  // Floats through walls, fades in and out, lunges with claws or fires slow bolts. Wraiths.
  AI.ghost = function (e, dt, sm) {
    const W = R.World;
    if (!AI.engage(e, dt, sm)) { e.alpha = 0.7; return; }
    const p = W.player, def = e.def, A = def.attack || {};
    e.atkCd -= dt;
    e.z = 4 + Math.sin(e.animT * 3) * 2;
    e.alpha = 0.55 + Math.sin(e.animT * 2) * 0.25;
    const d = U.dist(e.x, e.y, p.x, p.y);
    e.face = p.x > e.x ? 1 : -1;
    if (e.state === 'windup') {
      e.anim = 'windup'; e.alpha = 1; e.stateT -= dt;
      if (e.stateT <= 0) {
        if (A.bolt && d > 40) {
          const a = U.angle(e.x, e.y, p.x, p.y);
          for (let i = -1; i <= 1; i++) e.shoot(a + i * 0.2, { speed: A.speed || 100, color: A.color || '#80ffff', dmg: e.atk * (A.mult || 0.9), status: A.status, size: 3 });
          R.Audio.play('magic', { pitch: 0.6 });
          e.state = 'chase'; e.atkCd = A.cd || 2.2;
        } else { e.state = 'strike'; e.stateT = 0.25; e.hitDone = false; e.lungeA = U.angle(e.x, e.y, p.x, p.y); R.Audio.play('swing', { pitch: 0.5 }); }
      }
      return;
    }
    if (e.state === 'strike') {
      e.anim = 'attack'; e.alpha = 1; e.stateT -= dt;
      e.x += Math.cos(e.lungeA) * 180 * sm * dt; e.y += Math.sin(e.lungeA) * 180 * sm * dt;
      if (!e.hitDone && U.dist(e.x, e.y, p.x, p.y) < e.r + 12) { e.hitDone = true; e.hitPlayer(A.mult || 1.1, A.status ? { status: A.status } : null); }
      if (e.stateT <= 0) { e.state = 'chase'; e.atkCd = A.cd || 2; }
      return;
    }
    if (e.atkCd <= 0 && d < (A.bolt ? 150 : 50)) { e.state = 'windup'; e.stateT = A.windup || 0.55; return; }
    // drift straight at the player, ignoring walls (stays inside the map)
    const a = U.angle(e.x, e.y, p.x, p.y) + Math.sin(e.animT * 1.5) * 0.6;
    const sp = (def.spd || 45) * sm * (d > 40 ? 1 : 0.3);
    const mw = W.map.w * 16 - 8, mh = W.map.h * 16 - 8;
    e.x = U.clamp(e.x + Math.cos(a) * sp * dt, 8, mw); e.y = U.clamp(e.y + Math.sin(a) * sp * dt, 8, mh);
    e.anim = 'walk';
  };

  // Hides underground (untargetable), tunnels under the player and bursts out. Sand worms.
  AI.burrower = function (e, dt, sm) {
    const p = R.World.player, def = e.def, A = def.attack || {};
    if (e.state === 'idle' || e.state === 'wander') { e.anim = 'hidden'; e.untargetable = true; }
    if (!AI.engage(e, dt, sm)) { e.anim = 'hidden'; e.untargetable = true; return; }
    const m = e.mem;
    if (!m.bs) { m.bs = 'under'; m.t = 1; }
    m.t -= dt;
    if (m.bs === 'under') {
      e.untargetable = true; e.anim = 'hidden';
      e.moveToward(p.x, p.y, (def.spd || 60) * 1.4 * sm, dt);
      if (Math.random() < 0.3) FX.particle({ x: e.x + U.rand(-6, 6), y: e.y, vy: -15, life: 0.4, color: '#c8a870', size: 2 });
      if (m.t <= 0 && U.dist(e.x, e.y, p.x, p.y) < 30) {
        m.bs = 'rise'; m.t = A.windup || 0.8;
        e.telegraph(e.x, e.y, A.radius || 26, m.t, () => {}, '#ff8030');
      }
    } else if (m.bs === 'rise') {
      e.anim = 'hidden'; e.frame = Math.floor(e.animT * 16) % 2;
      if (m.t <= 0) {
        m.bs = 'up'; m.t = A.upT || 2.6; e.untargetable = false; m.shot = 0.8;
        FX.burst(e.x, e.y - 6, { n: 24, colors: ['#d8b878', '#b09058', '#f0d8a0'], speed: 90, life: 0.6, grav: 200, vz: 80, size: [1, 3] });
        FX.shake(3, 0.2); R.Audio.play('explode', { pitch: 1.4 });
        R.Combat.hitCircle(e.x, e.y, A.radius || 26, 'enemy', () => e.hitPlayer(A.mult || 1.5, { knock: 200 }));
      }
    } else if (m.bs === 'up') {
      e.face = p.x > e.x ? 1 : -1;
      m.shot -= dt;
      e.anim = m.shot < 0.35 && m.shot > 0 ? 'windup' : 'idle';
      if (m.shot <= 0) {
        m.shot = 1.1; e.anim = 'attack';
        const a = U.angle(e.x, e.y, p.x, p.y), n = A.count || 3;
        for (let i = 0; i < n; i++) e.shoot(a + (i - (n - 1) / 2) * 0.25, { speed: 120, color: A.color || '#d0c060', dmg: e.atk * 0.7, status: A.status, z: 24 });
        R.Audio.play('magic', { pitch: 0.4 });
      }
      if (m.t <= 0) { m.bs = 'down'; m.t = 0.4; }
    } else if (m.bs === 'down') {
      e.anim = 'emerge'; e.frame = 0;
      if (m.t <= 0) { m.bs = 'under'; m.t = 1.5; e.untargetable = true; FX.burst(e.x, e.y, { n: 12, color: '#c8a870', speed: 50, life: 0.4 }); }
    }
  };

  // Keeps distance, fires bolts and raises minions. Necromancers, bone mages, priests, shamans (heal).
  AI.summoner = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    const m = e.mem;
    m.sumCd = (m.sumCd == null ? 2 : m.sumCd) - dt;
    m.healCd = (m.healCd == null ? 3 : m.healCd) - dt;
    if (e.state === 'cast') {
      e.anim = 'cast'; e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = 'chase';
        if (m.castKind === 'summon') {
          const n = A.summonCount || 2;
          m.minions = (m.minions || []).filter((x) => !x.dead);
          for (let i = 0; i < n; i++) {
            const a = U.rand(0, U.TAU), x = e.x + Math.cos(a) * 24, y = e.y + Math.sin(a) * 16;
            if (R.World.collides(x, y, 6)) continue;
            const mn = R.World.spawnEnemy(A.summon, x, y, Math.max(1, e.level - 1));
            if (mn) { mn.state = 'chase'; mn.home = { x, y }; m.minions.push(mn); mn.noLoot = true; FX.burst(x, y - 6, { n: 14, color: A.color || '#b070ff', speed: 50, glow: true, up: 20 }); }
          }
          R.Audio.play('portal', { pitch: 0.6 });
        } else if (m.castKind === 'heal') {
          R.Combat.hitCircle(e.x, e.y, 90, 'player', (ally) => { if (ally.hp < ally.maxHp) { R.Combat.heal(ally, ally.maxHp * 0.25); FX.pillar(ally.x, ally.y, '#60ff80', 0.5, 12); } });
          R.Audio.play('heal', { pitch: 0.8 });
        }
      }
      return;
    }
    if (e.state === 'windup') {
      e.anim = 'windup'; e.stateT -= dt;
      if (e.stateT <= 0) {
        const a = U.angle(e.x, e.y - 10, p.x, p.y - 8), n = A.count || 1;
        for (let i = 0; i < n; i++) e.shoot(a + (i - (n - 1) / 2) * (A.spread || 0.25), { speed: A.speed || 130, color: A.color || '#b070ff', dmg: e.atk * (A.mult || 1), status: A.status, homing: A.homing, kind: 'bolt_magic' });
        R.Audio.play('magic', { pitch: 0.7 }); e.state = 'chase'; e.atkCd = A.cd || 2; e.anim = 'attack';
      }
      return;
    }
    e.atkCd -= dt;
    e.face = p.x > e.x ? 1 : -1;
    // heal hurt allies
    if (A.heal && m.healCd <= 0) {
      let hurt = false;
      R.Combat.hitCircle(e.x, e.y, 90, 'player', (ally) => { if (ally !== e && ally.hp < ally.maxHp * 0.7) hurt = true; });
      if (hurt || e.hp < e.maxHp * 0.5) { m.healCd = A.healCd || 6; m.castKind = 'heal'; e.state = 'cast'; e.stateT = 0.8; FX.ring(e.x, e.y, 4, 30, '#60ff80', 0.8); return; }
    }
    if (A.summon && m.sumCd <= 0 && (m.minions || []).filter((x) => !x.dead).length < (A.maxMinions || 3)) {
      m.sumCd = A.summonCd || 8; m.castKind = 'summon'; e.state = 'cast'; e.stateT = 1.0;
      FX.ring(e.x, e.y, 4, 34, A.color || '#b070ff', 1.0);
      return;
    }
    const d = U.dist(e.x, e.y, p.x, p.y);
    if (e.atkCd <= 0 && d < (A.range || 180) && AI.canSee(e, A.range || 180)) { e.state = 'windup'; e.stateT = A.windup || 0.6; return; }
    const want = A.keep || 110;
    const a = U.angle(e.x, e.y, p.x, p.y);
    if (d < want * 0.7) { e.moveAngle(a + Math.PI, (def.spd || 35) * sm, dt); e.anim = 'walk'; }
    else if (d > want * 1.3) { e.moveAngle(a, (def.spd || 35) * sm, dt); e.anim = 'walk'; }
    else e.anim = 'idle';
  };

  // Heavy bruiser: telegraphed ground slam (aoe circle in front) and optional rock/snowball throw. Yetis, golems.
  AI.brute = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    e.atkCd -= dt;
    if (e.state === 'windup') { e.anim = e.mem.kind === 'throw' ? 'cast' : 'windup'; e.stateT -= dt; if (e.stateT <= 0) { e.state = 'recover'; e.stateT = A.recover || 0.7; e.anim = 'attack'; } return; }
    if (e.state === 'recover') { e.anim = 'attack'; e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; return; }
    const d = U.dist(e.x, e.y, p.x, p.y);
    e.face = p.x > e.x ? 1 : -1;
    const R0 = A.radius || 30;
    if (e.atkCd <= 0 && d < R0 + 22) {
      const wt = A.windup || 0.8;
      const tx = e.x + e.face * 16, ty = e.y;
      e.state = 'windup'; e.stateT = wt; e.mem.kind = 'slam'; e.atkCd = A.cd || 2.4;
      e.telegraph(tx, ty, R0, wt, () => {
        if (e.dead) return;
        FX.shake(4, 0.25); FX.ring(tx, ty, 4, R0, A.color || '#e0e0e0', 0.4, 4);
        FX.burst(tx, ty, { n: 20, colors: [A.color || '#c0c0c0', '#ffffff'], speed: 90, life: 0.5, grav: 200, vz: 60 });
        R.Audio.play('explode', { pitch: 0.8 });
        R.Combat.hitCircle(tx, ty, R0, 'enemy', () => e.hitPlayer(A.mult || 1.5, { knock: 240, status: A.status }));
        if (A.pool) R.BossKit && R.BossKit.pool(tx, ty, A.pool.r || 20, A.pool.dur || 4, A.pool.color || '#ff6020', e.atk * (A.pool.mult || 0.3), A.pool.status);
      }, A.color);
      return;
    }
    if (A.throw && e.atkCd <= 0 && d > 60 && d < 180 && AI.canSee(e, 180)) {
      e.state = 'windup'; e.stateT = 0.7; e.mem.kind = 'throw'; e.atkCd = (A.cd || 2.4) + 0.6;
      const tx = p.x, ty = p.y;
      e.telegraph(tx, ty, 18, 1.3, () => {
        if (e.dead) return;
        FX.burst(tx, ty, { n: 16, colors: [A.throwColor || '#f0f8ff', '#ffffff'], speed: 70, life: 0.4 }); R.Audio.play('hit', { pitch: 0.6 });
        R.Combat.hitCircle(tx, ty, 18, 'enemy', () => e.hitPlayer(A.mult || 1.2, { status: A.status }));
      }, A.throwColor || '#80c0ff');
      const sx = e.x, sy = e.y;
      FX.add({ life: 1.3, layer: 'top', draw(ctx, t) { if (t < 0.45) return; const k = (t - 0.45) / 0.55; const x = U.lerp(sx, tx, k), y = U.lerp(sy - 40, ty, k) - Math.sin(k * Math.PI) * 40; ctx.fillStyle = A.throwColor || '#f0f8ff'; ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6); ctx.fillStyle = '#140c1c'; ctx.fillRect(Math.round(x - 3), Math.round(y + 3), 6, 1); } });
      return;
    }
    if (d > 26) { e.moveToward(p.x, p.y, (def.spd || 30) * sm, dt); e.anim = 'walk'; } else e.anim = 'idle';
  };

  // Spins with a weapon when close (telegraphed ring), otherwise melee. Tomb guardians.
  AI.spinner = function (e, dt, sm) {
    if (!AI.engage(e, dt, sm)) return;
    const p = R.World.player, def = e.def, A = def.attack || {};
    e.atkCd -= dt;
    if (e.state === 'windup') { e.anim = 'windup'; e.stateT -= dt; if (e.stateT <= 0) { e.state = 'spin'; e.stateT = A.spinT || 1.6; e.mem.tick = 0; } return; }
    if (e.state === 'spin') {
      e.anim = 'spin'; e.stateT -= dt; e.mem.tick -= dt;
      e.moveToward(p.x, p.y, (def.spd || 40) * 0.8 * sm, dt);
      if (e.mem.tick <= 0) { e.mem.tick = 0.35; R.Audio.play('swing', { pitch: 0.6 }); FX.ring(e.x, e.y, 6, A.radius || 30, '#d0d8e0', 0.25, 2); R.Combat.hitCircle(e.x, e.y, A.radius || 30, 'enemy', () => e.hitPlayer(A.mult || 0.6)); }
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.9; e.atkCd = A.cd || 3.5; }
      return;
    }
    if (e.state === 'recover') { e.anim = 'idle'; e.stateT -= dt; if (e.stateT <= 0) e.state = 'chase'; return; }
    const d = U.dist(e.x, e.y, p.x, p.y);
    if (e.atkCd <= 0 && d < 60) { e.state = 'windup'; e.stateT = A.windup || 0.7; e.telegraph(e.x, e.y, A.radius || 30, A.windup || 0.7, () => {}, '#ffb030'); return; }
    AI.melee(e, dt, sm);
  };

  // Does nothing (dummies, scripted).
  AI.none = function (e) { e.anim = 'idle'; };
})(window.RPG);
