'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const core = require('../donut/core');
const { createClient } = require('../donut/api');
const { poll, snapshot, emptyHistory, readHistory, priceNear } = require('../donut/tracker');
const { build, siteUrl } = require('../donut/build');
const hub = require('../donut/hub');
const { tmpdir } = require('./helpers');

const T0 = Date.parse('2026-09-25T12:00:00Z');
const KEY = 'test-key-5f2c9e';

function listing(price, o = {}) {
  return {
    item: { id: o.id || 'minecraft:diamond_pickaxe', count: 1, display_name: o.name || 'Diamond Pickaxe', lore: [], enchants: { enchantments: { levels: o.enchants || {} } } },
    price,
    seller: { name: o.seller || 'Steve', uuid: 'u' },
    time_left: o.left == null ? 3600 : o.left,
  };
}

function sale(t, price, o = {}) {
  return { ...listing(price, o), unixMillisDateSold: t };
}

// A stand-in for the DonutSMP API that records what it was asked.
function fakeApi(handler) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const call = { method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null };
      calls.push(call);
      const [status, json] = handler(call);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, calls, base: `http://127.0.0.1:${server.address().port}` })));
}

// A client double for the tracker: pages of auction results per search, pages of sales.
function fakeClient({ auctions = {}, sales = [], fail = null } = {}) {
  const calls = [];
  return {
    calls,
    hasKey: true,
    async auctions(page, { search, sort }) {
      calls.push(['auctions', page, search, sort]);
      if (fail) throw fail;
      const pages = auctions[search];
      if (pages instanceof Error) throw pages;
      return (pages && pages[page - 1]) || [];
    },
    async transactions(page) {
      calls.push(['transactions', page]);
      return sales[page - 1] || [];
    },
  };
}

test('formats and reads money the way DonutSMP writes it', () => {
  const f = core.formatMoney;
  assert.strictEqual(f(950), '$950');
  assert.strictEqual(f(12.5), '$12.5');
  assert.strictEqual(f(1000), '$1K');
  assert.strictEqual(f(1250), '$1.25K');
  assert.strictEqual(f(12500), '$12.5K');
  assert.strictEqual(f(999999), '$1M');
  assert.strictEqual(f(3456789), '$3.46M');
  assert.strictEqual(f(2e9), '$2B');
  assert.strictEqual(f(NaN), '—');
  assert.strictEqual(core.formatExact(1234567.5), '$1,234,567.5');

  const p = core.parseMoney;
  assert.strictEqual(p('150'), 150);
  assert.strictEqual(p(' $1,200 '), 1200);
  assert.strictEqual(p('1.5k'), 1500);
  assert.strictEqual(p('2.3 M'), 2300000);
  assert.strictEqual(p('.5K'), 500);
  assert.ok(Number.isNaN(p('abc')));
  assert.ok(Number.isNaN(p('')));
  assert.ok(Number.isNaN(p('1.2.3')));
});

test('names items, enchantments and durations for the HUD', () => {
  assert.strictEqual(core.itemKey('minecraft:diamond_pickaxe'), 'diamond_pickaxe');
  assert.strictEqual(core.itemKey('DIAMOND_PICKAXE'), 'diamond_pickaxe');
  assert.strictEqual(core.itemKey('Diamond Pickaxe'), 'diamond_pickaxe');
  assert.strictEqual(core.cleanText('§b§lFast §rPick'), 'Fast Pick');
  assert.strictEqual(core.enchantList([['efficiency', 5], ['mending', 1], ['silk_touch', 1], ['unbreaking', 3]]), 'Efficiency V, Mending, Silk Touch, Unbreaking III');
  assert.strictEqual(core.enchantName('minecraft:sharpness', 4), 'Sharpness IV');
  assert.strictEqual(core.formatDuration(90 * 60e3), '1h 30m');
  assert.strictEqual(core.formatDuration(27 * 3600e3), '1d 3h');
  assert.strictEqual(core.formatDuration(20e3), '<1m');
  assert.strictEqual(core.timeAgo(10e3), 'just now');
  assert.strictEqual(core.timeAgo(50e3), '1m ago');
  assert.strictEqual(core.timeAgo(3 * 3600e3 + 5), '3h ago');
});

test('API client sends the search as a JSON body on GET, with the key as a Bearer token', async (t) => {
  const api = await fakeApi(() => [200, { status: 200, result: [listing(900)] }]);
  t.after(() => api.server.close());
  const client = createClient({ key: KEY, base: api.base });
  const result = await client.auctions(1, { search: 'diamond pickaxe', sort: 'lowest_price' });
  assert.strictEqual(result.length, 1);
  assert.deepStrictEqual(api.calls[0], { method: 'GET', url: '/v1/auction/list/1', auth: `Bearer ${KEY}`, body: { search: 'diamond pickaxe', sort: 'lowest_price' } });
  await client.transactions(3);
  assert.strictEqual(api.calls[1].url, '/v1/auction/transactions/3');
  assert.strictEqual(api.calls[1].body, null);
});

test('API client falls back to the bare key once, and reports refused keys', async (t) => {
  const api = await fakeApi((c) => (c.auth === KEY ? [200, { status: 200, result: [] }] : [401, { status: 401, reason: 'Unauthorized' }]));
  t.after(() => api.server.close());
  // A pasted "Bearer …" prefix is ignored.
  const client = createClient({ key: `Bearer ${KEY}`, base: api.base });
  assert.deepStrictEqual(await client.auctions(1, {}), []);
  assert.deepStrictEqual(await client.transactions(1), []);
  assert.deepStrictEqual(api.calls.map((c) => c.auth), [`Bearer ${KEY}`, KEY, KEY]);

  const refused = createClient({ key: 'nope', base: api.base });
  await assert.rejects(refused.auctions(1, {}), { code: 'bad_key' });
  await assert.rejects(createClient({ key: '', base: api.base }).auctions(1, {}), { code: 'no_key' });
});

test('API client turns server errors into readable messages', async (t) => {
  let status = 429;
  const api = await fakeApi(() => [status, { status, reason: 'Error handling request', message: 'Could not handle your request.' }]);
  t.after(() => api.server.close());
  const client = createClient({ key: KEY, base: api.base });
  await assert.rejects(client.auctions(1, {}), { code: 'rate_limited' });
  status = 500;
  await assert.rejects(client.auctions(1, {}), (e) => e.code === 'api_error' && /500: Could not handle your request/.test(e.message));
  await assert.rejects(createClient({ key: KEY, base: 'http://127.0.0.1:9' }).auctions(1, {}), { code: 'network' });
});

test('poll keeps the cheapest diamond pickaxes and ignores other items', async () => {
  const client = fakeClient({
    auctions: {
      'diamond pickaxe': [[
        listing(700, { id: 'minecraft:netherite_pickaxe' }),
        listing(900, { seller: '§aAlex', enchants: { 'minecraft:efficiency': 5, 'minecraft:unbreaking': 3 }, left: 7200 }),
        listing(950, { name: '§oLucky Pick' }),
        listing(1200),
      ]],
    },
  });
  const r = await poll(client, emptyHistory(), { now: T0, sales: false });
  assert.strictEqual(r.status, 'ok');
  const last = r.history.last;
  assert.strictEqual(last.lowest.price, 900);
  assert.strictEqual(last.lowest.seller, 'Alex');
  assert.deepStrictEqual(last.lowest.enchants, [['efficiency', 5], ['unbreaking', 3]]);
  // time_left in seconds on this page (nothing above a week's worth)
  assert.strictEqual(last.lowest.endsAt, T0 + 7200e3);
  assert.deepStrictEqual(last.cheapest.map((l) => l.price), [900, 950, 1200]);
  assert.strictEqual(last.cheapest[1].name, 'Lucky Pick');
  assert.deepStrictEqual(r.history.points, [[T0, 900]]);
  assert.deepStrictEqual(r.history.low, { price: 900, t: T0 });
  assert.strictEqual(r.history.search, 'diamond pickaxe');
  // Page 1 already had pickaxes in price order, so it stops there.
  assert.deepStrictEqual(client.calls, [['auctions', 1, 'diamond pickaxe', 'lowest_price']]);
});

test('poll reads time_left as milliseconds when the numbers are that big', async () => {
  const client = fakeClient({ auctions: { 'diamond pickaxe': [[listing(900, { left: 86400e3 }), listing(950, { left: 5 * 60e3 })]] } });
  const r = await poll(client, emptyHistory(), { now: T0, sales: false });
  assert.deepStrictEqual(r.history.last.cheapest.map((l) => l.endsAt - T0), [86400e3, 5 * 60e3]);
});

test('poll tries the other search spelling and keeps whichever works', async () => {
  const client = fakeClient({ auctions: { 'diamond pickaxe': Object.assign(new Error('500'), { code: 'api_error' }), diamond_pickaxe: [[listing(1100)]] } });
  const logs = [];
  const r = await poll(client, emptyHistory(), { now: T0, sales: false, log: (m) => logs.push(m) });
  assert.strictEqual(r.status, 'ok');
  assert.strictEqual(r.history.last.lowest.price, 1100);
  assert.strictEqual(r.history.search, 'diamond_pickaxe');

  // Next time it starts with the spelling that worked.
  const again = fakeClient({ auctions: { diamond_pickaxe: [[listing(1000)]] } });
  await poll(again, r.history, { now: T0 + 300e3, sales: false });
  assert.deepStrictEqual(again.calls[0], ['auctions', 1, 'diamond_pickaxe', 'lowest_price']);
});

test('poll records "none listed" as a gap and keeps the last good listing through errors', async () => {
  const empty = await poll(fakeClient({ auctions: { 'diamond pickaxe': [[listing(5, { id: 'minecraft:dirt' })]] } }), emptyHistory(), { now: T0, sales: false });
  assert.strictEqual(empty.status, 'ok');
  assert.strictEqual(empty.history.last.lowest, null);
  assert.deepStrictEqual(empty.history.points, [[T0, null]]);

  const good = await poll(fakeClient({ auctions: { 'diamond pickaxe': [[listing(800)]] } }), emptyHistory(), { now: T0, sales: false });
  const down = await poll(fakeClient({ fail: Object.assign(new Error('DonutSMP is down'), { code: 'network' }) }), good.history, { now: T0 + 300e3 });
  assert.strictEqual(down.status, 'network');
  assert.strictEqual(down.message, 'DonutSMP is down');
  assert.strictEqual(down.history.last.lowest.price, 800);
  assert.strictEqual(down.history.lastOkAt, T0);
  assert.strictEqual(down.history.points.length, 1);

  const noKey = await poll({ hasKey: false }, good.history, { now: T0 + 600e3 });
  assert.strictEqual(noKey.status, 'no_key');
  assert.strictEqual(noKey.history.last.lowest.price, 800);
});

test('poll collects new pickaxe sales once and stops paging when caught up', async () => {
  const page1 = [sale(T0 - 1000, 1000), sale(T0 - 2000, 50, { id: 'minecraft:stone' }), sale(T0 - 3000, 1500, { enchants: { mending: 1 } })];
  const page2 = [sale(T0 - 90e3, 1200), sale(T0 - 100e3, 999)];
  const client = fakeClient({ auctions: { 'diamond pickaxe': [[listing(900)]] }, sales: [page1, page2] });
  const first = await poll(client, emptyHistory(), { now: T0 });
  assert.strictEqual(first.newSales, 4);
  assert.deepStrictEqual(first.history.sales, [[T0 - 100e3, 999], [T0 - 90e3, 1200], [T0 - 3000, 1500], [T0 - 1000, 1000]]);
  assert.strictEqual(first.history.recentSales[0].price, 1000);
  assert.deepStrictEqual(first.history.recentSales[1].enchants, [['mending', 1]]);
  // The API had no page 3, so it read pages 1-3.
  assert.deepStrictEqual(client.calls.filter((c) => c[0] === 'transactions').map((c) => c[1]), [1, 2, 3]);

  // Next check: one new sale on page 1, then page 1 reaches sales it already has.
  const later = fakeClient({ auctions: { 'diamond pickaxe': [[listing(900)]] }, sales: [[sale(T0 + 200e3, 1300), ...page1], page2] });
  const second = await poll(later, first.history, { now: T0 + 300e3 });
  assert.strictEqual(second.newSales, 1);
  assert.strictEqual(second.history.sales.length, 5);
  assert.deepStrictEqual(later.calls.filter((c) => c[0] === 'transactions').map((c) => c[1]), [1]);
});

test('history keeps a week in full and the lowest price per hour before that', async () => {
  const h = emptyHistory();
  const old = T0 - 10 * 864e5;
  // Twelve checks in one hour ten days ago, and one null hour.
  for (let i = 0; i < 12; i++) h.points.push([old + i * 300e3, 1000 + i * 10]);
  h.points[5][1] = 900;
  h.points.push([old + 2 * 3600e3, null]);
  h.points.push([T0 - 3600e3, 1100], [T0 - 1800e3, 1150]);
  const r = await poll(fakeClient({ auctions: { 'diamond pickaxe': [[listing(1200)]] } }), h, { now: T0, sales: false });
  assert.deepStrictEqual(r.history.points, [[old + 5 * 300e3, 900], [old + 2 * 3600e3, null], [T0 - 3600e3, 1100], [T0 - 1800e3, 1150], [T0, 1200]]);
});

test('snapshot reports the price about a day earlier', async () => {
  const h = emptyHistory();
  h.points.push([T0 - 864e5 - 600e3, 1000], [T0 - 3600e3, 950]);
  const r = await poll(fakeClient({ auctions: { 'diamond pickaxe': [[listing(900)]] } }), h, { now: T0, sales: false });
  const d = snapshot(r.history, { status: r.status, now: T0 });
  assert.deepStrictEqual(d.dayAgo, { t: T0 - 864e5 - 600e3, price: 1000 });
  assert.strictEqual(d.pickaxe.lowest.price, 900);
  assert.strictEqual(d.trackingSince, T0 - 864e5 - 600e3);
  assert.strictEqual(priceNear([[T0, 5]], T0 - 864e5), null);
  assert.strictEqual(readHistory({ v: 2, points: [], sales: [] }), null);
  assert.strictEqual(readHistory(null), null);
});

test('site URL points at the repository’s GitHub Pages address', () => {
  assert.strictEqual(siteUrl({ GITHUB_REPOSITORY: 'Someone/ClaudeHub' }), 'https://someone.github.io/ClaudeHub/');
  assert.strictEqual(siteUrl({ GITHUB_REPOSITORY: 'someone/someone.github.io' }), 'https://someone.github.io/');
  assert.strictEqual(siteUrl({ DONUT_SITE_URL: 'https://prices.example.com', GITHUB_REPOSITORY: 'a/b' }), 'https://prices.example.com/');
  assert.throws(() => siteUrl({}), /GITHUB_REPOSITORY/);
});

test('build continues the published history and writes the page files', async (t) => {
  const api = await fakeApi((c) => (c.url.startsWith('/v1/auction/list') ? [200, { status: 200, result: [listing(875, { seller: 'Notch' })] }] : [200, { status: 200, result: [] }]));
  const published = emptyHistory();
  published.points.push([Date.now() - 600e3, 900]);
  published.low = { price: 850, t: Date.now() - 864e5 };
  let historyStatus = 200;
  const site = http.createServer((req, res) => {
    assert.match(req.url, /^\/donut\/history\.json\?t=\d+$/);
    res.writeHead(historyStatus, { 'Content-Type': 'application/json' });
    res.end(historyStatus === 200 ? JSON.stringify(published) : 'nope');
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  t.after(() => { api.server.close(); site.close(); });

  const out = path.join(tmpdir('donut-site-'), 'donut');
  const env = { DONUTSMP_API_KEY: KEY, DONUT_API_BASE: api.base, DONUT_SITE_URL: `http://127.0.0.1:${site.address().port}/` };
  const logs = [];
  const r = await build({ out, fromSite: true, every: 300 }, { env, log: (m) => logs.push(m) });
  assert.strictEqual(r.status, 'ok');
  for (const f of ['index.html', 'core.js', 'data.json', 'history.json']) assert.ok(fs.existsSync(path.join(out, f)), f);
  const data = JSON.parse(fs.readFileSync(path.join(out, 'data.json'), 'utf8'));
  const history = JSON.parse(fs.readFileSync(path.join(out, 'history.json'), 'utf8'));
  assert.strictEqual(data.pickaxe.lowest.price, 875);
  assert.strictEqual(data.source, 'github');
  assert.deepStrictEqual(data.allTimeLow.price, 850);
  assert.strictEqual(history.points.length, 2);
  assert.ok(logs.some((m) => m.includes('Cheapest diamond pickaxe: $875 from Notch')));
  for (const f of fs.readdirSync(out)) assert.ok(!fs.readFileSync(path.join(out, f), 'utf8').includes(KEY), `${f} must not contain the key`);

  // A broken history download stops the build instead of starting over.
  historyStatus = 502;
  await assert.rejects(build({ out, fromSite: true }, { env, log() {} }), /Stopping so the history isn't lost/);
  // Before the first deploy there is no history yet.
  historyStatus = 404;
  const fresh = await build({ out, fromSite: true }, { env, log() {} });
  assert.strictEqual(fresh.history.points.length, 1);
});

test('build without an API key still produces a page that explains the setup', async () => {
  const out = tmpdir('donut-nokey-');
  const r = await build({ out }, { env: {}, log() {} });
  assert.strictEqual(r.status, 'no_key');
  const data = JSON.parse(fs.readFileSync(path.join(out, 'data.json'), 'utf8'));
  assert.strictEqual(data.status, 'no_key');
  assert.strictEqual(data.pickaxe, null);
});

test('live mode serves the page and prices only to localhost', async (t) => {
  const state = { data: { v: 1, status: 'ok' }, history: emptyHistory() };
  const server = hub.createServer(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const port = server.address().port;

  const get = (p, host = `localhost:${port}`, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers: { host } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    });
    req.on('error', reject);
    req.end();
  });
  const page = await get('/');
  assert.strictEqual(page.status, 200);
  assert.match(page.body, /<title>Donut HUD<\/title>/);
  assert.match((await get('/core.js')).body, /DonutCore/);
  const data = await get('/data.json?t=1');
  assert.strictEqual(data.type, 'application/json');
  assert.deepStrictEqual(JSON.parse(data.body), { v: 1, status: 'ok' });
  assert.strictEqual((await get('/history.json')).status, 200);
  assert.strictEqual((await get('/nope')).status, 404);
  assert.strictEqual((await get('/', 'evil.example:80')).status, 421);
  assert.strictEqual((await get('/', `localhost:${port}`, 'POST')).status, 405);
  assert.deepStrictEqual(hub.parseArgs(['--every', '3', '--port', '5000']).every, 5);
});
