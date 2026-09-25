'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { Scanner, isHumanPrompt } = require('../lib/scanner');
const { build } = require('../lib/stats');
const { costOf, priceFor } = require('../lib/pricing');
const { tmpdir, writeJsonl, usage, session } = require('./helpers');

const SID = '11111111-2222-4333-8444-555555555555';

test('counts a response streamed over several lines once', () => {
  const root = tmpdir();
  writeJsonl(path.join(root, '-proj', `${SID}.jsonl`), session({ sessionId: SID, cwd: '/proj' }));
  const sc = new Scanner([root]);
  sc.scan();
  assert.strictEqual(sc.requests.size, 1);
  const s = build(sc, { now: Date.parse('2026-09-24T10:01:00Z') });
  assert.strictEqual(s.totals.requests, 1);
  assert.strictEqual(s.totals.output, 300);
  assert.strictEqual(s.totals.cacheRead, 5000);
  // 300 output tokens from the prompt (t=0) to the last block (t=5s)
  assert.strictEqual(Math.round(s.totals.outputSpeed), 60);
  const a = s.agents[0];
  assert.strictEqual(a.label, 'Fix the flaky login test');
  assert.strictEqual(a.live, true);
  assert.deepStrictEqual(a.models, ['claude-sonnet-5']);
});

test('messages copied into a resumed session file are not double counted', () => {
  const root = tmpdir();
  const original = path.join(root, '-proj', `${SID}.jsonl`);
  writeJsonl(original, session({ sessionId: SID, cwd: '/proj' }));
  const sc = new Scanner([root]);
  sc.scan();
  const forkId = '99999999-2222-4333-8444-555555555555';
  writeJsonl(path.join(root, '-proj', `${forkId}.jsonl`), session({ sessionId: forkId, cwd: '/proj' }));
  sc.scan();
  assert.strictEqual(sc.requests.size, 1);
  assert.strictEqual([...sc.requests.values()][0].file, original);
});

test('reads appended lines incrementally, including a line split across writes', () => {
  const root = tmpdir();
  const file = path.join(root, '-proj', `${SID}.jsonl`);
  writeJsonl(file, session({ sessionId: SID, cwd: '/proj' }));
  const sc = new Scanner([root]);
  sc.scan();
  const next = JSON.stringify({
    type: 'assistant', uuid: 'a3', parentUuid: 'a2', timestamp: '2026-09-24T10:00:09Z', sessionId: SID, requestId: 'req_2',
    message: { id: 'msg_2', model: 'claude-sonnet-5', role: 'assistant', content: [], usage: usage({ output_tokens: 50 }) },
  });
  fs.appendFileSync(file, next.slice(0, 40));
  sc.scan();
  assert.strictEqual(sc.requests.size, 1);
  fs.appendFileSync(file, next.slice(40) + '\n');
  sc.scan();
  assert.strictEqual(sc.requests.size, 2);
});

test('subagent transcripts nest under their session and take the Agent call as label', () => {
  const root = tmpdir();
  const recs = session({ sessionId: SID, cwd: '/proj' });
  recs.push(
    { type: 'assistant', uuid: 'a4', parentUuid: 'a2', timestamp: '2026-09-24T10:00:10Z', sessionId: SID, requestId: 'req_3',
      message: { id: 'msg_3', model: 'claude-sonnet-5', role: 'assistant', usage: usage(),
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'Agent', input: { subagent_type: 'Explore', description: 'Find the auth code' } }] } },
    { type: 'user', uuid: 'u2', parentUuid: 'a4', timestamp: '2026-09-24T10:01:00Z', sessionId: SID,
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'done' }] }, toolUseResult: { agentId: 'abc123' } },
  );
  writeJsonl(path.join(root, '-proj', `${SID}.jsonl`), recs);
  writeJsonl(path.join(root, '-proj', SID, 'subagents', 'agent-abc123.jsonl'), [
    { type: 'user', uuid: 's1', parentUuid: null, timestamp: '2026-09-24T10:00:11Z', sessionId: SID, isSidechain: true, message: { role: 'user', content: 'Find the auth code' } },
    { type: 'assistant', uuid: 's2', parentUuid: 's1', timestamp: '2026-09-24T10:00:14Z', sessionId: SID, isSidechain: true, requestId: 'req_s',
      message: { id: 'msg_s', model: 'claude-haiku-4-5', role: 'assistant', content: [], usage: usage() } },
  ]);
  const sc = new Scanner([root]);
  sc.scan();
  const s = build(sc, { now: Date.parse('2026-09-24T12:00:00Z') });
  const sub = s.agents.find((a) => a.kind === 'subagent');
  assert.ok(sub);
  assert.strictEqual(sub.parent, SID);
  assert.strictEqual(sub.label, 'Explore: Find the auth code');
  assert.strictEqual(sub.canMessage, false);
  assert.strictEqual(s.totals.requests, 3);
});

test('prices cache writes by TTL and uses model-specific cache-read rates', () => {
  const u = { input: 2, cacheWrite5m: 0, cacheWrite1h: 18937, cacheRead: 39489, output: 178, fast: false };
  const expected = (2 * 4 + 18937 * 4 * 2 + 39489 * 0.2 + 178 * 20) / 1e6;
  assert.ok(Math.abs(costOf('claude-opus-5-5', u) - expected) < 1e-12);
  // Default cache read is 0.1x input; 5-minute writes are 1.25x.
  const v = { input: 0, cacheWrite5m: 1e6, cacheWrite1h: 0, cacheRead: 1e6, output: 0, fast: false };
  assert.ok(Math.abs(costOf('claude-sonnet-5', v) - (2 * 1.25 + 0.2)) < 1e-12);
  assert.strictEqual(priceFor('claude-opus-5-5').input, 4);
  assert.strictEqual(priceFor('claude-opus-5').input, 5);
  assert.strictEqual(priceFor('us.anthropic.claude-sonnet-5').input, 2);
  assert.strictEqual(costOf('some-other-model', v), null);
});

test('only typed prompts count as human messages', () => {
  assert.ok(isHumanPrompt({ type: 'user', message: { content: 'hello' } }));
  assert.ok(!isHumanPrompt({ type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } }));
  assert.ok(!isHumanPrompt({ type: 'user', message: { content: '<command-name>/clear</command-name>' } }));
  assert.ok(!isHumanPrompt({ type: 'user', isMeta: true, message: { content: 'hi' } }));
});
