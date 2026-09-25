'use strict';

// A small client for DonutSMP's public API (https://api.donutsmp.net/index.html).
// The auction search takes its JSON body on a GET request, which fetch() refuses to
// send, so this goes through http(s).request instead.

const http = require('http');
const https = require('https');

const DEFAULT_BASE = 'https://api.donutsmp.net';
const USER_AGENT = 'DonutHUD (+https://github.com/dddde6294-gif/ClaudeHub)';

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function send(base, path, auth, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json', Authorization: auth, 'User-Agent': USER_AGENT };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.request(url, { method: 'GET', headers, timeout: timeoutMs }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        text += c;
        if (text.length > 16e6) req.destroy(new Error('the response was too large'));
      });
      res.on('end', () => resolve({ status: res.statusCode, text }));
      res.on('error', (e) => reject(new ApiError('network', `Couldn't reach DonutSMP: ${e.message}`)));
    });
    req.on('timeout', () => req.destroy(new Error('it took too long to answer')));
    req.on('error', (e) => reject(new ApiError('network', `Couldn't reach DonutSMP: ${e.message}`)));
    req.end(payload || undefined);
  });
}

function reason(text) {
  try {
    const j = JSON.parse(text);
    return j && (j.message || j.reason) ? String(j.message || j.reason) : '';
  } catch {
    return '';
  }
}

function interpret(res) {
  if (res.status === 200) {
    let json;
    try {
      json = JSON.parse(res.text);
    } catch {
      throw new ApiError('api_error', 'DonutSMP sent back something that isn’t JSON', 200);
    }
    return Array.isArray(json && json.result) ? json.result : [];
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiError('bad_key', 'DonutSMP didn’t accept the API key. Make a new one in game with /api.', res.status);
  }
  if (res.status === 429) throw new ApiError('rate_limited', 'DonutSMP says the API key is making too many requests.', 429);
  const why = reason(res.text);
  throw new ApiError('api_error', `DonutSMP’s API answered ${res.status}${why ? `: ${why}` : ''}`, res.status);
}

function createClient({ key, base = process.env.DONUT_API_BASE || DEFAULT_BASE, timeoutMs = 20000 } = {}) {
  key = String(key || '').trim().replace(/^bearer\s+/i, '');
  // The docs say "Authorization: Bearer <key>", but some tools send the bare key.
  // If the Bearer form is refused, try the bare key once and keep whichever works.
  let bare = false;

  async function call(path, body) {
    if (!key) throw new ApiError('no_key', 'No DonutSMP API key is set.');
    let res = await send(base, path, bare ? key : `Bearer ${key}`, body, timeoutMs);
    if (res.status === 401 && !bare) {
      const retry = await send(base, path, key, body, timeoutMs);
      if (retry.status !== 401) {
        bare = true;
        res = retry;
      }
    }
    return interpret(res);
  }

  return {
    hasKey: Boolean(key),
    // sort: lowest_price, highest_price, recently_listed or last_listed
    auctions: (page, { search, sort } = {}) => call(`/v1/auction/list/${page}`, { search, sort }),
    // The last 1,000 sales, newest first, 100 per page (pages 1-10).
    transactions: (page) => call(`/v1/auction/transactions/${page}`),
  };
}

module.exports = { createClient, ApiError, DEFAULT_BASE };
