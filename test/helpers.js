'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function tmpdir(prefix = 'claudehub-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJsonl(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function usage(o = {}) {
  return {
    input_tokens: 2,
    cache_creation_input_tokens: 1000,
    cache_read_input_tokens: 5000,
    output_tokens: 300,
    cache_creation: { ephemeral_1h_input_tokens: 1000, ephemeral_5m_input_tokens: 0 },
    ...o,
  };
}

// A minimal session: a prompt, then one response streamed as two content blocks.
function session({ sessionId, cwd, t0 = Date.parse('2026-09-24T10:00:00Z'), model = 'claude-sonnet-5', msgId = 'msg_1' }) {
  const ts = (s) => new Date(t0 + s * 1000).toISOString();
  return [
    { type: 'user', uuid: 'u1', parentUuid: null, timestamp: ts(0), sessionId, cwd, gitBranch: 'main', message: { role: 'user', content: 'Fix the flaky login test' } },
    { type: 'assistant', uuid: 'a1', parentUuid: 'u1', timestamp: ts(2), sessionId, cwd, requestId: 'req_1', message: { id: msgId, model, role: 'assistant', content: [{ type: 'thinking', thinking: '' }], usage: usage() } },
    { type: 'assistant', uuid: 'a2', parentUuid: 'a1', timestamp: ts(5), sessionId, cwd, requestId: 'req_1', message: { id: msgId, model, role: 'assistant', content: [{ type: 'text', text: 'Found the race; fixing it.' }], usage: usage() } },
  ];
}

module.exports = { tmpdir, writeJsonl, usage, session };
