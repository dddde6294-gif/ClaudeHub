// Helpers shared by the Donut HUD page (as window.DonutCore) and the Node scripts.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DonutCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // "minecraft:diamond_pickaxe", "DIAMOND_PICKAXE" and "Diamond Pickaxe" all become "diamond_pickaxe".
  function itemKey(id) {
    return String(id == null ? '' : id).trim().toLowerCase().replace(/^minecraft:/, '').replace(/[\s-]+/g, '_');
  }

  // Minecraft formatting codes (§a, §l, …) should never reach the screen.
  function cleanText(s) {
    return String(s == null ? '' : s).replace(/§[0-9a-fk-orx]/gi, '').trim();
  }

  function trimZeros(s) {
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  }

  const UNITS = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

  // The way DonutSMP writes money: $950, $12.5K, $1.25M.
  function formatMoney(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    const sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    for (const [size, unit] of UNITS) {
      // 999,600 rounds to "1000K" at three digits, so it moves up to the next unit.
      if (n >= size * 0.9995) {
        const x = n / size;
        return sign + '$' + trimZeros(x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)) + unit;
      }
    }
    return sign + '$' + trimZeros(n.toFixed(Number.isInteger(n) || n >= 100 ? 0 : 2));
  }

  function formatExact(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  // What someone types for a price: "150", "$1,200", "1.5k", "2.3 M". NaN when it isn't one.
  function parseMoney(s) {
    const m = String(s == null ? '' : s).trim().toLowerCase().replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d*)?|\.\d+)([kmbt]?)$/);
    if (!m) return NaN;
    return Number(m[1]) * { '': 1, k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[2]];
  }

  const ENCHANT_NAMES = {
    efficiency: 'Efficiency', unbreaking: 'Unbreaking', fortune: 'Fortune', silk_touch: 'Silk Touch',
    mending: 'Mending', vanishing_curse: 'Curse of Vanishing', binding_curse: 'Curse of Binding',
  };
  const ONE_LEVEL = new Set(['mending', 'silk_touch', 'vanishing_curse', 'binding_curse', 'infinity', 'channeling', 'multishot', 'aqua_affinity', 'flame']);
  const NUMERALS = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

  function roman(n) {
    n = Math.floor(Number(n));
    if (!(n > 0) || n > 39) return String(n);
    let out = '';
    for (const [v, s] of NUMERALS) while (n >= v) { out += s; n -= v; }
    return out;
  }

  function enchantName(id, level) {
    const key = itemKey(id);
    const name = ENCHANT_NAMES[key] || key.split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    return ONE_LEVEL.has(key) && level <= 1 ? name : `${name} ${roman(level)}`;
  }

  // [["efficiency", 5], ["mending", 1]] -> "Efficiency V, Mending"
  function enchantList(enchants) {
    return (enchants || []).map(([id, level]) => enchantName(id, level)).join(', ');
  }

  function formatDuration(ms) {
    if (!(ms > 0)) return '0m';
    const m = Math.floor(ms / 60e3);
    if (m < 1) return '<1m';
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
    if (d) return h ? `${d}d ${h}h` : `${d}d`;
    if (h) return min ? `${h}h ${min}m` : `${h}h`;
    return `${min}m`;
  }

  function timeAgo(ms) {
    if (!(ms >= 45e3)) return 'just now';
    return `${formatDuration(Math.max(ms, 60e3)).replace(/ .*/, '')} ago`;
  }

  return { itemKey, cleanText, formatMoney, formatExact, parseMoney, roman, enchantName, enchantList, formatDuration, timeAgo };
});
