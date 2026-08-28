# AudioBlocks Artist Dashboard — Project Guide

Practical reference for running, deploying, and contributing to the artist
dashboard. The application itself lives in [`app/`](../app); paths below are
relative to that directory unless noted.

Contents:

1. [Environment variables](#1-environment-variables)
2. [Deployment](#2-deployment)
3. [Storybook](#3-storybook)
4. [Onboarding for new developers](#4-onboarding-for-new-developers)

---

## 1. Environment variables

Configuration is supplied through environment variables. Copy the template and
fill in the values for your setup:

```bash
cd app
cp .env.example .env.local
```

`.env.local` is git-ignored and is the file Next.js loads for local
development. Only variables prefixed with `NEXT_PUBLIC_` are exposed to the
browser bundle — never put a secret behind that prefix.

### Variables in `.env.example`

| Variable | Required | Description | Valid values / example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL of the [`AudioBlock_Backend`](https://github.com/AudioBitsStellar/AudioBlock_Backend) REST API. Almost every feature (auth, profile, uploads, on-chain relays) calls it. If unset, the app falls back to `http://localhost:3000/api`, which is rarely correct. | Absolute URL, e.g. `http://localhost:4000/api` or `https://api.audioblocks.example/api` |
| `NEXT_PUBLIC_DYNAMIC_ENV_ID` | No (legacy) | Historical Dynamic Labs environment ID. Wallet auth now uses the Freighter API (`src/lib/freighter.ts`) and no code reads this value; kept in the template only for older branches. Leave blank on new setups. | Dynamic environment ID string, or empty |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | For on-chain features | Stellar network passphrase used when building/signing Soroban transactions. Must match the network your backend and Freighter are pointed at. | `"Test SDF Network ; September 2015"` (testnet) or `"Public Global Stellar Network ; September 2015"` (mainnet) |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | For on-chain features | Stellar Horizon / RPC endpoint for reading chain state. | `https://horizon-testnet.stellar.org` (testnet), `https://horizon.stellar.org` (mainnet), or a self-hosted RPC URL |
| `NEXT_PUBLIC_ANALYTICS_WRITE_KEY` | No | Write key for the analytics pipeline (see `src/lib/ANALYTICS.md`). When empty, analytics calls are no-ops. | Provider write-key string, or empty to disable |
| `NEXT_PUBLIC_USE_MOCK_DATA` | No | Serve bundled mock fixtures instead of calling the real API — useful for UI work without a backend. | `"true"` or `"false"` (default `false`) |

### Additional variables recognised by the code

These are not in `.env.example` because they are optional or only relevant to
CI / hosted environments, but the app reads them when present:

| Variable | Used by | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | `sentry.*.config.ts` | Sentry project DSN. If neither is set, Sentry is disabled outside production. |
| `NEXT_PUBLIC_SENTRY_ENV` | `sentry.client.config.ts` | Environment label reported to Sentry (falls back to `NODE_ENV`). |
| `SENTRY_ORG` / `SENTRY_PROJECT` | `next.config.ts` (`withSentryConfig`) | Build-time source-map upload target. Set in the deploy environment only. |
| `PLAYWRIGHT_BASE_URL` | `playwright.config.ts` | Base URL the E2E suite runs against (defaults to the local dev server). |
| `NEXT_TELEMETRY_DISABLED` | Next.js | Set to `1` to opt out of Next.js telemetry (the Docker images set this). |

---

## 2. Deployment

The dashboard is a standard Next.js 16 App Router application. Two supported
paths: Vercel (recommended for the hosted app) and Docker (self-hosting or
local parity).

Regardless of target, the backend API must be reachable from wherever the app
runs, and `NEXT_PUBLIC_API_BASE_URL` must point at it.

### Vercel

1. **Import the repo** in the Vercel dashboard (New Project → import
   `AudioBlocks_For_Artist`).
2. **Set the root directory** to `app`. This repo keeps the Next.js project in
   a subdirectory, so the default (repo root) will not build.
3. **Framework preset**: Next.js (auto-detected once the root directory is
   `app`). Build command `next build` and output are handled automatically.
4. **Environment variables**: add every required variable from
   [section 1](#1-environment-variables) for the `Production`, `Preview`, and
   `Development` scopes as appropriate. At minimum:
   `NEXT_PUBLIC_API_BASE_URL`; add the `NEXT_PUBLIC_STELLAR_*` pair if on-chain
   features are enabled; add `SENTRY_ORG` / `SENTRY_PROJECT` /
   `NEXT_PUBLIC_SENTRY_DSN` to enable error reporting and source-map upload.
5. **Deploy.** Pushes to `main` publish to production; pull requests get
   preview URLs automatically (the repo's `preview.yml` workflow also comments
   the preview link on PRs).

Node version: the project targets Node 20 (`@types/node@20`, Docker images on
`node:20`). Set the Vercel project's Node.js version to 20.x.

### Docker

A multi-stage production `Dockerfile` and a lightweight `Dockerfile.dev` live
at the repository root, wired together by `docker-compose.yml` with two
profiles.

**Development** — hot-reload, source mounted from the host:

```bash
# from the repo root
cp app/.env.example app/.env.local   # edit as needed
docker compose --profile dev up --build
# app on http://localhost:3000
```

**Production image** — optimised standalone build:

```bash
# from the repo root
docker compose --profile prod up --build
# or build/run the image directly:
docker build -t audioblocks-artist -f Dockerfile .
docker run --rm -p 3000:3000 --env-file app/.env.local audioblocks-artist
```

Notes:

- Both compose services read `app/.env.local` via `env_file`; create it before
  running or the container starts with no configuration.
- The build context is the **repo root** (not `app/`), because the Dockerfiles
  copy `app/package.json` and `app/` explicitly.
- The production `Dockerfile` deploys the Next.js **standalone** output
  (`.next/standalone`). This requires `output: "standalone"` in
  `app/next.config.ts`. If the image build fails at the
  `COPY ... /app/.next/standalone` step, that setting is missing — add it and
  rebuild.
- The production container listens on port `3000` as the non-root `nextjs`
  user; put a TLS-terminating reverse proxy (or the platform's load balancer)
  in front of it.

### CI

`.github/workflows/ci.yml` runs lint, `tsc --noEmit`, and the Vitest suite on
every PR and push to `main`; `e2e.yml` runs Playwright. Deployments should only
follow a green CI run.

---

## 3. Storybook

Storybook is the workshop for building and reviewing components in isolation.
Config lives in [`.storybook/`](../app/.storybook) and uses the
`@storybook/nextjs-vite` framework with the `essentials` and `interactions`
addons.

### Running it

```bash
cd app
npm run storybook          # dev server on http://localhost:6006
npm run storybook:build    # static build into storybook-static/
```

### Where stories live

Story files sit next to their component and match
`src/components/**/*.stories.@(js|jsx|ts|tsx)`. Current examples:

- Primitives — `src/components/common/Input.stories.tsx`,
  `Select.stories.tsx`, `Checkbox.stories.tsx`, `RadioButton.stories.tsx`,
  `FileUpload.stories.tsx`
- Dashboard views — `TopHeader.stories.tsx`, `DashboardLayout.stories.tsx`,
  `MyMusicContent.stories.tsx`, `MyAlbums.stories.tsx`,
  `MerchesContent.stories.tsx`

### Writing a story

Match the existing pattern — a typed `Meta`, a default export, and one named
export per meaningful visual state:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import Input from "./Input";

const meta: Meta<typeof Input> = {
  title: "Common/Input",     // groups the story in the sidebar
  component: Input,
  tags: ["autodocs"],        // generates a Docs page from props + JSDoc
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "Email", placeholder: "you@example.com" } };
export const WithError: Story = { args: { label: "Email", error: "Required" } };
export const Disabled: Story = { args: { label: "Email", disabled: true } };
```

Guidelines:

- **Add a story for any new component with meaningful visual states** — this is
  part of the contribution checklist in
  [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- Use `tags: ["autodocs"]` so an auto-generated Docs page appears; `react-docgen`
  is configured, so typed props and doc comments are picked up automatically.
- Cover the states a reviewer needs to see: default, empty, loading, error,
  and permission-restricted variants where they exist.
- `.storybook/preview.ts` registers **Mobile (375×667)**, **Tablet
  (768×1024)**, and **Desktop (1440×900)** viewports — use the toolbar
  viewport switcher to check responsive behaviour.
- Interactive flows can be scripted with a `play` function via
  `@storybook/addon-interactions`.
- `npm run chromatic` publishes the build to Chromatic for visual regression
  review when a project token is configured.

---

## 4. Onboarding for new developers

A start-to-finish path for someone opening this codebase for the first time.
It expands on the quick setup in [`CONTRIBUTING.md`](../CONTRIBUTING.md) and
[`app/README.md`](../app/README.md).

### Step 1 — Prerequisites

- **Node.js 20.x** and npm (CI and the Docker images use Node 20).
- **Git**, and a GitHub account with a fork of this repo.
- **Freighter** browser extension — needed to exercise wallet connect / signing
  flows.
- Access to a running **`AudioBlock_Backend`**, or plan to use
  `NEXT_PUBLIC_USE_MOCK_DATA=true`. Without one, only static pages render.

### Step 2 — Get the code

```bash
git clone https://github.com/<your-username>/AudioBlocks_For_Artist.git
cd AudioBlocks_For_Artist
git remote add upstream https://github.com/AudioBitsStellar/AudioBlocks_For_Artist.git
```

### Step 3 — Install and configure

```bash
cd app                 # the Next.js project root — NOT the repo root
npm install
cp .env.example .env.local
```

Edit `.env.local`: set `NEXT_PUBLIC_API_BASE_URL` to your backend, or set
`NEXT_PUBLIC_USE_MOCK_DATA=true` to run against bundled fixtures. See
[section 1](#1-environment-variables) for every variable.

### Step 4 — Run it

```bash
npm run dev            # http://localhost:3000
```

Other commands (all from `app/`):

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (must be clean before a PR) |
| `npm run format` | Prettier write |
| `npm run test` | Vitest (watch); `npm run test:coverage` for one-shot |
| `npm run test:e2e` | Playwright E2E |
| `npm run storybook` | Component workshop on :6006 |

### Step 5 — Learn the layout

```
app/src/
├── app/            # App Router routes: login/, signup/, dashboard/{overview,my-music,upload-music,events,merches,profile}
├── api/            # axios client, React Query hook factories, endpoint registry
├── components/     # UI — common/ primitives, common/wallet/ on-chain actions, musicUpload/, dashboard widgets
│   └── shared/     # reusable dialogs/badges — check here before building a one-off
├── context/        # React context providers (React Query, playback, role)
├── hooks/          # custom hooks (toasts, API handlers)
├── services/       # authService, artistServices, upload + on-chain service wrappers
├── lib/freighter.ts# thin wrapper over @stellar/freighter-api
├── types/          # shared request/response types
└── __tests__/      # unit + integration tests
```

Deeper background lives in `app/README.md` (architecture, the on-chain
sign/submit flow, the chunked song-upload pipeline) and the topic docs:
`app/TESTING.md`, `app/src/context/RBAC.md`, `app/src/lib/ANALYTICS.md`,
`app/public/SERVICE_WORKER.md`, and the accessibility reports
(`app/ACCESSIBILITY_ISSUES.md`, `app/WCAG_2.1_AA_AUDIT_REPORT.md`).

### Step 6 — Make a change

1. **Pick an issue** and get it assigned to you before starting.
2. **Branch** from an up-to-date `main`, using the repo's type prefixes:
   ```bash
   git fetch upstream && git checkout -b feat/<short-description> upstream/main
   ```
   Prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`.
3. **Write the change** following `CONTRIBUTING.md` coding standards — strict
   TypeScript (no `any`), functional components, Tailwind utilities matching
   the dark theme, and accessible interactive elements.
4. **Add tests** for new behavior (Vitest + React Testing Library) and a
   `.stories.tsx` for a component with visual states.
5. **Check locally** before pushing:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run test:coverage
   ```
6. **Commit** with the same type prefix and an imperative summary
   (`docs: add project guide`), keeping commits focused.

### Step 7 — Open the PR

```bash
git push -u origin <your-branch>
```

Open a PR targeting `AudioBitsStellar/AudioBlocks_For_Artist:main`. Fill out
`.github/pull_request_template.md` in full, link the issues it resolves
(`Closes #123`), and make sure the checklist (tests pass, lint clean,
accessibility checked, no console errors, performance considered) genuinely
holds. CI runs lint, type-check, unit tests, and E2E on the PR.

### Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Requests 404 / hit `localhost:3000/api` | `NEXT_PUBLIC_API_BASE_URL` unset in `.env.local` |
| Only static pages load, dashboard data empty | No backend reachable; set the API URL or `NEXT_PUBLIC_USE_MOCK_DATA=true` |
| `npm install` peer-dependency errors | Use Node 20; retry with `npm install --legacy-peer-deps` |
| Wallet actions do nothing | Freighter not installed, or network passphrase mismatch between `.env.local`, backend, and the extension |
| Docker prod build fails at `COPY .next/standalone` | `output: "standalone"` missing from `app/next.config.ts` |
