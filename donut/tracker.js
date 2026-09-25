'use strict';

// Checks DonutSMP's auction house for diamond pickaxes and keeps the price history the HUD charts.

const { itemKey, cleanText } = require('./core');

const ITEM = 'diamond_pickaxe';
const SEARCHES = ['diamond pickaxe', 'diamond_pickaxe'];
const LIST_PAGES = 3;
const SALE_PAGES = 10; // the API only keeps the newest 1,000 sales
const CHEAPEST = 8;
const RECENT_SALES = 12;
const MAX_SALES = 5000;
const FULL_DETAIL_MS = 7 * 86400e3; // after a week, keep only the lowest price of each hour
const WEEK_S = 7 * 86400;

function emptyHistory() {
  return { v: 1, points: [], sales: [], recentSales: [], low: null, last: null, lastOkAt: null, search: null };
}

// Accepts a parsed history.json and returns a clean copy, or null if it isn't one.
function readHistory(obj) {
  if (!obj || typeof obj !== 'object' || obj.v !== 1 || !Array.isArray(obj.points) || !Array.isArray(obj.sales)) return null;
  const h = emptyHistory();
  h.points = obj.points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && (p[1] === null || Number.isFinite(p[1])));
  h.sales = obj.sales.filter((s) => Array.isArray(s) && Number.isFinite(s[0]) && Number.isFinite(s[1]));
  h.recentSales = Array.isArray(obj.recentSales) ? obj.recentSales.filter((s) => s && Number.isFinite(s.t) && Number.isFinite(s.price)) : [];
  h.low = obj.low && Number.isFinite(obj.low.price) ? { price: obj.low.price, t: obj.low.t } : null;
  h.last = obj.last && typeof obj.last === 'object' && Number.isFinite(obj.last.at) ? obj.last : null;
  h.lastOkAt = Number.isFinite(obj.lastOkAt) ? obj.lastOkAt : null;
  h.search = SEARCHES.includes(obj.search) ? obj.search : null;
  return h;
}

function isPickaxe(entry) {
  const item = entry && entry.item;
  if (!item) return false;
  if (item.id != null && item.id !== '') return itemKey(item.id) === ITEM;
  return itemKey(cleanText(item.display_name)) === ITEM;
}

function enchantsOf(item) {
  const levels = item && item.enchants && item.enchants.enchantments && item.enchants.enchantments.levels;
  if (!levels || typeof levels !== 'object') return [];
  return Object.entries(levels)
    .map(([id, level]) => [itemKey(id), Number(level)])
    .filter(([id, level]) => id && level > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
}

// time_left's unit isn't documented. Listings last hours to days, so a page with any value
// above a week's worth of seconds must be in milliseconds.
function msPerTimeLeft(entries) {
  return entries.some((e) => Number(e.time_left) > WEEK_S) ? 1 : 1000;
}

function listingOf(entry, msPerUnit, now) {
  const item = entry.item || {};
  const out = { price: Number(entry.price), seller: cleanText(entry.seller && entry.seller.name), enchants: enchantsOf(item) };
  const name = cleanText(item.display_name);
  if (name && itemKey(name) !== ITEM) out.name = name; // a custom name from an anvil
  const left = Number(entry.time_left);
  if (left > 0) out.endsAt = now + left * msPerUnit;
  return out;
}

async function findListings(client, preferred, now, log) {
  const order = preferred ? [preferred, ...SEARCHES.filter((s) => s !== preferred)] : SEARCHES;
  let failure = null;
  let answered = false;
  for (const search of order) {
    const found = [];
    let sorted = true;
    try {
      for (let page = 1; page <= LIST_PAGES; page++) {
        let entries;
        try {
          entries = await client.auctions(page, { search, sort: 'lowest_price' });
        } catch (e) {
          if (page > 1 && e.code === 'api_error') break; // past the last page
          throw e;
        }
        if (!entries.length) break;
        const prices = entries.map((e) => Number(e.price));
        if (prices.some((p, i) => i > 0 && p < prices[i - 1])) sorted = false;
        const unit = msPerTimeLeft(entries);
        for (const e of entries) if (isPickaxe(e) && Number.isFinite(Number(e.price))) found.push(listingOf(e, unit, now));
        if (page === 1 && !found.length) {
          const ids = [...new Set(entries.slice(0, 5).map((e) => e && e.item && e.item.id))].join(', ');
          log(`Search "${search}" page 1 had ${entries.length} listings but no diamond pickaxes (item ids like: ${ids}).`);
        }
        // Results come cheapest first, so the first page with pickaxes on it has the cheapest ones.
        if (found.length && sorted) break;
      }
      answered = true;
    } catch (e) {
      // A refused key or a network failure won't get better with a different search.
      if (e.code !== 'api_error') throw e;
      failure = e;
      continue;
    }
    if (found.length) return { search, sorted, listings: found.sort((a, b) => a.price - b.price) };
  }
  if (!answered && failure) throw failure;
  return { search: order[0], sorted: true, listings: [] };
}

async function collectSales(client, h, now) {
  const newest = h.sales.length ? h.sales[h.sales.length - 1][0] : 0;
  const known = new Set(h.sales.filter((s) => s[0] >= newest).map((s) => `${s[0]}|${s[1]}`));
  const fresh = [];
  for (let page = 1; page <= SALE_PAGES; page++) {
    let entries;
    try {
      entries = await client.transactions(page);
    } catch (e) {
      if (page > 1 && e.code === 'api_error') break;
      throw e;
    }
    if (!entries.length) break;
    let oldest = Infinity;
    for (const e of entries) {
      const t = Number(e && e.unixMillisDateSold);
      if (!Number.isFinite(t)) continue;
      oldest = Math.min(oldest, t);
      const price = Number(e.price);
      if (t < newest || t > now + 60e3 || !isPickaxe(e) || !Number.isFinite(price)) continue;
      const k = `${t}|${price}`;
      if (known.has(k)) continue;
      known.add(k);
      fresh.push({ t, price, seller: cleanText(e.seller && e.seller.name), enchants: enchantsOf(e.item) });
    }
    if (oldest <= newest) break; // caught up with sales we already have
  }
  fresh.sort((a, b) => a.t - b.t);
  for (const s of fresh) h.sales.push([s.t, s.price]);
  h.sales.sort((a, b) => a[0] - b[0]);
  if (h.sales.length > MAX_SALES) h.sales.splice(0, h.sales.length - MAX_SALES);
  h.recentSales = [...fresh, ...h.recentSales].sort((a, b) => b.t - a.t).slice(0, RECENT_SALES);
  return fresh.length;
}

function thin(h, now) {
  const cutoff = now - FULL_DETAIL_MS;
  const hours = new Map();
  const recent = [];
  for (const p of h.points.sort((a, b) => a[0] - b[0])) {
    if (p[0] >= cutoff) {
      recent.push(p);
      continue;
    }
    const hour = Math.floor(p[0] / 3600e3);
    const kept = hours.get(hour);
    if (!kept || (p[1] !== null && (kept[1] === null || p[1] < kept[1]))) hours.set(hour, p);
  }
  h.points = [...hours.values(), ...recent];
}

// One check: the cheapest diamond pickaxes listed right now, plus any new sales.
async function poll(client, history, { now = Date.now(), sales = true, log = () => {} } = {}) {
  const h = readHistory(history) || emptyHistory();
  if (!client.hasKey) return { history: h, status: 'no_key', message: 'No DonutSMP API key is set.', newSales: 0 };
  let status = 'ok';
  let message = null;
  try {
    const found = await findListings(client, h.search, now, log);
    const lowest = found.listings[0] || null;
    h.search = found.search;
    h.points.push([now, lowest ? lowest.price : null]);
    if (lowest && (!h.low || lowest.price < h.low.price)) h.low = { price: lowest.price, t: now };
    h.last = { at: now, lowest, cheapest: found.listings.slice(0, CHEAPEST), sorted: found.sorted };
    h.lastOkAt = now;
  } catch (e) {
    status = e.code || 'error';
    message = e.message;
  }
  let newSales = 0;
  if (sales && (status === 'ok' || status === 'api_error')) {
    try {
      newSales = await collectSales(client, h, now);
    } catch (e) {
      log(`Couldn't read recent sales: ${e.message}`);
    }
  }
  thin(h, now);
  return { history: h, status, message, newSales };
}

// The price listed closest to time t (within three hours), for "vs 24h ago".
function priceNear(points, t, windowMs = 3 * 3600e3) {
  let best = null;
  for (const p of points) {
    if (p[1] === null || Math.abs(p[0] - t) > windowMs) continue;
    if (!best || Math.abs(p[0] - t) < Math.abs(best.t - t)) best = { t: p[0], price: p[1] };
  }
  return best;
}

// The small file the HUD reloads every minute. history.json holds the rest.
function snapshot(h, { status, message = null, now = Date.now(), source = 'github', every = 300 } = {}) {
  return {
    v: 1,
    generatedAt: now,
    source,
    every,
    status,
    message,
    lastOkAt: h.lastOkAt,
    pickaxe: h.last,
    allTimeLow: h.low,
    dayAgo: h.last ? priceNear(h.points, h.last.at - 86400e3) : null,
    trackingSince: h.points.length ? h.points[0][0] : null,
    recentSales: h.recentSales,
  };
}

module.exports = { poll, snapshot, emptyHistory, readHistory, isPickaxe, priceNear, thin, SEARCHES };
