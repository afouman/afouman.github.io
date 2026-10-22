# Nights game server

Referee for live, AI-generated event games. A Cloudflare Worker routes
`wss://gaemaj.tech/api/games/live?event=…&game=…` to one Durable Object per event
game. That object holds every table of the game.

- Phones connect over a WebSocket and send `{type:'hello', token}` with their Firebase
  ID token (never in the URL). The server verifies the token and reads the event, game
  and RSVP with that same token, so Firestore rules still decide who may play.
- The generated rules (`setup`, `move`, `view`) run inside QuickJS compiled to
  WebAssembly, with memory, stack and instruction limits and no network access. The
  shared engine lives in `../game-engine/engine-source.mjs`.
- The full state and random seed stay on the server. Each phone receives only
  `view(state, itsSeat)`, seat ids and display names. Account ids never leave the server.
- Uses the WebSocket Hibernation API and SQLite-backed Durable Objects, both available
  on the Workers Free plan.

Deploy: `../node_modules/.bin/wrangler deploy --config wrangler.jsonc` (run `npm install` here first).

Local testing: `wrangler dev --config wrangler.jsonc --var GAME_SERVER_TEST_MODE:true
--var ALLOW_LOCAL_ORIGINS:true` enables fake identities for multiplayer tests. These
variables are never set in `wrangler.jsonc`, so a deployed server always verifies Firebase.
