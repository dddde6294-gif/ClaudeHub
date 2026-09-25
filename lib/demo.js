'use strict';

// Writes realistic, entirely made-up Claude Code transcripts so the dashboard can
// be tried (and the public GitHub Pages copy can show something) without real data.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SESSIONS = [
  {
    project: 'webapp', branch: 'feat/guest-checkout', model: 'claude-opus-5-5', speed: 62, live: true, spanMin: 170,
    turns: [
      ['Redesign the checkout flow so guest users can pay without creating an account', 'The guest path now skips account creation: email is collected on the payment step and the order is linked by a signed token. I split the form into three steps and kept the existing validation.'],
      ['Nice. Can you make sure saved carts still work for guests?', 'Saved carts now persist for guests through a 30-day cookie and merge into the account if they sign up later. Added tests for the merge.'],
      ['Run the whole e2e suite and fix anything that broke', 'Running the e2e suite now; two address-form tests needed new selectors after the step split. Fixing those.'],
    ],
    subagents: [
      { type: 'Explore', desc: 'Find every payment form component', model: 'claude-haiku-4-5', speed: 150, at: 0.2 },
      { type: 'general-purpose', desc: 'Write e2e tests for guest checkout', model: 'claude-sonnet-5', speed: 95, at: 0.55 },
    ],
  },
  {
    project: 'api-server', branch: 'main', model: 'claude-sonnet-5', speed: 94, live: true, spanMin: 45,
    turns: [
      ['Why is /v2/orders returning 500 for some users? Check the logs and fix it', 'Found it: legacy accounts have a null shipping_address and the serializer assumed it was set. Patched the serializer and added a regression test.'],
      ['Are there other endpoints with the same assumption?', 'Two more: /v2/invoices and /v2/returns. Patching both the same way and adding tests.'],
    ],
  },
  {
    project: 'ml-pipeline', branch: 'stream-parquet', model: 'claude-fable-5-1', speed: 47, hoursAgo: 19, spanMin: 150,
    turns: [
      ['Refactor the feature store loader to stream parquet files instead of loading everything into memory', 'The loader now streams row groups with a bounded prefetch queue. Peak memory on the full training set dropped from 41 GB to 3.2 GB; throughput is unchanged.'],
      ['Add a benchmark so we notice if this regresses', 'Added a benchmark job that fails if peak memory grows by more than 20% or throughput drops by more than 10%.'],
    ],
    subagents: [{ type: 'Explore', desc: 'Map where the loader is called', model: 'claude-haiku-4-5', speed: 155, at: 0.1 }],
  },
  {
    project: 'docs-site', branch: 'main', model: 'claude-haiku-4-5', speed: 158, hoursAgo: 28, spanMin: 50,
    turns: [
      ['Fix broken links across the docs and update the changelog for 2.4', 'Fixed 37 broken links (mostly the moved API reference) and wrote the 2.4 changelog from the merged PRs.'],
    ],
  },
  {
    project: 'mobile-app', branch: 'fix/android-push', model: 'claude-opus-5', speed: 57, hoursAgo: 70, spanMin: 120,
    turns: [
      ['Push notifications stopped arriving on Android 16, investigate', 'Android 16 requires the new notification channel importance flag; our channel was created before the upgrade and never updated. Added a migration that recreates the channel.'],
      ['Ship it behind a remote flag', 'Done: the migration runs only when the push_channel_v2 flag is on.'],
    ],
  },
  {
    project: 'infra', branch: 'aws-provider-6', model: 'claude-sonnet-5', speed: 90, hoursAgo: 130, spanMin: 90,
    turns: [
      ['Upgrade our terraform modules to the new AWS provider and plan the migration', 'All 14 modules now target the new provider. The plan is clean except for 3 S3 buckets that need moved blocks, which I added.'],
    ],
  },
  {
    project: 'webapp', branch: 'dark-mode', model: 'claude-sonnet-5', speed: 92, hoursAgo: 390, spanMin: 80,
    turns: [
      ['Add dark mode to the settings page', 'Dark mode is in, driven by the system setting with a manual override saved per user.'],
    ],
  },
];

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuid(r) {
  const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function id(prefix, r) {
  return prefix + crypto.createHash('sha1').update(String(r())).digest('base64url').slice(0, 22);
}

// One conversation thread (a session or a subagent) written as JSONL records.
class Thread {
  constructor({ r, sessionId, cwd, branch, model, speed, sidechain, agentId }) {
    Object.assign(this, { r, sessionId, cwd, branch, model, speed, sidechain, agentId });
    this.lines = [];
    this.last = null;
    this.ctx = sidechain ? 9000 : 21000; // system prompt + tools, cached after the first request
    this.cached = 0;
    this.lastReq = null;
  }

  base(type, t) {
    const uuidV = uuid(this.r);
    const rec = {
      type, uuid: uuidV, parentUuid: this.last, timestamp: new Date(t).toISOString(),
      sessionId: this.sessionId, cwd: this.cwd, gitBranch: this.branch, isSidechain: !!this.sidechain,
    };
    if (this.agentId) rec.agentId = this.agentId;
    this.last = uuidV;
    return rec;
  }

  user(t, content, extra) {
    this.lines.push({ ...this.base('user', t), message: { role: 'user', content }, ...extra });
    this.ctx += typeof content === 'string' ? Math.ceil(content.length / 4) : 400 + Math.floor(this.r() * 3500);
  }

  // Emits one API response; returns when it finished.
  assistant(t, content) {
    const r = this.r;
    const out = Math.round(Math.exp(4.2 + r() * 2.8)); // ~65 .. ~1100 tokens, long tail
    const gen = 0.8 + r() * 2.2 + out / (this.speed * (0.85 + r() * 0.3));
    const expired = this.lastReq != null && t - this.lastReq > 3600e3;
    const read = expired ? 0 : this.cached;
    const write = this.ctx - read;
    const rec = this.base('assistant', t + gen * 1000);
    rec.requestId = id('req_', r);
    rec.message = {
      id: id('msg_', r), type: 'message', role: 'assistant', model: this.model, content,
      usage: {
        input_tokens: 1 + Math.floor(r() * 6),
        cache_creation_input_tokens: write,
        cache_read_input_tokens: read,
        output_tokens: out,
        output_tokens_details: { thinking_tokens: Math.round(out * (0.2 + r() * 0.4)) },
        cache_creation: { ephemeral_1h_input_tokens: write, ephemeral_5m_input_tokens: 0 },
        service_tier: 'standard', speed: 'standard',
      },
    };
    this.lines.push(rec);
    this.cached = this.ctx;
    this.ctx += out;
    this.lastReq = t;
    if (this.ctx > 180000) {
      // Auto-compaction: history is summarized and the next request misses the cache.
      this.ctx = 30000 + Math.floor(r() * 15000);
      this.cached = 0;
    }
    return t + gen * 1000;
  }

  maxTs() {
    return this.lines.reduce((m, l) => Math.max(m, Date.parse(l.timestamp)), -Infinity);
  }

  shift(ms) {
    for (const l of this.lines) l.timestamp = new Date(Date.parse(l.timestamp) + ms).toISOString();
  }

  write(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, this.lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  }
}

const TOOLS = ['Read', 'Grep', 'Edit', 'Bash', 'Glob', 'Write'];

// Runs tool-use steps from t until `until`; returns the time the last response ended.
function work(th, t, until) {
  let lastToolId = null;
  while (t < until) {
    if (lastToolId) th.user(t, [{ type: 'tool_result', tool_use_id: lastToolId, content: 'ok' }]);
    lastToolId = id('toolu_', th.r);
    const name = TOOLS[Math.floor(th.r() * TOOLS.length)];
    t = th.assistant(t, [{ type: 'tool_use', id: lastToolId, name, input: {} }]);
    t += 400 + th.r() * 9000; // the tool runs
  }
  th.user(t, [{ type: 'tool_result', tool_use_id: lastToolId, content: 'ok' }]);
  return t;
}

function writeDemo(root, now = Date.now(), seed = 7) {
  const r = rng(seed);
  for (const s of SESSIONS) {
    const sessionId = uuid(r);
    const cwd = `/home/you/code/${s.project}`;
    const projDir = path.join(root, cwd.replace(/[^a-zA-Z0-9]/g, '-'));
    const spanMs = s.spanMin * 60e3;
    const end = s.live ? now : now - s.hoursAgo * 3600e3;
    const start = end - spanMs;
    const th = new Thread({ r, sessionId, cwd, branch: s.branch, model: s.model, speed: s.speed });
    const threads = [[th, path.join(projDir, `${sessionId}.jsonl`)]];

    const per = spanMs / s.turns.length;
    let t = start;
    s.turns.forEach(([prompt, reply], i) => {
      const last = i === s.turns.length - 1;
      const burstEnd = start + per * (i + 1) - (last ? 0 : per * (0.2 + r() * 0.3));
      th.user(t, prompt);
      for (const sub of s.subagents || []) {
        if (Math.floor(sub.at * s.turns.length) !== i) continue;
        const toolId = id('toolu_', r);
        t = th.assistant(t, [{ type: 'tool_use', id: toolId, name: 'Agent', input: { subagent_type: sub.type, description: sub.desc, prompt: sub.desc } }]);
        const agentId = crypto.createHash('sha1').update(sessionId + sub.desc).digest('hex').slice(0, 16);
        const sth = new Thread({ r, sessionId, cwd, branch: s.branch, model: sub.model, speed: sub.speed, sidechain: true, agentId });
        sth.user(t, sub.desc);
        const subEnd = work(sth, t + 500, t + per * (0.15 + r() * 0.15));
        sth.assistant(subEnd, [{ type: 'text', text: `Finished: ${sub.desc.toLowerCase()}.` }]);
        threads.push([sth, path.join(projDir, sessionId, 'subagents', `agent-${agentId}.jsonl`)]);
        t = subEnd + 1500;
        th.user(t, [{ type: 'tool_result', tool_use_id: toolId, content: 'done' }], { toolUseResult: { agentId, status: 'completed' } });
      }
      t = work(th, t, burstEnd - 20000);
      // The live sessions' last turn is still in progress: no final reply yet.
      if (!(s.live && last)) t = th.assistant(t, [{ type: 'text', text: reply }]);
      t = Math.max(t, burstEnd);
    });

    // Live sessions: land the most recent activity a few seconds before `now`.
    const shift = s.live ? now - (3000 + r() * 12000) - Math.max(...threads.map(([x]) => x.maxTs())) : 0;
    for (const [x, file] of threads) {
      if (shift) x.shift(shift);
      x.write(file);
    }
  }
}

module.exports = { writeDemo };
