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

  // Does nothing (dummies, scripted).
  AI.none = function (e) { e.anim = 'idle'; };
})(window.RPG);
