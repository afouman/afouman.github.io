# Gathering custom-domain router

This small Cloudflare Worker keeps event links clean while the static app remains
hosted at `https://afouman.github.io/gathering/`.

- `https://gaemaj.tech/movie-night` serves the Gathering app without redirecting.
- The browser pathname becomes the event ID.
- Static assets continue to come from the GitHub Pages build under `/gathering/`.
- The Worker also stores expiring browser push subscriptions in Cloudflare KV
  and sends encrypted Web Push notifications. Its VAPID private key is stored as
  a Worker secret and is never shipped to the browser.
- New manual expenses use an authenticated Worker endpoint to notify only
  registered, approved Going guests who have a share in the saved expense.
- A daily cron removes email/password accounts that remain unverified for 90
  days, including their Authentication user, phone/email claims, profile,
  invitations, contacts, and push subscriptions.

The account-retention cron uses a dedicated Google service account with the
minimum Firebase Authentication user-delete and Firestore data permissions.
Grant that account **Firebase Authentication Admin**
(`roles/firebaseauth.admin`) and **Cloud Datastore User**
(`roles/datastore.user`) on `gathering-app-109eb`.
Store its credentials as Worker secrets; never put them in `wrangler.jsonc` or
frontend environment files:

```sh
pnpm wrangler secret put FIREBASE_SERVICE_ACCOUNT_EMAIL --config domain-worker/wrangler.jsonc
pnpm wrangler secret put FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY --config domain-worker/wrangler.jsonc
```

The cron stays fail-closed until both secrets are present. Firestore security
rules cannot run timers, and Firestore TTL deletes require billing and would not
remove the corresponding Firebase Authentication user, so TTL is intentionally
not used here.

## Gemini game designer

`POST /api/games/generate` uses Gemini structured output to build a constrained
Nights game module. The Gemini API key is an encrypted Worker secret and is
never shipped in the browser build:

```sh
pnpm wrangler secret put GEMINI_API_KEY --config domain-worker/wrangler.jsonc
```

Use a Google AI Studio key that remains on the Gemini free tier. The Worker
defaults to `gemini-2.5-flash-lite` and enforces a per-account daily generation
allowance in the existing KV namespace. The non-secret `GEMINI_MODEL` and
`GAME_GENERATION_DAILY_LIMIT` values can be adjusted in `wrangler.jsonc`.

Attach `gaemaj.tech` and `www.gaemaj.tech` as Worker custom domains after the
domain is active in the same Cloudflare account.
