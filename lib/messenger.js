'use strict';

const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

// On Windows `claude` is a .cmd shim, which needs a shell. Every argument is a fixed
// flag or a validated session id; the message itself goes over stdin.
const WINDOWS = process.platform === 'win32';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Messenger {
  constructor({ claudeBin = 'claude', permissionMode = null } = {}) {
    this.claudeBin = claudeBin;
    this.permissionMode = permissionMode;
    this.busy = new Set(); // session ids with a message in flight
    this._flags = null;
  }

  // Probe once which optional flags this claude build understands.
  flags() {
    if (this._flags) return this._flags;
    let help = '';
    try {
      help = execFileSync(this.claudeBin, ['--help'], { encoding: 'utf8', timeout: 15000, shell: WINDOWS });
    } catch (e) {
      help = (e && e.stdout) || '';
    }
    this._flags = {
      available: help.includes('--resume'),
      permissionPrompts: help.includes('--permission-prompts'),
      partial: help.includes('--include-partial-messages'),
    };
    return this._flags;
  }

  // Sends `text` to the session and calls emit(event) for each streamed event.
  // Returns a function that aborts the run.
  send({ sessionId, cwd, text, fork }, emit) {
    if (!UUID_RE.test(sessionId)) throw new Error('Not a resumable session id');
    if (!cwd || !fs.existsSync(cwd)) throw new Error(`Session directory not found on this machine: ${cwd || '(unknown)'}`);
    const f = this.flags();
    if (!f.available) throw new Error(`Could not run "${this.claudeBin}". Install Claude Code or pass --claude-bin.`);
    if (this.busy.has(sessionId)) throw new Error('A message to this session is already running');

    const args = ['-p', '--resume', sessionId, '--output-format', 'stream-json', '--verbose'];
    if (f.partial) args.push('--include-partial-messages');
    // Nobody is at a terminal to answer permission prompts, so deny them instead of hanging.
    if (f.permissionPrompts) args.push('--permission-prompts', 'none');
    if (this.permissionMode) args.push('--permission-mode', this.permissionMode);
    if (fork) args.push('--fork-session');

    this.busy.add(sessionId);
    const child = spawn(this.claudeBin, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: process.env, shell: WINDOWS });
    // The prompt goes over stdin so text starting with "-" is never read as a flag.
    child.stdin.end(text);

    let buf = '';
    let stderr = '';
    let sawDelta = false;
    let finished = false;
    const done = (evt) => {
      if (finished) return;
      finished = true;
      this.busy.delete(sessionId);
      emit(evt);
    };

    child.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let m;
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }
        if (m.type === 'system' && m.subtype === 'init') {
          emit({ type: 'init', sessionId: m.session_id, model: m.model });
        } else if (m.type === 'stream_event' && m.event) {
          const ev = m.event;
          if (m.parent_tool_use_id) continue; // subagent chatter
          if (ev.type === 'message_start') sawDelta = false;
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
            sawDelta = true;
            emit({ type: 'text', text: ev.delta.text });
          }
          if (ev.type === 'content_block_start' && ev.content_block && ev.content_block.type === 'tool_use') {
            emit({ type: 'tool', name: ev.content_block.name });
          }
        } else if (m.type === 'assistant' && m.message && !m.parent_tool_use_id && !sawDelta) {
          // Builds without partial messages only send whole messages.
          for (const b of m.message.content || []) {
            if (b.type === 'text' && b.text) emit({ type: 'text', text: b.text });
            if (b.type === 'tool_use') emit({ type: 'tool', name: b.name });
          }
        } else if (m.type === 'result') {
          done({
            type: 'done',
            sessionId: m.session_id,
            cost: m.total_cost_usd,
            isError: !!m.is_error,
            error: m.is_error ? m.result || m.subtype : null,
          });
        }
      }
    });
    child.stderr.on('data', (c) => {
      stderr = (stderr + c.toString('utf8')).slice(-4000);
    });
    child.on('error', (e) => done({ type: 'error', error: e.message }));
    child.on('close', (code) => {
      if (code === 0) done({ type: 'done' });
      else done({ type: 'error', error: stderr.trim() || `claude exited with code ${code}` });
    });

    return () => {
      if (!finished) child.kill('SIGTERM');
    };
  }
}

module.exports = { Messenger, UUID_RE };
