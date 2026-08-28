# Service Worker: Caching & Offline Behavior

`public/sw.js` (originally added for #175) gives the app basic offline
support and faster repeat loads. It's registered client-side by
`src/components/ServiceWorkerRegister.tsx` and its offline/online state is
surfaced to users by `src/components/OfflineIndicator.tsx`.

## Caches

Three named caches, all suffixed with a shared `CACHE_VERSION`
(`audioblocks-v1`):

| Cache            | Purpose                                                                |
| ---------------- | ------------------------------------------------------------------------ |
| `shell-<version>`   | Precached app shell — populated on `install`, see below.               |
| `assets-<version>`  | Static assets (JS/CSS/images/fonts) cached as they're requested.       |
| `runtime-<version>` | Everything else (page navigations, same-origin API GETs) cached as they're requested. |

## Caching strategy by request type

| Request                                              | Strategy                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| Static asset (`.js .css .png .jpg .jpeg .gif .svg .webp .ico .woff .woff2 .ttf .eot .map`) | **Cache-first** (`ASSET_CACHE`) — serve from cache if present, otherwise fetch and populate the cache. |
| Page navigation or any other same-origin GET (incl. API responses) | **Network-first** (`RUNTIME_CACHE`) — try the network, fall back to cache on failure; a failed *navigation* with nothing cached falls back further to the precached `/` shell. |
| `POST` / `PUT` / `PATCH` / `DELETE`                  | **Never intercepted** — the service worker returns early and lets the request go straight to the network, so mutating requests are never served stale or cached. |
| Non-`http(s)` requests (e.g. browser extension URLs) | **Ignored** — the fetch handler returns without calling `respondWith`. |

Only responses with `status === 200 && type === "basic"` are cached (i.e.
successful, same-origin responses) — opaque cross-origin responses and error
responses are never written to a cache.

## Lifecycle

1. **`install`** — opens `shell-<version>` and precaches a fixed list of
   routes/assets (`/`, `/login`, `/signup`, `/dashboard`, `favicon.ico`,
   `logo.png`, `logo2.png`, `next.svg`, `vercel.svg`) using
   `{ cache: "reload" }` so the precache itself isn't served from the HTTP
   cache. A failure to precache any single URL is swallowed (non-critical —
   the runtime cache picks it up on first real visit). `self.skipWaiting()`
   is called so a newly installed worker doesn't wait for all tabs to close.
2. **`activate`** — deletes every cache whose name doesn't end in the
   current `-${CACHE_VERSION}` suffix, then calls `self.clients.claim()` so
   the new worker takes control of already-open tabs immediately.
3. **`fetch`** — routes each request per the table above.
4. **`message`** — listens for a `"SKIP_WAITING"` message from the page to
   force an installed-but-waiting worker to activate immediately (see
   below).

## Cache invalidation on deploy

Bump `CACHE_VERSION` in `sw.js` on any deploy where cached assets/shell
content should be invalidated. The `activate` handler purges every cache
that doesn't match the new version, so old cached responses can't be served
after the new worker takes over.

## Update flow (client side)

`ServiceWorkerRegister.tsx` registers `/sw.js` on page load (deferred until
after `window.load` so it doesn't compete with first paint) and drives the
update flow:

1. If a worker is already `waiting` at registration time, it's immediately
   told to `SKIP_WAITING`.
2. On `updatefound`, once the new worker reaches `installed` (and there's
   already an active controller — i.e. this isn't the very first install),
   it's also told to `SKIP_WAITING`.
3. On `controllerchange` (fired once the new worker takes control), the
   page reloads exactly once — guarded by a `reloaded` flag — so the user
   ends up on the new shell with newly cached assets actually being served.

Registration failures are caught and logged with `console.warn` — a broken
service worker is treated as non-fatal; the app still functions without
offline support.

## Offline UX

`OfflineIndicator.tsx` renders a sticky amber banner ("You're offline —
showing cached content...") whenever `navigator.onLine` is `false`. It
listens for the `online`/`offline` window events plus a
`visibilitychange`-triggered re-check (covers the case where connectivity
changed while the tab was backgrounded). It renders nothing while online.

## Debugging locally

- Chrome DevTools → **Application → Service Workers** shows registration
  status, lets you force-update or unregister, and has an **Offline**
  checkbox to simulate connectivity loss without actually disconnecting.
- **Application → Cache Storage** lets you inspect the contents of
  `shell-*`, `assets-*`, and `runtime-*` directly.
- If you're not seeing a code change take effect, check whether a worker is
  stuck `waiting` — the update flow above handles this in normal use, but a
  hard refresh (DevTools → "Update on reload") bypasses it during
  development.
