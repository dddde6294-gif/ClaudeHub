#!/usr/bin/env node
'use strict';

// Live mode: checks DonutSMP every 15 seconds and serves the HUD on this computer,
// for when the ~5 minute refresh of the GitHub Pages copy is too slow.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createClient } = require('./api');
const { poll, snapshot, emptyHistory, readHistory } = require('./tracker');
const { formatMoney } = require('./core');

const HELP = `Donut HUD live mode

Usage: node donut/hub.js [options]

  --key <key>         Your DonutSMP API key (type /api in game). Saved to
                      ~/.donuthud/key so you only pass it once. You can also
                      set $DONUTSMP_API_KEY instead.
  --port <n>          Port to listen on (default 4318)
  --every <seconds>   How often to check prices (default 15, at least 5)
  --data-dir <path>   Where the key and price history are kept (default ~/.donuthud)
  -h, --help          Show this help
`;

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/core.js': ['core.js', 'text/javascript; charset=utf-8'],
};

function parseArgs(argv) {
  const o = { key: null, port: 4318, every: 15, dataDir: path.join(os.homedir(), '.donuthud'), help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--key') o.key = next();
    else if (a === '--port') o.port = Number(next());
    else if (a === '--every') o.every = Math.max(5, Number(next()) || 15);
    else if (a === '--data-dir') o.dataDir = path.resolve(next());
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`Unknown option ${a}`);
  }
  return o;
}

function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function saveFile(file, text, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text, { mode });
  fs.renameSync(tmp, file);
}

// Serves the page and the latest prices. It only answers requests addressed to
// localhost, so a web page can't reach it through a rebound DNS name.
function createServer(state) {
  const server = http.createServer((req, res) => {
    const port = server.address().port;
    const hosts = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
    if (!hosts.includes(String(req.headers.host || '').toLowerCase())) {
      res.writeHead(421, { 'Content-Type': 'text/plain' });
      return res.end(`Open this page at http://localhost:${port}/\n`);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    const url = new URL(req.url, 'http://localhost');
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    let body;
    if (url.pathname === '/data.json' || url.pathname === '/history.json') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(url.pathname === '/data.json' ? state.data : state.history);
    } else if (FILES[url.pathname]) {
      const [file, type] = FILES[url.pathname];
      headers['Content-Type'] = type;
      body = fs.readFileSync(path.join(__dirname, file));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found\n');
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return server;
}

async function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (o.help) return console.log(HELP);

  const keyFile = path.join(o.dataDir, 'key');
  const historyFile = path.join(o.dataDir, 'history.json');
  if (o.key) saveFile(keyFile, o.key.trim() + '\n', 0o600);
  const key = o.key || process.env.DONUTSMP_API_KEY || (readFile(keyFile) || '').trim();
  if (!key) {
    console.error('Donut HUD needs your DonutSMP API key. Type /api in game, then run:\n\n  node donut/hub.js --key <your key>\n');
    process.exit(2);
  }

  let history = emptyHistory();
  try {
    history = readHistory(JSON.parse(readFile(historyFile))) || history;
  } catch {}
  const client = createClient({ key });
  const state = { history, data: snapshot(history, { status: 'starting', source: 'hub', every: o.every }) };

  const server = createServer(state);
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${o.port} is in use. Try --port ${o.port + 1}.` : e.message);
    process.exit(1);
  });
  server.listen(o.port, '127.0.0.1', () => console.log(`Donut HUD is live at http://localhost:${o.port}/  (checking every ${o.every}s, Ctrl+C to stop)`));

  // Sales change more slowly and cost up to 10 requests, so they're read at most once a minute.
  let lastSales = 0;
  let lastLine = '';
  for (;;) {
    const now = Date.now();
    const sales = now - lastSales >= 60e3;
    const r = await poll(client, state.history, { now, sales, log: (m) => console.log(m) });
    if (sales) lastSales = now;
    state.history = r.history;
    state.data = snapshot(r.history, { status: r.status, message: r.message, now, source: 'hub', every: o.every });
    try {
      saveFile(historyFile, JSON.stringify(r.history), 0o600);
    } catch (e) {
      console.error(`Couldn't save the price history: ${e.message}`);
    }
    const low = r.history.last && r.history.last.lowest;
    const line = r.status === 'ok' ? `Cheapest diamond pickaxe: ${low ? formatMoney(low.price) : 'none listed'}` : `DonutSMP check failed: ${r.message}`;
    if (line !== lastLine) console.log(`${new Date(now).toLocaleTimeString()}  ${line}`);
    lastLine = line;
    if (r.status === 'bad_key') {
      console.error('Make a new key with /api in game, then run: node donut/hub.js --key <your key>');
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, (r.status === 'rate_limited' ? 4 : 1) * o.every * 1000));
  }
}

if (require.main === module) main();

module.exports = { createServer, parseArgs };
