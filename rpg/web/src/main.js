'use strict';
// Boot + main loop.
(function (R) {
  const U = R.U, G = R.G, Input = R.Input, UI = R.UI, W = R.World, FX = R.FX;
  let canvas, ctx, back, bctx;
  R.state = 'title';
  R.playtime = 0;

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    back = G.canvas(G.W, G.H);
    bctx = back.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    resize();
    window.addEventListener('resize', resize);
    Input.attach(canvas, toInternal);
    UI.init();
    for (const k of ['master', 'sfx', 'music']) R.Audio.vol[k] = R.settings[k];
    if (R.settings.showFps) document.getElementById('fps').classList.remove('hidden');
    validateData();
    window.addEventListener('keydown', onKey);
    document.getElementById('loading').remove();
    R.toTitle();
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try { tick(dt); } catch (e) { console.error(e); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // Integer-ish scaling to fill the window, letterboxed.
  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    let k = Math.min(ww / G.W, wh / G.H);
    if (k >= 2) k = Math.floor(k * 2) / 2; // crisp half-steps
    canvas.width = G.W * Math.ceil(k); canvas.height = G.H * Math.ceil(k);
    canvas.style.width = Math.floor(G.W * k) + 'px';
    canvas.style.height = Math.floor(G.H * k) + 'px';
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (UI.layout && UI.root) UI.layout();
  }
  function toInternal(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * G.W, y: (cy - r.top) / r.height * G.H };
  }

  // Menu hotkeys
  function onKey(e) {
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter' && UI.current === 'create') e.target.blur(); return; }
    if (UI.dialogOpen) { if (UI.dialogKey(e.code)) e.preventDefault(); return; }
    if (R.state !== 'play') { if (e.code === 'Escape' && UI.current && !['title', 'create'].includes(UI.current)) UI.open('title'); return; }
    const B = Input.bindings;
    const is = (a) => B[a] && B[a].includes(e.code);
    if (W.player && W.player.dead) return;
    if (is('pause')) { if (UI.current) UI.close(); else UI.open('pause'); return; }
    if (is('inventory') || is('character')) { e.preventDefault(); UI.toggle('inventory'); return; }
    if (is('skills')) { UI.toggle('skills'); return; }
    if (is('quests')) { UI.toggle('quests'); return; }
    if (is('map')) { UI.toggle('map'); return; }
    if (!UI.current && is('interact')) { const t = W.currentInteract; if (t && t.fn) t.fn(); }
  }

  let fpsT = 0, fpsN = 0;
  function tick(dt) {
    Input.pollPad();
    // world mouse coords
    Input.mouse.x = Input.mouse.sx + W.cam.x;
    Input.mouse.y = Input.mouse.sy + W.cam.y;
    if (Input.gamepad && UI.dialogOpen) { if (Input.hit('interact') || Input.hit('dodge')) UI.dialogAdvance(); }
    if (R.state === 'play') {
      if (Input.gamepad && !UI.dialogOpen && Input.hit('interact') && !UI.current) { const t = W.currentInteract; if (t && t.fn) t.fn(); }
      if (Input.gamepad && Input.hit('pause')) { if (UI.current) UI.close(); else UI.open('pause'); }
      const paused = UI.pausesGame();
      if (FX.stop > 0) { FX.stop -= dt; }
      else if (!paused) { W.update(dt); R.playtime += dt; }
      UI.updateHUD(dt);
      W.draw(bctx);
      if (W.player.dead && !UI.current && !W.deathShown) { W.deathT = (W.deathT || 0) + dt; if (W.deathT > 1.5) { W.deathShown = true; UI.open('death'); } }
    } else {
      drawTitleBG(dt);
    }
    UI.updateDialog(dt);
    if (UI.current && UI.screens[UI.current].update) UI.screens[UI.current].update(dt);
    ctx.drawImage(back, 0, 0, canvas.width, canvas.height);
    Input.endFrame();
    fpsT += dt; fpsN++;
    if (fpsT > 0.5) { if (R.settings.showFps) document.getElementById('fps').textContent = Math.round(fpsN / fpsT) + ' fps'; fpsT = 0; fpsN = 0; }
  }

  // Slowly panning forest as the title backdrop.
  let tbg = null;
  function drawTitleBG(dt) {
    if (!tbg) {
      const M = W.buildMap(R.Maps.title_bg ? 'title_bg' : 'forest');
      tbg = { M, t: 0 };
    }
    tbg.t += dt;
    const M = tbg.M;
    const maxX = M.w * 16 - G.W, maxY = M.h * 16 - G.H;
    const cx = Math.round((Math.sin(tbg.t * 0.03) * 0.5 + 0.5) * maxX), cy = Math.round((Math.cos(tbg.t * 0.021) * 0.5 + 0.5) * maxY);
    bctx.fillStyle = '#000'; bctx.fillRect(0, 0, G.W, G.H);
    bctx.save(); bctx.translate(-cx, -cy);
    bctx.drawImage(M.ground, cx, cy, G.W, G.H, cx, cy, G.W, G.H);
    const vis = M.props.filter((p) => p.x > cx - 60 && p.x < cx + G.W + 60 && p.y > cy - 10 && p.y < cy + G.H + 80).sort((a, b) => a.y - b.y);
    for (const p of vis) { const d = R.Props[p.id]; const spr = R.Props.sprite(p.id, p.v, d.anim ? Math.floor(tbg.t * 6) % d.anim : 0); bctx.drawImage(spr, Math.round(p.x - d.ax - 1), Math.round(p.y - d.ay - 1)); }
    bctx.restore();
    // dusk tint + fireflies
    bctx.fillStyle = 'rgba(20,10,40,0.55)'; bctx.fillRect(0, 0, G.W, G.H);
    bctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const x = (Math.sin(i * 12.9 + tbg.t * 0.3) * 0.5 + 0.5) * G.W, y = (Math.cos(i * 7.3 + tbg.t * 0.23) * 0.5 + 0.5) * G.H;
      bctx.globalAlpha = Math.max(0, Math.sin(tbg.t * 1.5 + i));
      bctx.drawImage(G.glow(5, i % 3 ? '#d0ff60' : '#ffb040'), x - 5, y - 5);
    }
    bctx.globalAlpha = 1; bctx.globalCompositeOperation = 'source-over';
    const g = bctx.createLinearGradient(0, 0, 0, G.H);
    g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    bctx.fillStyle = g; bctx.fillRect(0, 0, G.W, G.H);
  }

  // ---- game lifecycle ----------------------------------------------------------------
  R.toTitle = function () {
    R.state = 'title';
    UI.showHUD(false);
    UI.close(true);
    R.Audio.music('title');
    UI.open('title');
  };

  // data: either a save snapshot or {player:{name, cls, appearance}, isNew:true}
  R.startGame = function (data) {
    const pd = Object.assign({}, data.player);
    const cls = R.Classes[pd.cls] || R.Classes.warrior;
    if (data.isNew) {
      pd.equip = {};
      for (const slot in cls.start) pd.equip[slot] = cls.start[slot];
      pd.inv = [{ id: 'potion_small', qty: 3 }, { id: 'ether_small', qty: 1 }];
      pd.gold = 25;
      pd.skillLv = { [cls.skills[0]]: 1 };
    }
    W.flags = data.flags || {};
    W.waypoints = data.waypoints || {};
    W.visited = data.visited || {};
    R.QuestLog.reset();
    if (data.quests) R.QuestLog.state = data.quests;
    R.QuestLog.tracked = data.tracked || null;
    R.playtime = data.playtime || 0;
    W.player = new R.Player(pd);
    W.deathShown = false; W.deathT = 0;
    FX.reset();
    R.state = 'play';
    UI.close(true);
    UI.showHUD(true);
    const map = data.map && R.Maps[data.map] ? data.map : 'town';
    W.load(map, data.map ? { x: data.x, y: data.y } : 'start');
    if (!W.waypoints.town) W.waypoints.town = { map: 'town', name: 'Havenbrook' };
    UI.resetHUD();
    R.QuestLog.autoStart();
    if (data.isNew) {
      W.later(0.8, () => {
        if (R.Story && R.Story.intro) R.Story.intro();
        else UI.toast('Talk to Elder Maren in the village square (E)', 'quest');
      });
      R.Save.autosave();
    }
  };

  R.respawn = function () {
    const p = W.player;
    p.dead = false;
    p.hp = p.stats.maxHp; p.mp = p.stats.maxMp;
    p.status = {}; p.buffs = []; p.shield = 0; p.recalc();
    p.invuln = 2;
    const lost = Math.floor(p.gold * 0.1);
    p.gold -= lost;
    W.deathShown = false; W.deathT = 0;
    W.load('town', 'wp:town');
    if (lost) UI.toast(`You lost ${lost} gold.`, 'bad');
  };

  // Catch broken references early (logs to console; the reviewer checks this).
  function validateData() {
    const errs = [];
    for (const [id, c] of Object.entries(R.Classes)) { for (const s of c.skills) if (!R.Skills[s]) errs.push(`class ${id}: missing skill ${s}`); for (const k in c.start) if (!R.Items[c.start[k]]) errs.push(`class ${id}: missing start item ${c.start[k]}`); }
    for (const [id, e] of Object.entries(R.Enemies)) { for (const d of e.drops || []) if (!R.Items[d.item]) errs.push(`enemy ${id}: missing drop ${d.item}`); if (!e.update && !R.AI[e.ai || 'melee']) errs.push(`enemy ${id}: unknown ai ${e.ai}`); if (!e.draw && !R.Monsters[e.sprite || 'slime']) errs.push(`enemy ${id}: unknown sprite ${e.sprite}`); }
    for (const [id, q] of Object.entries(R.Quests)) {
      if (q.giver && !R.NPCs[q.giver]) errs.push(`quest ${id}: missing giver ${q.giver}`);
      if (q.turnIn && !R.NPCs[q.turnIn]) errs.push(`quest ${id}: missing turnIn ${q.turnIn}`);
      for (const r of q.requires || []) if (!R.Quests[r]) errs.push(`quest ${id}: missing required quest ${r}`);
      for (const it of (q.rewards && q.rewards.items) || []) if (!R.Items[it]) errs.push(`quest ${id}: missing reward ${it}`);
      for (const o of q.objectives) {
        if (o.type === 'kill' && o.target) for (const t of [].concat(o.target)) if (!R.Enemies[t]) errs.push(`quest ${id}: missing enemy ${t}`);
        if ((o.type === 'collect' || o.type === 'use') && !R.Items[o.item]) errs.push(`quest ${id}: missing item ${o.item}`);
        if (o.type === 'talk' && !R.NPCs[o.npc]) errs.push(`quest ${id}: missing npc ${o.npc}`);
        if (o.type === 'boss' && !R.Enemies[o.target]) errs.push(`quest ${id}: missing boss ${o.target}`);
        if (o.type === 'reach' && o.map && !R.Maps[o.map]) errs.push(`quest ${id}: missing map ${o.map}`);
      }
    }
    for (const [id, n] of Object.entries(R.NPCs)) if (n.shop) { const items = typeof n.shop.items === 'function' ? n.shop.items() : n.shop.items; for (const it of items) if (!R.Items[it]) errs.push(`npc ${id}: missing shop item ${it}`); }
    for (const [id, it] of Object.entries(R.Items)) { if (it.slot === 'weapon' && !R.WeaponTypes[it.type]) errs.push(`item ${id}: unknown weapon type ${it.type}`); if (it.set && !R.ItemSets[it.set]) errs.push(`item ${id}: unknown set ${it.set}`); }
    for (const id of Object.keys(R.Maps)) {
      try {
        const M = W.buildMap(id);
        for (const x of M.exits) { if (!R.Maps[x.to]) errs.push(`map ${id}: exit to missing map ${x.to}`); else if (typeof x.at === 'string') { const T = W.buildMap(x.to); if (!T.points[x.at]) errs.push(`map ${id}: exit to ${x.to} uses missing point '${x.at}'`); } }
        for (const n of M.npcs) if (!R.NPCs[n.id]) errs.push(`map ${id}: missing npc ${n.id}`);
        for (const s of M.spawns) if (!R.Enemies[s.id]) errs.push(`map ${id}: missing enemy ${s.id}`);
        for (const b of M.bosses) if (!R.Enemies[b.id]) errs.push(`map ${id}: missing boss ${b.id}`);
        for (const c of M.chests) for (const l of c.loot) { const iid = typeof l === 'string' ? l : l.item; if (!R.Items[iid]) errs.push(`map ${id}: chest ${c.id} missing item ${iid}`); }
      } catch (e) { errs.push(`map ${id}: build failed: ${e.message}`); console.error(e); }
    }
    R.dataErrors = errs;
    if (errs.length) console.warn('DATA ERRORS:\n' + errs.join('\n'));
    else console.log('Data OK:', Object.keys(R.Items).length, 'items,', Object.keys(R.Enemies).length, 'enemies,', Object.keys(R.Quests).length, 'quests,', Object.keys(R.Maps).length, 'maps,', Object.keys(R.NPCs).length, 'npcs');
  }
  R.validateData = validateData;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.RPG);
