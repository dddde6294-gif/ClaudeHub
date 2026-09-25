#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Scanner } = require('./lib/scanner');
const { build } = require('./lib/stats');
const { Messenger } = require('./lib/messenger');
const { writeDemo } = require('./lib/demo');

const PKG = require('./package.json');

const HELP = `ClaudeHub - live token usage for your Claude Code agents

Usage: node server.js [options]

  --port <n>              Port to listen on (default 4317)
  --host <addr>           Address to bind (default 127.0.0.1)
  --dir <path>            A Claude "projects" directory to read; repeatable
                          (default: ~/.claude/projects and ~/.config/claude/projects,
                          or $CLAUDE_CONFIG_DIR/projects)
  --claude-bin <path>     claude executable used to message sessions (default "claude")
  --permission-mode <m>   Permission mode for messages sent from the hub
                          (acceptEdits, auto, dontAsk, plan, ...). Default: the
                          session's own settings; anything needing approval is denied.
  --no-messaging          Read-only: disable sending messages to sessions
  --pages-url <url>       Hosted dashboard allowed to connect to this hub
                          (default ${PKG.homepage})
  --allow-origin <o>      Another web origin allowed to connect; repeatable
  --token <value>         Pairing token to use instead of the saved one
  --new-token             Replace the saved pairing token (unpairs old browsers)
  --demo                  Show generated sample data instead of your transcripts
  --report                Print a usage summary to the terminal and exit
  --range <spec>          Time range for --report: 1h, 24h, 7d, 30d, all (default 24h)
  -h, --help              Show this help
`;

function parseArgs(argv) {
  const o = {
    port: 4317, host: '127.0.0.1', dirs: [], claudeBin: 'claude', permissionMode: null, messaging: true,
    pagesUrl: PKG.homepage, allowOrigins: [], token: null, newToken: false, demo: false, report: false, range: '24h',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--port') o.port = Number(next());
    else if (a === '--host') o.host = next();
    else if (a === '--dir') o.dirs.push(path.resolve(next()));
    else if (a === '--claude-bin') o.claudeBin = next();
    else if (a === '--permission-mode') o.permissionMode = next();
    else if (a === '--no-messaging') o.messaging = false;
    else if (a === '--pages-url') o.pagesUrl = next();
    else if (a === '--allow-origin') o.allowOrigins.push(next());
    else if (a === '--token') o.token = next();
    else if (a === '--new-token') o.newToken = true;
    else if (a === '--demo') o.demo = true;
    else if (a === '--report') o.report = true;
    else if (a === '--range') o.range = next();
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`Unknown option ${a}`);
  }
  if (!Number.isInteger(o.port) || o.port <= 0 || o.port > 65535) throw new Error('--port must be 1-65535');
  return o;
}

function rangeToMs(spec) {
  if (!spec || spec === 'all') return null;
  const m = /^(\d+)([mhd])$/.exec(spec);
  if (!m) throw new Error(`Bad range "${spec}" (try 1h, 24h, 7d, all)`);
  return Number(m[1]) * { m: 60e3, h: 3600e3, d: 86400e3 }[m[2]];
}

// The token pairs a browser with this hub. It is saved so a paired browser keeps
// working across restarts.
function loadToken(opts) {
  if (opts.token) return opts.token;
  const dir = path.join(os.homedir(), '.claudehub');
  const file = path.join(dir, 'token');
  if (!opts.newToken) {
    try {
      const t = fs.readFileSync(file, 'utf8').trim();
      if (/^[0-9a-f]{32,}$/.test(t)) return t;
    } catch {}
  }
  const t = crypto.randomBytes(24).toString('hex');
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, t + '\n', { mode: 0o600 });
  } catch (e) {
    console.warn(`Could not save the pairing token (${e.message}); it will change on restart.`);
  }
  return t;
}

function fmt(n) {
  if (n == null) return '-';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function printReport(scanner, range) {
  const s = build(scanner, { rangeMs: rangeToMs(range) });
  const t = s.totals;
  console.log(`ClaudeHub — ${range === 'all' ? 'all time' : 'last ' + range}`);
  console.log(`  ${t.requests} requests · ${fmt(t.total)} tokens · ~$${t.cost.toFixed(2)} API-equivalent`);
  console.log(`  input ${fmt(t.input)} · cache write ${fmt(t.cacheWrite)} · cache read ${fmt(t.cacheRead)} · output ${fmt(t.output)}`);
  if (t.outputSpeed) console.log(`  avg output speed ${t.outputSpeed.toFixed(0)} tok/s`);
  console.log('');
  const rows = s.agents.slice().sort((a, b) => b.stats.cost - a.stats.cost).slice(0, 25);
  for (const a of rows) {
    const speed = a.stats.outputSpeed ? `${a.stats.outputSpeed.toFixed(0)} tok/s` : '';
    console.log(
      `${a.live ? '●' : ' '} ${(a.kind === 'subagent' ? '  ↳ ' : '') + a.label}`.slice(0, 60).padEnd(61) +
        `${fmt(a.stats.total).padStart(8)} tok  $${a.stats.cost.toFixed(2).padStart(7)}  ${speed}`
    );
  }
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function createServer(opts, scanner, token) {
  const messenger = new Messenger({ claudeBin: opts.claudeBin, permissionMode: opts.permissionMode });
  // The served page carries no secret: other users on this computer can load it too.
  // Browsers pair by opening the #token=… link printed at startup.
  const indexHtml = fs
    .readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8')
    .replace("'__CLAUDEHUB_SERVED__'", "'hub'");

  const hostNames = new Set(['localhost', '127.0.0.1', '[::1]', opts.host]);
  const allowedOrigins = new Set(opts.allowOrigins);
  if (opts.pagesUrl) allowedOrigins.add(new URL(opts.pagesUrl).origin);
  const messaging = opts.messaging && !opts.demo;

  function originAllowed(req) {
    const origin = req.headers.origin;
    return !origin || allowedOrigins.has(origin) || origin === `http://${req.headers.host}`;
  }

  function cors(req, res) {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) return;
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type, x-claudehub-token');
    res.setHeader('access-control-max-age', '600');
    if (req.headers['access-control-request-private-network']) res.setHeader('access-control-allow-private-network', 'true');
  }

  function route(req, res, url) {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-frame-options': 'DENY',
        'content-security-policy': "frame-ancestors 'none'",
        'referrer-policy': 'no-referrer',
      });
      res.end(indexHtml);
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404).end('Not found');
      return;
    }

    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(originAllowed(req) ? 204 : 403).end();
      return;
    }
    if (!originAllowed(req)) return sendJson(res, 403, { error: 'Origin not allowed', code: 'origin' });
    // Every API call needs the pairing token: transcripts contain your prompts.
    if (req.headers['x-claudehub-token'] !== token) return sendJson(res, 401, { error: 'Not paired with this hub', code: 'unpaired' });

    if (req.method === 'GET' && url.pathname === '/api/stats') {
      const range = url.searchParams.get('range');
      const rangeMs = range && range !== 'all' ? Number(range) : null;
      if (rangeMs != null && !(rangeMs > 0)) return sendJson(res, 400, { error: 'Bad range' });
      const stats = build(scanner, { rangeMs });
      stats.hub = { messaging, demo: opts.demo, version: PKG.version };
      return sendJson(res, 200, stats);
    }
    const m = /^\/api\/agents\/([^/]+)\/(chat|message)$/.exec(url.pathname);
    if (m) {
      const agent = scanner.agents.get(decodeURIComponent(m[1]));
      if (!agent) return sendJson(res, 404, { error: 'Unknown agent' });
      if (m[2] === 'chat' && req.method === 'GET') {
        return sendJson(res, 200, { chat: agent.chat, busy: messenger.busy.has(agent.sessionId) });
      }
      if (m[2] === 'message' && req.method === 'POST') return handleMessage(req, res, agent);
    }
    sendJson(res, 404, { error: 'Not found' });
  }

  function handleMessage(req, res, agent) {
    if (!messaging) return sendJson(res, 403, { error: opts.demo ? 'Messaging is off in demo mode' : 'Messaging is disabled (--no-messaging)' });
    if (agent.kind !== 'session') return sendJson(res, 400, { error: 'Subagents cannot be messaged; message their parent session' });

    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 200000) req.destroy();
    });
    req.on('end', () => {
      let text, fork;
      try {
        ({ text, fork } = JSON.parse(body));
      } catch {
        return sendJson(res, 400, { error: 'Bad JSON' });
      }
      if (typeof text !== 'string' || !text.trim()) return sendJson(res, 400, { error: 'Empty message' });

      res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
      const write = (evt) => {
        if (!res.writableEnded) res.write(JSON.stringify(evt) + '\n');
        if (evt.type === 'done' || evt.type === 'error') res.end();
      };
      let abort;
      try {
        abort = messenger.send({ sessionId: agent.sessionId, cwd: agent.cwd, text, fork: !!fork }, write);
      } catch (e) {
        return write({ type: 'error', error: e.message });
      }
      res.on('close', () => {
        if (!res.writableEnded) abort();
      });
    });
  }

  const server = http.createServer((req, res) => {
    // Reject DNS-rebinding requests: the hub must be reached by its own address.
    const port = server.address().port;
    if (![...hostNames].some((h) => req.headers.host === `${h}:${port}`)) {
      res.writeHead(421).end('Misdirected request');
      return;
    }
    try {
      route(req, res, new URL(req.url, `http://${req.headers.host}`));
    } catch (e) {
      if (!res.headersSent) sendJson(res, 500, { error: e.message });
      else res.end();
    }
  });
  return server;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message + '\n\n' + HELP);
    process.exit(2);
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }

  if (opts.demo) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudehub-demo-'));
    writeDemo(dir);
    opts.dirs = [dir];
  }
  const scanner = new Scanner(opts.dirs);
  scanner.scan();

  if (opts.report) {
    printReport(scanner, opts.range);
    return;
  }
  setInterval(() => scanner.scan(), 3000).unref();

  const token = loadToken(opts);
  const server = createServer(opts, scanner, token);
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${opts.port} is in use. Try --port <other>.` : e.message);
    process.exit(1);
  });
  server.listen(opts.port, opts.host, () => {
    const hub = `http://127.0.0.1:${opts.port}`;
    console.log(`\nClaudeHub is running${opts.demo ? ' with demo data' : ''}.\n`);
    console.log(`  On this computer:   http://localhost:${opts.port}/#token=${token}`);
    if (opts.pagesUrl) console.log(`  Hosted dashboard:   ${opts.pagesUrl}#hub=${encodeURIComponent(hub)}&token=${token}`);
    console.log('\n  Opening a link once pairs that browser; after that the plain address works.');
    console.log(`\n  Reading ${scanner.roots.join(', ')}`);
    console.log(`  Found ${scanner.agents.size} agents and ${scanner.requests.size} requests so far`);
    if (!opts.messaging || opts.demo) console.log('  Messaging is off');
    console.log('');
  });
  return server;
}

if (require.main === module) main();

module.exports = { parseArgs, rangeToMs, createServer, loadToken };
