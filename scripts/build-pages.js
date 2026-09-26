#!/usr/bin/env node
'use strict';

// Builds the static site for GitHub Pages: the dashboard page plus a demo dataset
// it shows until the visitor pairs it with a ClaudeHub running on their computer,
// and the Emberfall game under /rpg/.
// Nothing here reads real transcripts.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeDemo } = require('../lib/demo');
const { Scanner } = require('../lib/scanner');
const { build } = require('../lib/stats');

const RANGES = { 3600000: 3600e3, 86400000: 86400e3, 604800000: 604800e3, 2592000000: 2592000e3, all: null };

function main(outDir) {
  const out = path.resolve(outDir || '_site');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claudehub-pages-'));
  try {
    const now = Date.now();
    writeDemo(tmp, now);
    const scanner = new Scanner([tmp]);
    scanner.scan();

    const stats = {};
    for (const [key, rangeMs] of Object.entries(RANGES)) {
      stats[key] = build(scanner, { rangeMs, now });
      stats[key].roots = ['~/.claude/projects'];
      stats[key].hub = { messaging: false, demo: true };
    }
    const chats = {};
    for (const a of scanner.agents.values()) if (a.kind === 'session') chats[a.key] = a.chat;

    fs.mkdirSync(out, { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', 'public', 'index.html'), path.join(out, 'index.html'));
    fs.writeFileSync(path.join(out, 'demo.json'), JSON.stringify({ now, stats, chats }));
    // Emberfall, the browser RPG, is published as a sub-site at /rpg/.
    fs.cpSync(path.join(__dirname, '..', 'rpg', 'web'), path.join(out, 'rpg'), { recursive: true });
    console.log(`Wrote ${out}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main(process.argv[2]);
