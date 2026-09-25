'use strict';

const { genSeconds, speedEligible } = require('./scanner');

const LIVE_WINDOW_MS = 2 * 60 * 1000;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const NICE_BUCKETS = [60, 300, 900, 1800, 3600, 3 * 3600, 6 * 3600, 12 * 3600, 86400, 7 * 86400].map((s) => s * 1000);

function emptyTotals() {
  return { requests: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, thinking: 0, cost: 0, unpriced: 0, genSec: 0, genOut: 0 };
}

function add(t, r) {
  const u = r.usage;
  t.requests += 1;
  t.input += u.input;
  t.cacheWrite += u.cacheWrite5m + u.cacheWrite1h;
  t.cacheRead += u.cacheRead;
  t.output += u.output;
  t.thinking += u.thinking;
  if (r.cost == null) t.unpriced += 1;
  else t.cost += r.cost;
  if (speedEligible(r)) {
    t.genSec += genSeconds(r);
    t.genOut += u.output;
  }
}

function allTokens(u) {
  return u.input + u.cacheWrite5m + u.cacheWrite1h + u.cacheRead + u.output;
}

function finish(t) {
  const total = t.input + t.cacheWrite + t.cacheRead + t.output;
  const promptSide = t.input + t.cacheWrite + t.cacheRead;
  return {
    requests: t.requests,
    input: t.input,
    cacheWrite: t.cacheWrite,
    cacheRead: t.cacheRead,
    output: t.output,
    thinking: t.thinking,
    total,
    cost: t.cost,
    unpriced: t.unpriced,
    cacheHitRate: promptSide ? t.cacheRead / promptSide : null,
    // Output tokens per second of wall time between request start and last block.
    outputSpeed: t.genSec ? t.genOut / t.genSec : null,
  };
}

function build(scanner, { rangeMs, now = Date.now() } = {}) {
  const from = rangeMs ? now - rangeMs : -Infinity;
  const inRange = [];
  let minTs = Infinity;
  for (const r of scanner.requests.values()) {
    if (r.end == null || r.end < from || r.end > now + 60000) continue;
    inRange.push(r);
    if (r.end < minTs) minTs = r.end;
  }

  const span = rangeMs || (Number.isFinite(minTs) ? Math.max(now - minTs, 3600e3) : 3600e3);
  const bucketMs = NICE_BUCKETS.find((b) => span / b <= 90) || NICE_BUCKETS[NICE_BUCKETS.length - 1];
  const start = Math.floor((now - span) / bucketMs) * bucketMs;
  const nBuckets = Math.ceil((now - start) / bucketMs) || 1;

  const totals = emptyTotals();
  const perAgent = new Map();
  const perModel = new Map();
  const liveTotals = { all: 0, output: 0, cost: 0 };
  // buckets[i][agentKey] = [allTokens, output, cost]
  const buckets = Array.from({ length: nBuckets }, () => ({}));

  for (const r of inRange) {
    add(totals, r);
    if (!perAgent.has(r.agent)) perAgent.set(r.agent, { t: emptyTotals(), rate: { all: 0, output: 0, cost: 0 } });
    const pa = perAgent.get(r.agent);
    add(pa.t, r);
    if (!perModel.has(r.model)) perModel.set(r.model, emptyTotals());
    add(perModel.get(r.model), r);

    const all = allTokens(r.usage);
    if (now - r.end <= RATE_WINDOW_MS) {
      pa.rate.all += all;
      pa.rate.output += r.usage.output;
      pa.rate.cost += r.cost || 0;
      liveTotals.all += all;
      liveTotals.output += r.usage.output;
      liveTotals.cost += r.cost || 0;
    }

    const bi = Math.floor((r.end - start) / bucketMs);
    if (bi >= 0 && bi < nBuckets) {
      const cell = buckets[bi][r.agent] || (buckets[bi][r.agent] = [0, 0, 0]);
      cell[0] += all;
      cell[1] += r.usage.output;
      cell[2] += r.cost || 0;
    }
  }

  const perMinute = (x) => x / (RATE_WINDOW_MS / 60000);
  const agents = [];
  for (const a of scanner.agents.values()) {
    const pa = perAgent.get(a.key);
    const live = a.lastTs != null && now - a.lastTs <= LIVE_WINDOW_MS;
    if (!pa && !live) continue;
    agents.push({
      key: a.key,
      kind: a.kind,
      parent: a.parent,
      sessionId: a.sessionId,
      label: scanner.agentLabel(a),
      project: a.cwd || a.project,
      branch: a.branch,
      models: [...a.models],
      firstTs: a.firstTs,
      lastTs: a.lastTs,
      live,
      canMessage: a.kind === 'session',
      stats: finish(pa ? pa.t : emptyTotals()),
      rate: pa
        ? { all: perMinute(pa.rate.all), output: perMinute(pa.rate.output), cost: perMinute(pa.rate.cost) }
        : { all: 0, output: 0, cost: 0 },
    });
  }

  const models = [...perModel.entries()].map(([model, t]) => ({ model, stats: finish(t) }));
  models.sort((a, b) => b.stats.total - a.stats.total);

  return {
    now,
    rangeMs: rangeMs || null,
    roots: scanner.roots,
    totals: finish(totals),
    live: {
      agents: agents.filter((a) => a.live).length,
      windowMin: RATE_WINDOW_MS / 60000,
      perMinute: { all: perMinute(liveTotals.all), output: perMinute(liveTotals.output), cost: perMinute(liveTotals.cost) },
    },
    series: { start, bucketMs, buckets },
    agents,
    models,
  };
}

module.exports = { build };
