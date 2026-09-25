#!/usr/bin/env node
'use strict';
// Stands in for the claude CLI: records how it was called and streams a canned reply.
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('--resume --fork-session --include-partial-messages --permission-prompts --output-format');
  process.exit(0);
}
let stdin = '';
process.stdin.on('data', (c) => (stdin += c));
process.stdin.on('end', () => {
  if (process.env.FAKE_CLAUDE_LOG) fs.writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ args, stdin, cwd: process.cwd() }));
  const sid = args[args.indexOf('--resume') + 1];
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
  out({ type: 'system', subtype: 'init', session_id: sid, model: 'claude-sonnet-5' });
  out({ type: 'stream_event', event: { type: 'message_start' } });
  out({ type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'tool_use', name: 'Read' } } });
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } } });
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'there' } } });
  out({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello there' }] } });
  out({ type: 'result', subtype: 'success', is_error: false, session_id: sid, total_cost_usd: 0.01, result: 'Hello there' });
});
