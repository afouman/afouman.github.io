import { buildPushPayload } from '@block65/webcrypto-web-push';

const GITHUB_PAGES_ORIGIN = 'https://afouman.github.io';
const APP_BASE_PATH = '/gathering';
const FIRESTORE_ROOT = 'https://firestore.googleapis.com/v1/projects/gathering-app-109eb/databases/(default)/documents';
const VAPID_PUBLIC_KEY = 'BBLVoXFRiUDSV72gImtZXfRgu92qgCEmBY-nByHqKDiaQrB7uEkvAWRo-D6VtQlHmtESAFH7bpPMImL2uXOu5dY';
const ALLOWED_ORIGINS = new Set(['https://gaemaj.tech', 'https://www.gaemaj.tech', 'https://afouman.github.io']);

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
      if (incomingUrl.pathname === '/api/push/invite' && request.method === 'POST') return sendInvitationPush(request, env, context);
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
};
