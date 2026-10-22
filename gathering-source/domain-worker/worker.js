import { buildPushPayload } from '@block65/webcrypto-web-push';

const GITHUB_PAGES_ORIGIN = 'https://afouman.github.io';
const APP_BASE_PATH = '/gathering';
const FIRESTORE_ROOT = 'https://firestore.googleapis.com/v1/projects/gathering-app-109eb/databases/(default)/documents';
const FIREBASE_PROJECT_ID = 'gathering-app-109eb';
const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 90;
const VAPID_PUBLIC_KEY = 'BBLVoXFRiUDSV72gImtZXfRgu92qgCEmBY-nByHqKDiaQrB7uEkvAWRo-D6VtQlHmtESAFH7bpPMImL2uXOu5dY';
const ALLOWED_ORIGINS = new Set(['https://gaemaj.tech', 'https://www.gaemaj.tech', 'https://afouman.github.io']);
const LEGACY_HOST_EMAIL = 'alaki.dolaki.holholaki@gmail.com';
const LEGACY_HOST_UID = 'W2T8SwFA1pdg8wxm23E5kQqbEHv2';

const APP_ASSETS = new Set([
  '/favicon.svg', '/manifest.webmanifest', '/manifest-guest.webmanifest',
  '/manifest-host.webmanifest', '/og.png', '/sw.js',
  '/vinext-client-entry-manifest.json', '/gather-birthday-party-hero.jpg',
  '/gather-custom-event-hero.jpg', '/gather-dinner-hero.jpg',
  '/gather-game-night-hero.jpg', '/gather-movie-night-hero.jpg',
]);

function upstreamPath(pathname) {
  if (pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`))
    return pathname === APP_BASE_PATH ? `${APP_BASE_PATH}/` : pathname;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/icons/') || APP_ASSETS.has(pathname))
    return `${APP_BASE_PATH}${pathname}`;
  return `${APP_BASE_PATH}/`;
}

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  return {
    'access-control-allow-origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://gaemaj.tech',
    'access-control-allow-methods': 'POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function json(request, value, status = 200) {
  return Response.json(value, { status, headers: corsHeaders(request) });
}

function safeSegment(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{2,160}$/.test(value);
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

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return {
    mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)])) },
  };
  return { stringValue: String(value) };
}

function toFirestoreFields(value) {
  return Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, toFirestoreValue(item)]));
}

async function firestoreDocument(path, token = '') {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${FIRESTORE_ROOT}/${path}`, { headers });
  if (!response.ok) return null;
  const document = await response.json();
  return firestoreFields(document.fields);
}

async function authenticatedFirestoreDocument(path, token) {
  const response = await fetch(
    `${FIRESTORE_ROOT}/${path.split('/').map(encodeURIComponent).join('/')}`,
    { headers: { accept: 'application/json', authorization: `Bearer ${token}` } },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firebase game read failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const document = await response.json();
  return {
    data: firestoreFields(document.fields || {}),
    updateTime: document.updateTime || '',
  };
}

async function writeAuthenticatedFirestoreDocument(path, data, token, updateTime = '') {
  const url = new URL(`${FIRESTORE_ROOT}/${path.split('/').map(encodeURIComponent).join('/')}`);
  if (updateTime) url.searchParams.set('currentDocument.updateTime', updateTime);
  else url.searchParams.set('currentDocument.exists', 'false');
  const response = await fetch(url.href, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firebase game write failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const document = await response.json();
  return {
    data: firestoreFields(document.fields || {}),
    updateTime: document.updateTime || '',
  };
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

function encodeBase64Url(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function serviceAccountPrivateKey(value) {
  const normalized = String(value || '').replace(/\\n/g, '\n');
  const body = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  if (!body) throw new Error('FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY is not configured.');
  return Uint8Array.from(atob(body), character => character.charCodeAt(0));
}

let cachedAdminToken;
async function firebaseAdminAccessToken(env) {
  if (cachedAdminToken && cachedAdminToken.expiresAt > Date.now() + 60_000)
    return cachedAdminToken.value;
  if (!env.FIREBASE_SERVICE_ACCOUNT_EMAIL || !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY)
    throw new Error('Firebase cleanup credentials are not configured.');
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = encodeBase64Url(JSON.stringify({
    iss: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    serviceAccountPrivateKey(env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const assertion = `${header}.${claim}.${encodeBase64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token)
    throw new Error(result.error_description || 'Could not authorize Firebase cleanup.');
  cachedAdminToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(300, Number(result.expires_in) || 3600) * 1000,
  };
  return cachedAdminToken.value;
}

async function adminFirebaseFetch(env, url, options = {}) {
  const accessToken = await firebaseAdminAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set('authorization', `Bearer ${accessToken}`);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(url, { ...options, headers });
  if (!response.ok && response.status !== 404) {
    const detail = await response.text();
    throw new Error(`Firebase cleanup request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response;
}

async function adminFirestoreDocument(env, path) {
  const response = await adminFirebaseFetch(
    env,
    `${FIRESTORE_ROOT}/${path.split('/').map(encodeURIComponent).join('/')}`,
  );
  if (response.status === 404) return null;
  const document = await response.json();
  return {
    data: firestoreFields(document.fields || {}),
    updateTime: document.updateTime || '',
  };
}

async function writeAdminFirestoreDocument(env, path, data, updateTime = '') {
  const url = new URL(`${FIRESTORE_ROOT}/${path.split('/').map(encodeURIComponent).join('/')}`);
  if (updateTime) url.searchParams.set('currentDocument.updateTime', updateTime);
  else url.searchParams.set('currentDocument.exists', 'false');
  const response = await adminFirebaseFetch(env, url.href, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  const document = await response.json();
  return {
    data: firestoreFields(document.fields || {}),
    updateTime: document.updateTime || '',
  };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value).trim().toLowerCase()));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function firestoreDocumentPath(name) {
  const marker = '/documents/';
  const index = String(name || '').indexOf(marker);
  return index >= 0 ? String(name).slice(index + marker.length) : '';
}

async function expiredUnverifiedProfiles(env, now = new Date()) {
  const response = await adminFirebaseFetch(env, `${FIRESTORE_ROOT}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'verificationExpiresAt' },
            op: 'LESS_THAN_OR_EQUAL',
            value: { timestampValue: now.toISOString() },
          },
        },
        orderBy: [{ field: { fieldPath: 'verificationExpiresAt' }, direction: 'ASCENDING' }],
        limit: 100,
      },
    }),
  });
  const rows = await response.json();
  return rows
    .filter(row => row.document)
    .map(row => ({
      path: firestoreDocumentPath(row.document.name),
      data: firestoreFields(row.document.fields),
    }))
    .filter(record => record.path && record.data.emailVerified === false);
}

async function collectionDocumentPaths(env, parentPath, collectionId) {
  const paths = [];
  let pageToken = '';
  do {
    const url = new URL(`${FIRESTORE_ROOT}/${parentPath}/${collectionId}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await adminFirebaseFetch(env, url.toString());
    if (response.status === 404) return paths;
    const result = await response.json();
    paths.push(...(result.documents || []).map(document => firestoreDocumentPath(document.name)).filter(Boolean));
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return paths;
}

async function contactPathsForAccount(env, accountUid) {
  const response = await adminFirebaseFetch(env, `${FIRESTORE_ROOT}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'contacts', allDescendants: true }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'accountUid' },
            op: 'EQUAL',
            value: { stringValue: accountUid },
          },
        },
      },
    }),
  });
  const rows = await response.json();
  return rows.filter(row => row.document).map(row => firestoreDocumentPath(row.document.name)).filter(Boolean);
}

async function deleteAdminDocument(env, path) {
  if (!path) return;
  await adminFirebaseFetch(env, `${FIRESTORE_ROOT}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE',
  });
}

async function deletePushSubscriptionsForAccount(env, accountUid, guestUid) {
  let cursor;
  do {
    const page = await env.PUSH_SUBSCRIPTIONS.list({ cursor });
    const records = await Promise.all(page.keys.map(async key => ({
      key: key.name,
      value: await env.PUSH_SUBSCRIPTIONS.get(key.name, 'json'),
    })));
    const matching = records.filter(record => record.value
      && (record.value.actorUid === guestUid || record.value.actorUid === accountUid));
    await Promise.all(matching.map(record => env.PUSH_SUBSCRIPTIONS.delete(record.key)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

async function purgeExpiredUnverifiedAccount(env, profile) {
  const accountUid = profile.data.uid || profile.path.split('/').pop();
  const guestUid = profile.data.guestUid;
  if (!safeSegment(accountUid) || !safeSegment(guestUid))
    throw new Error(`Invalid expired account profile: ${profile.path}`);

  await adminFirebaseFetch(
    env,
    `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:batchDelete`,
    { method: 'POST', body: JSON.stringify({ localIds: [accountUid], force: true }) },
  );

  const [invitationPaths, ownContactPaths, referringContactPaths] = await Promise.all([
    collectionDocumentPaths(env, `users/${encodeURIComponent(accountUid)}`, 'invitations'),
    collectionDocumentPaths(env, `users/${encodeURIComponent(accountUid)}`, 'contacts'),
    contactPathsForAccount(env, accountUid),
  ]);
  const emailHash = profile.data.email ? await sha256Hex(profile.data.email) : '';
  const paths = new Set([
    ...invitationPaths,
    ...ownContactPaths,
    ...referringContactPaths,
    `guest-identities/${guestUid}`,
    `account-directory/${accountUid}`,
    emailHash ? `account-emails/${emailHash}` : '',
  ].filter(Boolean));
  await Promise.all([...paths].map(path => deleteAdminDocument(env, path)));
  await deletePushSubscriptionsForAccount(env, accountUid, guestUid);
  await deleteAdminDocument(env, profile.path);
  return accountUid;
}

async function purgeExpiredUnverifiedAccounts(env) {
  const expired = await expiredUnverifiedProfiles(env);
  const results = await Promise.allSettled(expired.map(profile => purgeExpiredUnverifiedAccount(env, profile)));
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) console.error('Unverified account cleanup failures', failed.map(result => result.reason));
  return { checked: expired.length, deleted: results.length - failed.length, failed: failed.length };
}

async function verifyFirebaseToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Missing or invalid account session.');
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  const now = Math.floor(Date.now() / 1000);
  if (
    header.alg !== 'RS256'
    || !header.kid
    || claims.aud !== 'gathering-app-109eb'
    || claims.iss !== 'https://securetoken.google.com/gathering-app-109eb'
    || typeof claims.sub !== 'string'
    || claims.sub.length < 2
    || claims.exp <= now
    || claims.iat > now + 60
  ) throw new Error('Invalid account session.');
  const response = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!response.ok) throw new Error('Could not verify account session.');
  const keys = await response.json();
  const jwk = keys.keys?.find(candidate => candidate.kid === header.kid);
  if (!jwk) throw new Error('Could not verify account session.');
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error('Invalid account session.');
  return { token, claims };
}

// ---------------------------------------------------------------------------
// On-the-go game generation.
//
// Gemini writes a small game module (pure logic + DOM renderer). The Worker only
// generates and shape-checks it; the module never runs here. It runs in the
// guest's browser inside a sandboxed, network-less iframe (see app/games.tsx),
// which is the security boundary. Live play is stored as an ordered move log in
// Firestore and replayed deterministically on every device, so no device acts
// as a referee and any number of tables can play the same game independently.
// ---------------------------------------------------------------------------

const GAME_RUNTIME_VERSION = 3;
const GAME_LIMITS = { logicSource: 20_000, uiSource: 30_000, styles: 12_000, tests: 8_000, instructions: 1_000, uiNotes: 1_000 };

function cleanGameDefinition(value) {
  if (!value || typeof value !== 'object') throw new Error('Game definition is required.');
  const textFields = [
    'title', 'summary', 'playerArrangement', 'interfaceDescription', 'rules',
    'scoring', 'timing', 'hiddenInformation', 'winCondition',
  ];
  const definition = {};
  for (const field of textFields) {
    const text = String(value[field] || '').trim();
    if (text.length > 6000) throw new Error(`${field} is too long.`);
    definition[field] = text;
  }
  if (!definition.title || !definition.playerArrangement || !definition.interfaceDescription || !definition.rules)
    throw new Error('Name, player arrangement, interface, and rules are required.');
  definition.minPlayers = Math.max(1, Math.min(100, Math.floor(Number(value.minPlayers) || 1)));
  definition.maxPlayers = Math.max(definition.minPlayers, Math.min(100, Math.floor(Number(value.maxPlayers) || definition.minPlayers)));
  if (JSON.stringify(definition).length > 20_000) throw new Error('Game definition is too large.');
  return definition;
}

function gameResponseSchema() {
  return {
    type: 'object',
    required: ['instructions', 'uiNotes', 'logicSource', 'uiSource', 'styles', 'tests'],
    properties: {
      instructions: { type: 'string', description: 'One or two sentences telling players how to play.' },
      uiNotes: { type: 'string', description: 'One or two sentences describing the screen you built.' },
      logicSource: { type: 'string', description: 'Plain JavaScript declaring function setup(ctx), function move(state, action, ctx) and function view(state, player).' },
      uiSource: { type: 'string', description: 'Plain JavaScript declaring function render(root, model, ctx).' },
      styles: { type: 'string', description: 'CSS for the game screen. Scope every rule under #game.' },
      tests: { type: 'string', description: 'A JSON array of test scenarios, as described in the instructions.' },
    },
  };
}

const GAME_CONTRACT = `
THE NIGHTS GAME CONTRACT

A game is two plain JavaScript sources. No imports, no modules, no network, no storage. Both run in an isolated sandbox.

1. logicSource — pure, deterministic game rules. Declare exactly these three top-level functions:

   function setup(ctx) -> state
     ctx.players : [{id, name}] in seat order. ids are 'p1', 'p2', ... Use ids for everything; names are only for display.
     ctx.rng     : seeded random source. ctx.rng() -> [0,1). ctx.rng.int(n) -> 0..n-1. ctx.rng.pick(array). ctx.rng.shuffle(array) -> new array.
     Return the complete initial state as plain JSON (objects, arrays, strings, numbers, booleans, null).
     Do team assignment, dealing, role selection, etc. here with ctx.rng.

   function move(state, action, ctx) -> nextState
     action      : the plain JSON object a player sent from the UI.
     ctx.player  : id of the player who sent it ('p1', ...). This is trusted; never read the sender from action.
     ctx.players : same list as in setup.
     ctx.now     : the move's timestamp in milliseconds. This is the ONLY clock.
     ctx.rng     : seeded random source for this move.
     Return the full next state. To refuse an illegal move (not your turn, square taken, game over...), throw new Error('short reason players can read').
     Validate everything: the action comes from a player's device.
     Restarting / "new game" / "play again" is just another action handled here.

   function view(state, player) -> model
     player: the viewer's id ('p1', ...) or null for a spectator.
     Return a plain JSON model of what THIS viewer may see. Include whose turn it is, scores, the board, and booleans
     the UI needs (for example canAct, isMyTurn, myTeam, mySymbol). Leave out other players' secrets.

   Math.random, Date.now and new Date() are disabled in logic (they would make devices disagree). Use ctx.rng and ctx.now.
   Never use loops that might not terminate. Keep the state small.

2. uiSource — the screen. Declare exactly one top-level function:

   function render(root, model, ctx)
     Called every time the model changes. root (the #game element) is already EMPTY when render is called:
     build the whole screen and append it to root every time. Never cache elements between calls.
     model    : the value view() returned for this viewer.
     ctx.me   : this viewer's id or null (spectator).
     ctx.players : [{id, name}].
     ctx.send(action) : send a plain JSON action object (under 1500 characters) to move(). Returns a Promise of
                {ok:true} or {ok:false, error}. Nights already shows refusals to the player; you may also show them.
     ctx.now() : local clock in ms, only for displaying countdowns.
     ctx.effects.confetti(), ctx.effects.sound('tap'|'success'|'error'), ctx.effects.vibrate()
     These are the only ctx members; do not call anything else on ctx.
     Use document.createElement / textContent / addEventListener. Never use innerHTML with player-provided text.
     Every tappable control MUST be a <button> element. Disable buttons the viewer cannot use right now.
     setTimeout/setInterval are allowed only for countdown displays; time-based rules must go through ctx.send.
     Timers: to end a timed turn, the UI sends an action such as {type:'timeUp'} when its countdown reaches zero, and
     move() checks ctx.now against a deadline stored in state.

3. styles — CSS. Scope every selector under #game. The game area fills the viewport (100vw x 100vh, no page
   scrolling). Make the main play area as large as possible, use CSS grid for boards (a 3x3 board is
   grid-template-columns: repeat(3, 1fr) with square cells), and keep it readable on a phone held upright.

4. tests — a JSON array (as a string) of 2 to 5 scenarios that prove the rules work:
   [{"name": "...", "players": 2,
     "steps": [{"player": "p1", "action": {...}, "expect": "accept"}, {"player": "p2", "action": {...}, "expect": "reject"}],
     "expectText": {"player": "p1", "includes": ["wins"]}}]
   Each step is checked with move(); "expect" says whether it must succeed or throw. expectText (optional) renders the
   final screen for that player and checks the visible text contains each string (case-insensitive).
   Scenarios must not depend on random outcomes: choose actions that are legal whatever ctx.rng decided, or read
   the setup through moves that are always legal. Include a win (or end) scenario and an illegal-move scenario.

Teams: if the host asks for teams, form them in setup() from ctx.players with ctx.rng (for random assignment)
and show each player's team and mark in the view. Any number of players between the limits may sit at a table.

WORKED EXAMPLE (a different game, for shape only):

logicSource:
function setup(ctx) {
  return { order: ctx.rng.shuffle(ctx.players.map(p => p.id)), turn: 0, total: 0, target: 21, winner: null };
}
function move(state, action, ctx) {
  if (action.type === 'restart') return setup(ctx);
  if (state.winner) throw new Error('The game is over.');
  if (state.order[state.turn % state.order.length] !== ctx.player) throw new Error('It is not your turn.');
  if (action.type !== 'add' || ![1, 2, 3].includes(action.amount)) throw new Error('Add 1, 2 or 3.');
  const total = state.total + action.amount;
  return { ...state, total, turn: state.turn + 1, winner: total >= state.target ? ctx.player : null };
}
function view(state, player) {
  const current = state.order[state.turn % state.order.length];
  return { total: state.total, target: state.target, current, winner: state.winner, isMyTurn: !state.winner && current === player };
}

uiSource:
function render(root, model, ctx) {
  const name = id => (ctx.players.find(p => p.id === id) || {}).name || id;
  const status = document.createElement('p');
  status.className = 'status';
  status.textContent = model.winner ? name(model.winner) + ' wins!' : (model.isMyTurn ? 'Your turn' : name(model.current) + ' is playing');
  const total = document.createElement('div');
  total.className = 'total';
  total.textContent = model.total + ' / ' + model.target;
  const row = document.createElement('div');
  row.className = 'row';
  [1, 2, 3].forEach(amount => {
    const button = document.createElement('button');
    button.textContent = '+' + amount;
    button.disabled = !model.isMyTurn;
    button.addEventListener('click', () => ctx.send({ type: 'add', amount }));
    row.append(button);
  });
  const again = document.createElement('button');
  again.textContent = 'New game';
  again.addEventListener('click', () => ctx.send({ type: 'restart' }));
  root.append(status, total, row, again);
  if (model.winner) ctx.effects.confetti();
}
`;

function gameGenerationPrompt(definition) {
  return `You write small multiplayer party games for Nights, a gathering app. Players use their phones at the same event.
Turn the host's description into a game that follows the contract below exactly, and return JSON matching the response schema.
Implement what the host asked for — their layout, controls, teams and rules — rather than a generic version.
${GAME_CONTRACT}
The host's game (player limits: ${definition.minPlayers} to ${definition.maxPlayers}):
${JSON.stringify(definition, null, 2)}`;
}

function gameRevisionPrompt(definition, previousGame, feedback, failures) {
  const parts = [gameGenerationPrompt(definition), '', 'You are REVISING an existing draft. Keep everything that works; change only what is needed. Return the complete replacement for every field.', '', 'Current draft:', JSON.stringify(previousGame, null, 2)];
  if (failures.length) parts.push('', 'Nights ran this draft in its test harness and it FAILED. Fix every problem:', ...failures.map((failure, index) => `${index + 1}. ${failure}`));
  if (feedback.length) parts.push('', 'Host feedback, oldest to newest. Apply all of it:', ...feedback.map((message, index) => `${index + 1}. ${message}`));
  return parts.join('\n');
}

function cleanTextList(value, maxItems, maxLength) {
  return (Array.isArray(value) ? value : [value])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(-maxItems)
    .map(item => item.slice(0, maxLength));
}

function stripCodeFence(value) {
  return String(value || '').trim().replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
}

// Shape checks only. Safety comes from the sandbox, not from scanning code.
function generatedGameValidation(value) {
  if (!value || typeof value !== 'object') return { valid: false, error: 'Gemini did not return a game.' };
  const game = {
    runtimeVersion: GAME_RUNTIME_VERSION,
    instructions: String(value.instructions || '').trim().slice(0, GAME_LIMITS.instructions),
    uiNotes: String(value.uiNotes || '').trim().slice(0, GAME_LIMITS.uiNotes),
    logicSource: stripCodeFence(value.logicSource),
    uiSource: stripCodeFence(value.uiSource),
    styles: stripCodeFence(value.styles),
    tests: stripCodeFence(value.tests) || '[]',
  };
  for (const name of ['setup', 'move', 'view'])
    if (!new RegExp(`function\\s+${name}\\s*\\(`).test(game.logicSource))
      return { valid: false, error: `logicSource must declare function ${name}(...).`, game };
  if (!/function\s+render\s*\(/.test(game.uiSource))
    return { valid: false, error: 'uiSource must declare function render(root, model, ctx).', game };
  for (const field of ['logicSource', 'uiSource', 'styles', 'tests'])
    if (game[field].length > GAME_LIMITS[field])
      return { valid: false, error: `${field} is longer than ${GAME_LIMITS[field]} characters; make it shorter.`, game };
  try {
    if (!Array.isArray(JSON.parse(game.tests))) throw new Error('not an array');
  } catch {
    return { valid: false, error: 'tests must be a JSON array of scenarios.', game };
  }
  return { valid: true, error: '', game };
}

function cleanPreviousGame(value) {
  if (!value || typeof value !== 'object') return null;
  const result = generatedGameValidation(value);
  return result.game || null;
}

async function requestGeminiGame(env, model, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: gameResponseSchema(),
        temperature: 0.4,
        maxOutputTokens: 32768,
      },
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message || `Gemini returned HTTP ${response.status}.`;
    return { game: null, error: response.status === 429 ? 'Gemini’s free quota is temporarily exhausted. Try again later.' : message, retryable: response.status === 429 || response.status === 404 || response.status >= 500 };
  }
  const candidate = result?.candidates?.[0];
  const text = (candidate?.content?.parts || []).map(part => part.text || '').join('').trim();
  if (candidate?.finishReason === 'MAX_TOKENS')
    return { game: null, error: 'Gemini ran out of space before finishing the game. Simplify the description or try again.', retryable: true };
  try {
    return { game: JSON.parse(stripCodeFence(text)), error: '', retryable: false };
  } catch {
    return { game: null, error: 'Gemini returned an unreadable draft.', retryable: true };
  }
}

function configuredGameModels(env) {
  return [...new Set([
    String(env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
    ...String(env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash-lite')
      .split(',')
      .map(value => value.trim()),
  ].filter(Boolean))];
}

async function requestGeminiGameWithFallback(env, prompt) {
  const failures = [];
  for (const model of configuredGameModels(env)) {
    const result = await requestGeminiGame(env, model, prompt);
    if (result.game) return { ...result, model };
    failures.push(`${model}: ${result.error}`);
    if (!result.retryable) break;
  }
  return { game: null, error: failures.join(' · ') || 'No Gemini model is configured.', model: '' };
}

async function generateEventGame(request, env) {
  try {
    const { token, claims } = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => null);
    if (!body || !safeSegment(body.eventId)) return json(request, { error: 'Invalid event.' }, 400);
    const event = await firestoreDocument(`events/${encodeURIComponent(body.eventId)}`, token);
    const managesEvent = event && (
      event.ownerUid === claims.sub
      || (claims.email === LEGACY_HOST_EMAIL && event.ownerUid === LEGACY_HOST_UID)
    );
    if (!managesEvent) return json(request, { error: 'Only this event’s host can generate games.' }, 403);
    if (!env.GEMINI_API_KEY) return json(request, { error: 'Game generation is not configured yet.' }, 503);

    const definition = cleanGameDefinition(body.definition);
    const feedback = cleanTextList(body.feedback, 12, 1500);
    const failures = cleanTextList(body.failures, 15, 600);
    const previousGame = cleanPreviousGame(body.previousGame);
    if ((feedback.length || failures.length) && !previousGame)
      return json(request, { error: 'A revision must include the draft being revised.' }, 400);

    const day = new Date().toISOString().slice(0, 10);
    const quotaKey = `game-ai:${claims.sub}:${day}`;
    const used = Number(await env.PUSH_SUBSCRIPTIONS.get(quotaKey)) || 0;
    const dailyLimit = Math.max(1, Math.min(200, Number(env.GAME_GENERATION_DAILY_LIMIT) || 30));
    if (used >= dailyLimit)
      return json(request, { error: 'Today’s game-generation allowance has been used. Try again tomorrow.' }, 429);
    await env.PUSH_SUBSCRIPTIONS.put(quotaKey, String(used + 1), { expirationTtl: 60 * 60 * 48 });

    const prompt = previousGame
      ? gameRevisionPrompt(definition, previousGame, feedback, failures)
      : gameGenerationPrompt(definition);
    let generation = await requestGeminiGameWithFallback(env, prompt);
    if (!generation.game) return json(request, { error: generation.error }, 502);
    let validation = generatedGameValidation(generation.game);
    if (!validation.valid) {
      const repairPrompt = `${prompt}\n\nYour previous answer was rejected: ${validation.error}\nPrevious answer:\n${JSON.stringify(validation.game || generation.game)}\nReturn the corrected complete game.`;
      generation = await requestGeminiGameWithFallback(env, repairPrompt);
      if (!generation.game) return json(request, { error: generation.error }, 502);
      validation = generatedGameValidation(generation.game);
      if (!validation.valid) return json(request, { error: `Gemini’s draft was incomplete: ${validation.error}` }, 422);
    }
    return json(request, {
      game: validation.game,
      model: generation.model,
      remainingToday: Math.max(0, dailyLimit - used - 1),
    });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Game generation failed.' }, 400);
  }
}

async function deleteAccountPushData(request, env) {
  try {
    const { token, claims } = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => null);
    if (!body || !safeSegment(body.guestUid))
      return json(request, { error: 'Invalid account identity.' }, 400);
    const profile = await firestoreDocument(`users/${encodeURIComponent(claims.sub)}`, token);
    if (!profile || profile.uid !== claims.sub || profile.guestUid !== body.guestUid)
      return json(request, { error: 'Account identity does not match.' }, 403);
    let cursor;
    let deleted = 0;
    do {
      const page = await env.PUSH_SUBSCRIPTIONS.list({ cursor });
      const records = await Promise.all(page.keys.map(async key => ({
        key: key.name,
        value: await env.PUSH_SUBSCRIPTIONS.get(key.name, 'json'),
      })));
      const matching = records.filter(record => record.value
        && (record.value.actorUid === body.guestUid || record.value.actorUid === claims.sub));
      await Promise.all(matching.map(record => env.PUSH_SUBSCRIPTIONS.delete(record.key)));
      deleted += matching.length;
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return json(request, { ok: true, deleted });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Account cleanup failed.' }, 401);
  }
}

async function subscribe(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !safeSegment(body.eventId) || !safeSegment(body.subscriptionId))
    return json(request, { error: 'Invalid subscription.' }, 400);
  const subscription = body.subscription;
  if (!subscription?.endpoint?.startsWith('https://') || !subscription?.keys?.p256dh || !subscription?.keys?.auth)
    return json(request, { error: 'Invalid push endpoint.' }, 400);
  if (!safeSegment(body.actorUid) || !['guest', 'host'].includes(body.actorRole))
    return json(request, { error: 'Invalid participant.' }, 400);

  if (body.actorRole === 'guest') {
    const rsvp = await firestoreDocument(`events/${encodeURIComponent(body.eventId)}/rsvps/${encodeURIComponent(body.actorUid)}`);
    if (!rsvp || rsvp.status !== 'yes' || rsvp.guestName !== body.actorName || ['declined', 'pending'].includes(rsvp.approvalStatus))
      return json(request, { error: 'Only approved guests who are going can enable chat notifications.' }, 403);
  }

  await env.PUSH_SUBSCRIPTIONS.put(
    `subscription:${body.eventId}:${body.subscriptionId}`,
    JSON.stringify({
      eventId: body.eventId,
      subscriptionId: body.subscriptionId,
      subscription,
      actorUid: body.actorUid,
      actorRole: body.actorRole,
      actorName: String(body.actorName || '').slice(0, 80),
      updatedAt: Date.now(),
    }),
    { expirationTtl: 60 * 60 * 24 * 120 },
  );
  return json(request, { ok: true });
}

async function unsubscribe(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !safeSegment(body.eventId) || !safeSegment(body.subscriptionId))
    return json(request, { error: 'Invalid subscription.' }, 400);
  await env.PUSH_SUBSCRIPTIONS.delete(`subscription:${body.eventId}:${body.subscriptionId}`);
  return json(request, { ok: true });
}

async function listEventSubscriptions(env, eventId) {
  const prefix = `subscription:${eventId}:`;
  let cursor;
  const records = [];
  do {
    const page = await env.PUSH_SUBSCRIPTIONS.list({ prefix, cursor });
    const values = await Promise.all(page.keys.map((key) => env.PUSH_SUBSCRIPTIONS.get(key.name, 'json')));
    records.push(...values.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return records;
}

async function listAccountSubscriptions(env, actorUid) {
  let cursor;
  const records = [];
  do {
    const page = await env.PUSH_SUBSCRIPTIONS.list({ cursor });
    const values = await Promise.all(page.keys
      .filter((key) => key.name.startsWith('subscription:'))
      .map((key) => env.PUSH_SUBSCRIPTIONS.get(key.name, 'json')));
    records.push(...values.filter((record) => record?.actorUid === actorUid));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return [...new Map(records.map((record) => [record.subscription?.endpoint, record])).values()];
}

function allocatedExpenseParticipantIds(expense) {
  return [...new Set((Array.isArray(expense?.items) ? expense.items : [])
    .flatMap(item => Array.isArray(item?.allocations) ? item.allocations : [])
    .filter(allocation => Number(allocation?.multiplier) > 0 && safeSegment(allocation?.participantUid))
    .map(allocation => allocation.participantUid))];
}

function eligibleExpenseGuestIds(participants, rsvps, submitterUid) {
  const rsvpByGuest = new Map(rsvps.filter(Boolean).map(rsvp => [rsvp.guestUid, rsvp]));
  return [...new Set(participants.filter(Boolean).flatMap(participant => {
    const guestUid = participant.primaryGuestUid;
    const rsvp = rsvpByGuest.get(guestUid);
    const registered = typeof participant.accountUid === 'string' && participant.accountUid.length > 1;
    const approved = rsvp && rsvp.status === 'yes' && !['declined', 'pending'].includes(rsvp.approvalStatus);
    const isGuest = participant.role === 'guest' || participant.role === 'companion';
    return registered && approved && isGuest && guestUid !== submitterUid ? [guestUid] : [];
  }))];
}

function eventExpenseUrl(event, eventId) {
  const publicPath = typeof event?.publicPath === 'string'
    && /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(event.publicPath)
    ? event.publicPath
    : '';
  const url = new URL(publicPath ? `https://gaemaj.tech/${publicPath}` : 'https://gaemaj.tech/');
  if (!publicPath) url.searchParams.set('event', eventId);
  url.searchParams.set('expenses', '1');
  return url.toString();
}

async function sendExpensePush(request, env, context) {
  try {
    const { token, claims } = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => null);
    if (!body || !safeSegment(body.eventId) || !safeSegment(body.expenseId))
      return json(request, { error: 'Invalid expense.' }, 400);

    const [expense, event] = await Promise.all([
      firestoreDocument(
        `events/${encodeURIComponent(body.eventId)}/expenses/${encodeURIComponent(body.expenseId)}`,
        token,
      ),
      firestoreDocument(`events/${encodeURIComponent(body.eventId)}`, token),
    ]);
    if (!expense || expense.kind !== 'manual')
      return json(request, { error: 'Expense not found.' }, 404);
    if (expense.submittedByAccountUid !== claims.sub)
      return json(request, { error: 'Only the person who added this expense can notify its guests.' }, 403);

    const sentKey = `expense-sent:${body.eventId}:${body.expenseId}`;
    if (await env.PUSH_SUBSCRIPTIONS.get(sentKey))
      return json(request, { ok: true, duplicate: true, recipients: 0 });

    const participantIds = allocatedExpenseParticipantIds(expense);
    const participants = await Promise.all(participantIds.map(participantId => firestoreDocument(
      `events/${encodeURIComponent(body.eventId)}/expense-participants/${encodeURIComponent(participantId)}`,
      token,
    )));
    const primaryGuestIds = [...new Set(participants.filter(Boolean)
      .map(participant => participant.primaryGuestUid)
      .filter(safeSegment))];
    const rsvps = await Promise.all(primaryGuestIds.map(guestUid => firestoreDocument(
      `events/${encodeURIComponent(body.eventId)}/rsvps/${encodeURIComponent(guestUid)}`,
      token,
    )));
    const recipientGuestIds = eligibleExpenseGuestIds(participants, rsvps, expense.submittedByUid);
    const subscriptions = (await listEventSubscriptions(env, body.eventId))
      .filter(record => recipientGuestIds.includes(record.actorUid));

    await env.PUSH_SUBSCRIPTIONS.put(sentKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
    const vapid = {
      subject: 'mailto:alaki.dolaki.holholaki@gmail.com',
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    };
    const url = eventExpenseUrl(event, body.eventId);
    const amount = expense.items.reduce((total, item) => total + Math.max(0, Number(item?.amountCents) || 0), 0)
      + Math.max(0, Number(expense.taxCents) || 0)
      + Math.max(0, Number(expense.feesCents) || 0);
    const bodyText = `${expense.submittedByName || 'A guest'} added “${String(expense.title || 'New expense').slice(0, 100)}”${amount ? ` (${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)})` : ''}.`;
    context.waitUntil(Promise.all(subscriptions.map(async record => {
      try {
        const payload = await buildPushPayload(
          {
            data: JSON.stringify({
              title: `New expense · ${event?.title || 'Nights'}`,
              body: bodyText,
              tag: `nights-expense-${body.eventId}-${body.expenseId}`,
              url,
              eventId: body.eventId,
            }),
            options: { ttl: 86400, urgency: 'normal' },
          },
          record.subscription,
          vapid,
        );
        const response = await fetch(record.subscription.endpoint, payload);
        if (response.status === 404 || response.status === 410)
          await env.PUSH_SUBSCRIPTIONS.delete(`subscription:${body.eventId}:${record.subscriptionId}`);
      } catch (error) {
        console.error('Expense push delivery failed', error);
      }
    })));
    return json(request, {
      ok: true,
      recipients: recipientGuestIds.length,
      deliveries: subscriptions.length,
    });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Expense notification failed.' }, 401);
  }
}

async function sendInvitationPush(request, env, context) {
  try {
    const { token, claims } = await verifyFirebaseToken(request);
    const body = await request.json().catch(() => null);
    if (!body || !safeSegment(body.eventId) || !safeSegment(body.recipientUid))
      return json(request, { error: 'Invalid invitation.' }, 400);
    const [invitation, event] = await Promise.all([
      firestoreDocument(
        `users/${encodeURIComponent(body.recipientUid)}/invitations/${encodeURIComponent(body.eventId)}`,
        token,
      ),
      firestoreDocument(`events/${encodeURIComponent(body.eventId)}`, token),
    ]);
    if (
      !invitation
      || invitation.hostUid !== claims.sub
      || invitation.recipientUid !== body.recipientUid
      || invitation.eventId !== body.eventId
    ) return json(request, { error: 'Invitation not found.' }, 403);
    const sentKey = `invite-sent:${body.eventId}:${body.recipientUid}:${Date.parse(invitation.updatedAt || '') || 0}`;
    if (await env.PUSH_SUBSCRIPTIONS.get(sentKey)) return json(request, { ok: true, duplicate: true });
    await env.PUSH_SUBSCRIPTIONS.put(sentKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
    const subscriptions = await listAccountSubscriptions(env, invitation.recipientGuestUid);
    const vapid = {
      subject: 'mailto:alaki.dolaki.holholaki@gmail.com',
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    };
    const title = event?.title || invitation.eventTitle || 'a new event';
    context.waitUntil(Promise.all(subscriptions.map(async (record) => {
      try {
        const payload = await buildPushPayload(
          {
            data: JSON.stringify({
              title: 'You’re invited',
              body: `${title} is waiting on your Nights home page.`,
              tag: `nights-invitation-${body.eventId}`,
              url: 'https://gaemaj.tech/nights-guest/',
            }),
            options: { ttl: 86400, urgency: 'normal' },
          },
          record.subscription,
          vapid,
        );
        const response = await fetch(record.subscription.endpoint, payload);
        if (response.status === 404 || response.status === 410)
          await env.PUSH_SUBSCRIPTIONS.delete(`subscription:${record.eventId}:${record.subscriptionId}`);
      } catch (error) {
        console.error('Invitation push delivery failed', error);
      }
    })));
    return json(request, { ok: true, recipients: subscriptions.length });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Invitation notification failed.' }, 401);
  }
}

async function sendPush(request, env, context) {
  const body = await request.json().catch(() => null);
  if (!body || !safeSegment(body.eventId) || !safeSegment(body.messageId))
    return json(request, { error: 'Invalid message.' }, 400);
  const sentKey = `sent:${body.eventId}:${body.messageId}`;
  if (await env.PUSH_SUBSCRIPTIONS.get(sentKey)) return json(request, { ok: true, duplicate: true });

  const [message, event] = await Promise.all([
    firestoreDocument(`events/${encodeURIComponent(body.eventId)}/chat/${encodeURIComponent(body.messageId)}`),
    firestoreDocument(`events/${encodeURIComponent(body.eventId)}`),
  ]);
  if (!message || message.deleted) return json(request, { error: 'Message not found.' }, 404);
  await env.PUSH_SUBSCRIPTIONS.put(sentKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });

  const subscriptions = await listEventSubscriptions(env, body.eventId);
  const notification = {
    title: `${message.authorRole === 'host' ? 'Host' : message.authorName || 'Guest'} · ${event?.title || 'Gather'}`,
    body: message.type === 'poll' ? `Poll: ${message.pollQuestion || 'New poll'}` : String(message.text || 'New message').slice(0, 180),
    tag: `gather-chat-${body.eventId}-${body.messageId}`,
  };
  const vapid = {
    subject: 'mailto:alaki.dolaki.holholaki@gmail.com',
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  context.waitUntil(Promise.all(subscriptions
    .filter((record) => record.actorUid !== message.authorUid)
    .map(async (record) => {
      try {
        const payload = await buildPushPayload(
          {
            data: JSON.stringify({
              ...notification,
              url: `https://gaemaj.tech/?${record.actorRole === 'host' ? 'view=host&' : ''}event=${encodeURIComponent(body.eventId)}&chat=1`,
            }),
            options: { ttl: 86400, urgency: 'normal' },
          },
          record.subscription,
          vapid,
        );
        const response = await fetch(record.subscription.endpoint, payload);
        if (response.status === 404 || response.status === 410)
          await env.PUSH_SUBSCRIPTIONS.delete(`subscription:${body.eventId}:${record.subscriptionId}`);
      } catch (error) {
        console.error('Push delivery failed', error);
      }
    })));
  return json(request, { ok: true, recipients: subscriptions.length });
}

export {
  allocatedExpenseParticipantIds,
  cleanGameDefinition,
  eligibleExpenseGuestIds,
  eventExpenseUrl,
  expiredUnverifiedProfiles,
  gameGenerationPrompt,
  configuredGameModels,
  requestGeminiGameWithFallback,
  generatedGameValidation,
  purgeExpiredUnverifiedAccounts,
  upstreamPath,
};

export default {
  async fetch(request, env, context) {
    const incomingUrl = new URL(request.url);
    if (incomingUrl.pathname.startsWith('/api/games/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
      const origin = request.headers.get('origin');
      if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: 'Origin not allowed.' }, 403);
      if (incomingUrl.pathname === '/api/games/generate' && request.method === 'POST')
        return generateEventGame(request, env);
      return json(request, { error: 'Not found.' }, 404);
    }
    if (incomingUrl.pathname.startsWith('/api/push/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
      const origin = request.headers.get('origin');
      if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: 'Origin not allowed.' }, 403);
      if (incomingUrl.pathname === '/api/push/subscribe' && request.method === 'POST') return subscribe(request, env);
      if (incomingUrl.pathname === '/api/push/subscribe' && request.method === 'DELETE') return unsubscribe(request, env);
      if (incomingUrl.pathname === '/api/push/send' && request.method === 'POST') return sendPush(request, env, context);
      if (incomingUrl.pathname === '/api/push/invite' && request.method === 'POST') return sendInvitationPush(request, env, context);
      if (incomingUrl.pathname === '/api/push/expense' && request.method === 'POST') return sendExpensePush(request, env, context);
      if (incomingUrl.pathname === '/api/push/account' && request.method === 'DELETE') return deleteAccountPushData(request, env);
      return json(request, { error: 'Not found.' }, 404);
    }

    const originUrl = new URL(GITHUB_PAGES_ORIGIN);
    originUrl.pathname = upstreamPath(incomingUrl.pathname);
    originUrl.search = incomingUrl.search;
    const upstreamRequest = new Request(originUrl, request);
    upstreamRequest.headers.set('host', 'afouman.github.io');
    const releaseFile = incomingUrl.pathname === '/sw.js'
      || incomingUrl.pathname === `${APP_BASE_PATH}/sw.js`;
    const staticAsset = incomingUrl.pathname.startsWith('/_next/')
      || incomingUrl.pathname.startsWith('/icons/')
      || incomingUrl.pathname.startsWith(`${APP_BASE_PATH}/_next/`)
      || incomingUrl.pathname.startsWith(`${APP_BASE_PATH}/icons/`)
      || APP_ASSETS.has(incomingUrl.pathname)
      || APP_ASSETS.has(incomingUrl.pathname.replace(APP_BASE_PATH, ''));
    const freshPage = !staticAsset;
    const response = await fetch(upstreamRequest, {
      cf: releaseFile || freshPage
        ? { cacheEverything: false, cacheTtl: 0 }
        : { cacheEverything: request.method === 'GET', cacheTtlByStatus: { '200-299': 300, '404': 30, '500-599': 0 } },
    });
    const headers = new Headers(response.headers);
    headers.set('x-gather-route', incomingUrl.pathname);
    if (releaseFile || freshPage) headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(purgeExpiredUnverifiedAccounts(env).then(result => {
      console.log('Unverified account cleanup complete', {
        ...result,
        retentionDays: UNVERIFIED_ACCOUNT_RETENTION_DAYS,
      });
    }));
  },
};
