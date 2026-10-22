// The game sandbox: the only place AI-generated game code runs on a device.
//
// Security model
// - Generated code only ever runs inside an <iframe sandbox="allow-scripts"> built
//   from srcdoc. Without allow-same-origin the frame has an opaque origin: it cannot
//   read the app's cookies, storage, DOM or Firebase session, open popups, submit
//   forms or navigate the top window.
// - A Content-Security-Policy inside the frame blocks every network request
//   (connect, images, fonts, styles and scripts from anywhere but the frame itself).
// - The parent talks to the frame only through a private MessageChannel and accepts
//   just a few message types; everything the frame says is treated as untrusted.
//
// Two modes
// - 'remote' (live play): the Nights game server referees the game. The frame gets
//   only {me, players, model} for this viewer and sends actions; the rules, seed and
//   full state never reach the device.
// - 'local' (host design preview and the pre-publish self-test): the rules run in a
//   Worker inside the frame, with a watchdog that stops runaway loops.
//
// Data in: seat ids ('p1', ...), display names and the viewer's own view (remote) or
// the sample table (local). No account ids, emails or phone numbers.
// Data out: {type:'send', action} with a plain JSON object under 1.5 KB, plus
// 'ready', 'error' and, in test mode, 'test-result'.

import { ENGINE_SOURCE, WORKER_GUARDS } from '../game-engine/engine-source.mjs';

export type GameRuntime = {
  runtimeVersion: 3;
  instructions: string;
  uiNotes: string;
  logicSource: string;
  uiSource: string;
  styles: string;
  tests: string;
};

export type SandboxPlayer = { id: string; name: string };
export type SandboxMove = { player: string; at: number; action: Record<string, unknown> };
export type SandboxTable = {
  epoch: string;
  seed: number;
  players: SandboxPlayer[];
  me: string | null;
  moves: SandboxMove[];
};

export const MAX_ACTION_LENGTH = 1500;

export const isPlayableRuntime = (runtime: unknown): runtime is GameRuntime => {
  const value = runtime as Partial<GameRuntime> | null;
  return Boolean(value && value.runtimeVersion === 3 && typeof value.logicSource === 'string'
    && typeof value.uiSource === 'string');
};

const SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob:",
  'worker-src blob:',
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

const WORKER_MAIN = String.raw`
var nightsEngine = createEngine(nightsGame);
self.onmessage = function (event) {
  var data = event.data || {};
  try { self.postMessage({ id: data.id, ok: true, result: nightsEngine[data.op](data.payload || {}) }); }
  catch (error) { self.postMessage({ id: data.id, ok: false, error: nightsMessage(error) }); }
};
`;

const wrapLogic = (logic: string) => `var nightsGame = (function () {\n'use strict';\n${logic}\n;return { setup: typeof setup === 'function' ? setup : null, move: typeof move === 'function' ? move : null, view: typeof view === 'function' ? view : null };\n})();\n`;

// Runs inside the sandboxed frame. Plain ES2017, no template literals.
const FRAME_SOURCE = String.raw`
(function (config) {
  'use strict';
  var root = document.getElementById('game');
  var banner = document.getElementById('nights-banner');
  var nativeSetTimeout = window.setTimeout.bind(window);
  var nativeClearTimeout = window.clearTimeout.bind(window);
  var nativeSetInterval = window.setInterval.bind(window);
  var nativeClearInterval = window.clearInterval.bind(window);
  var port = null;
  var engine = null;
  var engineKind = 'worker';
  var renderFn = null;
  var problems = [];
  var uiErrors = [];
  var players = [];
  var me = null;
  var epoch = '';
  var applied = [];
  var model = null;
  var queue = Promise.resolve();
  var sentTimes = [];
  var testSink = null;
  var renderTimers = [];
  var lastConfetti = 0;
  var bannerTimer = 0;

  function post(message) { if (port) { try { port.postMessage(message); } catch (error) {} } }
  function text(error) { return String((error && error.message) || error || 'Unknown error').slice(0, 300); }
  function showBanner(message, tone) {
    banner.textContent = message;
    banner.className = tone || 'error';
    banner.hidden = !message;
    nativeClearTimeout(bannerTimer);
    if (message && tone === 'notice') bannerTimer = nativeSetTimeout(function () { banner.hidden = true; }, 2600);
  }

  addEventListener('error', function (event) {
    var message = String(event.message || 'Script error');
    uiErrors.push(message);
    if (!testSink && port) post({ type: 'error', message: 'Game screen error: ' + message });
  });
  addEventListener('unhandledrejection', function (event) { uiErrors.push(text(event.reason)); });

  // Timers started by one render are cleared before the next render.
  window.setTimeout = function (handler, delay) {
    if (typeof handler !== 'function') return 0;
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nativeSetTimeout(function () { handler.apply(null, args); }, Math.min(Number(delay) || 0, 3600000));
    renderTimers.push(['t', id]);
    return id;
  };
  window.setInterval = function (handler, delay) {
    if (typeof handler !== 'function') return 0;
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nativeSetInterval(function () { handler.apply(null, args); }, Math.max(Number(delay) || 0, 50));
    renderTimers.push(['i', id]);
    return id;
  };
  window.clearTimeout = nativeClearTimeout;
  window.clearInterval = nativeClearInterval;
  function clearRenderTimers() {
    renderTimers.forEach(function (timer) { (timer[0] === 'i' ? nativeClearInterval : nativeClearTimeout)(timer[1]); });
    renderTimers = [];
  }

  function workerEngine() {
    var prefix = config.guards + '\n' + config.engine + '\n';
    var source = prefix + config.wrappedLogic + config.workerMain;
    var offset = prefix.split('\n').length + 1;
    var url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    var worker = new Worker(url);
    var pending = {};
    var nextId = 0;
    var dead = '';
    function kill(reason) {
      if (dead) return;
      dead = reason;
      worker.terminate();
      Object.keys(pending).forEach(function (id) { nativeClearTimeout(pending[id].timer); pending[id].reject(new Error(reason)); });
      pending = {};
      problems.push(reason);
      showBanner(reason, 'error');
      post({ type: 'error', message: reason });
    }
    worker.onmessage = function (event) {
      var data = event.data || {};
      var entry = pending[data.id];
      if (!entry) return;
      delete pending[data.id];
      nativeClearTimeout(entry.timer);
      if (data.ok) entry.resolve(data.result); else entry.reject(new Error(data.error));
    };
    worker.onerror = function (event) {
      event.preventDefault();
      var line = event.lineno ? ' (logic line ' + Math.max(1, event.lineno - offset) + ')' : '';
      kill('The game rules failed to load: ' + (event.message || 'syntax error') + line);
    };
    return {
      call: function (op, payload) {
        return new Promise(function (resolve, reject) {
          if (dead) { reject(new Error(dead)); return; }
          nextId += 1;
          var id = nextId;
          pending[id] = {
            resolve: resolve,
            reject: reject,
            timer: nativeSetTimeout(function () { kill('The game rules took too long and were stopped (an endless loop?).'); }, op === 'apply' ? 5000 : 2000),
          };
          worker.postMessage({ id: id, op: op, payload: payload });
        });
      },
    };
  }

  // Fallback for browsers that refuse workers in opaque-origin frames. The frame
  // itself is still the security boundary; only the freeze watchdog is lost.
  function inlineEngine() {
    engineKind = 'inline';
    var holder = '__nightsLogic' + String(Math.floor(Math.random() * 1e9));
    var script = document.createElement('script');
    script.textContent = config.wrappedLogic.replace('var nightsGame =', 'window["' + holder + '"] =');
    var before = uiErrors.length;
    document.head.appendChild(script);
    var game = window[holder];
    if (!game) problems.push('The game rules failed to load: ' + (uiErrors[before] || 'syntax error'));
    var core = createEngine(game);
    var realRandom = Math.random;
    var realNow = Date.now;
    return {
      call: function (op, payload) {
        return new Promise(function (resolve, reject) {
          Math.random = function () { throw new Error('Math.random() is not available in game rules. Use ctx.rng.'); };
          Date.now = function () { throw new Error('Date.now() is not available in game rules. Use ctx.now.'); };
          try { resolve(core[op](payload || {})); }
          catch (error) { reject(new Error(text(error))); }
          finally { Math.random = realRandom; Date.now = realNow; }
        });
      },
    };
  }

  var remote = config.mode === 'remote';
  if (remote) engineKind = 'remote';
  else { try { engine = workerEngine(); } catch (error) { engine = inlineEngine(); } }

  if (config.styles) {
    var style = document.createElement('style');
    style.textContent = config.styles;
    document.head.appendChild(style);
  }
  var uiErrorStart = uiErrors.length;
  var ui = document.createElement('script');
  ui.textContent = config.ui + '\n;window.__nightsRender = typeof render === "function" ? render : null;';
  document.head.appendChild(ui);
  renderFn = typeof window.__nightsRender === 'function' ? window.__nightsRender : null;
  if (uiErrors.length > uiErrorStart) problems.push('The game screen code failed to load: ' + uiErrors[uiErrorStart]);
  else if (!renderFn) problems.push('The game screen code must declare function render(root, model, ctx).');

  function confetti() {
    var now = Date.now();
    if (now - lastConfetti < 4000) return;
    lastConfetti = now;
    var colors = ['#9ce6cf', '#f0c77b', '#ff8d8d', '#ffffff'];
    for (var i = 0; i < 36; i += 1) {
      var piece = document.createElement('i');
      piece.className = 'nights-confetti';
      piece.style.left = (10 + Math.random() * 80) + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.3) + 's';
      document.body.appendChild(piece);
      nativeSetTimeout(function (node) { node.remove(); }, 1600, piece);
    }
  }
  function sound(tone) {
    try {
      var Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      var context = new Context();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.frequency.value = { tap: 440, success: 660, error: 180 }[tone] || 440;
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      return true;
    } catch (error) { return false; }
  }
  function refuse(message) {
    if (!testSink) showBanner(message, 'notice');
    return { ok: false, error: message };
  }
  function send(action) {
    return new Promise(function (resolve) {
      var json;
      try { json = JSON.stringify(action); } catch (error) { json = undefined; }
      if (!action || typeof action !== 'object' || Array.isArray(action) || !json) { resolve(refuse('Game actions must be plain objects.')); return; }
      if (json.length > config.maxAction) { resolve(refuse('That action is too large.')); return; }
      var clean = JSON.parse(json);
      if (testSink) { testSink.push(clean); resolve({ ok: true }); return; }
      if (me == null) { resolve(refuse('You are watching this table.')); return; }
      var now = Date.now();
      sentTimes = sentTimes.filter(function (time) { return now - time < 2000; });
      if (sentTimes.length >= 8) { resolve(refuse('Slow down a little.')); return; }
      sentTimes.push(now);
      if (remote) { post({ type: 'send', action: clean }); resolve({ ok: true }); return; }
      engine.call('check', { player: me, action: clean, at: now }).then(function () {
        post({ type: 'send', action: clean });
        resolve({ ok: true });
      }, function (error) { resolve(refuse(text(error))); });
    });
  }
  var ctx = Object.freeze({
    get me() { return me; },
    get players() { return players.map(function (p) { return { id: p.id, name: p.name }; }); },
    send: send,
    now: function () { return Date.now(); },
    effects: Object.freeze({ confetti: confetti, sound: sound, vibrate: function () { return false; } }),
  });

  function draw() {
    clearRenderTimers();
    while (root.firstChild) root.removeChild(root.firstChild);
    if (!renderFn) return;
    try { renderFn(root, model == null ? null : JSON.parse(JSON.stringify(model)), ctx); }
    catch (error) {
      var message = 'The game screen crashed: ' + text(error);
      uiErrors.push(message);
      if (!testSink) { showBanner(message, 'error'); post({ type: 'error', message: message }); }
    }
  }
  function sameMove(a, b) {
    return Boolean(b) && a.player === b.player && a.at === b.at && JSON.stringify(a.action) === JSON.stringify(b.action);
  }
  function syncTable(table) {
    queue = queue.then(function () {
      me = table.me == null ? null : String(table.me);
      var incoming = Array.isArray(table.moves) ? table.moves : [];
      var continues = table.epoch === epoch && applied.length <= incoming.length
        && applied.every(function (entry, index) { return sameMove(entry, incoming[index]); });
      var ready = Promise.resolve();
      if (!continues) {
        epoch = table.epoch;
        players = table.players || [];
        applied = [];
        ready = engine.call('reset', { players: players, seed: table.seed });
      }
      return ready.then(function () {
        var fresh = incoming.slice(applied.length);
        applied = applied.concat(fresh);
        return fresh.length ? engine.call('apply', { moves: fresh }).then(function (outcomes) {
          (outcomes || []).forEach(function (outcome, index) {
            if (continues && outcome !== 'ok' && fresh[index].player === me && !testSink) showBanner('Your move was not accepted: ' + outcome, 'notice');
          });
        }) : null;
      }).then(function () {
        return engine.call('view', { player: me });
      }).then(function (next) {
        model = next;
        if (banner.className === 'error') showBanner('', 'error');
        draw();
      });
    }).catch(function (error) {
      var message = text(error);
      showBanner(message, 'error');
      post({ type: 'error', message: message });
    });
  }

  // ----- self-test, run on every generated draft before the host sees it -----
  // Hidden frames have throttled timers, so yield with a message-channel task instead.
  function tick() {
    return new Promise(function (resolve) {
      var channel = new MessageChannel();
      channel.port1.onmessage = function () { channel.port1.close(); resolve(); };
      channel.port2.postMessage(0);
    });
  }
  function seats(count) {
    var list = [];
    for (var i = 1; i <= count; i += 1) list.push({ id: 'p' + i, name: 'Player ' + i });
    return list;
  }
  function visible() {
    return root.childElementCount > 0
      && (root.textContent.trim().length > 0 || Boolean(root.querySelector('button, svg, canvas, img, input')));
  }
  function label(element, index) { return 'button ' + (index + 1) + ' ("' + (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 30) + '")'; }
  function renderAs(viewer) {
    return engine.call('view', { player: viewer }).then(function (next) {
      me = viewer;
      model = next;
      uiErrors = [];
      testSink = [];
      draw();
      testSink = null;
      return tick();
    }).then(function () {
      if (uiErrors.length) return 'render() crashed: ' + uiErrors[0];
      if (!visible()) return 'render() left the screen empty';
      return '';
    }, function (error) { return 'view() failed: ' + text(error); });
  }
  // Give text fields, numbers and pickers a plausible value so "type, then submit" games can be exercised.
  function fillInputs() {
    root.querySelectorAll('input, textarea, select').forEach(function (field) {
      var kind = String(field.type || '').toLowerCase();
      if (field.disabled || kind === 'button' || kind === 'submit' || kind === 'hidden') return;
      if (field.tagName === 'SELECT') { if (field.options.length) field.selectedIndex = field.options.length > 1 ? 1 : 0; }
      else if (kind === 'checkbox' || kind === 'radio') field.checked = true;
      else if (kind === 'number' || kind === 'range') field.value = String(field.min && !isNaN(Number(field.min)) ? Number(field.min) + 1 : 1);
      else field.value = 'apple';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  async function clickSmoke(list, seed, viewer, note) {
    var accepted = false;
    await engine.call('reset', { players: list, seed: seed });
    players = list;
    var problem = await renderAs(viewer);
    if (problem) return false;
    var total = Math.min(root.querySelectorAll('button').length, 40);
    for (var index = 0; index < total; index += 1) {
      await renderAs(viewer);
      fillInputs();
      var button = root.querySelectorAll('button')[index];
      if (!button || button.disabled) continue;
      uiErrors = [];
      testSink = [];
      button.click();
      await tick();
      await tick();
      var sent = testSink || [];
      testSink = null;
      if (uiErrors.length) note('Tapping ' + label(button, index) + ' as ' + viewer + ' threw: ' + uiErrors[0], 'tap:' + uiErrors[0]);
      for (var s = 0; s < sent.length; s += 1) {
        try { await engine.call('check', { player: viewer, action: sent[s], at: 1700000000000 }); accepted = true; }
        catch (error) { /* refusals such as "not your turn" are expected */ }
      }
    }
    return accepted;
  }
  async function selfTest(spec) {
    var failures = [];
    var seen = {};
    function note(message, key) {
      var id = key || message;
      if (seen[id] || failures.length >= 15) return;
      seen[id] = true;
      failures.push(message);
    }
    problems.forEach(function (problem) { note(problem); });
    if (!renderFn || problems.length) return failures;
    var min = Math.max(1, spec.minPlayers | 0);
    var max = Math.max(min, spec.maxPlayers | 0);
    var counts = [min, Math.min(max, Math.max(min, 3)), Math.min(max, 6)].filter(function (n, i, all) { return all.indexOf(n) === i; });
    var anyAccepted = false;
    for (var c = 0; c < counts.length; c += 1) {
      var n = counts[c];
      var list = seats(n);
      try { await engine.call('reset', { players: list, seed: 1000 + n }); }
      catch (error) { note('setup() failed with ' + n + ' players: ' + text(error), 'setup:' + text(error)); continue; }
      players = list;
      var viewers = list.map(function (p) { return p.id; }).concat([null]);
      for (var v = 0; v < viewers.length; v += 1) {
        var problem = await renderAs(viewers[v]);
        if (problem) note(problem + ' (for example with ' + n + ' players, viewer ' + (viewers[v] || 'spectator') + ').', problem);
      }
      for (var p = 0; p < Math.min(n, 4); p += 1) {
        if (await clickSmoke(list, 1000 + n, list[p].id, note)) anyAccepted = true;
      }
    }
    if (!anyAccepted) note('No button on the opening screen produced a move that move() accepts, for any player. Every tappable control must be a <button> whose click handler calls ctx.send with a legal action.');
    var scenarios = [];
    try { scenarios = JSON.parse(config.tests || '[]'); } catch (error) { scenarios = null; }
    if (!Array.isArray(scenarios) || !scenarios.length) { note('tests must be a JSON array with at least one scenario.'); return failures; }
    for (var t = 0; t < Math.min(scenarios.length, 6); t += 1) {
      var scenario = scenarios[t] || {};
      var name = String(scenario.name || 'Scenario ' + (t + 1)).slice(0, 80);
      var size = Math.min(max, Math.max(min, Number(scenario.players) || min));
      var people = seats(size);
      try { await engine.call('reset', { players: people, seed: 7 }); }
      catch (error) { note('Scenario "' + name + '": setup() failed: ' + text(error)); continue; }
      players = people;
      var steps = Array.isArray(scenario.steps) ? scenario.steps : [];
      for (var s = 0; s < steps.length; s += 1) {
        var step = steps[s] || {};
        var who = String(step.player || 'p1');
        var at = 1700000000000 + s * 1000;
        var acceptedStep = true;
        var reason = '';
        try { await engine.call('check', { player: who, action: step.action || {}, at: at }); }
        catch (error) { acceptedStep = false; reason = text(error); }
        var expected = step.expect !== 'reject';
        if (acceptedStep !== expected)
          note('Scenario "' + name + '" step ' + (s + 1) + ': ' + who + ' sent ' + JSON.stringify(step.action || {}).slice(0, 160)
            + ' and move() ' + (acceptedStep ? 'accepted it' : 'refused it ("' + reason + '")') + ', but the test expected it to be ' + (expected ? 'accepted' : 'refused') + '.');
        await engine.call('apply', { moves: [{ player: who, at: at, action: step.action || {} }] });
      }
      for (var r = 0; r < people.length; r += 1) {
        var endProblem = await renderAs(people[r].id);
        if (endProblem) note('Scenario "' + name + '": at the end, ' + endProblem + ' for ' + people[r].id + '.');
      }
      var expectText = scenario.expectText;
      if (expectText && Array.isArray(expectText.includes)) {
        await renderAs(String(expectText.player || 'p1'));
        var screenText = (root.innerText || root.textContent).replace(/\s+/g, ' ').trim();
        var screen = screenText.toLowerCase();
        expectText.includes.forEach(function (fragment) {
          if (screen.indexOf(String(fragment).toLowerCase()) < 0)
            note('Scenario "' + name + '": the final screen for ' + (expectText.player || 'p1') + ' does not show "' + String(fragment).slice(0, 60) + '". It shows: "' + screenText.slice(0, 160) + '".');
        });
      }
    }
    return failures;
  }

  addEventListener('message', function (event) {
    var data = event.data;
    if (port || !data || data.type !== 'nights-connect' || !event.ports || !event.ports[0]) return;
    port = event.ports[0];
    port.onmessage = function (message) {
      var input = message.data || {};
      if (input.type === 'table' && !remote) syncTable(input.table || {});
      else if (input.type === 'view' && remote) {
        var update = input.view || {};
        me = update.me == null ? null : String(update.me);
        players = Array.isArray(update.players) ? update.players : [];
        model = update.model === undefined ? null : update.model;
        if (banner.className === 'error') showBanner('', 'error');
        draw();
      }
      else if (input.type === 'notice') showBanner(String(input.message || '').slice(0, 200), 'notice');
      else if (input.type === 'test') {
        selfTest(input).then(function (failures) { post({ type: 'test-result', failures: failures }); },
          function (error) { post({ type: 'test-result', failures: ['The self-test crashed: ' + text(error)] }); });
      }
    };
    port.start();
    post({ type: 'ready', engine: engineKind, problems: problems.slice(0, 5) });
    if (problems.length) showBanner(problems[0], 'error');
  });
})
`;

const FRAME_STYLES = `
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0b2425;color:#f7f2e8;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
*{box-sizing:border-box}
#game{width:100%;height:100%;overflow:auto}
#game button{font:inherit;touch-action:manipulation}
#nights-banner{position:fixed;z-index:2147483646;left:50%;top:10px;transform:translateX(-50%);max-width:calc(100% - 20px);border-radius:12px;padding:8px 12px;font:700 13px/1.35 ui-sans-serif,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);pointer-events:none}
#nights-banner.notice{background:#f0c77b;color:#2b1d05}
#nights-banner.error{background:#ffb4a8;color:#4a0f0b}
#nights-banner[hidden]{display:none}
.nights-confetti{position:fixed;z-index:2147483645;top:-12px;width:8px;height:12px;border-radius:2px;pointer-events:none;animation:nights-fall 1.4s ease-in forwards}
@keyframes nights-fall{to{transform:translateY(105vh) rotate(540deg);opacity:.2}}
`;

const inlineJson = (value: unknown) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
  .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');

// mode 'local': rules run in this device's sandbox (design preview and self-test).
// mode 'remote': the server referee runs the rules; the frame only draws the
// viewer's own view and sends actions, and the rules are not even included.
export function sandboxDocument(runtime: GameRuntime, mode: 'local' | 'remote' = 'local') {
  const config = {
    mode,
    engine: ENGINE_SOURCE,
    guards: WORKER_GUARDS,
    workerMain: WORKER_MAIN,
    wrappedLogic: mode === 'remote' ? '' : wrapLogic(runtime.logicSource),
    ui: runtime.uiSource,
    styles: runtime.styles,
    tests: mode === 'remote' ? '[]' : runtime.tests,
    maxAction: MAX_ACTION_LENGTH,
  };
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"><meta name="referrer" content="no-referrer"><style>${FRAME_STYLES}</style></head><body><div id="nights-banner" role="status" hidden></div><div id="game"></div><script>${mode === 'remote' ? '' : ENGINE_SOURCE}\n${FRAME_SOURCE}(${inlineJson(config)});</script></body></html>`;
}

export const SANDBOX_ATTRIBUTES = {
  sandbox: 'allow-scripts',
  allow: "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'; fullscreen 'none'",
  referrerPolicy: 'no-referrer' as const,
};

type FrameMessage =
  | { type: 'ready'; engine?: string; problems?: unknown }
  | { type: 'send'; action: unknown }
  | { type: 'error'; message: unknown }
  | { type: 'test-result'; failures: unknown };

// Validates one message from a sandbox. Anything unexpected is dropped.
export function readFrameMessage(data: unknown): FrameMessage | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  if (message.type === 'ready' || message.type === 'error' || message.type === 'test-result') return message as FrameMessage;
  if (message.type !== 'send') return null;
  const action = message.action;
  if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
  let json = '';
  try { json = JSON.stringify(action); } catch { return null; }
  if (!json || json.length > MAX_ACTION_LENGTH) return null;
  return { type: 'send', action: JSON.parse(json) as Record<string, unknown> };
}

// Runs a candidate game through the in-sandbox self-test in a hidden frame.
// Resolves to a list of human-readable problems; an empty list means it passed.
export function runSelfTest(runtime: GameRuntime, minPlayers: number, maxPlayers: number): Promise<string[]> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', SANDBOX_ATTRIBUTES.sandbox);
    frame.setAttribute('allow', SANDBOX_ATTRIBUTES.allow);
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:390px;height:740px;border:0;opacity:0;pointer-events:none;';
    const channel = new MessageChannel();
    let loads = 0;
    let finished = false;
    const finish = (failures: string[]) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      channel.port1.close();
      frame.remove();
      resolve(failures);
    };
    const timer = window.setTimeout(() => finish(['The game did not finish its self-test within 30 seconds (an endless loop or an extremely slow screen).']), 30_000);
    channel.port1.onmessage = ({ data }) => {
      const message = readFrameMessage(data);
      if (message?.type === 'ready') channel.port1.postMessage({ type: 'test', minPlayers, maxPlayers });
      if (message?.type === 'test-result')
        finish(Array.isArray(message.failures) ? message.failures.map((item) => String(item).slice(0, 600)).slice(0, 15) : ['The self-test returned no result.']);
    };
    frame.addEventListener('load', () => {
      loads += 1;
      if (loads > 1) {
        finish(['The game navigated away from its sandbox page. Never change location or follow links.']);
        return;
      }
      channel.port1.start();
      frame.contentWindow?.postMessage({ type: 'nights-connect' }, '*', [channel.port2]);
    });
    frame.srcdoc = sandboxDocument(runtime);
    document.body.appendChild(frame);
  });
}
