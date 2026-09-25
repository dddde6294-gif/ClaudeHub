'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { StringDecoder } = require('string_decoder');
const { costOf, normalizeModel } = require('./pricing');

// Requests whose output is shorter than this are dominated by time-to-first-token,
// so they are left out of the output-speed calculation.
const MIN_SPEED_TOKENS = 50;
const MAX_GEN_SECONDS = 900;
const CHAT_HISTORY = 60;
const CHAT_TEXT_LIMIT = 4000;
const READ_CHUNK = 8 * 1024 * 1024;

function defaultRoots() {
  const env = process.env.CLAUDE_CONFIG_DIR;
  const bases = env
    ? env.split(',').map((s) => s.trim()).filter(Boolean)
    : [path.join(os.homedir(), '.config', 'claude'), path.join(os.homedir(), '.claude')];
  return bases.map((b) => path.join(b, 'projects'));
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((c) => c && c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n');
}

// A "real" prompt typed by a person, as opposed to tool results or harness-injected
// command/caveat wrappers.
function isHumanPrompt(rec) {
  if (rec.type !== 'user' || rec.isMeta || !rec.message) return false;
  const c = rec.message.content;
  if (Array.isArray(c) && c.some((b) => b && b.type === 'tool_result')) return false;
  const t = textOf(c).trim();
  return t.length > 0 && !t.startsWith('<') && !t.startsWith('Caveat:');
}

function clip(s, n) {
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

class Scanner {
  constructor(roots) {
    this.roots = roots && roots.length ? roots : defaultRoots();
    this.files = new Map(); // path -> file state
    this.agents = new Map(); // agentKey -> agent
    this.requests = new Map(); // dedupe key -> request
    this.taskLabels = new Map(); // agentId -> label from the parent's Task/Agent call
    this.pendingTasks = new Map(); // tool_use id -> label
  }

  scan() {
    for (const root of this.roots) {
      // Oldest files first: when a resumed/forked session copies earlier messages
      // into a new file, the original file keeps credit for them.
      const files = walk(root, [])
        .filter((f) => !this.files.has(f))
        .map((f) => {
          try {
            const st = fs.statSync(f);
            return [f, st.birthtimeMs || st.ctimeMs];
          } catch {
            return [f, 0];
          }
        })
        .sort((a, b) => a[1] - b[1])
        .map(([f]) => f);
      for (const file of this.files.keys()) if (file.startsWith(root + path.sep)) this.readFile(file, root);
      for (const file of files) this.readFile(file, root);
    }
  }

  agentFor(file, root) {
    const rel = path.relative(root, file).split(path.sep);
    const project = rel[0];
    const base = path.basename(file, '.jsonl');
    // Newer Claude Code: <project>/<sessionId>/subagents/agent-<id>.jsonl
    const subIdx = rel.indexOf('subagents');
    let key, sessionId, agentId, kind;
    if (subIdx > 0) {
      sessionId = rel[subIdx - 1];
      agentId = base.replace(/^agent-/, '');
      key = `${sessionId}/${agentId}`;
      kind = 'subagent';
    } else {
      sessionId = base;
      key = sessionId;
      kind = 'session';
    }
    if (!this.agents.has(key)) {
      this.agents.set(key, {
        key,
        kind,
        sessionId,
        agentId: agentId || null,
        parent: kind === 'subagent' ? sessionId : null,
        project,
        cwd: null,
        branch: null,
        label: null,
        title: null,
        firstTs: null,
        lastTs: null,
        models: new Set(),
        chat: [],
      });
    }
    return this.agents.get(key);
  }

  // Older Claude Code wrote subagent turns into the session file with isSidechain.
  sidechainAgent(parent) {
    const key = `${parent.sessionId}/sidechain`;
    if (!this.agents.has(key)) {
      this.agents.set(key, {
        ...parent,
        key,
        kind: 'subagent',
        agentId: 'sidechain',
        parent: parent.key,
        label: 'Subagents (inline)',
        title: null,
        firstTs: null,
        lastTs: null,
        models: new Set(),
        chat: [],
      });
    }
    return this.agents.get(key);
  }

  readFile(file, root) {
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      return;
    }
    let state = this.files.get(file);
    if (state && st.size < state.offset) state = null; // truncated / rewritten
    if (!state) {
      state = {
        offset: 0,
        leftover: '',
        // Keeps a multi-byte character that straddles two reads intact.
        decoder: new StringDecoder('utf8'),
        uuidTs: new Map(),
        prevTs: null,
        agent: this.agentFor(file, root),
        file,
      };
      this.files.set(file, state);
    }
    if (st.size === state.offset) return;

    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(Math.min(READ_CHUNK, st.size - state.offset));
      while (state.offset < st.size) {
        const n = fs.readSync(fd, buf, 0, Math.min(buf.length, st.size - state.offset), state.offset);
        if (n <= 0) break;
        state.offset += n;
        const lines = (state.leftover + state.decoder.write(buf.subarray(0, n))).split('\n');
        state.leftover = lines.pop(); // incomplete last line, finished by the next read
        for (const line of lines) {
          if (!line.trim()) continue;
          let rec;
          try {
            rec = JSON.parse(line);
          } catch {
            continue;
          }
          this.ingest(rec, state);
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  ingest(rec, state) {
    let agent = state.agent;
    if (rec.isSidechain && agent.kind === 'session') agent = this.sidechainAgent(agent);

    if (rec.type === 'summary' && rec.summary) agent.title = agent.title || rec.summary;
    if (rec.type === 'custom-title' && rec.customTitle) agent.title = rec.customTitle;

    const ts = rec.timestamp ? Date.parse(rec.timestamp) : NaN;
    if (!Number.isNaN(ts)) {
      if (rec.uuid) {
        state.uuidTs.set(rec.uuid, ts);
        // Parents are almost always a few records back; don't keep every uuid forever.
        if (state.uuidTs.size > 512) state.uuidTs.delete(state.uuidTs.keys().next().value);
      }
      if (rec.type === 'user' || rec.type === 'assistant') {
        agent.firstTs = agent.firstTs == null ? ts : Math.min(agent.firstTs, ts);
        agent.lastTs = agent.lastTs == null ? ts : Math.max(agent.lastTs, ts);
      }
    }
    if (rec.cwd && !agent.cwd) agent.cwd = rec.cwd;
    if (rec.gitBranch) agent.branch = rec.gitBranch;

    if (rec.type === 'user') this.ingestUser(rec, agent, ts);
    if (rec.type === 'assistant' && rec.message) this.ingestAssistant(rec, agent, state, ts);

    if (!Number.isNaN(ts)) state.prevTs = ts;
  }

  ingestUser(rec, agent, ts) {
    const content = rec.message && rec.message.content;
    if (isHumanPrompt(rec)) {
      const t = textOf(content);
      if (!agent.label) agent.label = clip(t, 90);
      pushChat(agent, { role: 'user', text: t, ts });
    }
    // Link subagent transcripts back to the Task/Agent call that launched them.
    const res = rec.toolUseResult;
    if (res && typeof res === 'object' && res.agentId && Array.isArray(content)) {
      for (const b of content) {
        if (b && b.type === 'tool_result' && this.pendingTasks.has(b.tool_use_id)) {
          this.taskLabels.set(String(res.agentId), this.pendingTasks.get(b.tool_use_id));
        }
      }
    }
  }

  ingestAssistant(rec, agent, state, ts) {
    const msg = rec.message;
    const model = normalizeModel(msg.model);
    const content = Array.isArray(msg.content) ? msg.content : [];

    for (const b of content) {
      if (b && b.type === 'tool_use' && (b.name === 'Task' || b.name === 'Agent') && b.input) {
        const label = [b.input.subagent_type, b.input.description].filter(Boolean).join(': ');
        if (label) this.pendingTasks.set(b.id, label);
      }
    }
    const t = textOf(content);
    if (t.trim()) pushChat(agent, { role: 'assistant', text: t, ts, id: msg.id });

    const u = msg.usage;
    if (!u || !model || model === '<synthetic>') return;

    const key = `${msg.id || rec.uuid}:${rec.requestId || ''}`;
    let req = this.requests.get(key);
    if (req && req.file !== state.file) return; // same message replayed into a resumed session file

    const cc = u.cache_creation || {};
    const cw1h = cc.ephemeral_1h_input_tokens || 0;
    const cwTotal = u.cache_creation_input_tokens || 0;
    const usage = {
      input: u.input_tokens || 0,
      cacheWrite1h: cw1h,
      cacheWrite5m: Math.max(0, cwTotal - cw1h),
      cacheRead: u.cache_read_input_tokens || 0,
      output: u.output_tokens || 0,
      thinking: (u.output_tokens_details && u.output_tokens_details.thinking_tokens) || 0,
      fast: u.speed === 'fast',
    };

    if (!req) {
      const parentTs = rec.parentUuid != null ? state.uuidTs.get(rec.parentUuid) : undefined;
      req = {
        key,
        file: state.file,
        agent: agent.key,
        model,
        start: parentTs != null ? parentTs : state.prevTs,
        end: ts,
      };
      this.requests.set(key, req);
      agent.models.add(model);
    }
    // Every content block of one response repeats the usage; keep the largest.
    if (!req.usage || usage.output >= req.usage.output) req.usage = usage;
    if (!Number.isNaN(ts)) req.end = Math.max(req.end || ts, ts);
    req.cost = costOf(model, req.usage);
  }

  agentLabel(a) {
    if (a.kind === 'subagent' && this.taskLabels.has(a.agentId)) return this.taskLabels.get(a.agentId);
    return a.title || a.label || (a.kind === 'subagent' ? `Subagent ${a.agentId}` : `Session ${a.sessionId.slice(0, 8)}`);
  }
}

function pushChat(agent, entry) {
  entry.text = entry.text.length > CHAT_TEXT_LIMIT ? entry.text.slice(0, CHAT_TEXT_LIMIT) + '…' : entry.text;
  const last = agent.chat[agent.chat.length - 1];
  // Streaming writes one line per content block; merge blocks of the same message.
  if (entry.id && last && last.id === entry.id) {
    last.text += '\n' + entry.text;
    return;
  }
  agent.chat.push(entry);
  if (agent.chat.length > CHAT_HISTORY) agent.chat.shift();
}

function genSeconds(r) {
  if (r.start == null || r.end == null) return null;
  const s = (r.end - r.start) / 1000;
  return s > 0 && s < MAX_GEN_SECONDS ? s : null;
}

function speedEligible(r) {
  return r.usage.output >= MIN_SPEED_TOKENS && genSeconds(r) != null;
}

module.exports = { Scanner, defaultRoots, genSeconds, speedEligible, isHumanPrompt, textOf };
