# Testing Strategy & Guide

This app tests at four layers: unit, component, integration, and end-to-end.
`CONTRIBUTING.md` covers the basics (where tests live, run commands); this
doc goes deeper on *when to use which layer* and *how to write one*.

## The layers

| Layer           | Tool                              | File pattern                          | What it covers                                                      |
| ---------------- | ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Unit            | Vitest                            | `*.test.ts`                           | Pure functions, services, hooks in isolation — no rendered DOM needed for non-React modules. |
| Component       | Vitest + React Testing Library    | `*.test.tsx`                          | A single component's rendered output and interactions, with dependencies mocked. |
| Integration     | Vitest + React Testing Library    | `*.integration.test.tsx`              | A component wired to real providers (React Query, etc.) against a mocked API layer, exercising the actual data-fetching path. |
| End-to-end (E2E) | Playwright                        | `e2e/*.spec.ts`                       | A full user flow in a real browser against the running Next.js app, with network calls intercepted via `page.route()`. |
| Accessibility   | Vitest + `vitest-axe`             | e.g. `*Accessibility.test.tsx`        | Automated a11y violation checks (`toHaveNoViolations()`) layered on top of component tests. |

Rule of thumb: reach for the *lowest* layer that can actually catch the bug.
A pure function bug belongs in a unit test, not an E2E flow — it's faster to
run and pinpoints the failure precisely. Reach for integration/E2E when the
bug is in how pieces are wired together (a component + its data fetching, or
a multi-page flow), not in any one piece's logic.

## Running tests

All commands run from `app/`:

```bash
npm test               # Vitest, watch mode (unit + component + integration)
npm run test:coverage  # Vitest, one-shot run with coverage
npm run test:e2e       # Playwright E2E suite
npm run test:ui        # Vitest's interactive UI
```

E2E tests need Playwright's browser binary installed once:
`npx playwright install chromium` (see the header comment in
`e2e/auth.spec.ts`).

## File location

Either co-located next to the code (e.g.
`src/app/dashboard/overview/overview.test.tsx`) or grouped under
`src/__tests__/` (e.g. `src/__tests__/authService.test.ts`) — both exist in
this codebase. Match whatever's already next to the code you're touching;
don't move existing tests to "fix" the inconsistency as a drive-by.

## Writing each layer

### Unit tests (services, hooks, utils)

Mock the module's actual dependencies (API hooks, external libraries), not
the module under test. See `src/__tests__/authService.test.ts`: it mocks
`@/api/queryClient`'s `usePost` and `@/hooks/useToastHandler`, then asserts
on the real `authService` functions (`storeToken`, `isTokenExpired`, etc.)
and `renderHook`/`act` for the hook parts.

### Component tests

Render the component with React Testing Library and mock anything it pulls
from context or the network. If the component reads `RoleContext` and/or
React Query, wrap it the same way `src/__tests__/TopHeader.test.tsx` does —
a small `renderX()` helper that composes `QueryClientProvider` and, when
needed, `<RoleProvider initialRole={...}>`, with a `wrapper` option to
render once per role under test. Reuse that helper pattern instead of
inventing a new one — see [RBAC.md](src/context/RBAC.md) for what
`RoleProvider`/`useRole()` actually provide.

### Integration tests (`*.integration.test.tsx`)

For a component that fetches its own data, mock at the API-client boundary
(`@/api/axios`'s `createApiClient`) rather than mocking the component's own
hooks — that way the test exercises the real React Query + axios wiring, not
just the component's render logic. See
`src/__tests__/EarningsRoyalties.integration.test.tsx`: it uses
`vi.hoisted()` to declare a `mockGet` before `vi.mock("@/api/axios", ...)`
references it (required because `vi.mock` factories are hoisted above
normal `const` declarations), returns a fixed JSON payload from the mocked
`get`, and asserts the component renders data derived from that payload
inside a real `QueryClientProvider`.

### E2E tests (Playwright)

Mock the backend at the network boundary with `page.route()`, matching the
actual request shape from the relevant service file (see
`e2e/auth.spec.ts`'s header comment, which documents the exact
`authService.ts`/`axios.ts` request shape it mocks: base URL,
endpoint paths, and response body). Assert on user-visible outcomes
(redirected URL, rendered text) rather than implementation details. New E2E
specs go in `e2e/` and are picked up automatically by
`playwright.config.ts` (`testDir: "./e2e"`).

### Accessibility tests

Use the `toHaveNoViolations()` matcher from `vitest-axe`, registered
globally in `src/test/setup.ts`. See
`src/__tests__/FormAccessibility.test.tsx` and
`src/__tests__/DashboardAccessibility.test.tsx` for the pattern: render the
component, run axe against the container, assert no violations. New
interactive components should get a matching a11y test — see
`CONTRIBUTING.md`'s Accessibility section and `app/ACCESSIBILITY_ISSUES.md`
for the broader a11y bar this project holds itself to.

## Conventions

- **Mocking**: `vi.mock()` at the top of the file for module-level mocks;
  `vi.hoisted()` when the mock factory needs to reference a variable
  declared before it (Vitest hoists `vi.mock` calls above normal imports).
- **Cleanup**: reset mocks and any global state (`localStorage`,
  `document.documentElement` classes, cookies) in `beforeEach`/`afterEach` —
  see the top of `TopHeader.test.tsx` and `authService.test.ts` for the
  pattern.
- **New behavior needs a test.** Bug fixes should include a test that
  reproduces the bug before the fix and passes after.
- Run `npm run lint` before opening a PR — the CI-equivalent bar, not
  optional (see `CONTRIBUTING.md`).

## CI

`.github/workflows/ci.yml` and `.github/workflows/e2e.yml` run the Vitest
and Playwright suites respectively on PRs — a red CI check on either
workflow means one of the layers above caught something; check which job
failed to know which layer to look at first.
