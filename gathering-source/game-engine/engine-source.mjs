// The deterministic game engine shared by the browser sandbox (design preview and
// self-test) and the server referee (QuickJS inside a Durable Object). It is plain
// JavaScript source text, evaluated inside those sandboxes, never in the app itself.

// Shared by the Worker and the in-frame fallback: seeded randomness, JSON-only data
// and deterministic replay of a move log.
export const ENGINE_SOURCE = String.raw`
function nightsMix(seed, n) {
  var h = (seed ^ Math.imul(n + 1, 0x9E3779B1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
  return (h ^ (h >>> 16)) >>> 0;
}
function nightsRng(seed) {
  var a = seed >>> 0;
  function next() {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  var rng = function () { return next(); };
  rng.int = function (n) { return Math.floor(next() * Math.max(0, Math.floor(Number(n) || 0))); };
  rng.pick = function (items) { return Array.isArray(items) && items.length ? items[Math.floor(next() * items.length)] : undefined; };
  rng.shuffle = function (items) {
    var copy = Array.isArray(items) ? items.slice() : [];
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(next() * (i + 1));
      var swap = copy[i]; copy[i] = copy[j]; copy[j] = swap;
    }
    return copy;
  };
  return Object.freeze(rng);
}
function nightsJson(value, label) {
  if (value === undefined) throw new Error(label + ' returned nothing.');
  var text = JSON.stringify(value);
  if (text === undefined) throw new Error(label + ' must return plain JSON data.');
  if (text.length > 200000) throw new Error(label + ' returned too much data.');
  return JSON.parse(text);
}
function nightsMessage(error) {
  return String((error && error.message) || error || 'Refused.').slice(0, 300);
}
function createEngine(game) {
  var players = [];
  var seed = 1;
  var state = null;
  var count = 0;
  var creator = null;
  function requireGame() {
    ['setup', 'move', 'view'].forEach(function (name) {
      if (!game || typeof game[name] !== 'function') throw new Error('The game rules do not declare function ' + name + '().');
    });
  }
  function roster() { return players.map(function (p) { return { id: p.id, name: p.name }; }); }
  function seatOrNull(value) {
    var id = value == null ? null : String(value);
    return players.some(function (p) { return p.id === id; }) ? id : null;
  }
  function step(action, player, at) {
    return nightsJson(game.move(nightsJson(state, 'The state'), nightsJson(action, 'The action'), {
      player: player, players: roster(), creator: creator, now: at, rng: nightsRng(nightsMix(seed, count + 1)),
    }), 'move()');
  }
  return {
    reset: function (input) {
      requireGame();
      players = (input.players || []).map(function (p) { return { id: String(p.id), name: String(p.name) }; });
      seed = input.seed >>> 0;
      creator = seatOrNull(input.creator);
      count = 0;
      state = null;
      state = nightsJson(game.setup({ players: roster(), creator: creator, rng: nightsRng(nightsMix(seed, 0)) }), 'setup()');
      return true;
    },
    apply: function (input) {
      return (input.moves || []).map(function (entry) {
        var outcome = 'ok';
        if (!players.some(function (p) { return p.id === entry.player; })) outcome = 'Unknown player.';
        else {
          try { state = step(entry.action, entry.player, Number(entry.at) || 0); }
          catch (error) { outcome = nightsMessage(error); }
        }
        count += 1;
        return outcome;
      });
    },
    restore: function (input) {
      requireGame();
      players = (input.players || []).map(function (p) { return { id: String(p.id), name: String(p.name) }; });
      seed = input.seed >>> 0;
      creator = seatOrNull(input.creator);
      count = Number(input.count) || 0;
      state = nightsJson(input.state, 'The saved state');
      return true;
    },
    dump: function () { return { state: state, count: count }; },
    check: function (input) {
      step(input.action, String(input.player), Number(input.at) || 0);
      return true;
    },
    view: function (input) {
      return nightsJson(game.view(nightsJson(state, 'The state'), input.player == null ? null : String(input.player), { players: roster(), creator: creator }), 'view()');
    },
  };
}
`;

// Installed before the rules load (browser Worker and server QuickJS).
export const WORKER_GUARDS = String.raw`
(function () {
  var self = typeof globalThis !== 'undefined' ? globalThis : this;
  function blocked(name, hint) { return function () { throw new Error(name + ' is not available in game rules. Use ' + hint + '.'); }; }
  Math.random = blocked('Math.random()', 'ctx.rng');
  var RealDate = Date;
  function SafeDate() {
    if (!arguments.length) throw new Error('new Date() is not available in game rules. Use ctx.now.');
    var args = [null];
    for (var i = 0; i < arguments.length; i += 1) args.push(arguments[i]);
    return new (Function.prototype.bind.apply(RealDate, args))();
  }
  SafeDate.now = blocked('Date.now()', 'ctx.now');
  SafeDate.UTC = RealDate.UTC;
  SafeDate.parse = RealDate.parse;
  SafeDate.prototype = RealDate.prototype;
  self.Date = SafeDate;
  ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel']
    .forEach(function (name) { try { self[name] = undefined; } catch (error) {} });
})();
`;
