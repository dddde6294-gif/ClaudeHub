'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { createServer, parseArgs } = require('../server');
const { Scanner } = require('../lib/scanner');
const { tmpdir, writeJsonl, session } = require('./helpers');

const SID = '11111111-2222-4333-8444-555555555555';
const TOKEN = 'ab'.repeat(24);
const PAGES = 'https://someone.github.io';

function request(port, { method = 'GET', path: p = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function start(extra = []) {
  const root = tmpdir();
  const cwd = tmpdir('claudehub-cwd-');
  writeJsonl(path.join(root, '-proj', `${SID}.jsonl`), session({ sessionId: SID, cwd }));
  const log = path.join(tmpdir(), 'fake.json');
  process.env.FAKE_CLAUDE_LOG = log;
  const opts = parseArgs(['--port', '1', '--dir', root, '--pages-url', PAGES + '/ClaudeHub/',
    '--claude-bin', path.join(__dirname, 'fixtures', 'fake-claude.js'), ...extra]);
  const scanner = new Scanner(opts.dirs);
  scanner.scan();
  const server = createServer(opts, scanner, TOKEN);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: server.address().port, log, cwd };
}

test('serves the page without its token and guards the API', async (t) => {
  const { server, port } = await start();
  t.after(() => server.close());

  const page = await request(port);
  assert.strictEqual(page.status, 200);
  // Anyone who can reach the port can load the page, so it must not carry the token.
  assert.ok(!page.body.includes(TOKEN));
  assert.ok(page.body.includes("const SERVED_BY_HUB = 'hub' === 'hub';"));
  assert.strictEqual(page.headers['x-frame-options'], 'DENY');

  assert.strictEqual((await request(port, { path: '/api/stats' })).status, 401);
  const ok = await request(port, { path: '/api/stats?range=all', headers: { 'x-claudehub-token': TOKEN } });
  assert.strictEqual(ok.status, 200);
  const stats = JSON.parse(ok.body);
  assert.strictEqual(stats.totals.requests, 1);
  assert.strictEqual(stats.hub.messaging, true);

  // DNS rebinding: a foreign Host header is refused.
  assert.strictEqual((await request(port, { headers: { host: `evil.example:${port}` } })).status, 421);
});

test('lets the hosted page in through CORS and keeps other sites out', async (t) => {
  const { server, port } = await start();
  t.after(() => server.close());

  const pre = await request(port, { method: 'OPTIONS', path: '/api/stats', headers: { origin: PAGES, 'access-control-request-private-network': 'true' } });
  assert.strictEqual(pre.status, 204);
  assert.strictEqual(pre.headers['access-control-allow-origin'], PAGES);
  assert.strictEqual(pre.headers['access-control-allow-private-network'], 'true');
  assert.match(pre.headers['access-control-allow-headers'], /x-claudehub-token/);

  const fromPages = await request(port, { path: '/api/stats', headers: { origin: PAGES, 'x-claudehub-token': TOKEN } });
  assert.strictEqual(fromPages.status, 200);

  const evilPre = await request(port, { method: 'OPTIONS', path: '/api/stats', headers: { origin: 'https://evil.example' } });
  assert.strictEqual(evilPre.status, 403);
  assert.strictEqual(evilPre.headers['access-control-allow-origin'], undefined);
  const evil = await request(port, { path: '/api/stats', headers: { origin: 'https://evil.example', 'x-claudehub-token': TOKEN } });
  assert.strictEqual(evil.status, 403);
});

test('messages a session through claude --resume and streams the reply', async (t) => {
  const { server, port, log, cwd } = await start();
  t.after(() => server.close());
  const key = encodeURIComponent(SID);

  const noToken = await request(port, { method: 'POST', path: `/api/agents/${key}/message`, body: '{"text":"hi"}' });
  assert.strictEqual(noToken.status, 401);

  const res = await request(port, {
    method: 'POST', path: `/api/agents/${key}/message`,
    headers: { 'x-claudehub-token': TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify({ text: '--not-a-flag please run the tests', fork: true }),
  });
  assert.strictEqual(res.status, 200);
  const events = res.body.trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(events.filter((e) => e.type === 'text').map((e) => e.text).join(''), 'Hello there');
  assert.ok(events.some((e) => e.type === 'tool' && e.name === 'Read'));
  const done = events[events.length - 1];
  assert.strictEqual(done.type, 'done');
  assert.strictEqual(done.cost, 0.01);

  const call = JSON.parse(fs.readFileSync(log, 'utf8'));
  assert.strictEqual(call.stdin, '--not-a-flag please run the tests');
  assert.deepStrictEqual(call.args.slice(0, 3), ['-p', '--resume', SID]);
  assert.ok(call.args.includes('--fork-session'));
  assert.ok(call.args.includes('--permission-prompts'));
  assert.strictEqual(fs.realpathSync(call.cwd), fs.realpathSync(cwd));

  const chat = JSON.parse((await request(port, { path: `/api/agents/${key}/chat`, headers: { 'x-claudehub-token': TOKEN } })).body);
  assert.strictEqual(chat.chat[0].text, 'Fix the flaky login test');
});

test('read-only mode refuses messages', async (t) => {
  const { server, port } = await start(['--no-messaging']);
  t.after(() => server.close());
  const res = await request(port, {
    method: 'POST', path: `/api/agents/${encodeURIComponent(SID)}/message`,
    headers: { 'x-claudehub-token': TOKEN }, body: '{"text":"hi"}',
  });
  assert.strictEqual(res.status, 403);
});
