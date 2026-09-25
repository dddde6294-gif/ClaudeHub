#!/usr/bin/env node
'use strict';

// Builds the Donut HUD for GitHub Pages: copies the page, checks DonutSMP's auction house once,
// and writes data.json and history.json next to it. The Pages workflow runs this on every
// deploy and every ~5 minutes; the price history lives on the published site between runs.

const fs = require('fs');
const path = require('path');
const { createClient } = require('./api');
const { poll, snapshot, emptyHistory, readHistory } = require('./tracker');
const { formatMoney, enchantList } = require('./core');

const HELP = `Donut HUD site builder

Usage: node donut/build.js <out-dir> [options]

  --from-site             Continue the price history already published on GitHub Pages
                          (the site URL comes from $DONUT_SITE_URL or $GITHUB_REPOSITORY)
  --history-url <url>     Continue the price history at this URL instead
  --history-file <path>   Continue the price history in this file instead
  --every <seconds>       How often the site is refreshed, shown on the page (default 300)

The API key is read from $DONUTSMP_API_KEY. Without one, the page shows how to add it.
`;

const PAGE_FILES = ['index.html', 'core.js'];

function parseArgs(argv) {
  const o = { out: null, fromSite: false, historyUrl: null, historyFile: null, every: 300, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--from-site') o.fromSite = true;
    else if (a === '--history-url') o.historyUrl = next();
    else if (a === '--history-file') o.historyFile = next();
    else if (a === '--every') o.every = Number(next());
    else if (a === '-h' || a === '--help') o.help = true;
    else if (!a.startsWith('-') && !o.out) o.out = a;
    else throw new Error(`Unknown option ${a}`);
  }
  return o;
}

// Where GitHub Pages publishes this repository.
function siteUrl(env = process.env) {
  if (env.DONUT_SITE_URL) return env.DONUT_SITE_URL.replace(/\/*$/, '/');
  const [owner, repo] = String(env.GITHUB_REPOSITORY || '').split('/');
  if (!owner || !repo) throw new Error('--from-site needs $DONUT_SITE_URL or $GITHUB_REPOSITORY');
  const host = `${owner.toLowerCase()}.github.io`;
  return repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
}

async function loadHistory(o, log) {
  if (o.historyFile) {
    if (!fs.existsSync(o.historyFile)) return emptyHistory();
    return readHistory(JSON.parse(fs.readFileSync(o.historyFile, 'utf8'))) || emptyHistory();
  }
  if (!o.historyUrl) return emptyHistory();
  // The query string skips GitHub's CDN cache, so we read what the last run published.
  const url = `${o.historyUrl}${o.historyUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  let res;
  try {
    res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    throw new Error(`Couldn't load the price history from ${o.historyUrl} (${e.message}). Stopping so the history isn't lost.`);
  }
  if (res.status === 404) {
    log('No price history published yet; starting a new one.');
    return emptyHistory();
  }
  if (!res.ok) throw new Error(`Couldn't load the price history from ${o.historyUrl} (HTTP ${res.status}). Stopping so the history isn't lost.`);
  const h = readHistory(await res.json().catch(() => null));
  if (!h) {
    log('The published history.json was unreadable; starting a new one.');
    return emptyHistory();
  }
  return h;
}

function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

async function build(o, { env = process.env, log = console.log } = {}) {
  const out = path.resolve(o.out);
  fs.mkdirSync(out, { recursive: true });
  for (const f of PAGE_FILES) fs.copyFileSync(path.join(__dirname, f), path.join(out, f));

  if (o.fromSite) o.historyUrl = `${siteUrl(env)}donut/history.json`;
  const previous = await loadHistory(o, log);
  const client = createClient({ key: env.DONUTSMP_API_KEY, base: env.DONUT_API_BASE || undefined });
  const now = Date.now();
  const r = await poll(client, previous, { now, log });
  const data = snapshot(r.history, { status: r.status, message: r.message, now, source: 'github', every: o.every });
  writeJson(path.join(out, 'history.json'), r.history);
  writeJson(path.join(out, 'data.json'), data);

  const low = data.pickaxe && data.pickaxe.lowest;
  if (r.status === 'no_key') log('No DONUTSMP_API_KEY set: the page will show how to add one.');
  else if (r.status !== 'ok') log(`DonutSMP check failed (${r.status}): ${r.message}`);
  else if (low) log(`Cheapest diamond pickaxe: ${formatMoney(low.price)} from ${low.seller || 'unknown'}${low.enchants.length ? ` (${enchantList(low.enchants)})` : ''}; ${data.pickaxe.cheapest.length} cheapest kept.`);
  else log('No diamond pickaxes are listed on the auction house right now.');
  if (r.newSales) log(`${r.newSales} new diamond pickaxe sale${r.newSales === 1 ? '' : 's'}.`);
  log(`History: ${r.history.points.length} price points, ${r.history.sales.length} sales. Wrote ${out}`);
  return { status: r.status, data, history: r.history };
}

async function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (o.help || !o.out) {
    console.log(HELP);
    process.exit(o.help ? 0 : 2);
  }
  try {
    const { status } = await build(o);
    // The Pages workflow skips deploying scheduled runs until an API key is set.
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\n`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { build, parseArgs, siteUrl };
