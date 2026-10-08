import { buildPushPayload } from '@block65/webcrypto-web-push';

const GITHUB_PAGES_ORIGIN = 'https://afouman.github.io';
const APP_BASE_PATH = '/gathering';
const FIRESTORE_ROOT = 'https://firestore.googleapis.com/v1/projects/gathering-app-109eb/databases/(default)/documents';
const VAPID_PUBLIC_KEY = 'BBLVoXFRiUDSV72gImtZXfRgu92qgCEmBY-nByHqKDiaQrB7uEkvAWRo-D6VtQlHmtESAFH7bpPMImL2uXOu5dY';
const ALLOWED_ORIGINS = new Set(['https://gaemaj.tech', 'https://www.gaemaj.tech', 'https://afouman.github.io']);

const APP_ASSETS = new Set([
  '/favicon.svg', '/manifest.webmanifest', '/og.png', '/sw.js',
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
    'access-control-allow-headers': 'content-type',
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

async function firestoreDocument(path) {
  const response = await fetch(`${FIRESTORE_ROOT}/${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) return null;
  const document = await response.json();
  return firestoreFields(document.fields);
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

export { upstreamPath };

export default {
  async fetch(request, env, context) {
    const incomingUrl = new URL(request.url);
    if (incomingUrl.pathname.startsWith('/api/push/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
      const origin = request.headers.get('origin');
      if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: 'Origin not allowed.' }, 403);
      if (incomingUrl.pathname === '/api/push/subscribe' && request.method === 'POST') return subscribe(request, env);
      if (incomingUrl.pathname === '/api/push/subscribe' && request.method === 'DELETE') return unsubscribe(request, env);
      if (incomingUrl.pathname === '/api/push/send' && request.method === 'POST') return sendPush(request, env, context);
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
};
