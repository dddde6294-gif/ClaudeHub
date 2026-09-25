'use strict';

// USD per million tokens. Cache writes bill at 1.25x input (5-minute TTL) or
// 2x input (1-hour TTL); cache reads default to 0.1x input unless overridden.
// Fast mode bills at 2x standard. Edit this table if your rates differ
// (e.g. Bedrock / Vertex partner pricing).
const MODELS = [
  // Longest prefix wins, so more specific ids come first.
  { match: 'claude-fable-5-1', input: 10, output: 50, cacheRead: 0.25 },
  { match: 'claude-mythos-5-1', input: 10, output: 50, cacheRead: 0.25 },
  { match: 'claude-fable-5', input: 10, output: 50, cacheRead: 1 },
  { match: 'claude-mythos-5', input: 10, output: 50, cacheRead: 1 },
  { match: 'claude-opus-5-5', input: 4, output: 20, cacheRead: 0.2 },
  { match: 'claude-opus-5', input: 5, output: 25 },
  { match: 'claude-opus-4-8', input: 5, output: 25 },
  { match: 'claude-opus-4-7', input: 5, output: 25 },
  { match: 'claude-opus-4-6', input: 5, output: 25 },
  { match: 'claude-opus-4-5', input: 5, output: 25 },
  { match: 'claude-opus-4-1', input: 15, output: 75 },
  { match: 'claude-opus-4', input: 15, output: 75 },
  { match: 'claude-3-opus', input: 15, output: 75 },
  { match: 'claude-sonnet-5', input: 2, output: 10 },
  { match: 'claude-sonnet-4', input: 3, output: 15 },
  { match: 'claude-3-7-sonnet', input: 3, output: 15 },
  { match: 'claude-3-5-sonnet', input: 3, output: 15 },
  { match: 'claude-haiku-4-5', input: 1, output: 5 },
  { match: 'claude-3-5-haiku', input: 0.8, output: 4 },
  { match: 'claude-3-haiku', input: 0.25, output: 1.25 },
].sort((a, b) => b.match.length - a.match.length);

function normalizeModel(model) {
  if (!model) return '';
  // Strip provider prefixes ("anthropic.", "us.anthropic.") and Vertex "@date" suffixes.
  return String(model).replace(/^(?:[a-z]{2}\.)?anthropic\./, '').replace(/@.*$/, '').replace(/\[.*\]$/, '');
}

function priceFor(model) {
  const id = normalizeModel(model);
  return MODELS.find((m) => id.startsWith(m.match)) || null;
}

// usage: { input, cacheWrite5m, cacheWrite1h, cacheRead, output, fast }
// Returns USD, or null when the model has no known price.
function costOf(model, u) {
  const p = priceFor(model);
  if (!p) return null;
  const read = p.cacheRead != null ? p.cacheRead : p.input * 0.1;
  const dollars =
    u.input * p.input +
    u.cacheWrite5m * p.input * 1.25 +
    u.cacheWrite1h * p.input * 2 +
    u.cacheRead * read +
    u.output * p.output;
  return (dollars / 1e6) * (u.fast ? 2 : 1);
}

module.exports = { MODELS, priceFor, costOf, normalizeModel };
