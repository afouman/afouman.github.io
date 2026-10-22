// Nights game server: the referee for live event games.
//
// One Durable Object per event game holds every table of that game. Phones connect
// over a WebSocket, prove who they are with their Firebase ID token, and then only
// send actions. The Durable Object runs the generated game rules inside QuickJS
// (a separate JavaScript engine compiled to WebAssembly, with memory, stack and
// instruction limits and no access to the network or this Worker), keeps the full
// state and random seed private, and sends each viewer only view(state, theirSeat).
//
// Privacy: phones receive seat ids ('p1', ...), display names and their own view.
// Account ids, emails and phone numbers never leave this server.

import { DurableObject } from 'cloudflare:workers';
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core';
import releaseVariant from '@jitl/quickjs-wasmfile-release-sync';
// Workers cannot compile WebAssembly from bytes at runtime; import the module instead.
import quickJsWasm from '../node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm';
import { ENGINE_SOURCE, WORKER_GUARDS } from '../../game-engine/engine-source.mjs';

const FIREBASE_PROJECT_ID = 'gathering-app-109eb';
const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const ALLOWED_ORIGINS = new Set(['https://gaemaj.tech', 'https://www.gaemaj.tech', 'https://afouman.github.io']);
const LEGACY_HOST_EMAIL = 'alaki.dolaki.holholaki@gmail.com';
const LEGACY_HOST_UID = 'W2T8SwFA1pdg8wxm23E5kQqbEHv2';
const MAX_ACTION_LENGTH = 1500;
const MAX_MESSAGE_LENGTH = 6000;
const MAX_TABLES = 40;
const MAX_TABLE_PLAYERS = 100;
const ENGINE_MEMORY_BYTES = 32 * 1024 * 1024;
const ENGINE_STACK_BYTES = 512 * 1024;
const ENGINE_INTERRUPT_BUDGET = 2_000;

const safeSegment = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{2,160}$/.test(value);

// ----- Firebase identity -----------------------------------------------------

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function verifyFirebaseToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Missing or invalid account session.');
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  const now = Math.floor(Date.now() / 1000);
  if (
    header.alg !== 'RS256' || !header.kid
    || claims.aud !== FIREBASE_PROJECT_ID
    || claims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`
    || typeof claims.sub !== 'string' || claims.sub.length < 2
    || claims.exp <= now || claims.iat > now + 60
  ) throw new Error('Invalid account session.');
  const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('Could not verify account session.');
  const jwk = (await response.json()).keys?.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new Error('Could not verify account session.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!verified) throw new Error('Invalid account session.');
  return claims;
}

function firestoreValue(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return firestoreFields(value.mapValue?.fields || {});
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(firestoreValue);
  return undefined;
}

function firestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
}

// Reads with the player's own token, so Firestore rules decide what they may see.
async function readAsUser(path, token) {
  const response = await fetch(`${FIRESTORE_ROOT}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Could not read game data (${response.status}).`);
  return firestoreFields((await response.json()).fields || {});
}

// Who is this player for this event game, and may they play?
async function resolvePlayer(token, eventId, gameId) {
  const claims = await verifyFirebaseToken(token);
  const [event, game, profile] = await Promise.all([
    readAsUser(`events/${eventId}`, token),
    readAsUser(`events/${eventId}/games/${gameId}`, token),
    readAsUser(`users/${claims.sub}`, token),
  ]);
  if (!event || !game) throw new Error('This game is not available.');
  const host = event.ownerUid === claims.sub
    || (claims.email === LEGACY_HOST_EMAIL && claims.email_verified === true && event.ownerUid === LEGACY_HOST_UID);
  if (host) return { uid: claims.sub, name: 'Host', host: true, game };
  if (!profile?.guestUid) throw new Error('Finish your Nights account before playing.');
  if (game.status !== 'published') throw new Error('This game is not published yet.');
  const rsvp = await readAsUser(`events/${eventId}/rsvps/${profile.guestUid}`, token);
  const approved = !event.requireGuestApproval || !rsvp?.approvalStatus || rsvp.approvalStatus === 'approved';
  if (rsvp?.status !== 'yes' || !approved) throw new Error('Only approved attendees who are going can play.');
  return { uid: claims.sub, name: String(rsvp.guestName || 'Guest').slice(0, 60), host: false, game };
}

// ----- QuickJS referee --------------------------------------------------------

let quickJsPromise = null;
const loadQuickJs = () => (quickJsPromise ||= newQuickJSWASMModuleFromVariant(newVariant(releaseVariant, { wasmModule: quickJsWasm })));

const wrapLogic = (logic) => `var nightsGame = (function () {\n'use strict';\n${logic}\n;return { setup: typeof setup === 'function' ? setup : null, move: typeof move === 'function' ? move : null, view: typeof view === 'function' ? view : null };\n})();\n`;

const DISPATCH = `
var nightsEngine = createEngine(nightsGame);
function nightsCall(op, input) {
  try { return JSON.stringify({ ok: true, result: nightsEngine[op](JSON.parse(input)) }); }
  catch (error) { return JSON.stringify({ ok: false, error: nightsMessage(error) }); }
}
`;

class Referee {
  constructor(QuickJS, logicSource) {
    this.runtime = QuickJS.newRuntime();
    this.runtime.setMemoryLimit(ENGINE_MEMORY_BYTES);
    this.runtime.setMaxStackSize(ENGINE_STACK_BYTES);
    // Date.now() does not advance during execution in Workers, so limit work by
    // counting interrupt checks instead of wall-clock time.
    this.ticks = 0;
    this.runtime.setInterruptHandler(() => {
      this.ticks += 1;
      return this.ticks > ENGINE_INTERRUPT_BUDGET;
    });
    this.vm = this.runtime.newContext();
    this.run(WORKER_GUARDS);
    this.run(ENGINE_SOURCE);
    this.run(wrapLogic(logicSource), 'The game rules failed to load');
    this.run(DISPATCH);
  }
  run(source, label = 'The game engine failed') {
    this.ticks = 0;
    const result = this.vm.evalCode(source);
    if (result.error) {
      const detail = this.vm.dump(result.error);
      result.error.dispose();
      const message = this.ticks > ENGINE_INTERRUPT_BUDGET ? 'took too long' : String(detail?.message || detail);
      throw new Error(`${label}: ${message}`.slice(0, 300));
    }
    const value = this.vm.dump(result.value);
    result.value.dispose();
    return value;
  }
  call(op, input) {
    const reply = JSON.parse(this.run(`nightsCall(${JSON.stringify(op)}, ${JSON.stringify(JSON.stringify(input))})`, 'The game rules failed'));
    if (!reply.ok) throw new Error(reply.error);
    return reply.result;
  }
  dispose() {
    try { this.vm.dispose(); } catch { /* already gone */ }
    try { this.runtime.dispose(); } catch { /* already gone */ }
  }
}

// ----- Durable Object: all tables of one event game ----------------------------

const randomSeed = () => 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 2_000_000_000);
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.referees = new Map();
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.game = (await ctx.storage.get('game')) || null;
      this.tables = (await ctx.storage.get('tables')) || {};
    });
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ eventId: url.searchParams.get('event'), gameId: url.searchParams.get('game'), uid: '', name: '', host: false, watching: '', sent: [] });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, raw) {
    await this.ready;
    const session = socket.deserializeAttachment() || {};
    const reply = (message) => { try { socket.send(JSON.stringify(message)); } catch { /* closed */ } };
    let message;
    try {
      if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_LENGTH) throw new Error('Message too large.');
      message = JSON.parse(raw);
    } catch {
      reply({ type: 'error', message: 'Invalid message.' });
      return;
    }
    try {
      if (message.type === 'hello') return await this.hello(socket, session, message, reply);
      if (!session.uid) throw new Error('Sign in again to play.');
      const now = Date.now();
      session.sent = (session.sent || []).filter((time) => now - time < 2000);
      if (session.sent.length >= 12) throw new Error('Slow down a little.');
      session.sent.push(now);
      socket.serializeAttachment(session);
      if (message.type === 'move') return await this.move(socket, session, message, reply);
      if (message.type === 'open') return await this.open(socket, session, message.tableId);
      if (message.type === 'create') return await this.createTable(socket, session);
      if (message.type === 'join') return await this.join(session, message.tableId);
      if (message.type === 'leave') return await this.leave(socket, session, message.tableId);
      if (message.type === 'start') return await this.start(session, message.tableId);
      if (message.type === 'lobby') return await this.toLobby(session, message.tableId);
      if (message.type === 'close') return await this.closeTable(session, message.tableId);
      throw new Error('Unknown request.');
    } catch (error) {
      reply({ type: 'error', message: error instanceof Error ? error.message : 'Request failed.' });
    }
  }

  async webSocketClose(socket) { try { socket.close(); } catch { /* already closed */ } }
  async webSocketError(socket) { try { socket.close(); } catch { /* already closed */ } }

  async hello(socket, session, message, reply) {
    if (!safeSegment(session.eventId) || !safeSegment(session.gameId)) throw new Error('Invalid game.');
    // Local development only: GAME_SERVER_TEST_MODE is passed to `wrangler dev --var`
    // and is never set in wrangler.jsonc, so deployed servers always verify Firebase.
    const player = this.env.GAME_SERVER_TEST_MODE === 'true' && message.test
      ? { uid: String(message.test.uid), name: String(message.test.name), host: Boolean(message.test.host), game: message.test.game }
      : await resolvePlayer(message.token, session.eventId, session.gameId);
    const game = player.game;
    const runtime = game.runtime || {};
    if (runtime.runtimeVersion !== 3 || typeof runtime.logicSource !== 'string') throw new Error('This game needs to be regenerated before it can be played.');
    const version = Number(game.version) || 1;
    if (!this.game || version > this.game.version || (version === this.game.version && runtime.logicSource !== this.game.logicSource)) {
      this.game = {
        version,
        status: game.status,
        title: String(game.title || 'Game'),
        minPlayers: Math.max(1, Number(game.minPlayers) || 1),
        maxPlayers: Math.max(1, Number(game.maxPlayers) || 1),
        logicSource: runtime.logicSource,
      };
      await this.ctx.storage.put('game', this.game);
    }
    Object.assign(session, { uid: player.uid, name: player.name, host: player.host, watching: '' });
    socket.serializeAttachment(session);
    reply({ type: 'welcome', name: player.name, gameVersion: this.game.version });
    this.sendTables(socket, session);
  }

  // Summaries never include account ids.
  summary(table, session) {
    const members = Object.entries(table.players);
    return {
      id: table.id,
      name: table.name,
      status: table.status,
      players: members.map(([, member]) => member.name),
      count: members.length,
      joined: Boolean(table.players[session.uid]),
      creator: table.createdBy === session.uid,
    };
  }

  sendTables(socket, session) {
    const tables = Object.values(this.tables).sort((left, right) => left.createdAt - right.createdAt).map((table) => this.summary(table, session));
    try { socket.send(JSON.stringify({ type: 'tables', tables })); } catch { /* closed */ }
  }

  broadcastTables() {
    for (const socket of this.ctx.getWebSockets()) {
      const session = socket.deserializeAttachment();
      if (session?.uid) this.sendTables(socket, session);
    }
  }

  table(tableId) {
    const table = this.tables[tableId];
    if (!table) throw new Error('That table no longer exists.');
    return table;
  }

  async save() { await this.ctx.storage.put('tables', this.tables); }

  referee(table) {
    const cached = this.referees.get(table.id);
    if (cached && cached.version === table.gameVersion && cached.round === table.round) return cached.referee;
    cached?.referee.dispose();
    return null;
  }

  async ensureReferee(table) {
    const existing = this.referee(table);
    if (existing) return existing;
    if (!this.game || this.game.version !== table.gameVersion) throw new Error('This round uses an older version of the game. Start a new round.');
    const referee = new Referee(await loadQuickJs(), this.game.logicSource);
    referee.call('restore', { players: this.seatPlayers(table), seed: table.seed, state: table.state, count: table.count });
    this.referees.set(table.id, { referee, version: table.gameVersion, round: table.round });
    return referee;
  }

  seatPlayers(table) {
    return table.seats.map((uid, index) => ({ id: `p${index + 1}`, name: table.seatNames[index] || `Player ${index + 1}` }));
  }

  seatOf(table, uid) {
    const index = table.seats.indexOf(uid);
    return index < 0 ? null : `p${index + 1}`;
  }

  // Sends one viewer the table and their own view of it.
  async sendTable(socket, session, table, cache = new Map()) {
    const me = table.status === 'playing' ? this.seatOf(table, session.uid) : null;
    let view = null;
    let problem = '';
    const outdated = table.status === 'playing' && (!this.game || this.game.version !== table.gameVersion);
    if (table.status === 'playing' && !outdated) {
      const key = me || '__spectator';
      if (!cache.has(key)) {
        try {
          const referee = await this.ensureReferee(table);
          cache.set(key, { view: referee.call('view', { player: me }) });
        } catch (error) {
          cache.set(key, { problem: error instanceof Error ? error.message : 'The game could not be shown.' });
        }
      }
      ({ view = null, problem = '' } = cache.get(key));
    }
    const payload = {
      type: 'table',
      table: {
        ...this.summary(table, session),
        minPlayers: this.game?.minPlayers || 1,
        maxPlayers: this.game?.maxPlayers || 1,
        creatorName: table.players[table.createdBy]?.name || table.creatorName,
        round: table.round,
        seats: table.status === 'playing' ? this.seatPlayers(table) : [],
        me,
        outdated,
        problem,
        view,
      },
    };
    try { socket.send(JSON.stringify(payload)); } catch { /* closed */ }
  }

  async broadcastTable(table) {
    const cache = new Map();
    for (const socket of this.ctx.getWebSockets()) {
      const session = socket.deserializeAttachment();
      if (session?.uid && session.watching === table.id) await this.sendTable(socket, session, table, cache);
    }
  }

  async open(socket, session, tableId) {
    const table = this.table(tableId);
    session.watching = table.id;
    socket.serializeAttachment(session);
    await this.sendTable(socket, session, table);
  }

  async createTable(socket, session) {
    if (Object.keys(this.tables).length >= MAX_TABLES) throw new Error('This game already has many tables. Join one of them.');
    const id = newId();
    this.tables[id] = {
      id,
      name: `${session.name}’s table`.slice(0, 60),
      createdBy: session.uid,
      creatorName: session.name,
      createdAt: Date.now(),
      status: 'open',
      players: { [session.uid]: { name: session.name, joinedAt: Date.now() } },
      seats: [],
      seatNames: [],
      seed: 0,
      round: 0,
      gameVersion: this.game?.version || 0,
      state: null,
      count: 0,
    };
    await this.save();
    this.broadcastTables();
    try { socket.send(JSON.stringify({ type: 'opened', tableId: id })); } catch { /* closed */ }
    await this.open(socket, session, id);
  }

  async join(session, tableId) {
    const table = this.table(tableId);
    if (!table.players[session.uid]) {
      if (Object.keys(table.players).length >= MAX_TABLE_PLAYERS) throw new Error('This table is full.');
      table.players[session.uid] = { name: session.name, joinedAt: Date.now() };
      await this.save();
    }
    this.broadcastTables();
    await this.broadcastTable(table);
  }

  async leave(socket, session, tableId) {
    const table = this.table(tableId);
    if (table.status === 'playing' && table.seats.includes(session.uid)) throw new Error('You are playing this round. Ask the table creator to return to the lobby first.');
    delete table.players[session.uid];
    if (!Object.keys(table.players).length) {
      delete this.tables[table.id];
      this.referees.get(table.id)?.referee.dispose();
      this.referees.delete(table.id);
    }
    await this.save();
    session.watching = '';
    socket.serializeAttachment(session);
    this.broadcastTables();
    if (this.tables[table.id]) await this.broadcastTable(table);
  }

  async start(session, tableId) {
    const table = this.table(tableId);
    if (table.createdBy !== session.uid && !session.host) throw new Error('Only the table creator can start a round.');
    if (!this.game) throw new Error('The game is still loading.');
    const seats = Object.entries(table.players)
      .sort(([leftId, left], [rightId, right]) => (left.joinedAt - right.joinedAt) || leftId.localeCompare(rightId))
      .map(([uid]) => uid)
      .slice(0, this.game.maxPlayers);
    if (seats.length < this.game.minPlayers) throw new Error(`This game needs at least ${this.game.minPlayers} players.`);
    const seed = randomSeed();
    const draft = { ...table, seats, seatNames: seats.map((uid) => table.players[uid].name), seed, gameVersion: this.game.version };
    const referee = new Referee(await loadQuickJs(), this.game.logicSource);
    try {
      referee.call('reset', { players: this.seatPlayers(draft), seed });
    } catch (error) {
      referee.dispose();
      throw error;
    }
    const saved = referee.call('dump', {});
    Object.assign(table, draft, { status: 'playing', round: table.round + 1, state: saved.state, count: saved.count, startedAt: Date.now() });
    this.referees.get(table.id)?.referee.dispose();
    this.referees.set(table.id, { referee, version: table.gameVersion, round: table.round });
    await this.save();
    this.broadcastTables();
    await this.broadcastTable(table);
  }

  async toLobby(session, tableId) {
    const table = this.table(tableId);
    if (table.createdBy !== session.uid && !session.host) throw new Error('Only the table creator can do that.');
    Object.assign(table, { status: 'open', seats: [], seatNames: [], seed: 0, state: null, count: 0 });
    this.referees.get(table.id)?.referee.dispose();
    this.referees.delete(table.id);
    await this.save();
    this.broadcastTables();
    await this.broadcastTable(table);
  }

  async closeTable(session, tableId) {
    const table = this.table(tableId);
    if (table.createdBy !== session.uid && !session.host) throw new Error('Only the table creator or the host can close a table.');
    delete this.tables[table.id];
    this.referees.get(table.id)?.referee.dispose();
    this.referees.delete(table.id);
    await this.save();
    for (const socket of this.ctx.getWebSockets()) {
      const other = socket.deserializeAttachment();
      if (other?.watching === table.id) {
        other.watching = '';
        socket.serializeAttachment(other);
        try { socket.send(JSON.stringify({ type: 'closed', tableId: table.id })); } catch { /* closed */ }
      }
    }
    this.broadcastTables();
  }

  async move(socket, session, message, reply) {
    const table = this.table(message.tableId);
    if (table.status !== 'playing') throw new Error('This round has not started.');
    const seat = this.seatOf(table, session.uid);
    if (!seat) throw new Error('You are watching this round.');
    const action = message.action;
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new Error('Invalid action.');
    const json = JSON.stringify(action);
    if (json.length > MAX_ACTION_LENGTH) throw new Error('That action is too large.');
    const referee = await this.ensureReferee(table);
    const [outcome] = referee.call('apply', { moves: [{ player: seat, at: Date.now(), action: JSON.parse(json) }] });
    const saved = referee.call('dump', {});
    table.count = saved.count;
    if (outcome !== 'ok') {
      reply({ type: 'refused', tableId: table.id, message: outcome });
      return;
    }
    table.state = saved.state;
    await this.save();
    await this.broadcastTable(table);
  }
}

// ----- Worker entry -------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/games/live') return new Response('Not found', { status: 404 });
    const origin = request.headers.get('origin');
    if (origin && !ALLOWED_ORIGINS.has(origin) && !(env.ALLOW_LOCAL_ORIGINS === 'true' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))
      return new Response('Origin not allowed', { status: 403 });
    if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const eventId = url.searchParams.get('event');
    const gameId = url.searchParams.get('game');
    if (!safeSegment(eventId) || !safeSegment(gameId)) return new Response('Invalid game', { status: 400 });
    const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`${eventId}/${gameId}`));
    return room.fetch(request);
  },
};
