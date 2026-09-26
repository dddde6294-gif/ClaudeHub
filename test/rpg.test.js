'use strict';

// Structural checks for Emberfall (rpg/): every script the page loads exists and
// parses, and the Electron entry points are in place. The game itself runs in a
// browser, so deeper checks live in the in-game data validator (RPG.validateData).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'rpg');
const web = path.join(root, 'web');

test('rpg: every script in index.html exists and parses', () => {
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.ok(srcs.length > 20, 'expected the game scripts to be listed');
  assert.strictEqual(new Set(srcs).size, srcs.length, 'a script is listed twice');
  for (const src of srcs) {
    const file = path.join(web, src);
    assert.ok(fs.existsSync(file), `missing ${src}`);
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, 'utf8'), { filename: src }), `syntax error in ${src}`);
  }
  assert.ok(srcs[srcs.length - 1].endsWith('main.js'), 'main.js must load last');
});

test('rpg: no script is left out of index.html', () => {
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(path.join(web, 'src')).filter((f) => f.endsWith('.js'))) {
    const rel = path.relative(web, f).split(path.sep).join('/');
    assert.ok(html.includes(`src="${rel}"`), `${rel} is not loaded by index.html`);
  }
});

test('rpg: electron entry points exist', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const f of [pkg.main, 'preload.js', 'web/index.html', 'web/styles.css']) assert.ok(fs.existsSync(path.join(root, f)), `missing rpg/${f}`);
  assert.ok(pkg.devDependencies.electron, 'electron should be a dev dependency');
});
