# Gather

A static event-menu and real-time ordering app designed for GitHub Pages. Guests choose dishes and submit a name without creating an account. The browser remembers their latest order for 30 days, allowing edits or soft cancellation while it is still New. Hosts sign in with Google to create and delete events, build menus with item photos, shared categories, and preparation times, and manage orders in real time. Starting an order creates a per-item schedule so every dish finishes together.

## One-time setup

1. Create a Firebase project at https://console.firebase.google.com.
2. Add a Web App and copy its five public configuration values into a local `.env.local`, using `.env.example` as the template.
3. In Firebase Authentication, enable **Anonymous** and **Google** providers. Add your GitHub Pages domain under Authentication → Settings → Authorized domains.
4. Create a Firestore database and enable Firebase Storage.
5. Deploy both security files with the Firebase CLI (`firebase deploy --only firestore:rules,storage`).
6. In the GitHub repository, add the five values as Actions secrets with the exact names shown in `.env.example`.
7. In GitHub Settings → Pages, choose **GitHub Actions** as the source and push to `main`.

The private dashboard is `/?view=host`. On first use, sign in as host and choose **New event**. After saving its menu, use **Open guest preview** or **Copy guest link** for that event.

## Local development

```bash
pnpm install
pnpm dev
```

Without Firebase values the app intentionally runs with polished sample data, so the complete flow can be previewed safely. Preview orders and saved menu changes are shared between tabs in the same browser.

## Preview and test environment

Run `pnpm preview`, then open `http://localhost:3000/?test=1` in one tab and `http://localhost:3000/?view=host&test=1` in another. This deliberately uses sample data when Firebase is not configured. Orders and saved menu changes synchronize automatically between those tabs through browser-local storage and a live browser channel, without touching production data.

Run `pnpm test` for the repeatable code-quality check and production export. The generated GitHub Pages site is written to `dist/client`.

## Data and security

Firebase's public web configuration is safe to ship in a static bundle; the Firestore and Storage rules are the security boundary. Guests receive an anonymous Firebase identity persisted in that browser. A small 30-day receipt containing the event and order IDs is stored locally so the app can reopen that guest's order. Guests can retrieve and change only an order owned by their anonymous identity, and only while its status is New. Cancellation is a traceable status change rather than deletion. Only the Google account recorded as an event's `ownerUid` can list all orders, change or delete the event, or upload menu-item images.
