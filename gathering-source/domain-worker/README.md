# Gathering custom-domain router

This small Cloudflare Worker keeps event links clean while the static app remains
hosted at `https://afouman.github.io/gathering/`.

- `https://gaemaj.tech/movie-night` serves the Gathering app without redirecting.
- The browser pathname becomes the event ID.
- Static assets continue to come from the GitHub Pages build under `/gathering/`.
- The Worker also stores expiring browser push subscriptions in Cloudflare KV
  and sends encrypted Web Push notifications. Its VAPID private key is stored as
  a Worker secret and is never shipped to the browser.

Attach `gaemaj.tech` and `www.gaemaj.tech` as Worker custom domains after the
domain is active in the same Cloudflare account.
