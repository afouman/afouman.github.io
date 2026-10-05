const GITHUB_PAGES_ORIGIN = 'https://afouman.github.io';
const APP_BASE_PATH = '/gathering';

const APP_ASSETS = new Set([
  '/favicon.svg',
  '/manifest.webmanifest',
  '/og.png',
  '/sw.js',
  '/vinext-client-entry-manifest.json',
  '/gather-birthday-party-hero.jpg',
  '/gather-custom-event-hero.jpg',
  '/gather-dinner-hero.jpg',
  '/gather-game-night-hero.jpg',
  '/gather-movie-night-hero.jpg',
]);

function upstreamPath(pathname) {
  if (pathname === APP_BASE_PATH || pathname.startsWith(`${APP_BASE_PATH}/`))
    return pathname === APP_BASE_PATH ? `${APP_BASE_PATH}/` : pathname;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/icons/') || APP_ASSETS.has(pathname))
    return `${APP_BASE_PATH}${pathname}`;
  return `${APP_BASE_PATH}/`;
}

export { upstreamPath };

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const originUrl = new URL(GITHUB_PAGES_ORIGIN);
    originUrl.pathname = upstreamPath(incomingUrl.pathname);
    originUrl.search = incomingUrl.search;

    const upstreamRequest = new Request(originUrl, request);
    upstreamRequest.headers.set('host', 'afouman.github.io');
    const response = await fetch(upstreamRequest, {
      cf: {
        cacheEverything: request.method === 'GET',
        cacheTtlByStatus: { '200-299': 300, '404': 30, '500-599': 0 },
      },
    });

    const headers = new Headers(response.headers);
    headers.set('x-gather-route', incomingUrl.pathname);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
