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
const GAME_SOURCE_FORBIDDEN = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|import|require|eval|Function|globalThis|self|postMessage|close|Worker|Blob|URL|WebAssembly|Atomics|SharedArrayBuffer|navigator|caches|indexedDB|document|window|parent|top|opener|localStorage|sessionStorage|constructor|__proto__|prototype|setTimeout|setInterval|queueMicrotask|crypto|performance|Date|Promise|async|await|while)\b/;

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

async function firestoreDocument(path, token = '') {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${FIRESTORE_ROOT}/${path}`, { headers });
  if (!response.ok) return null;
  const document = await response.json();
  return firestoreFields(document.fields);
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
    required: ['instructions', 'logicSource', 'uiNotes'],
    properties: {
      instructions: { type: 'string', description: 'A short host-facing explanation of how to start and test the game.' },
      uiNotes: { type: 'string', description: 'A short description of the generated player interface.' },
      logicSource: { type: 'string', description: 'One JavaScript object expression implementing the exact Nights game contract.' },
    },
  };
}

function gameGenerationPrompt(definition) {
  return `You are the game designer for Nights, a gathering app. Convert the host's description into a small deterministic party-game module.

Return JSON matching the response schema. logicSource must be a SINGLE JAVASCRIPT OBJECT EXPRESSION, beginning with ({ and ending with }). Do not use Markdown fences.

The object must implement exactly:
- setup(context) -> serializable initial state
- onAction(state, action, context) -> serializable next state
- view(state, viewer, ui) -> one serializable UI node

Available context only:
- context.players.list() returns [{id,name}]
- context.teams.randomize(count) returns [{id,name,players}]
- context.random.pick(array)
- context.random.shuffle(array)
- context.clock.now()

Available UI constructors only:
- ui.screen(children)
- ui.heading(text)
- ui.text(text)
- ui.card(title, children)
- ui.button(label, actionObject, optionalTone)
- ui.timer(deadlineMilliseconds, optionalLabel)
- ui.teams(teams)
- ui.scoreboard(objectOfLabelToNumber)
- ui.list(array)
- ui.secret(label, value)
- ui.input(label, key, optionalPlaceholder)

An input value can be inserted into a later button action with the string "$input:key". Keep all game state JSON-serializable. Every button action must have a type string. Handle every emitted action in onAction. Prefer immutable state updates.

Never use networking, browser APIs, storage, imports, code generation, constructors, prototypes, global objects, workers, blobs, timers, recursion, while loops, asynchronous code, or nondeterministic side effects. The runtime supplies randomness and time. Keep the source under 12,000 characters.
The safety validator rejects these names anywhere in logicSource, including labels, comments, action names, and string values: fetch, XMLHttpRequest, WebSocket, EventSource, importScripts, import, require, eval, Function, globalThis, self, postMessage, close, Worker, Blob, URL, WebAssembly, Atomics, SharedArrayBuffer, navigator, caches, indexedDB, document, window, parent, top, opener, localStorage, sessionStorage, constructor, __proto__, prototype, setTimeout, setInterval, queueMicrotask, crypto, performance, Date, Promise, async, await, while. For all deadlines use context.clock.now(); never use Date.

Host definition:
${JSON.stringify(definition, null, 2)}`;
}

function normalizeGeneratedGameSource(value) {
  let source = String(value || '').trim();
  source = source
    .replace(/^```(?:javascript|js)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^(?:javascript|js)\s*\n/i, '')
    .trim()
    .replace(/;\s*$/, '')
    .trim();
  const assignment = source.match(/^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*([\s\S]+)$/);
  if (assignment) source = assignment[1].trim().replace(/;\s*$/, '').trim();
  if (!source.startsWith('{') && !source.startsWith('({')) {
    const firstBrace = source.indexOf('{');
    const lastBrace = source.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) source = source.slice(firstBrace, lastBrace + 1).trim();
  }
  if (source.startsWith('{') && source.endsWith('}')) source = `(${source})`;
  return source;
}

function generatedRuntimeValidation(value) {
  if (!value || typeof value !== 'object') return { valid: false, error: 'Gemini did not return a game object.' };
  if (typeof value.instructions !== 'string' || typeof value.uiNotes !== 'string' || typeof value.logicSource !== 'string')
    return { valid: false, error: 'Gemini omitted part of the playable game.' };
  const source = normalizeGeneratedGameSource(value.logicSource);
  if (!source.startsWith('({') || !source.endsWith('})'))
    return { valid: false, error: 'Gemini returned code that could not be converted into a safe Nights game. Generate again.' };
  if (source.length > 16_000)
    return { valid: false, error: 'Gemini generated a game that is too large for the safe player.' };
  const forbiddenMatch = source.match(GAME_SOURCE_FORBIDDEN);
  if (forbiddenMatch) {
    const replacement = ['Date', 'performance', 'setTimeout', 'setInterval'].includes(forbiddenMatch[0])
      ? ' It must use Nights’ built-in game clock instead.'
      : '';
    return {
      valid: false,
      error: `Gemini used the blocked capability “${forbiddenMatch[0]}”. Your game description is valid; generate again.${replacement}`,
    };
  }
  const missing = ['setup', 'onAction', 'view'].filter(name => !new RegExp(`\\b${name}\\s*(?:\\(|:)`).test(source));
  if (missing.length)
    return { valid: false, error: `Gemini omitted the required ${missing.join(', ')} game function${missing.length === 1 ? '' : 's'}. Generate again.` };
  return { valid: true, error: '', source };
}

function validGeneratedRuntime(value) {
  return generatedRuntimeValidation(value).valid;
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
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message || 'Gemini could not generate this game.';
    return { game: null, error: response.status === 429 ? 'Gemini’s free quota is temporarily exhausted. Try again later.' : message, status: response.status === 429 ? 429 : 502 };
  }
  const text = (result?.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim();
  try {
    return { game: JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')), error: '', status: 200 };
  } catch {
    return { game: null, error: 'Gemini returned an invalid JSON game draft.', status: 502 };
  }
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
    const day = new Date().toISOString().slice(0, 10);
    const quotaKey = `game-ai:${claims.sub}:${day}`;
    const used = Number(await env.PUSH_SUBSCRIPTIONS.get(quotaKey)) || 0;
    const dailyLimit = Math.max(1, Math.min(100, Number(env.GAME_GENERATION_DAILY_LIMIT) || 15));
    if (used >= dailyLimit)
      return json(request, { error: 'Today’s free game-generation allowance has been used. Try again tomorrow.' }, 429);

    const model = String(env.GEMINI_MODEL || 'gemini-2.5-flash-lite');
    let generation = await requestGeminiGame(env, model, gameGenerationPrompt(definition));
    if (!generation.game) return json(request, { error: generation.error }, generation.status);
    let game = generation.game;
    let validation = generatedRuntimeValidation(game);
    if (!validation.valid) {
      generation = await requestGeminiGame(env, model, `${gameGenerationPrompt(definition)}\n\nA previous attempt failed Nights validation: ${validation.error}\nRegenerate the module from scratch. Return only the required JSON. Use a plain object expression for logicSource and implement setup, onAction, and view.`);
      if (!generation.game) return json(request, { error: `${generation.error} The first generated draft also failed: ${validation.error}` }, generation.status);
      game = generation.game;
      validation = generatedRuntimeValidation(game);
    }
    if (!validation.valid)
      return json(request, { error: `Gemini could not produce a safe playable module after two attempts. Last issue: ${validation.error}` }, 422);

    await env.PUSH_SUBSCRIPTIONS.put(quotaKey, String(used + 1), { expirationTtl: 60 * 60 * 48 });
    return json(request, {
      game: {
        instructions: game.instructions.slice(0, 1000),
        uiNotes: game.uiNotes.slice(0, 1000),
        logicSource: validation.source,
      },
      remainingToday: Math.max(0, dailyLimit - used - 1),
      model,
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
  generatedRuntimeValidation,
  normalizeGeneratedGameSource,
  purgeExpiredUnverifiedAccounts,
  upstreamPath,
  validGeneratedRuntime,
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
