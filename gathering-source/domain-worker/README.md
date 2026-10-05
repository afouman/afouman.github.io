# Gathering custom-domain router

This small Cloudflare Worker keeps event links clean while the static app remains
hosted at `https://afouman.github.io/gathering/`.

- `https://gaemaj.tech/movie-night` serves the Gathering app without redirecting.
- The browser pathname becomes the event ID.
- Static assets continue to come from the GitHub Pages build under `/gathering/`.
- No Firebase data, credentials, or private guest information passes through the
  Worker; the browser continues to connect directly to Firebase.

Attach `gaemaj.tech` and `www.gaemaj.tech` as Worker custom domains after the
domain is active in the same Cloudflare account.
