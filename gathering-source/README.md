# Gather

A static event-menu and real-time ordering app designed for GitHub Pages. Guests first create a temporary profile with their name and phone number, then RSVP Yes, Maybe, or No, and finally order if they are attending. The normalized phone number deterministically identifies that temporary profile; no verification code or guest sign-in is used. Profile, RSVP, and orders are separate records tied to that identifier. Only Yes RSVPs can order while ordering is open, while RSVP stays available after ordering closes. Active orders lock RSVP downgrades until the order is cancelled, rejected, or fully served. Hosts sign in with Google to manage events, menus, orders, and a live RSVP panel.

## One-time setup

1. Create a Firebase project at https://console.firebase.google.com.
2. Add a Web App and copy its five public configuration values into a local `.env.local`, using `.env.example` as the template.
3. In Firebase Authentication, enable **Anonymous** and **Google** providers. Add your GitHub Pages domain under Authentication → Settings → Authorized domains.
4. Create a Firestore database and enable Firebase Storage.
5. Generate a Web Push VAPID key pair. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, upgrade the Firebase project to Blaze so Cloud Functions can run, and store the private key with `firebase functions:secrets:set VAPID_PRIVATE_KEY`.
6. Deploy the security files and notification function with the Firebase CLI (`firebase deploy --only firestore:rules,storage,functions`).
7. In the GitHub repository, add the six public values from `.env.example` as Actions secrets with the exact names shown there. Never add the VAPID private key to GitHub or the web build.
8. Publish the static build to the repository's `gathering/` directory (this repository currently uses the `master` branch for GitHub Pages).

The private dashboard is `/?view=host`. On first use, sign in as host and choose **New event**. After saving its menu, use **Open guest preview** or **Copy guest link** for that event.

## Custom domain

Production supports clean event links on `gaemaj.tech`. A new event named
“Movie Night” receives the slug `movie-night`, so its guest link is
`https://gaemaj.tech/movie-night`. If that slug already exists, the next event
uses `movie-night-2`. Existing GitHub Pages links that use `?event=` continue to
work.

The static application remains deployed in `gathering/`. The small Cloudflare
Worker in `domain-worker/` proxies the custom domain to that directory while
preserving the clean URL in the browser. Firebase remains the direct data
service; the Worker does not receive event, RSVP, chat, or order data.

## Local development

```bash
pnpm install
pnpm dev
```

Without Firebase values the app intentionally runs with polished sample data, so the complete flow can be previewed safely. Preview orders and saved menu changes are shared between tabs in the same browser.

## Preview and test environment

Run `pnpm preview`, then open `http://localhost:3000/?test=1` in one tab and `http://localhost:3000/?view=host&test=1` in another. To use sample data, start without Firebase environment variables. Preview orders, RSVPs, and saved menu changes synchronize between those tabs through browser-local storage and a live browser channel, without touching production data.

Run `pnpm test` for the repeatable code-quality check and production export. The generated GitHub Pages site is written to `dist/client`.

## Data and security

Firebase's public web configuration is safe to ship in a static bundle; Firestore and Storage rules are the security boundary. Guests do not authenticate. A SHA-256 identifier derived from the normalized phone number lets the same phone recover the same temporary profile across browsers, while event-wide name and phone claims prevent duplicates. Firestore rules permit new orders only for Yes RSVPs while the event accepts orders. Every active order increments a protected RSVP lock, and terminal order transitions release it. Hosts see every order and RSVP, including the phone number supplied by the guest. Cancelling an order records a status change rather than deleting it. Because phone numbers are not verified, they are convenient identifiers—not proof of ownership; anyone who knows a guest's phone number could assume that guest's temporary profile.

Chat push notifications are opt-in and event-specific. On iPhone and iPad they require iOS/iPadOS 16.4 or later and the site must be opened from an icon added to the Home Screen. A participant enables them from the bell in Event chat; Firebase stores the browser push subscription and the `notifyEventChat` function sends new-message notifications only to the host and approved Going guests for that event.
